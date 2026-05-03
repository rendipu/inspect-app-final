import { useEffect, useCallback, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Pusher from 'pusher-js'
import { api } from '../lib/api'
import {
  setData,
  setLoading,
  setError,
  setSyncing,
  setOnline,
  setRtStatus,
  mutateData,
  selectData,
  selectLoading,
  selectError,
  selectSyncing,
  selectLastSync,
  selectOnline,
  selectRtStatus,
} from '../store/appSlice'

Pusher.logToConsole = true;

const PUSHER_KEY     = import.meta.env.VITE_PUSHER_KEY
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER || 'mt1'
const CHANNEL_NAME   = 'inspect-channel'

// Singleton Pusher di luar React — tidak terpengaruh StrictMode double-mount
let globalPusher   = null
let globalChannel  = null
let globalRefCount = 0

function getOrCreatePusher() {
  if (!globalPusher || globalPusher.connection.state === 'disconnected' || globalPusher.connection.state === 'failed') {
    if (globalPusher) {
      try { globalPusher.disconnect() } catch (_) {}
    }
    globalPusher = new Pusher(PUSHER_KEY, {
      cluster:  PUSHER_CLUSTER,
      forceTLS: true,
    })
    globalChannel = globalPusher.subscribe(CHANNEL_NAME)
  }
  return { pusher: globalPusher, channel: globalChannel }
}

function destroyPusher() {
  if (globalPusher) {
    try {
      if (globalChannel) globalChannel.unbind_all()
      globalPusher.connection.unbind_all()
      globalPusher.disconnect()
    } catch (_) {}
    globalPusher  = null
    globalChannel = null
  }
}

export function usePolling(interval = 15000, enabled = true) {
  const dispatch = useDispatch()

  // Read from Redux store
  const data     = useSelector(selectData)
  const loading  = useSelector(selectLoading)
  const error    = useSelector(selectError)
  const syncing  = useSelector(selectSyncing)
  const lastSync = useSelector(selectLastSync)
  const online   = useSelector(selectOnline)
  const rtStatus = useSelector(selectRtStatus)

  const isMounted   = useRef(true)
  const pollingRef  = useRef(null)
  const fetchAllRef = useRef(null)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  // ── Fetch semua data ──────────────────────────────────────────────
  const fetchAll = useCallback(async (silent = false) => {
    if (!enabled) return
    try {
      if (!silent) dispatch(setLoading(true))
      else dispatch(setSyncing(true))

      const getLocalYMD = (d = new Date()) =>
        new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]

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

      dispatch(setData({ users, units, questions, schedules, inspections, recurring }))
    } catch (err) {
      if (!isMounted.current) return
      dispatch(setError(err.message))
    } finally {
      if (!isMounted.current) return
      dispatch(setLoading(false))
      dispatch(setSyncing(false))
    }
  }, [enabled, dispatch])

  fetchAllRef.current = fetchAll

  // ── Setup Pusher (singleton — aman dari StrictMode double-mount) ──
  useEffect(() => {
    if (!enabled || !PUSHER_KEY) {
      if (!PUSHER_KEY) dispatch(setRtStatus('unavailable'))
      return
    }

    globalRefCount++
    const { pusher, channel } = getOrCreatePusher()

    // Sync status awal
    const currentState = pusher.connection.state
    if (currentState === 'connected') {
      dispatch(setRtStatus('connected'))
    } else if (currentState === 'connecting' || currentState === 'initialized') {
      dispatch(setRtStatus('connecting'))
    }

    const onStateChange = ({ current: s }) => {
      if (!isMounted.current) return
      console.log('[RT Status Updated]', s)
      if (s === 'connected')                       dispatch(setRtStatus('connected'))
      else if (s === 'unavailable' || s === 'failed') dispatch(setRtStatus('unavailable'))
      else                                          dispatch(setRtStatus('connecting'))
    }

    pusher.connection.bind('state_change', onStateChange)

    channel.bind('pusher:subscription_succeeded', () => {
      console.log('[Pusher] Subscription succeeded for', CHANNEL_NAME)
    })

    const onUpdate = () => fetchAllRef.current?.(true)
    channel.bind('inspection_created',   onUpdate)
    channel.bind('work_status_updated',  onUpdate)
    channel.bind('order_status_updated', onUpdate)
    channel.bind('hm_updated',           onUpdate)

    // Timeout fallback jika Pusher tidak bisa connect dalam 10 detik
    const connTimeout = setTimeout(() => {
      if (pusher.connection.state !== 'connected' && isMounted.current) {
        dispatch(setRtStatus('unavailable'))
      }
    }, 10000)

    return () => {
      clearTimeout(connTimeout)
      pusher.connection.unbind('state_change', onStateChange)
      channel.unbind('inspection_created',   onUpdate)
      channel.unbind('work_status_updated',  onUpdate)
      channel.unbind('order_status_updated', onUpdate)
      channel.unbind('hm_updated',           onUpdate)
      channel.unbind('pusher:subscription_succeeded')

      globalRefCount--
      // Hanya destroy saat tidak ada lagi consumer (bukan cleanup StrictMode sementara)
      if (globalRefCount <= 0) {
        globalRefCount = 0
        destroyPusher()
      }
    }
  }, [enabled, dispatch])

  // ── Polling + visibilitychange ────────────────────────────────────
  useEffect(() => {
    if (!enabled) return

    fetchAll(false)
    pollingRef.current = setInterval(() => fetchAllRef.current?.(true), interval)

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchAllRef.current?.(true)
        if (globalPusher && globalPusher.connection.state !== 'connected') {
          globalPusher.connect()
        }
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(pollingRef.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, interval, fetchAll])

  const mutate = useCallback((updater) => {
    dispatch(mutateData(updater))
  }, [dispatch])

  const refetch = useCallback(() => fetchAllRef.current?.(true), [])

  return { data, loading, error, syncing, lastSync, mutate, refetch, online, rtStatus }
}
