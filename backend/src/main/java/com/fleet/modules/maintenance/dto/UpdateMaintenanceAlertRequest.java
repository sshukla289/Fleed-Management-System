package com.fleet.modules.maintenance.dto;

public record UpdateMaintenanceAlertRequest(
    String vehicleId,
    String title,
    String severity,
    String dueDate,
    String description
) {
}
