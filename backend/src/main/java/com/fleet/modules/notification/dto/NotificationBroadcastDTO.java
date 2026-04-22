package com.fleet.modules.notification.dto;

import com.fleet.modules.notification.entity.NotificationSeverity;
import java.time.LocalDateTime;
import java.util.List;

public record NotificationBroadcastDTO(
    String id,
    String title,
    String message,
    NotificationSeverity severity,
    List<String> targetRoles,
    int recipientCount,
    String createdBy,
    LocalDateTime createdAt
) {
}
