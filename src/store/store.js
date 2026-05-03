import { configureStore } from '@reduxjs/toolkit'
import appReducer from './appSlice'
import stockReducer from './stockSlice'

export const store = configureStore({
  reducer: {
    app: appReducer,
    stock: stockReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // lastSync is a Date object
        ignoredPaths: ['app.lastSync'],
        ignoredActions: ['app/setLastSync', 'app/setSyncing'],
      },
    }),
})
