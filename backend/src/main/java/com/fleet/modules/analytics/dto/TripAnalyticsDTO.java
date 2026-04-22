package com.fleet.modules.analytics.dto;

import java.time.LocalDateTime;
import java.util.List;

public record TripAnalyticsDTO(
    LocalDateTime generatedAt,
    LocalDateTime startDate,
    LocalDateTime endDate,
    String statusFilter,
    List<DashboardKpiDTO> kpis,
    double onTimeDeliveryRate,
    double tripSuccessRate,
    double averageDelayMinutes,
    double fuelEfficiencyKmPerFuelUnit,
    int completedTrips,
    int cancelledTrips,
    int delayedTrips,
    List<AnalyticsTimelinePointDTO> tripVolumeTrend,
    List<AnalyticsTrendDTO> delayTrends,
    List<AnalyticsTrendDTO> alertFrequencyByCategory,
    List<TripAnalyticsRowDTO> recentTrips
) {}
