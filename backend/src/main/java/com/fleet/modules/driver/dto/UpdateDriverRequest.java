package com.fleet.modules.driver.dto;

public record UpdateDriverRequest(
    String name,
    String status,
    String licenseType,
    String assignedVehicleId,
    double hoursDrivenToday
) {
}
