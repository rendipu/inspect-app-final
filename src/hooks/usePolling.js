import { useState, useEffect, useCallback, useRef } from 'react'
import Pusher from 'pusher-js'
import { api } from '../lib/api'

const PUSHER_KEY     = import.meta.env.VITE_PUSHER_KEY
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER || 'mt1'
const CHANNEL_NAME   = 'inspect-channel'

export function usePolling(interval = 15000, enabled = true) {
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [syncing,  setSyncing]  = useState(false)
  const [lastSync, setLastSync] = useState(new Date())
  const [online,   setOnline]   = useState(true)
  const [rtStatus, setRtStatus] = useState('connecting') // connecting | connected | unavailable

  const isMounted  = useRef(true)
  const pollingRef = useRef(null)
  const pusherRef  = useRef(null)
  const channelRef = useRef(null)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  // ── Fetch semua data ──────────────────────────────────────────────
  const fetchAll = useCallback(async (silent = false) => {
    if (!enabled) return
    try {
      if (!silent) setLoading(true)
      else setSyncing(true)

      const getLocalYMD = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]

      const [users, unitsRes, questions, schedules, inspRes, recurring] = await Promise.all([
        api.getUsers().catch(() => []),
        api.getUnits(),
        api.getQuestions(),
        api.getTodaySchedule(getLocalYMD()),
        api.getInspections(),
        api.getRecurringSchedules().catch(() => []),
      ])

      if (!isMounted.current) return

      const units       = Array.isArray(unitsRes) ? unitsRes : (unitsRes?.data || [])
      const inspections = Array.isArray(inspRes)  ? inspRes  : (inspRes?.data  || [])

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

  const setupPusher = useCallback(() => {
    if (!PUSHER_KEY || !enabled) {
      if (isMounted.current) setRtStatus('unavailable')
      return
    }

    // Bersihkan koneksi lama
    if (pusherRef.current) {
      pusherRef.current.disconnect()
      pusherRef.current = null
    }

    const pusher = new Pusher(PUSHER_KEY, {
      cluster:       PUSHER_CLUSTER,
      forceTLS:      true,
    })
    pusherRef.current = pusher

    // Timeout jika koneksi nyangkut lebih dari 10 detik (misal diblokir provider HP)
    const connTimeout = setTimeout(() => {
      if (pusher.connection.state === 'connecting' && isMounted.current) {
        setRtStatus('unavailable')
      }
    }, 10000)

    pusher.connection.bind('connected', () => { 
      clearTimeout(connTimeout)
      if (isMounted.current) setRtStatus('connected')   
    })
    pusher.connection.bind('unavailable',  () => { if (isMounted.current) setRtStatus('unavailable') })
    pusher.connection.bind('disconnected', () => { if (isMounted.current) setRtStatus('connecting')  })
    pusher.connection.bind('failed',       () => { if (isMounted.current) setRtStatus('unavailable') })

    // Subscribe ke channel
    const channel = pusher.subscribe(CHANNEL_NAME)
    channelRef.current = channel

    // Event handlers — refetch saat ada perubahan
    const onUpdate = () => fetchAll(true)
    channel.bind('inspection_created',   onUpdate)
    channel.bind('work_status_updated',  onUpdate)
    channel.bind('order_status_updated', onUpdate)
    channel.bind('hm_updated',           onUpdate)
  }, [enabled, fetchAll])

  // ── Setup polling + Pusher ────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return

    // Initial fetch
    fetchAll(false)

    // Setup Pusher untuk real-time
    setupPusher()

    // Polling sebagai fallback jika Pusher tidak tersedia
    pollingRef.current = setInterval(() => fetchAll(true), interval)

    // Refetch saat tab aktif kembali
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchAll(true)
        // Paksa Pusher untuk reconnect jika layarnya baru nyala dari sleep di HP
        if (pusherRef.current && pusherRef.current.connection.state !== 'connected') {
          pusherRef.current.connect()
        }
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(pollingRef.current)
      document.removeEventListener('visibilitychange', onVisible)
      if (channelRef.current) channelRef.current.unbind_all()
      if (pusherRef.current)  pusherRef.current.disconnect()
    }
  }, [enabled, fetchAll, setupPusher, interval])

  const mutate = useCallback((updater) => {
    setData(prev => {
      if (!prev) return prev
      return typeof updater === 'function' ? updater(prev) : updater
    })
  }, [])

  const refetch = useCallback(() => fetchAll(true), [fetchAll])

  return { data, loading, error, syncing, lastSync, mutate, refetch, online, rtStatus }
}