import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { api } from '../lib/api'
import { selectOfflineQueue, selectOnline, removeQueueItem } from '../store/appSlice'

export function useSyncOfflineQueue() {
  const dispatch = useDispatch()
  const offlineQueue = useSelector(selectOfflineQueue)
  const isOnline = useSelector(selectOnline)
  const isSyncing = useRef(false)

  useEffect(() => {
    // Jalankan hanya ketika device sedang online dan ada item antrean
    const currentQueue = offlineQueue || []
    if (!isOnline || currentQueue.length === 0 || isSyncing.current) return

    const syncQueue = async () => {
      isSyncing.current = true
      
      // Salin queue untuk mencegah mutation conflict
      const queue = [...currentQueue]
      
      for (const item of queue) {
        try {
          // Pilih endpoint API berdasarkan tipe mutasi
          if (item.type === 'CREATE_INSPECTION') {
            await api.createInspection(item.data)
          } else if (item.type === 'UPDATE_HM') {
            await api.updateHourMeter(item.data)
          } else if (item.type === 'UPDATE_WORK_STATUS') {
            await api.updateWorkStatus(item.data.detailId, item.data.type, { work_status: item.data.newStatus })
          } else if (item.type === 'CREATE_STOCK') {
             await api.createStock(item.data)
          }

          console.log(`[Offline Sync] Sukses mengirim: ${item.type}`)
          // Hapus item dari queue jika sukses
          dispatch(removeQueueItem(item.id))
        } catch (err) {
          console.error(`[Offline Sync] Gagal mengirim: ${item.type}`, err)
          // Berhenti sinkronisasi sisa antrean jika terjadi error jaringan (biarkan dicoba nanti)
          break
        }
      }

      isSyncing.current = false
    }

    syncQueue()

  }, [isOnline, offlineQueue, dispatch])
}
