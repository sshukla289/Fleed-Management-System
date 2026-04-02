package com.fleet.modules.maintenance.dto;

public record CreateMaintenanceAlertRequest(
    String vehicleId,
    String title,
    String severity,
    String dueDate,
    String description
) {
}
