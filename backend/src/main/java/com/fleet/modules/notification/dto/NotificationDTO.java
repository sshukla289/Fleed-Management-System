package com.fleet.modules.notification.dto;

import com.fleet.modules.notification.entity.NotificationCategory;
import com.fleet.modules.notification.entity.NotificationSeverity;
import java.time.LocalDateTime;

public record NotificationDTO(
    String id,
    NotificationCategory category,
    NotificationSeverity severity,
    String title,
    String message,
    String entityType,
    String entityId,
    String tripId,
    String vehicleId,
    String recipientUserId,
    String metadataJson,
    LocalDateTime createdAt,
    LocalDateTime readAt,
    boolean read
) {}
