package com.fleet.modules.analytics.dto;

public record AnalyticsTimelinePointDTO(
    String label,
    int totalTrips,
    int completedTrips,
    int delayedTrips
) {}
