package com.fleet.modules.analytics.dto;

import com.fleet.modules.trip.entity.TripStatus;
import java.time.LocalDateTime;

public record DriverTripHistoryRowDTO(
    String tripId,
    LocalDateTime tripDate,
    TripStatus status,
    int distanceKm,
    long durationMinutes,
    long plannedDurationMinutes,
    long actualDurationMinutes,
    long delayMinutes,
    Double fuelUsed
) {}
