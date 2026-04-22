import { configureStore } from '@reduxjs/toolkit'
import { adminDashboardReducer } from './adminDashboardSlice'
import { tripExecutionReducer } from './tripExecutionSlice'
import { tripReducer } from './tripSlice'

export const store = configureStore({
  reducer: {
    adminDashboard: adminDashboardReducer,
    trip: tripReducer,
    tripExecution: tripExecutionReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
