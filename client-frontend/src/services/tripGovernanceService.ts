import { httpRequest } from './httpClient'
import type { CreateTripInput, Trip, TripOptimizationResult, TripValidationResult } from '../types'

function normalizeApiDateTime(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00` : value
}

function serializeCreateTripInput(input: CreateTripInput) {
  return {
    ...input,
    routeId: input.routeId.trim(),
    assignedVehicleId: input.assignedVehicleId.trim(),
    assignedDriverId: input.assignedDriverId.trim(),
    source: input.source.trim(),
    destination: input.destination.trim(),
    estimatedDuration: input.estimatedDuration.trim(),
    plannedStartTime: normalizeApiDateTime(input.plannedStartTime),
    plannedEndTime: normalizeApiDateTime(input.plannedEndTime),
    remarks: input.remarks?.trim() || undefined,
  }
}

export function fetchGovernanceTrips() {
  return httpRequest<Trip[]>('/trips')
}

export function createGovernanceTrip(input: CreateTripInput) {
  return httpRequest<Trip>('/trips', {
    method: 'POST',
    body: JSON.stringify(serializeCreateTripInput(input)),
  })
}

export function validateGovernanceTrip(tripId: string) {
  return httpRequest<TripValidationResult>(`/trips/${tripId}/validate`, { method: 'POST' })
}

export function optimizeGovernanceTrip(tripId: string) {
  return httpRequest<TripOptimizationResult>(`/trips/${tripId}/optimize`, { method: 'POST' })
}

export function dispatchGovernanceTrip(tripId: string, options?: { overrideValidation?: boolean }) {
  const overrideValidation = options?.overrideValidation ? '?overrideValidation=true' : ''
  return httpRequest<Trip>(`/trips/${tripId}/dispatch${overrideValidation}`, { method: 'POST' })
}

export function cancelGovernanceTrip(tripId: string, reason?: string) {
  const query = reason?.trim() ? `?reason=${encodeURIComponent(reason.trim())}` : ''
  return httpRequest<Trip>(`/trips/${tripId}/cancel${query}`, { method: 'POST' })
}
