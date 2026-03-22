import { useState, useEffect, useCallback, useRef } from 'react'
import Pusher from 'pusher-js'
import { api } from '../lib/api'

Pusher.logToConsole = true;

const PUSHER_KEY     = import.meta.env.VITE_PUSHER_KEY
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER || 'mt1'
const CHANNEL_NAME   = 'inspect-channel-prod'

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
  // Simpan fetchAll di ref agar setupPusher tidak perlu fetchAll sebagai dependency
  const fetchAllRef = useRef(null)

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

  // Selalu update ref ke versi terbaru fetchAll tanpa memicu re-render
  fetchAllRef.current = fetchAll

  // ── Setup Pusher — hanya jalan SEKALI saat mount ──────────────────
  useEffect(() => {
    if (!enabled) return

    if (!PUSHER_KEY) {
      setRtStatus('unavailable')
      return
    }

    const pusher = new Pusher(PUSHER_KEY, {
      cluster:  PUSHER_CLUSTER,
      forceTLS: true,
    })
    pusherRef.current = pusher

    // Timeout jika koneksi nyangkut lebih dari 10 detik
    const connTimeout = setTimeout(() => {
      if (pusher.connection.state === 'connecting' && isMounted.current) {
        setRtStatus('unavailable')
      }
    }, 10000)

    pusher.connection.bind('state_change', (states) => {
      if (!isMounted.current) return
      const s = states.current
      console.log('[RT Status Updated]', s)
      if (s === 'connected') {
        clearTimeout(connTimeout)
        setRtStatus('connected')
      } else if (s === 'unavailable' || s === 'failed') {
        setRtStatus('unavailable')
      } else if (s === 'connecting' || s === 'disconnected') {
        setRtStatus('connecting')
      }
    })

    // Cek jika Pusher sudah connected sebelum listener terpasang (race condition)
    if (pusher.connection.state === 'connected') {
      clearTimeout(connTimeout)
      setRtStatus('connected')
    }

    const channel = pusher.subscribe(CHANNEL_NAME)
    channelRef.current = channel

    channel.bind('pusher:subscription_succeeded', () => {
      console.log('[Pusher] Subscription succeeded for', CHANNEL_NAME)
    })

    // Gunakan ref agar event handler tidak perlu di-rebind saat fetchAll berubah
    const onUpdate = () => fetchAllRef.current?.(true)
    channel.bind('inspection_created',   onUpdate)
    channel.bind('work_status_updated',  onUpdate)
    channel.bind('order_status_updated', onUpdate)
    channel.bind('hm_updated',           onUpdate)

    return () => {
      clearTimeout(connTimeout)
      if (channelRef.current) channelRef.current.unbind_all()
      if (pusherRef.current) {
        pusherRef.current.connection.unbind_all()
        pusherRef.current.disconnect()
        pusherRef.current = null
      }
    }
  }, [enabled]) // ← hanya enabled, tidak bergantung pada fetchAll/setupPusher

  // ── Setup polling + visibilitychange ─────────────────────────────
  useEffect(() => {
    if (!enabled) return

    // Initial fetch
    fetchAll(false)

    // Polling fallback
    pollingRef.current = setInterval(() => fetchAllRef.current?.(true), interval)

    // Refetch saat tab aktif kembali
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchAllRef.current?.(true)
        if (pusherRef.current && pusherRef.current.connection.state !== 'connected') {
          pusherRef.current.connect()
        }
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(pollingRef.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, interval]) // ← fetchAll dihapus dari deps, pakai ref

  const mutate = useCallback((updater) => {
    setData(prev => {
      if (!prev) return prev
      return typeof updater === 'function' ? updater(prev) : updater
    })
  }, [])

  const refetch = useCallback(() => fetchAllRef.current?.(true), [])

  return { data, loading, error, syncing, lastSync, mutate, refetch, online, rtStatus }
}
