package com.fleet.modules.analytics.dto;

import java.time.LocalDateTime;

public record DashboardExceptionDTO(
    String id,
    String category,
    String severity,
    String title,
    String message,
    String status,
    String relatedTripId,
    String relatedVehicleId,
    LocalDateTime updatedAt
) {}
