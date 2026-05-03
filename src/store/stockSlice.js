import { createSlice } from '@reduxjs/toolkit'

const stockSlice = createSlice({
  name: 'stock',
  initialState: {
    stocks: [],
    loading: true,
    error: null,
    lastFetched: null, // timestamp — skip refetch jika data belum berubah
  },
  reducers: {
    setStocks(state, action) {
      state.stocks = action.payload
      state.error = null
      state.lastFetched = Date.now()
    },
    setStockLoading(state, action) {
      state.loading = action.payload
    },
    setStockError(state, action) {
      state.error = action.payload
    },
    invalidateStock(state) {
      // Dipanggil setelah create/update/delete/movement — force refetch berikutnya
      state.lastFetched = null
    },
  },
})

export const {
  setStocks,
  setStockLoading,
  setStockError,
  invalidateStock,
} = stockSlice.actions

export const selectStocks     = (state) => state.stock.stocks
export const selectStockLoading = (state) => state.stock.loading
export const selectStockError   = (state) => state.stock.error
export const selectStockLastFetched = (state) => state.stock.lastFetched

export default stockSlice.reducer
