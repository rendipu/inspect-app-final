// src/hooks/usePolling.js
// Hook data fetching dengan dua mode:
// 1. SSE (realtime) — koneksi EventSource ke /api/sse, trigger refetch saat ada event
// 2. Polling fallback — interval 15 detik jika SSE tidak tersedia

import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../lib/api'

export function usePolling(interval = 15000, enabled = true) {
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [syncing,  setSyncing]  = useState(false)
  const [lastSync, setLastSync] = useState(new Date())
  const [online,   setOnline]   = useState(true)

  const isMounted  = useRef(true)
  const esRef      = useRef(null)
  const retryRef   = useRef(0)
  const pollingRef = useRef(null)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  // ── Fetch semua data ──────────────────────────────────────────────────
  const fetchAll = useCallback(async (silent = false) => {
    if (!enabled) return
    try {
      if (!silent) setLoading(true)
      else setSyncing(true)

      const [users, unitsRes, questions, schedules, inspRes, recurring] = await Promise.all([
        api.getUsers().catch(() => []),
        api.getUnits(),
        api.getQuestions(),
        api.getTodaySchedule(),
        api.getInspections(),
        api.getRecurringSchedules().catch(() => []),
      ])

      if (!isMounted.current) return

      // Handle pagination response dari MongoDB API
      const units       = Array.isArray(unitsRes) ? unitsRes : (unitsRes.data || [])
      const inspections = Array.isArray(inspRes)  ? inspRes  : (inspRes.data  || [])

      setData({ users, units, questions, schedules, inspections, recurring })
      setLastSync(new Date())
      setError(null)
      setOnline(true)
    } catch (err) {
      if (!isMounted.current) return
      setError(err.message)
      setOnline(false)
    } finally {
      if (!isMounted.current) return
      setLoading(false)
      setSyncing(false)
    }
  }, [enabled])

  // ── SSE realtime connection ───────────────────────────────────────────
  const connectSSE = useCallback(() => {
    const token = localStorage.getItem('inspect_token')
    if (!token || !enabled) return

    if (esRef.current) esRef.current.close()

    const es = new EventSource(`/api/sse?token=${token}`)
    esRef.current = es

    es.addEventListener('connected', () => {
      retryRef.current = 0
      // Fetch fresh data saat SSE terhubung
      fetchAll(true)
    })

    // Trigger refetch saat ada event baru
    const triggerRefetch = () => fetchAll(true)
    es.addEventListener('inspection_created',  triggerRefetch)
    es.addEventListener('work_status_updated', triggerRefetch)
    es.addEventListener('order_status_updated', triggerRefetch)

    // Stock low — hanya dispatch event, tidak perlu refetch seluruh data
    es.addEventListener('stock_low', (e) => {
      try {
        const detail = JSON.parse(e.data)
        window.dispatchEvent(new CustomEvent('stock_low', { detail }))
      } catch {}
    })

    es.onerror = () => {
      es.close()
      esRef.current = null
      // Reconnect exponential backoff
      const delay = Math.min(2000 * Math.pow(2, retryRef.current++), 30000)
      setTimeout(connectSSE, delay)
    }
  }, [enabled, fetchAll])

  // ── Setup SSE + polling fallback ──────────────────────────────────────
  useEffect(() => {
    if (!enabled) return

    // Initial fetch
    fetchAll(false)

    // Setup SSE
    connectSSE()

    // Polling fallback (tetap jalan untuk antisipasi SSE putus)
    pollingRef.current = setInterval(() => fetchAll(true), interval)

    // Reconnect SSE saat tab kembali aktif
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        if (!esRef.current || esRef.current.readyState === EventSource.CLOSED) {
          connectSSE()
        }
        fetchAll(true)
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(pollingRef.current)
      document.removeEventListener('visibilitychange', onVisible)
      if (esRef.current) {
        esRef.current.close()
        esRef.current = null
      }
    }
  }, [enabled, fetchAll, connectSSE, interval])

  // ── Helpers ───────────────────────────────────────────────────────────
  const mutate = useCallback((updater) => {
    setData(prev => {
      if (!prev) return prev
      return typeof updater === 'function' ? updater(prev) : updater
    })
  }, [])

  const refetch = useCallback(() => fetchAll(true), [fetchAll])

  return { data, loading, error, syncing, lastSync, mutate, refetch, online }
}
