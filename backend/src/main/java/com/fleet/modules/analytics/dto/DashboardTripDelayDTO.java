package com.fleet.modules.analytics.dto;

import java.time.LocalDateTime;

public record DashboardTripDelayDTO(
    String tripId,
    String routeId,
    String vehicleId,
    String driverId,
    String status,
    long minutesLate,
    LocalDateTime plannedEndTime,
    String reason
) {}
