package com.fleet.modules.driver.dto;

public record AssignShiftRequest(
    String driverId,
    String assignedVehicleId,
    String status,
    String assignedShift
) {
}
