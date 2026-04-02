package com.fleet.modules.vehicle.dto;

public record VehicleDTO(
    String id,
    String name,
    String type,
    String status,
    String location,
    int fuelLevel,
    int mileage,
    String driverId
) {
}
