import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type {
  AdminUser,
  AdminUserStatus,
  AlertLifecycleStatus,
  AlertSeverity,
  AppRole,
  TripOptimizationResult,
  TripStatus,
  TripValidationResult,
} from '../types'

export type AdminUsersModalMode = 'create' | 'edit' | 'role'
export type AdminUsersRowAction = 'status' | 'reset' | 'delete'
export type AdminUsersBannerTone = 'success' | 'error' | 'info'

export interface AdminUsersBannerState {
  tone: AdminUsersBannerTone
  title: string
  message: string
  secret?: string
}

export interface AdminUsersRowActionState {
  userId: string
  action: AdminUsersRowAction
}

export interface AdminUsersUiState {
  search: string
  roleFilter: 'ALL' | AppRole
  statusFilter: 'ALL' | AdminUserStatus
  page: number
  pageSize: number
  modalMode: AdminUsersModalMode | null
  selectedUser: AdminUser | null
  banner: AdminUsersBannerState | null
  rowAction: AdminUsersRowActionState | null
}

export type TripGovernanceNoticeTone = 'success' | 'error'

export interface TripGovernanceNoticeState {
  tone: TripGovernanceNoticeTone
  text: string
}

export interface AdminTripGovernanceUiState {
  search: string
  statusFilter: 'ALL' | TripStatus
  selectedTripId: string | null
  notice: TripGovernanceNoticeState | null
  showCreateModal: boolean
  dispatchTripId: string | null
  cancelTripId: string | null
  validationResult: TripValidationResult | null
  optimizationResult: TripOptimizationResult | null
}

export type AlertsPageStatusFilter = AlertLifecycleStatus | 'ALL'
export type AlertsPageSeverityFilter = AlertSeverity | 'ALL'

export interface AdminAlertsUiState {
  statusFilter: AlertsPageStatusFilter
  severityFilter: AlertsPageSeverityFilter
  tripFilter: string
  regionFilter: string
  message: string | null
}

interface AdminModuleState {
  users: AdminUsersUiState
  tripGovernance: AdminTripGovernanceUiState
  alerts: AdminAlertsUiState
}

const initialUsersState: AdminUsersUiState = {
  search: '',
  roleFilter: 'ALL',
  statusFilter: 'ALL',
  page: 0,
  pageSize: 25,
  modalMode: null,
  selectedUser: null,
  banner: null,
  rowAction: null,
}

const initialTripGovernanceState: AdminTripGovernanceUiState = {
  search: '',
  statusFilter: 'ALL',
  selectedTripId: null,
  notice: null,
  showCreateModal: false,
  dispatchTripId: null,
  cancelTripId: null,
  validationResult: null,
  optimizationResult: null,
}

const initialAlertsState: AdminAlertsUiState = {
  statusFilter: 'ALL',
  severityFilter: 'ALL',
  tripFilter: 'ALL',
  regionFilter: 'ALL',
  message: null,
}

const initialState: AdminModuleState = {
  users: initialUsersState,
  tripGovernance: initialTripGovernanceState,
  alerts: initialAlertsState,
}

const adminModuleSlice = createSlice({
  name: 'adminModule',
  initialState,
  reducers: {
    patchAdminUsersState(state, action: PayloadAction<Partial<AdminUsersUiState>>) {
      Object.assign(state.users, action.payload)
    },
    resetAdminUsersState(state) {
      state.users = { ...initialUsersState }
    },
    patchAdminTripGovernanceState(state, action: PayloadAction<Partial<AdminTripGovernanceUiState>>) {
      Object.assign(state.tripGovernance, action.payload)
    },
    resetAdminTripGovernanceState(state) {
      state.tripGovernance = { ...initialTripGovernanceState }
    },
    patchAdminAlertsState(state, action: PayloadAction<Partial<AdminAlertsUiState>>) {
      Object.assign(state.alerts, action.payload)
    },
    resetAdminAlertsState(state) {
      state.alerts = { ...initialAlertsState }
    },
  },
})

export const {
  patchAdminUsersState,
  patchAdminTripGovernanceState,
  patchAdminAlertsState,
  resetAdminUsersState,
  resetAdminTripGovernanceState,
  resetAdminAlertsState,
} = adminModuleSlice.actions

export const adminModuleReducer = adminModuleSlice.reducer
