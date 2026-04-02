package com.fleet.modules.driver.dto;

public record CreateDriverRequest(
    String name,
    String status,
    String licenseType,
    String assignedVehicleId,
    double hoursDrivenToday
) {
}
