import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type {
  DriverPosition,
  ExecutionTrip,
  ExecutionTripStatus,
} from '../types/tripExecution'

interface TripExecutionState {
  activeTrip: ExecutionTrip | null
  tripStatus: ExecutionTripStatus | null
  currentStopId: string | null
  driverPosition: DriverPosition | null
  actionInProgress: string | null
}

function getCurrentStopId(trip: ExecutionTrip | null): string | null {
  if (!trip) {
    return null
  }

  return [...trip.stops]
    .sort((left, right) => left.sequence - right.sequence)
    .find((stop) => stop.status !== 'COMPLETED')
    ?.id ?? null
}

const initialState: TripExecutionState = {
  activeTrip: null,
  tripStatus: null,
  currentStopId: null,
  driverPosition: null,
  actionInProgress: null,
}

const tripExecutionSlice = createSlice({
  name: 'tripExecution',
  initialState,
  reducers: {
    setTrip(state, action: PayloadAction<ExecutionTrip | null>) {
      state.activeTrip = action.payload
      state.tripStatus = action.payload?.status ?? null
      state.currentStopId = getCurrentStopId(action.payload)
    },
    setDriverPosition(state, action: PayloadAction<DriverPosition | null>) {
      state.driverPosition = action.payload
    },
    setActionInProgress(state, action: PayloadAction<string | null>) {
      state.actionInProgress = action.payload
    },
    resetTripExecution(state) {
      state.activeTrip = null
      state.tripStatus = null
      state.currentStopId = null
      state.driverPosition = null
      state.actionInProgress = null
    },
  },
})

export const {
  resetTripExecution,
  setActionInProgress,
  setDriverPosition,
  setTrip,
} = tripExecutionSlice.actions

export const tripExecutionReducer = tripExecutionSlice.reducer
