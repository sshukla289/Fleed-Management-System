import type { CreateTelemetryInput, TelemetryData } from '../types'

const DEFAULT_API_BASE_URL = 'http://localhost:8080/api'

function getApiBaseUrl() {
  const runtimeConfig = globalThis as { __API_BASE_URL__?: string }
  return (runtimeConfig.__API_BASE_URL__ ?? DEFAULT_API_BASE_URL).replace(/\/$/, '')
}

interface ApiTelemetryPoint {
  vehicleId: string
  latitude: number
  longitude: number
  speed: number
  fuelLevel: number
  timestamp?: string
}

function seededValue(seed: number, min: number, max: number) {
  const normalized = (Math.sin(seed) + 1) / 2
  return Math.round(min + normalized * (max - min))
}

function buildMockTelemetry(vehicleId: string): TelemetryData[] {
  const baseSeed = vehicleId.length * 17

  return Array.from({ length: 7 }, (_, index) => {
    const hour = `${8 + index}:00`

    return {
      timestamp: hour,
      speed: seededValue(baseSeed + index, 32, 86),
      fuelUsage: seededValue(baseSeed + index * 1.4, 9, 28),
      engineTemperature: seededValue(baseSeed + index * 1.8, 78, 104),
    }
  })
}

function createMockTelemetryPoint(input: CreateTelemetryInput): TelemetryData {
  const timestampLabel = input.timestamp
    ? new Date(input.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return {
    timestamp: timestampLabel,
    speed: Math.round(input.speed),
    fuelUsage: Math.max(6, Math.round((100 - input.fuelLevel) / 3)),
    engineTemperature: 78 + (Math.round(input.speed) % 25),
  }
}

function mapTelemetryPoint(point: ApiTelemetryPoint, index: number): TelemetryData {
  return {
    timestamp: point.timestamp ? new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `${8 + index}:00`,
    speed: Math.round(point.speed),
    fuelUsage: Math.max(6, Math.round((100 - point.fuelLevel) / 3)),
    engineTemperature: 78 + ((Math.round(point.speed) + index * 3) % 25),
  }
}

export async function fetchVehicleTelemetry(vehicleId: string): Promise<TelemetryData[]> {
  if (typeof fetch !== 'function') {
    return buildMockTelemetry(vehicleId)
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/telemetry/${vehicleId}`)

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    const data = (await response.json()) as ApiTelemetryPoint[]
    return data.map(mapTelemetryPoint)
  } catch (error) {
    console.warn('Falling back to mock telemetry data:', error)
    return buildMockTelemetry(vehicleId)
  }
}

export async function submitVehicleTelemetry(input: CreateTelemetryInput): Promise<TelemetryData> {
  if (typeof fetch !== 'function') {
    return createMockTelemetryPoint(input)
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/telemetry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    return createMockTelemetryPoint(input)
  } catch (error) {
    console.warn('Falling back to mock telemetry submission:', error)
    return createMockTelemetryPoint(input)
  }
}
