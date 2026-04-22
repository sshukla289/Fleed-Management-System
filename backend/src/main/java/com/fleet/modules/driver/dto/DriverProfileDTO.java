package com.fleet.modules.driver.dto;

public record DriverProfileDTO(
    String id,
    String name,
    String role,
    String email,
    String assignedRegion,
    String status,
    String licenseType,
    String phone,
    String assignedVehicleId,
    String assignedVehicleName
) {
}
