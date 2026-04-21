package com.fleet.modules.analytics.dto;

public record DriverFuelEfficiencyPointDTO(
    String tripId,
    String label,
    double distanceKm,
    double fuelUsed,
    double fuelConsumptionPer100Km
) {}
