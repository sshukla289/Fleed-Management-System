import type { AppRole } from '../types'

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: 'Admin',
  FLEET_MANAGER: 'Fleet Manager',
  DISPATCHER_PLANNER: 'Dispatcher / Planner',
  MAINTENANCE_MANAGER: 'Maintenance Manager',
  DRIVER: 'Driver',
}

export const ALL_ROLES: AppRole[] = ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER', 'MAINTENANCE_MANAGER', 'DRIVER']

const roleAliases: Record<string, AppRole> = {
  ADMIN: 'ADMIN',
  ROLE_ADMIN: 'ADMIN',
  FLEET_MANAGER: 'FLEET_MANAGER',
  ROLE_FLEET_MANAGER: 'FLEET_MANAGER',
  FLEET_OPERATIONS_MANAGER: 'FLEET_MANAGER',
  DISPATCHER: 'DISPATCHER_PLANNER',
  PLANNER: 'DISPATCHER_PLANNER',
  DISPATCHER_PLANNER: 'DISPATCHER_PLANNER',
  DISPATCHER_PLANNER_ROLE: 'DISPATCHER_PLANNER',
  ROLE_DISPATCHER_PLANNER: 'DISPATCHER_PLANNER',
  MAINTENANCE_MANAGER: 'MAINTENANCE_MANAGER',
  ROLE_MAINTENANCE_MANAGER: 'MAINTENANCE_MANAGER',
  DRIVER: 'DRIVER',
  ROLE_DRIVER: 'DRIVER',
}

export function normalizeRole(role: string | undefined | null): AppRole | undefined {
  if (!role) {
    return undefined
  }

  const normalized = role.trim().replace(/[-/\s]+/g, '_').toUpperCase()
  return roleAliases[normalized]
}

export function hasAnyRole(role: string | undefined, allowedRoles: readonly AppRole[]) {
  const normalized = normalizeRole(role)
  if (!normalized) {
    return false
  }

  return allowedRoles.includes(normalized)
}

export function canManageTrips(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER'])
}

export function canOperateTripExecution(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER', 'DRIVER'])
}

export function canManageVehicles(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'FLEET_MANAGER'])
}

export function canManageDrivers(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER'])
}

export function canManageRoutes(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER'])
}

export function canManageMaintenance(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'FLEET_MANAGER', 'MAINTENANCE_MANAGER'])
}

export function canManageAlerts(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER', 'MAINTENANCE_MANAGER'])
}

export function canAccessAnalytics(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER', 'MAINTENANCE_MANAGER'])
}

export function canAccessAuditLogs(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'FLEET_MANAGER'])
}

export function canAccessVehicles(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER', 'MAINTENANCE_MANAGER'])
}

export function canAccessDrivers(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER'])
}

export function canAccessRoutes(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER', 'MAINTENANCE_MANAGER'])
}

export function canAccessMaintenance(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER', 'MAINTENANCE_MANAGER'])
}

export function canAccessAlerts(role: string | undefined) {
  return hasAnyRole(role, ALL_ROLES)
}

export function canAccessTrips(role: string | undefined) {
  return hasAnyRole(role, ALL_ROLES)
}

export function canAccessNotifications(role: string | undefined) {
  return hasAnyRole(role, ALL_ROLES)
}

export function canAccessDashboard(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER', 'MAINTENANCE_MANAGER'])
}

export function canAccessProfile(role: string | undefined) {
  return hasAnyRole(role, ALL_ROLES)
}
