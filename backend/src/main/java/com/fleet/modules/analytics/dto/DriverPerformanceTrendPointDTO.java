package com.fleet.modules.analytics.dto;

public record DriverPerformanceTrendPointDTO(
    String label,
    int tripsCompleted,
    double onTimePercent,
    double distanceKm
) {}
