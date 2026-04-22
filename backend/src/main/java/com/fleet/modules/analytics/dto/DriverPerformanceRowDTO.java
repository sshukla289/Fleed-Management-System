package com.fleet.modules.analytics.dto;

public record DriverPerformanceRowDTO(
    String driverId,
    String name,
    String status,
    String licenseType,
    String assignedVehicleId,
    int totalTrips,
    int tripsCompleted,
    double onTimePercent,
    double safetyScore,
    double averageSpeedKph,
    long overspeedEvents,
    long safetyIncidents,
    String note
) {}
