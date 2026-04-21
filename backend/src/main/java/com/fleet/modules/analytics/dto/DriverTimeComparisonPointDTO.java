package com.fleet.modules.analytics.dto;

public record DriverTimeComparisonPointDTO(
    String tripId,
    String label,
    long plannedDurationMinutes,
    long actualDurationMinutes,
    long delayMinutes
) {}
