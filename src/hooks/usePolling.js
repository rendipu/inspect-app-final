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
  const pollingRef = useRef(null)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

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

  useEffect(() => {
    if (!enabled) return

    fetchAll(false)

    pollingRef.current = setInterval(() => fetchAll(true), interval)

    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchAll(true)
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(pollingRef.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, fetchAll, interval])

  const mutate = useCallback((updater) => {
    setData(prev => {
      if (!prev) return prev
      return typeof updater === 'function' ? updater(prev) : updater
    })
  }, [])

  const refetch = useCallback(() => fetchAll(true), [fetchAll])

  return { data, loading, error, syncing, lastSync, mutate, refetch, online }
}
