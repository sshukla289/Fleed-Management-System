package com.fleet.modules.analytics.dto;

import java.time.LocalDateTime;

public record DashboardAlertSummaryDTO(
    String id,
    String category,
    String severity,
    String status,
    String title,
    String relatedTripId,
    String relatedVehicleId,
    LocalDateTime createdAt
) {}
