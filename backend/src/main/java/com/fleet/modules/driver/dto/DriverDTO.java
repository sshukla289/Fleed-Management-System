package com.fleet.modules.driver.dto;

public record DriverDTO(
    String id,
    String name,
    String status,
    String licenseType,
    String phone,
    String assignedVehicleId,
    double hoursDrivenToday
) {
}
