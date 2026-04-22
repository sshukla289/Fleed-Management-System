import { httpRequest } from './httpClient'
import type { AssignShiftInput, CreateDriverInput, Driver, UpdateDriverInput } from '../types'

function normalizeDriver(driver: Driver): Driver {
  return {
    ...driver,
    licenseNumber: driver.licenseNumber ?? '',
    licenseExpiryDate: driver.licenseExpiryDate ?? '',
    assignedShift: driver.assignedShift ?? '',
    phone: driver.phone ?? '',
    assignedVehicleId: driver.assignedVehicleId ?? '',
  }
}

function serializeDriverInput(input: CreateDriverInput | UpdateDriverInput) {
  return {
    ...input,
    licenseNumber: input.licenseNumber?.trim() || '',
    licenseExpiryDate: input.licenseExpiryDate?.trim() || '',
    assignedShift: input.assignedShift?.trim() || '',
    phone: input.phone?.trim() || '',
    assignedVehicleId: input.assignedVehicleId.trim(),
  }
}

export async function fetchDriversList() {
  const drivers = await httpRequest<Driver[]>('/drivers')
  return drivers.map(normalizeDriver)
}

export async function createDriverRecord(input: CreateDriverInput) {
  const driver = await httpRequest<Driver>('/drivers', {
    method: 'POST',
    body: JSON.stringify(serializeDriverInput(input)),
  })
  return normalizeDriver(driver)
}

export async function updateDriverRecord(id: string, input: UpdateDriverInput) {
  const driver = await httpRequest<Driver>(`/drivers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(serializeDriverInput(input)),
  })
  return normalizeDriver(driver)
}

export async function assignDriverShift(input: AssignShiftInput) {
  const driver = await httpRequest<Driver>('/drivers/assign-shift', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      assignedVehicleId: input.assignedVehicleId.trim(),
      assignedShift: input.assignedShift?.trim() || '',
    }),
  })
  return normalizeDriver(driver)
}

export function deleteDriverRecord(id: string) {
  return httpRequest<void>(`/drivers/${id}`, { method: 'DELETE' })
}
