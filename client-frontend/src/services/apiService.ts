import type {
  AssignShiftInput,
  AuthSession,
  ChangePasswordInput,
  CreateMaintenanceAlertInput,
  CreateDriverInput,
  CreateRoutePlanInput,
  CreateVehicleInput,
  Driver,
  LoginCredentials,
  MaintenanceAlert,
  RoutePlan,
  UpdateRoutePlanInput,
  UpdateDriverInput,
  UpdateMaintenanceAlertInput,
  UpdateProfileInput,
  UpdateVehicleInput,
  UserProfile,
  Vehicle,
} from '../types'

const DEFAULT_API_BASE_URL = 'http://localhost:8080/api'

function getApiBaseUrl() {
  const runtimeConfig = globalThis as { __API_BASE_URL__?: string }
  return (runtimeConfig.__API_BASE_URL__ ?? DEFAULT_API_BASE_URL).replace(/\/$/, '')
}

let vehicles: Vehicle[] = [
  {
    id: 'VH-101',
    name: 'Atlas Prime',
    type: 'Heavy Truck',
    status: 'Active',
    location: 'Mumbai Hub',
    fuelLevel: 72,
    mileage: 128_540,
    driverId: 'DR-201',
  },
  {
    id: 'VH-102',
    name: 'Coastal Runner',
    type: 'Reefer Van',
    status: 'Idle',
    location: 'Pune Depot',
    fuelLevel: 54,
    mileage: 87_920,
    driverId: 'DR-202',
  },
  {
    id: 'VH-103',
    name: 'Northline Carrier',
    type: 'Flatbed',
    status: 'Maintenance',
    location: 'Nagpur Service Bay',
    fuelLevel: 31,
    mileage: 165_210,
    driverId: 'DR-203',
  },
  {
    id: 'VH-104',
    name: 'Urban Sprint',
    type: 'Light Commercial',
    status: 'Active',
    location: 'Bengaluru Last-Mile Center',
    fuelLevel: 81,
    mileage: 43_180,
    driverId: 'DR-204',
  },
]

let drivers: Driver[] = [
  {
    id: 'DR-201',
    name: 'Aarav Sharma',
    status: 'On Duty',
    licenseType: 'HMV',
    assignedVehicleId: 'VH-101',
    hoursDrivenToday: 5.2,
  },
  {
    id: 'DR-202',
    name: 'Nisha Patel',
    status: 'Resting',
    licenseType: 'LMV',
    assignedVehicleId: 'VH-102',
    hoursDrivenToday: 3.4,
  },
  {
    id: 'DR-203',
    name: 'Rohan Verma',
    status: 'Off Duty',
    licenseType: 'HMV',
    assignedVehicleId: 'VH-103',
    hoursDrivenToday: 0,
  },
  {
    id: 'DR-204',
    name: 'Ishita Mehra',
    status: 'On Duty',
    licenseType: 'Transport',
    assignedVehicleId: 'VH-104',
    hoursDrivenToday: 6.1,
  },
]

const maintenanceAlerts: MaintenanceAlert[] = [
  {
    id: 'MA-1',
    vehicleId: 'VH-103',
    title: 'Brake pad replacement',
    severity: 'Critical',
    dueDate: '2026-04-04',
    description: 'Brake wear threshold exceeded during latest inspection.',
  },
  {
    id: 'MA-2',
    vehicleId: 'VH-101',
    title: 'Oil pressure inspection',
    severity: 'Medium',
    dueDate: '2026-04-06',
    description: 'Oil pressure trend dipped below preferred baseline.',
  },
  {
    id: 'MA-3',
    vehicleId: 'VH-102',
    title: 'Refrigeration calibration',
    severity: 'Low',
    dueDate: '2026-04-08',
    description: 'Temperature drift detected during cold-chain simulation.',
  },
]

const routePlans: RoutePlan[] = [
  {
    id: 'RT-501',
    name: 'Western Corridor Morning Run',
    status: 'In Progress',
    distanceKm: 342,
    estimatedDuration: '6h 15m',
    stops: ['Mumbai Hub', 'Lonavala', 'Pune Depot', 'Satara Crossdock'],
  },
  {
    id: 'RT-502',
    name: 'Central Maintenance Loop',
    status: 'Scheduled',
    distanceKm: 184,
    estimatedDuration: '3h 40m',
    stops: ['Nagpur Service Bay', 'Wardha', 'Amravati'],
  },
  {
    id: 'RT-503',
    name: 'Southern Last-Mile Sweep',
    status: 'Completed',
    distanceKm: 96,
    estimatedDuration: '2h 10m',
    stops: ['Bengaluru Center', 'Indiranagar', 'Whitefield', 'Yelahanka'],
  },
]

const profile: UserProfile = {
  id: 'USR-1',
  name: 'Shreya Operations',
  role: 'Fleet Operations Manager',
  email: 'shreya.ops@fleetcontrol.dev',
  assignedRegion: 'West and South India',
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

async function withFallback<T>(loader: () => Promise<T>, fallback: T): Promise<T> {
  if (typeof fetch !== 'function') {
    return fallback
  }

  try {
    return await loader()
  } catch (error) {
    console.warn('Falling back to mock API data:', error)
    return fallback
  }
}

function cloneVehicle(vehicle: Vehicle): Vehicle {
  return { ...vehicle }
}

function nextVehicleId() {
  const maxVehicleNumber = vehicles.reduce((max, vehicle) => {
    const vehicleNumber = Number(vehicle.id.replace('VH-', ''))
    return Number.isFinite(vehicleNumber) ? Math.max(max, vehicleNumber) : max
  }, 100)

  return `VH-${maxVehicleNumber + 1}`
}

function cloneDriver(driver: Driver): Driver {
  return { ...driver }
}

function nextDriverId() {
  const maxDriverNumber = drivers.reduce((max, driver) => {
    const driverNumber = Number(driver.id.replace('DR-', ''))
    return Number.isFinite(driverNumber) ? Math.max(max, driverNumber) : max
  }, 200)

  return `DR-${maxDriverNumber + 1}`
}

const fallbackSession: AuthSession = {
  token: 'local-demo-session',
  profile,
}

export async function login(credentials: LoginCredentials): Promise<AuthSession> {
  if (typeof fetch !== 'function') {
    if (
      credentials.email === 'manager@fleetcontrol.dev' &&
      credentials.password === 'password123'
    ) {
      return fallbackSession
    }

    throw new Error('Invalid credentials')
  }

  try {
    return await request<AuthSession>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  } catch (error) {
    if (
      credentials.email === 'manager@fleetcontrol.dev' &&
      credentials.password === 'password123'
    ) {
      return fallbackSession
    }

    throw error
  }
}

export function fetchVehicles(): Promise<Vehicle[]> {
  return withFallback(
    () => request<Vehicle[]>('/vehicles'),
    vehicles.map(cloneVehicle),
  )
}

export async function fetchVehicleById(id: string): Promise<Vehicle | undefined> {
  return withFallback(
    () => request<Vehicle>(`/vehicles/${id}`),
    (() => {
      const vehicle = vehicles.find((item) => item.id === id)
      return vehicle ? cloneVehicle(vehicle) : undefined
    })(),
  )
}

export function fetchDrivers(): Promise<Driver[]> {
  return withFallback(
    () => request<Driver[]>('/drivers'),
    drivers.map(cloneDriver),
  )
}

export function fetchMaintenanceAlerts(): Promise<MaintenanceAlert[]> {
  return withFallback(() => request<MaintenanceAlert[]>('/maintenance-alerts'), maintenanceAlerts)
}

export function fetchRoutePlans(): Promise<RoutePlan[]> {
  return withFallback(() => request<RoutePlan[]>('/routes'), routePlans)
}

export function fetchProfile(): Promise<UserProfile> {
  return withFallback(() => request<UserProfile>('/profile'), profile)
}

export async function createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
  try {
    return await request<Vehicle>('/vehicles', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  } catch (error) {
    console.warn('Falling back to mock API data:', error)
    const createdVehicle = {
      id: nextVehicleId(),
      ...input,
    }
    vehicles = [...vehicles, createdVehicle]
    return cloneVehicle(createdVehicle)
  }
}

export async function updateVehicle(id: string, input: UpdateVehicleInput): Promise<Vehicle> {
  try {
    return await request<Vehicle>(`/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
  } catch (error) {
    console.warn('Falling back to mock API data:', error)
    const updatedVehicle = {
      id,
      ...input,
    }
    vehicles = vehicles.map((vehicle) => (vehicle.id === id ? updatedVehicle : vehicle))
    return cloneVehicle(updatedVehicle)
  }
}

export async function deleteVehicle(id: string): Promise<void> {
  try {
    await request<void>(`/vehicles/${id}`, {
      method: 'DELETE',
    })
  } catch (error) {
    console.warn('Falling back to mock API data:', error)
    vehicles = vehicles.filter((vehicle) => vehicle.id !== id)
  }
}

export async function createDriver(input: CreateDriverInput): Promise<Driver> {
  try {
    return await request<Driver>('/drivers', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  } catch (error) {
    console.warn('Falling back to mock API data:', error)
    const createdDriver = {
      id: nextDriverId(),
      ...input,
      assignedVehicleId: input.assignedVehicleId || undefined,
    }
    drivers = [...drivers, createdDriver]
    return cloneDriver(createdDriver)
  }
}

export async function createMaintenanceAlert(
  input: CreateMaintenanceAlertInput,
): Promise<MaintenanceAlert> {
  return withFallback(
    () =>
      request<MaintenanceAlert>('/maintenance-alerts', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    {
      id: `MA-${maintenanceAlerts.length + 1}`,
      ...input,
    },
  )
}

export async function updateMaintenanceAlert(
  id: string,
  input: UpdateMaintenanceAlertInput,
): Promise<MaintenanceAlert> {
  return withFallback(
    () =>
      request<MaintenanceAlert>(`/maintenance-alerts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    {
      id,
      ...input,
    },
  )
}

export async function deleteMaintenanceAlert(id: string): Promise<void> {
  return withFallback(
    () =>
      request<void>(`/maintenance-alerts/${id}`, {
        method: 'DELETE',
      }),
    undefined,
  )
}

export async function assignShift(input: AssignShiftInput): Promise<Driver> {
  try {
    return await request<Driver>('/drivers/assign-shift', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  } catch (error) {
    console.warn('Falling back to mock API data:', error)
    const updatedDriver = {
      ...(drivers.find((driver) => driver.id === input.driverId) ?? drivers[0]),
      assignedVehicleId: input.assignedVehicleId,
      status: input.status,
    }
    drivers = drivers.map((driver) => (driver.id === updatedDriver.id ? updatedDriver : driver))
    return cloneDriver(updatedDriver)
  }
}

export async function updateDriver(id: string, input: UpdateDriverInput): Promise<Driver> {
  try {
    return await request<Driver>(`/drivers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
  } catch (error) {
    console.warn('Falling back to mock API data:', error)
    const updatedDriver = {
      id,
      ...input,
      assignedVehicleId: input.assignedVehicleId || undefined,
    }
    drivers = drivers.map((driver) => (driver.id === id ? updatedDriver : driver))
    return cloneDriver(updatedDriver)
  }
}

export async function deleteDriver(id: string): Promise<void> {
  try {
    await request<void>(`/drivers/${id}`, {
      method: 'DELETE',
    })
  } catch (error) {
    console.warn('Falling back to mock API data:', error)
    drivers = drivers.filter((driver) => driver.id !== id)
  }
}

export async function optimizeRoutes(): Promise<RoutePlan[]> {
  return withFallback(
    () =>
      request<RoutePlan[]>('/routes/optimize', {
        method: 'POST',
      }),
    [...routePlans].sort((left, right) => left.distanceKm - right.distanceKm),
  )
}

export async function createRoutePlan(input: CreateRoutePlanInput): Promise<RoutePlan> {
  return withFallback(
    () =>
      request<RoutePlan>('/routes', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    {
      id: `RT-${500 + routePlans.length + 1}`,
      ...input,
    },
  )
}

export async function updateRoutePlan(id: string, input: UpdateRoutePlanInput): Promise<RoutePlan> {
  return withFallback(
    () =>
      request<RoutePlan>(`/routes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    {
      id,
      ...input,
    },
  )
}

export async function deleteRoutePlan(id: string): Promise<void> {
  return withFallback(
    () =>
      request<void>(`/routes/${id}`, {
        method: 'DELETE',
      }),
    undefined,
  )
}

export async function updateProfile(input: UpdateProfileInput): Promise<UserProfile> {
  return withFallback(
    () =>
      request<UserProfile>('/profile', {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    {
      id: profile.id,
      ...input,
    },
  )
}

export async function changePassword(input: ChangePasswordInput): Promise<void> {
  return withFallback(
    () =>
      request<void>('/profile/change-password', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    undefined,
  )
}
