import { configureStore, combineReducers } from '@reduxjs/toolkit'
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist'
import storage from 'redux-persist/lib/storage'
import appReducer from './appSlice'
import stockReducer from './stockSlice'

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['app', 'stock'], // persist both app and stock slices
}

const rootReducer = combineReducers({
  app: appReducer,
  stock: stockReducer,
})

const persistedReducer = persistReducer(persistConfig, rootReducer)

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER, 'app/setLastSync', 'app/setSyncing'],
      },
    }),
})

export const persistor = persistStore(store)
