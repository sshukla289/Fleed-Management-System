package com.fleet.modules.analytics.dto;

import java.time.LocalDateTime;
import java.util.List;

public record DriverPerformanceDashboardDTO(
    LocalDateTime generatedAt,
    LocalDateTime startDate,
    LocalDateTime endDate,
    List<DashboardKpiDTO> kpis,
    double fleetOnTimePercent,
    int totalCompletedTrips,
    double totalDistanceCoveredKm,
    double averageTripDurationMinutes,
    double averageSafetyScore,
    String safetyStatus,
    long totalOverspeedEvents,
    long totalRouteDeviationEvents,
    long totalIdleMinutes,
    double averageSpeedKph,
    double averageFuelConsumptionPer100Km,
    double averageFuelEfficiencyKmPerUnit,
    double averageDelayMinutes,
    double delayFrequencyPercent,
    List<DriverPerformanceTrendPointDTO> tripsOverTime,
    List<DriverFuelEfficiencyPointDTO> distanceVsFuel,
    List<DriverTimeComparisonPointDTO> plannedVsActualTime,
    List<DriverBehaviorInsightDTO> insights,
    List<DriverPerformanceRowDTO> drivers
) {}
