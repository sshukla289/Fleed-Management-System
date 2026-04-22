import { httpRequest } from './httpClient'
import type { CreateVehicleInput, UpdateVehicleInput, Vehicle } from '../types'

function normalizeVehicle(vehicle: Vehicle): Vehicle {
  return {
    ...vehicle,
    assignedRegion: vehicle.assignedRegion ?? '',
    driverId: vehicle.driverId ?? '',
  }
}

function serializeVehicleInput(input: CreateVehicleInput | UpdateVehicleInput) {
  return {
    ...input,
    assignedRegion: input.assignedRegion?.trim() || '',
    driverId: input.driverId.trim(),
  }
}

export async function fetchVehiclesList() {
  const vehicles = await httpRequest<Vehicle[]>('/vehicles')
  return vehicles.map(normalizeVehicle)
}

export async function createVehicleRecord(input: CreateVehicleInput) {
  const vehicle = await httpRequest<Vehicle>('/vehicles', {
    method: 'POST',
    body: JSON.stringify(serializeVehicleInput(input)),
  })
  return normalizeVehicle(vehicle)
}

export async function updateVehicleRecord(id: string, input: UpdateVehicleInput) {
  const vehicle = await httpRequest<Vehicle>(`/vehicles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(serializeVehicleInput(input)),
  })
  return normalizeVehicle(vehicle)
}

export function deleteVehicleRecord(id: string) {
  return httpRequest<void>(`/vehicles/${id}`, { method: 'DELETE' })
}
