package com.fleet.modules.analytics.dto;

import java.time.LocalDateTime;
import java.util.List;

public record DriverTripHistoryDTO(
    LocalDateTime generatedAt,
    LocalDateTime startDate,
    LocalDateTime endDate,
    String statusFilter,
    int totalTrips,
    double totalDistanceCoveredKm,
    double averageTripDurationMinutes,
    List<DriverTripHistoryRowDTO> trips
) {}
