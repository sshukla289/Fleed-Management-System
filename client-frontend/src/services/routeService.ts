import { httpRequest } from './httpClient'
import type { CreateRoutePlanInput, RoutePlan, TripStop, UpdateRoutePlanInput } from '../types'

function normalizeStop(stop: TripStop, index: number): TripStop {
  return {
    ...stop,
    name: stop.name ?? '',
    sequence: stop.sequence ?? index + 1,
    status: stop.status ?? 'PENDING',
    latitude: stop.latitude ?? null,
    longitude: stop.longitude ?? null,
  }
}

function normalizeRoute(route: RoutePlan): RoutePlan {
  return {
    ...route,
    stops: (route.stops ?? []).map(normalizeStop),
  }
}

function serializeRouteInput(input: CreateRoutePlanInput | UpdateRoutePlanInput) {
  return {
    ...input,
    name: input.name.trim(),
    estimatedDuration: input.estimatedDuration.trim(),
    stops: input.stops.map((stop, index) => ({
      ...stop,
      name: stop.name.trim(),
      sequence: index + 1,
      status: stop.status ?? 'PENDING',
      latitude: typeof stop.latitude === 'number' ? stop.latitude : null,
      longitude: typeof stop.longitude === 'number' ? stop.longitude : null,
    })),
  }
}

export async function fetchRoutesList() {
  const routes = await httpRequest<RoutePlan[]>('/routes')
  return routes.map(normalizeRoute)
}

export async function createRouteRecord(input: CreateRoutePlanInput) {
  const route = await httpRequest<RoutePlan>('/routes', {
    method: 'POST',
    body: JSON.stringify(serializeRouteInput(input)),
  })
  return normalizeRoute(route)
}

export async function updateRouteRecord(id: string, input: UpdateRoutePlanInput) {
  const route = await httpRequest<RoutePlan>(`/routes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(serializeRouteInput(input)),
  })
  return normalizeRoute(route)
}

export function deleteRouteRecord(id: string) {
  return httpRequest<void>(`/routes/${id}`, { method: 'DELETE' })
}

export async function optimizeRoutePlans() {
  const routes = await httpRequest<RoutePlan[]>('/routes/optimize', { method: 'POST' })
  return routes.map(normalizeRoute)
}
