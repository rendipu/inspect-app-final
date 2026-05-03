import { createSlice } from '@reduxjs/toolkit'

const emptyData = {
  users: [],
  units: [],
  questions: [],
  schedules: [],
  inspections: [],
  recurring: [],
}

const appSlice = createSlice({
  name: 'app',
  initialState: {
    data: null,
    loading: true,
    error: null,
    syncing: false,
    lastSync: new Date().toISOString(),
    online: true,
    rtStatus: 'connecting',
  },
  reducers: {
    setData(state, action) {
      state.data = action.payload
      state.error = null
      state.online = true
      state.lastSync = new Date().toISOString()
    },
    setLoading(state, action) {
      state.loading = action.payload
    },
    setError(state, action) {
      state.error = action.payload
      state.online = false
    },
    setSyncing(state, action) {
      state.syncing = action.payload
    },
    setOnline(state, action) {
      state.online = action.payload
    },
    setRtStatus(state, action) {
      state.rtStatus = action.payload
    },
    mutateData(state, action) {
      if (!state.data) return
      if (typeof action.payload === 'function') {
        // For function updaters, we pass the data directly
        // Note: RTK uses Immer, so we can mutate
        const result = action.payload(state.data)
        if (result) state.data = result
      } else {
        state.data = action.payload
      }
    },
    clearAll(state) {
      state.data = null
      state.loading = true
      state.error = null
    },
  },
})

export const {
  setData,
  setLoading,
  setError,
  setSyncing,
  setOnline,
  setRtStatus,
  mutateData,
  clearAll,
} = appSlice.actions

// ── Selectors ────────────────────────────────────────────────────────
export const selectData = (state) => state.app.data
export const selectSafeData = (state) => state.app.data || emptyData
export const selectLoading = (state) => state.app.loading
export const selectError = (state) => state.app.error
export const selectSyncing = (state) => state.app.syncing
export const selectOnline = (state) => state.app.online
export const selectRtStatus = (state) => state.app.rtStatus
export const selectLastSync = (state) => state.app.lastSync

export default appSlice.reducer
