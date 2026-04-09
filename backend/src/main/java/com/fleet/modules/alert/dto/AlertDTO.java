package com.fleet.modules.alert.dto;

import com.fleet.modules.alert.entity.AlertCategory;
import com.fleet.modules.alert.entity.AlertLifecycleStatus;
import com.fleet.modules.alert.entity.AlertSeverity;
import java.time.LocalDateTime;

public record AlertDTO(
    String id,
    AlertCategory category,
    AlertSeverity severity,
    AlertLifecycleStatus status,
    String title,
    String description,
    String sourceType,
    String sourceId,
    String relatedTripId,
    String relatedVehicleId,
    String metadataJson,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    LocalDateTime acknowledgedAt,
    LocalDateTime resolvedAt,
    LocalDateTime closedAt
) {}
