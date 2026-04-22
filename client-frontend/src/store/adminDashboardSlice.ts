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
  selectedVehicleId: string | null
}

const initialState: AdminDashboardState = {
  dashboardStats: null,
  liveVehicles: [],
  recentActivities: [],
  selectedVehicleId: null,
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
    setSelectedVehicleId(state, action: PayloadAction<string | null>) {
      state.selectedVehicleId = action.payload
    },
    resetSelectedVehicleId(state) {
      state.selectedVehicleId = null
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
  setSelectedVehicleId,
  resetSelectedVehicleId,
} = adminDashboardSlice.actions

export const adminDashboardReducer = adminDashboardSlice.reducer
