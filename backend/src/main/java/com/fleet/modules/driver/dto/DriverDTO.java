package com.fleet.modules.driver.dto;

public record DriverDTO(
    String id,
    String name,
    String status,
    String licenseType,
    String licenseNumber,
    String licenseExpiryDate,
    String assignedShift,
    String phone,
    String assignedVehicleId,
    double hoursDrivenToday
) {
}
