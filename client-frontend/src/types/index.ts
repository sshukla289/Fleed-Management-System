export type VehicleStatus = 'Active' | 'Idle' | 'Maintenance'

export interface Vehicle {
  id: string
  name: string
  type: string
  status: VehicleStatus
  location: string
  fuelLevel: number
  mileage: number
  driverId: string
}

export interface Driver {
  id: string
  name: string
  status: 'On Duty' | 'Off Duty' | 'Resting'
  licenseType: string
  assignedVehicleId?: string
  hoursDrivenToday: number
}

export interface TelemetryData {
  timestamp: string
  speed: number
  fuelUsage: number
  engineTemperature: number
}

export interface MaintenanceAlert {
  id: string
  vehicleId: string
  title: string
  severity: 'Low' | 'Medium' | 'Critical'
  dueDate: string
  description: string
}

export interface RoutePlan {
  id: string
  name: string
  status: 'Scheduled' | 'In Progress' | 'Completed'
  distanceKm: number
  estimatedDuration: string
  stops: string[]
}

export interface CreateRoutePlanInput {
  name: string
  status: RoutePlan['status']
  distanceKm: number
  estimatedDuration: string
  stops: string[]
}

export type UpdateRoutePlanInput = CreateRoutePlanInput

export interface UserProfile {
  id: string
  name: string
  role: string
  email: string
  assignedRegion: string
}

export interface AuthSession {
  token: string
  profile: UserProfile
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface CreateVehicleInput {
  name: string
  type: string
  status: VehicleStatus
  location: string
  fuelLevel: number
  mileage: number
  driverId: string
}

export type UpdateVehicleInput = CreateVehicleInput

export interface CreateDriverInput {
  name: string
  status: Driver['status']
  licenseType: string
  assignedVehicleId: string
  hoursDrivenToday: number
}

export type UpdateDriverInput = CreateDriverInput

export interface CreateMaintenanceAlertInput {
  vehicleId: string
  title: string
  severity: MaintenanceAlert['severity']
  dueDate: string
  description: string
}

export type UpdateMaintenanceAlertInput = CreateMaintenanceAlertInput

export interface AssignShiftInput {
  driverId: string
  assignedVehicleId: string
  status: Driver['status']
}

export interface UpdateProfileInput {
  name: string
  role: string
  email: string
  assignedRegion: string
}
