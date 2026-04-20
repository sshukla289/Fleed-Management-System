import { create } from 'zustand'
import type {
  AdminDashboardActivity,
  AdminDashboardLiveVehicle,
  DashboardAnalytics,
} from '../types'

interface AdminDashboardState {
  dashboardStats: DashboardAnalytics | null
  liveVehicles: AdminDashboardLiveVehicle[]
  recentActivities: AdminDashboardActivity[]
  setDashboardStats: (dashboardStats: DashboardAnalytics | null) => void
  setLiveVehicles: (liveVehicles: AdminDashboardLiveVehicle[]) => void
  setRecentActivities: (recentActivities: AdminDashboardActivity[]) => void
  setDashboardSnapshot: (snapshot: {
    dashboardStats: DashboardAnalytics | null
    liveVehicles: AdminDashboardLiveVehicle[]
    recentActivities: AdminDashboardActivity[]
  }) => void
}

export const useAdminDashboardStore = create<AdminDashboardState>((set) => ({
  dashboardStats: null,
  liveVehicles: [],
  recentActivities: [],
  setDashboardStats: (dashboardStats) => set({ dashboardStats }),
  setLiveVehicles: (liveVehicles) => set({ liveVehicles }),
  setRecentActivities: (recentActivities) => set({ recentActivities }),
  setDashboardSnapshot: (snapshot) => set(snapshot),
}))
