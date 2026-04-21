import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type {
  AdminDashboardActivity,
  AdminDashboardLiveVehicle,
  DashboardAnalytics,
} from '../types'

interface AdminDashboardState {
  dashboardStats: DashboardAnalytics | null
  liveVehicles: AdminDashboardLiveVehicle[]
  recentActivities: AdminDashboardActivity[]
}

const initialState: AdminDashboardState = {
  dashboardStats: null,
  liveVehicles: [],
  recentActivities: [],
}

const adminDashboardSlice = createSlice({
  name: 'adminDashboard',
  initialState,
  reducers: {
    setDashboardStats(state, action: PayloadAction<DashboardAnalytics | null>) {
      state.dashboardStats = action.payload
    },
    setLiveVehicles(state, action: PayloadAction<AdminDashboardLiveVehicle[]>) {
      state.liveVehicles = action.payload
    },
    setRecentActivities(state, action: PayloadAction<AdminDashboardActivity[]>) {
      state.recentActivities = action.payload
    },
    setDashboardSnapshot(
      state,
      action: PayloadAction<{
        dashboardStats: DashboardAnalytics | null
        liveVehicles: AdminDashboardLiveVehicle[]
        recentActivities: AdminDashboardActivity[]
      }>,
    ) {
      state.dashboardStats = action.payload.dashboardStats
      state.liveVehicles = action.payload.liveVehicles
      state.recentActivities = action.payload.recentActivities
    },
  },
})

export const {
  setDashboardSnapshot,
  setDashboardStats,
  setLiveVehicles,
  setRecentActivities,
} = adminDashboardSlice.actions

export const adminDashboardReducer = adminDashboardSlice.reducer
