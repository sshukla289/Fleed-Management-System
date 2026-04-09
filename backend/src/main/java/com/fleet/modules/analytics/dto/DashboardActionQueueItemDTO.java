package com.fleet.modules.analytics.dto;

public record DashboardActionQueueItemDTO(
    String id,
    String category,
    String title,
    String status,
    String priority,
    String note,
    String relatedTripId,
    String relatedVehicleId,
    String actionLabel,
    String actionPath
) {}
