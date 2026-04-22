package com.fleet.modules.notification.dto;

import com.fleet.modules.notification.entity.NotificationSeverity;
import java.util.List;

public record CreateBroadcastMessageRequest(
    String title,
    String message,
    NotificationSeverity severity,
    List<String> targetRoles
) {
}
