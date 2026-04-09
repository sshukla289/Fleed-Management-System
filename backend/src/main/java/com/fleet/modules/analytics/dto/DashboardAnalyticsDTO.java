package com.fleet.modules.analytics.dto;

import java.time.LocalDateTime;
import java.util.List;

public record DashboardAnalyticsDTO(
    LocalDateTime generatedAt,
    List<DashboardKpiDTO> kpis,
    int activeTrips,
    int delayedTrips,
    int criticalAlerts,
    int availableVehicles,
    int vehiclesInMaintenance,
    int driversOnDuty,
    double fleetReadinessPercent,
    List<DashboardTripDelayDTO> delayedTripsSummary,
    List<DashboardAlertSummaryDTO> criticalAlertSummary,
    List<DashboardResourceDTO> blockedVehicles,
    List<DashboardResourceDTO> driversOnDutySnapshot
) {}
