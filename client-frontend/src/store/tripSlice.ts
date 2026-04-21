import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { StopStatus, Trip } from '../types'

interface TripRealtimePayload {
  tripId: string
  tripStatus?: Trip['status']
  latitude?: number | null
  longitude?: number | null
  speed?: number | null
  fuelLevel?: number | null
  currentStop?: string | null
  currentStopStatus?: StopStatus | null
  timestamp: string
}

interface TripTelemetryState {
  lat: number
  lng: number
  speed: number
  fuel: number
  timestamp: string
}

interface TripState {
  activeTrip: Trip | null
  telemetry: TripTelemetryState | null
}

const initialState: TripState = {
  activeTrip: null,
  telemetry: null,
}

const tripSlice = createSlice({
  name: 'trip',
  initialState,
  reducers: {
    setActiveTrip(state, action: PayloadAction<Trip | null>) {
      state.activeTrip = action.payload
    },
    updateTripFromSocket(state, action: PayloadAction<TripRealtimePayload>) {
      const payload = action.payload
      if (!state.activeTrip || state.activeTrip.tripId !== payload.tripId) {
        return
      }

      state.activeTrip = {
        ...state.activeTrip,
        status: payload.tripStatus ?? state.activeTrip.status,
        stops: state.activeTrip.stops.map((stop) => {
          if (stop.name !== payload.currentStop || !payload.currentStopStatus) {
            return stop
          }

          return {
            ...stop,
            status: payload.currentStopStatus,
          }
        }),
      }

      if (payload.latitude != null && payload.longitude != null) {
        state.telemetry = {
          lat: payload.latitude,
          lng: payload.longitude,
          speed: payload.speed ?? state.telemetry?.speed ?? 0,
          fuel: payload.fuelLevel ?? state.telemetry?.fuel ?? 0,
          timestamp: payload.timestamp,
        }
      }
    },
  },
})

export const { setActiveTrip, updateTripFromSocket } = tripSlice.actions

export const tripReducer = tripSlice.reducer
