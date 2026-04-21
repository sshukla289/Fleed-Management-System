package com.fleet.modules.analytics.service;

import com.fleet.modules.alert.entity.Alert;
import com.fleet.modules.alert.entity.AlertCategory;
import com.fleet.modules.alert.repository.AlertRepository;
import com.fleet.modules.analytics.dto.AnalyticsTrendDTO;
import com.fleet.modules.analytics.dto.DashboardKpiDTO;
import com.fleet.modules.analytics.dto.DriverAnalyticsDTO;
import com.fleet.modules.analytics.dto.DriverAnalyticsRowDTO;
import com.fleet.modules.analytics.dto.DriverPerformanceDashboardDTO;
import com.fleet.modules.analytics.dto.DriverPerformanceRowDTO;
import com.fleet.modules.auth.entity.AppRole;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.analytics.dto.TripAnalyticsDTO;
import com.fleet.modules.analytics.dto.TripAnalyticsRowDTO;
import com.fleet.modules.analytics.dto.VehicleAnalyticsDTO;
import com.fleet.modules.analytics.dto.VehicleAnalyticsRowDTO;
import com.fleet.modules.driver.entity.Driver;
import com.fleet.modules.driver.entity.DriverDutyStatus;
import com.fleet.modules.driver.repository.DriverRepository;
import com.fleet.modules.maintenance.dto.MaintenanceScheduleDTO;
import com.fleet.modules.maintenance.entity.MaintenanceScheduleStatus;
import com.fleet.modules.maintenance.service.MaintenanceScheduleService;
import com.fleet.modules.telemetry.entity.Telemetry;
import com.fleet.modules.telemetry.repository.TelemetryRepository;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import com.fleet.modules.vehicle.entity.Vehicle;
import com.fleet.modules.vehicle.entity.VehicleOperationalStatus;
import com.fleet.modules.vehicle.repository.VehicleRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class OperationalAnalyticsService {

    private final TripRepository tripRepository;
    private final VehicleRepository vehicleRepository;
    private final DriverRepository driverRepository;
    private final TelemetryRepository telemetryRepository;
    private final AlertRepository alertRepository;
    private final MaintenanceScheduleService maintenanceScheduleService;
    private final CurrentUserService currentUserService;

    public OperationalAnalyticsService(
        TripRepository tripRepository,
        VehicleRepository vehicleRepository,
        DriverRepository driverRepository,
        TelemetryRepository telemetryRepository,
        AlertRepository alertRepository,
        MaintenanceScheduleService maintenanceScheduleService,
        CurrentUserService currentUserService
    ) {
        this.tripRepository = tripRepository;
        this.vehicleRepository = vehicleRepository;
        this.driverRepository = driverRepository;
        this.telemetryRepository = telemetryRepository;
        this.alertRepository = alertRepository;
        this.maintenanceScheduleService = maintenanceScheduleService;
        this.currentUserService = currentUserService;
    }

    public TripAnalyticsDTO getTripAnalytics(LocalDateTime startDate, LocalDateTime endDate, TripStatus status) {
        List<Trip> trips = filteredTrips(startDate, endDate, status);
        List<Trip> completedTrips = trips.stream().filter(trip -> trip.getStatus() == TripStatus.COMPLETED).toList();
        List<Trip> cancelledTrips = trips.stream().filter(trip -> trip.getStatus() == TripStatus.CANCELLED).toList();
        List<Trip> delayedTrips = trips.stream().filter(trip -> isDelayed(trip, now())).toList();

        long onTimeCompleted = completedTrips.stream()
            .filter(trip -> trip.getActualEndTime() != null && trip.getPlannedEndTime() != null && !trip.getActualEndTime().isAfter(trip.getPlannedEndTime()))
            .count();

        long terminalTrips = completedTrips.size() + cancelledTrips.size();
        double onTimeDeliveryRate = completedTrips.isEmpty()
            ? 0.0
            : roundPercent(onTimeCompleted * 100.0 / completedTrips.size());
        double tripSuccessRate = terminalTrips == 0
            ? 0.0
            : roundPercent(completedTrips.size() * 100.0 / terminalTrips);
        double averageDelayMinutes = roundOneDecimal(delayedTrips.stream().mapToLong(trip -> delayMinutes(trip, now())).average().orElse(0.0));
        double fuelEfficiency = calculateFuelEfficiency(completedTrips);

        Map<String, Long> alertCounts = alertRepository.findAll().stream()
            .filter(alert -> isWithinRange(alert.getCreatedAt(), startDate, endDate))
            .collect(Collectors.groupingBy(alert -> alert.getCategory().name(), Collectors.counting()));

        return new TripAnalyticsDTO(
            now(),
            startDate,
            endDate,
            status == null ? "ALL" : status.name(),
            List.of(
                new DashboardKpiDTO("completed-trips", "Completed trips", String.valueOf(completedTrips.size()), "Trips finished in the selected range", "mint"),
                new DashboardKpiDTO("cancelled-trips", "Cancelled trips", String.valueOf(cancelledTrips.size()), "Trips closed before delivery", "rose"),
                new DashboardKpiDTO("on-time-rate", "On-time delivery", formatPercent(onTimeDeliveryRate), "Completed trips finished on or before plan", "blue"),
                new DashboardKpiDTO("success-rate", "Trip success", formatPercent(tripSuccessRate), "Completed versus terminal trips", "teal"),
                new DashboardKpiDTO("avg-delay", "Average delay", formatMinutes(averageDelayMinutes), "Delay among late trips only", "amber"),
                new DashboardKpiDTO("fuel-efficiency", "Fuel efficiency", fuelEfficiency <= 0 ? "N/A" : String.format(Locale.ROOT, "%.2f km/unit", fuelEfficiency), "Derived from telemetry fuel delta", "violet")
            ),
            onTimeDeliveryRate,
            tripSuccessRate,
            averageDelayMinutes,
            fuelEfficiency,
            completedTrips.size(),
            cancelledTrips.size(),
            delayedTrips.size(),
            buildDelayBuckets(delayedTrips),
            buildCategoryTrends(alertCounts, "alerts"),
            trips.stream()
                .sorted(Comparator.comparing(
                    (Trip trip) -> Optional.ofNullable(trip.getCompletionProcessedAt()).orElse(trip.getActualEndTime()),
                    Comparator.nullsLast(Comparator.naturalOrder())
                ).reversed())
                .limit(12)
                .map(this::toTripRow)
                .toList()
        );
    }

    public VehicleAnalyticsDTO getVehicleAnalytics(LocalDateTime startDate, LocalDateTime endDate) {
        List<Trip> trips = filteredTrips(startDate, endDate, null);
        List<Vehicle> vehicles = vehicleRepository.findAll();
        Map<String, List<Trip>> tripsByVehicle = trips.stream()
            .filter(trip -> trip.getAssignedVehicleId() != null)
            .collect(Collectors.groupingBy(Trip::getAssignedVehicleId));

        List<MaintenanceScheduleDTO> schedules = maintenanceScheduleService.getSchedules();
        Map<String, MaintenanceScheduleDTO> blockingByVehicle = schedules.stream()
            .filter(schedule -> schedule.blockDispatch() && List.of(MaintenanceScheduleStatus.PLANNED, MaintenanceScheduleStatus.IN_PROGRESS).contains(schedule.status()))
            .collect(Collectors.toMap(
                MaintenanceScheduleDTO::vehicleId,
                Function.identity(),
                (left, right) -> left.plannedStartDate().isAfter(right.plannedStartDate()) ? left : right
            ));

        List<VehicleAnalyticsRowDTO> rows = vehicles.stream()
            .map(vehicle -> {
                List<Trip> vehicleTrips = tripsByVehicle.getOrDefault(vehicle.getId(), List.of());
                long completedTrips = vehicleTrips.stream().filter(trip -> trip.getStatus() == TripStatus.COMPLETED).count();
                long activeTrips = vehicleTrips.stream().filter(
                    trip -> trip.getStatus() == TripStatus.IN_PROGRESS
                        || trip.getStatus() == TripStatus.PAUSED
                        || trip.getStatus() == TripStatus.DISPATCHED
                ).count();
                double utilization = vehicleTrips.isEmpty() ? 0.0 : roundPercent((completedTrips + activeTrips) * 100.0 / vehicleTrips.size());
                MaintenanceScheduleDTO blockingSchedule = blockingByVehicle.get(vehicle.getId());
                return new VehicleAnalyticsRowDTO(
                    vehicle.getId(),
                    vehicle.getName(),
                    vehicle.getStatus(),
                    vehicle.getLocation(),
                    vehicle.getMileage(),
                    blockingSchedule != null || isVehicleInMaintenance(vehicle.getStatus()),
                    vehicleTrips.size(),
                    (int) completedTrips,
                    (int) activeTrips,
                    utilization,
                    blockingSchedule == null ? "Fleet-ready" : "Blocked by " + blockingSchedule.reasonCode()
                );
            })
            .sorted(Comparator.comparing(VehicleAnalyticsRowDTO::utilizationPercent).reversed())
            .toList();

        double averageUtilization = rows.isEmpty()
            ? 0.0
            : roundPercent(rows.stream().mapToDouble(VehicleAnalyticsRowDTO::utilizationPercent).average().orElse(0.0));

        Map<String, Long> maintenanceTrend = schedules.stream()
            .filter(schedule -> isWithinRange(schedule.createdAt(), startDate, endDate))
            .collect(Collectors.groupingBy(
                schedule -> schedule.status().name(),
                Collectors.counting()
            ));

        int availableVehicles = (int) rows.stream().filter(row -> !row.maintenanceDue() && !isVehicleInMaintenance(row.status())).count();
        int blockedVehicles = rows.size() - availableVehicles;

        return new VehicleAnalyticsDTO(
            now(),
            startDate,
            endDate,
            List.of(
                new DashboardKpiDTO("fleet-size", "Fleet size", String.valueOf(rows.size()), "Registered vehicles in the fleet", "blue"),
                new DashboardKpiDTO("available", "Available", String.valueOf(availableVehicles), "Vehicles cleared for dispatch", "mint"),
                new DashboardKpiDTO("blocked", "Blocked", String.valueOf(blockedVehicles), "Vehicles in maintenance or hold", "rose"),
                new DashboardKpiDTO("avg-utilization", "Utilization", formatPercent(averageUtilization), "Average trip utilization by vehicle", "teal")
            ),
            averageUtilization,
            rows,
            buildCategoryTrends(maintenanceTrend, "maintenance")
        );
    }

    public DriverAnalyticsDTO getDriverAnalytics(LocalDateTime startDate, LocalDateTime endDate) {
        List<Trip> trips = filteredTrips(startDate, endDate, null);
        List<Driver> drivers = driverRepository.findAll();
        Map<String, List<Trip>> tripsByDriver = trips.stream()
            .filter(trip -> trip.getAssignedDriverId() != null)
            .collect(Collectors.groupingBy(Trip::getAssignedDriverId));

        List<DriverAnalyticsRowDTO> rows = drivers.stream()
            .map(driver -> {
                List<Trip> driverTrips = tripsByDriver.getOrDefault(driver.getId(), List.of());
                long completedTrips = driverTrips.stream().filter(trip -> trip.getStatus() == TripStatus.COMPLETED).count();
                long activeTrips = driverTrips.stream().filter(
                    trip -> trip.getStatus() == TripStatus.IN_PROGRESS
                        || trip.getStatus() == TripStatus.PAUSED
                        || trip.getStatus() == TripStatus.DISPATCHED
                ).count();
                double productivity = driverTrips.isEmpty() ? 0.0 : roundPercent(completedTrips * 100.0 / driverTrips.size());
                return new DriverAnalyticsRowDTO(
                    driver.getId(),
                    driver.getName(),
                    driver.getStatus(),
                    driver.getLicenseType(),
                    driver.getAssignedVehicleId(),
                    driver.getHoursDrivenToday(),
                    driverTrips.size(),
                    (int) completedTrips,
                    productivity,
                    activeTrips > 0 ? "Live trip assigned" : (completedTrips > 0 ? "Completed in selected range" : "Idle in selected range")
                );
            })
            .sorted(Comparator.comparing(DriverAnalyticsRowDTO::productivityPercent).reversed())
            .toList();

        double averageProductivity = rows.isEmpty()
            ? 0.0
            : roundPercent(rows.stream().mapToDouble(DriverAnalyticsRowDTO::productivityPercent).average().orElse(0.0));

        Map<String, Long> dutyTrend = drivers.stream()
            .collect(Collectors.groupingBy(
                driver -> driver.getStatus() == null ? "Unknown" : driver.getStatus(),
                Collectors.counting()
            ));

        return new DriverAnalyticsDTO(
            now(),
            startDate,
            endDate,
            List.of(
                new DashboardKpiDTO("driver-count", "Drivers", String.valueOf(rows.size()), "Registered drivers in the fleet", "blue"),
                new DashboardKpiDTO("on-duty", "On duty", String.valueOf(rows.stream().filter(row -> isDriverOnDuty(row.status())).count()), "Drivers ready for live work", "mint"),
                new DashboardKpiDTO("avg-hours", "Avg hours", String.format(Locale.ROOT, "%.1f h", rows.stream().mapToDouble(DriverAnalyticsRowDTO::hoursDrivenToday).average().orElse(0.0)), "Today's duty load", "amber"),
                new DashboardKpiDTO("avg-productivity", "Productivity", formatPercent(averageProductivity), "Completed trips versus assigned trips", "teal")
            ),
            averageProductivity,
            rows,
            buildCategoryTrends(dutyTrend, "drivers")
        );
    }

    public DriverPerformanceDashboardDTO getDriverPerformance(LocalDateTime startDate, LocalDateTime endDate) {
        List<Trip> trips = filteredTrips(startDate, endDate, null);
        AppRole currentRole = currentUserService.getCurrentRole();
        String scopedDriverId = currentRole == AppRole.DRIVER ? currentUserService.getRequiredUser().getId() : null;

        List<Driver> drivers = driverRepository.findAll().stream()
            .filter(driver -> scopedDriverId == null || driver.getId().equalsIgnoreCase(scopedDriverId))
            .toList();

        Map<String, List<Trip>> tripsByDriver = trips.stream()
            .filter(trip -> trip.getAssignedDriverId() != null && !trip.getAssignedDriverId().isBlank())
            .collect(Collectors.groupingBy(Trip::getAssignedDriverId));

        Set<String> relevantTripIds = trips.stream()
            .map(Trip::getId)
            .filter(id -> id != null && !id.isBlank())
            .collect(Collectors.toSet());

        Map<String, List<Telemetry>> telemetryByTrip = telemetryRepository.findAll().stream()
            .filter(telemetry -> telemetry.getTripId() != null && relevantTripIds.contains(telemetry.getTripId()))
            .filter(telemetry -> isWithinRange(telemetry.getTimestamp(), startDate, endDate))
            .collect(Collectors.groupingBy(Telemetry::getTripId));

        List<Alert> relevantAlerts = alertRepository.findAll().stream()
            .filter(alert -> alert.getCategory() == AlertCategory.SAFETY)
            .filter(alert -> isWithinRange(alert.getCreatedAt(), startDate, endDate))
            .toList();

        List<DriverPerformanceRowDTO> rows = drivers.stream()
            .map(driver -> toDriverPerformanceRow(driver, tripsByDriver.getOrDefault(driver.getId(), List.of()), telemetryByTrip, relevantAlerts))
            .sorted(Comparator.comparing(DriverPerformanceRowDTO::tripsCompleted).reversed()
                .thenComparing(Comparator.comparing(DriverPerformanceRowDTO::safetyScore).reversed())
                .thenComparing(Comparator.comparing(DriverPerformanceRowDTO::onTimePercent).reversed()))
            .toList();

        double fleetOnTimePercent = rows.isEmpty()
            ? 0.0
            : roundPercent(rows.stream().mapToDouble(DriverPerformanceRowDTO::onTimePercent).average().orElse(0.0));
        int totalCompletedTrips = rows.stream().mapToInt(DriverPerformanceRowDTO::tripsCompleted).sum();
        double averageSafetyScore = rows.isEmpty()
            ? 0.0
            : roundOneDecimal(rows.stream().mapToDouble(DriverPerformanceRowDTO::safetyScore).average().orElse(0.0));
        double averageSpeedKph = rows.isEmpty()
            ? 0.0
            : roundOneDecimal(rows.stream().mapToDouble(DriverPerformanceRowDTO::averageSpeedKph).average().orElse(0.0));

        List<DashboardKpiDTO> kpis = List.of(
            new DashboardKpiDTO("driver-performance-on-time", "On-time %", formatPercent(fleetOnTimePercent), "Average completion punctuality across scoped drivers", "blue"),
            new DashboardKpiDTO("driver-performance-trips", "Trips completed", String.valueOf(totalCompletedTrips), "Completed trips in the selected period", "teal"),
            new DashboardKpiDTO("driver-performance-safety", "Safety score", formatScore(averageSafetyScore), "Safety score blends overspeed behavior and safety alerts", "mint"),
            new DashboardKpiDTO("driver-performance-speed", "Avg speed", formatSpeed(averageSpeedKph), "Average observed travel speed from telemetry and completed trips", "amber")
        );

        return new DriverPerformanceDashboardDTO(
            now(),
            startDate,
            endDate,
            kpis,
            fleetOnTimePercent,
            totalCompletedTrips,
            0.0,
            0.0,
            averageSafetyScore,
            averageSafetyScore >= 85.0 ? "Excellent" : averageSafetyScore >= 65.0 ? "Good" : "Poor",
            rows.stream().mapToLong(DriverPerformanceRowDTO::overspeedEvents).sum(),
            rows.stream().mapToLong(DriverPerformanceRowDTO::safetyIncidents).sum(),
            0L,
            averageSpeedKph,
            0.0,
            0.0,
            0.0,
            0.0,
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            rows
        );
    }

    private DriverPerformanceRowDTO toDriverPerformanceRow(
        Driver driver,
        List<Trip> driverTrips,
        Map<String, List<Telemetry>> telemetryByTrip,
        List<Alert> relevantAlerts
    ) {
        List<Trip> completedTrips = driverTrips.stream()
            .filter(trip -> trip.getStatus() == TripStatus.COMPLETED)
            .toList();

        long onTimeCompleted = completedTrips.stream()
            .filter(this::isTripOnTime)
            .count();

        double onTimePercent = completedTrips.isEmpty()
            ? 0.0
            : roundPercent(onTimeCompleted * 100.0 / completedTrips.size());

        List<Telemetry> telemetryPoints = driverTrips.stream()
            .flatMap(trip -> telemetryByTrip.getOrDefault(trip.getId(), List.of()).stream())
            .toList();

        long overspeedEvents = telemetryPoints.stream()
            .filter(telemetry -> telemetry.getSpeed() > 80)
            .count();

        double averageSpeedKph = telemetryPoints.isEmpty()
            ? fallbackAverageSpeed(driverTrips)
            : roundOneDecimal(telemetryPoints.stream().mapToDouble(Telemetry::getSpeed).average().orElse(0.0));

        Set<String> driverTripIds = driverTrips.stream()
            .map(Trip::getId)
            .filter(id -> id != null && !id.isBlank())
            .collect(Collectors.toSet());

        List<Alert> driverSafetyAlerts = relevantAlerts.stream()
            .filter(alert -> matchesDriverSafetyAlert(alert, driver.getId(), driverTripIds))
            .toList();

        double safetyScore = calculateSafetyScore(telemetryPoints.size(), overspeedEvents, driverSafetyAlerts);

        return new DriverPerformanceRowDTO(
            driver.getId(),
            driver.getName(),
            driver.getStatus(),
            driver.getLicenseType(),
            driver.getAssignedVehicleId(),
            driverTrips.size(),
            completedTrips.size(),
            onTimePercent,
            safetyScore,
            averageSpeedKph,
            overspeedEvents,
            driverSafetyAlerts.size(),
            buildDriverPerformanceNote(driverTrips.size(), completedTrips.size(), overspeedEvents, driverSafetyAlerts.size())
        );
    }

    private List<Trip> filteredTrips(LocalDateTime startDate, LocalDateTime endDate, TripStatus status) {
        return tripRepository.findAll().stream()
            .filter(trip -> status == null || trip.getStatus() == status)
            .filter(trip -> isTripWithinRange(trip, startDate, endDate))
            .sorted(Comparator.comparing(this::referenceTime, Comparator.nullsLast(Comparator.naturalOrder())).reversed())
            .toList();
    }

    private boolean isTripWithinRange(Trip trip, LocalDateTime startDate, LocalDateTime endDate) {
        if (startDate == null && endDate == null) {
            return true;
        }

        LocalDateTime reference = referenceTime(trip);
        if (reference == null) {
            return false;
        }

        if (startDate != null && reference.isBefore(startDate)) {
            return false;
        }

        if (endDate != null && reference.isAfter(endDate)) {
            return false;
        }

        return true;
    }

    private LocalDateTime referenceTime(Trip trip) {
        if (trip == null) {
            return null;
        }

        if (trip.getCompletionProcessedAt() != null) {
            return trip.getCompletionProcessedAt();
        }

        if (trip.getActualEndTime() != null) {
            return trip.getActualEndTime();
        }

        if (trip.getActualStartTime() != null) {
            return trip.getActualStartTime();
        }

        return trip.getPlannedStartTime();
    }

    private boolean isWithinRange(LocalDateTime timestamp, LocalDateTime startDate, LocalDateTime endDate) {
        if (timestamp == null) {
            return false;
        }

        if (startDate != null && timestamp.isBefore(startDate)) {
            return false;
        }

        if (endDate != null && timestamp.isAfter(endDate)) {
            return false;
        }

        return true;
    }

    private boolean isDelayed(Trip trip, LocalDateTime now) {
        if (trip == null || trip.getPlannedEndTime() == null) {
            return false;
        }

        if (trip.getStatus() == TripStatus.COMPLETED && trip.getActualEndTime() != null) {
            return trip.getActualEndTime().isAfter(trip.getPlannedEndTime());
        }

        return List.of(TripStatus.DRAFT, TripStatus.VALIDATED, TripStatus.OPTIMIZED, TripStatus.DISPATCHED, TripStatus.IN_PROGRESS, TripStatus.PAUSED)
            .contains(trip.getStatus())
            && trip.getPlannedEndTime().isBefore(now);
    }

    private long delayMinutes(Trip trip, LocalDateTime now) {
        if (trip == null || trip.getPlannedEndTime() == null) {
            return 0;
        }

        LocalDateTime reference = trip.getActualEndTime() != null ? trip.getActualEndTime() : now;
        return Math.max(0, Duration.between(trip.getPlannedEndTime(), reference).toMinutes());
    }

    private TripAnalyticsRowDTO toTripRow(Trip trip) {
        return new TripAnalyticsRowDTO(
            trip.getId(),
            trip.getRouteId(),
            trip.getAssignedVehicleId(),
            trip.getAssignedDriverId(),
            trip.getStatus(),
            trip.getPlannedEndTime(),
            trip.getActualEndTime(),
            trip.getDelayMinutes(),
            trip.getActualDistance(),
            trip.getFuelUsed(),
            trip.getCompletionProcessedAt()
        );
    }

    private List<AnalyticsTrendDTO> buildDelayBuckets(List<Trip> delayedTrips) {
        Map<String, Long> buckets = new HashMap<>();
        buckets.put("0-15 min", 0L);
        buckets.put("16-30 min", 0L);
        buckets.put("31-60 min", 0L);
        buckets.put("60+ min", 0L);

        for (Trip trip : delayedTrips) {
            long minutes = Math.max(0, delayMinutes(trip, now()));
            String bucket = minutes <= 15 ? "0-15 min" : minutes <= 30 ? "16-30 min" : minutes <= 60 ? "31-60 min" : "60+ min";
            buckets.put(bucket, buckets.get(bucket) + 1);
        }

        return List.of(
            new AnalyticsTrendDTO("0-15 min", buckets.get("0-15 min"), "Short delays"),
            new AnalyticsTrendDTO("16-30 min", buckets.get("16-30 min"), "Moderate delays"),
            new AnalyticsTrendDTO("31-60 min", buckets.get("31-60 min"), "Material delays"),
            new AnalyticsTrendDTO("60+ min", buckets.get("60+ min"), "Severe delays")
        );
    }

    private List<AnalyticsTrendDTO> buildCategoryTrends(Map<String, Long> counts, String noteSuffix) {
        return counts.entrySet().stream()
            .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
            .map(entry -> new AnalyticsTrendDTO(entry.getKey(), entry.getValue(), "Counted from persisted " + noteSuffix))
            .toList();
    }

    private double calculateFuelEfficiency(List<Trip> completedTrips) {
        double totalDistance = 0.0;
        double totalFuel = 0.0;

        for (Trip trip : completedTrips) {
            if (trip.getFuelUsed() != null && trip.getFuelUsed() > 0) {
                totalDistance += trip.getActualDistance();
                totalFuel += trip.getFuelUsed();
                continue;
            }

            List<Telemetry> telemetry = telemetryRepository.findByTripIdOrderByTimestampAsc(trip.getId());
            if (telemetry.size() >= 2) {
                double fuelUsed = telemetry.get(0).getFuelLevel() - telemetry.get(telemetry.size() - 1).getFuelLevel();
                if (fuelUsed > 0) {
                    totalDistance += trip.getActualDistance();
                    totalFuel += fuelUsed;
                }
            }
        }

        if (totalDistance <= 0 || totalFuel <= 0) {
            return 0.0;
        }

        return roundTwoDecimals(totalDistance / totalFuel);
    }

    private boolean isTripOnTime(Trip trip) {
        return trip != null
            && trip.getActualEndTime() != null
            && trip.getPlannedEndTime() != null
            && !trip.getActualEndTime().isAfter(trip.getPlannedEndTime());
    }

    private double fallbackAverageSpeed(List<Trip> driverTrips) {
        double totalDistance = 0.0;
        double totalHours = 0.0;

        for (Trip trip : driverTrips) {
            LocalDateTime start = trip.getActualStartTime();
            LocalDateTime end = trip.getActualEndTime();
            if (start == null || end == null || !end.isAfter(start) || trip.getActualDistance() <= 0) {
                continue;
            }

            totalDistance += trip.getActualDistance();
            totalHours += Duration.between(start, end).toMinutes() / 60.0;
        }

        if (totalDistance <= 0 || totalHours <= 0) {
            return 0.0;
        }

        return roundOneDecimal(totalDistance / totalHours);
    }

    private boolean matchesDriverSafetyAlert(Alert alert, String driverId, Set<String> driverTripIds) {
        if (alert == null) {
            return false;
        }

        if (alert.getRelatedTripId() != null && driverTripIds.contains(alert.getRelatedTripId())) {
            return true;
        }

        return "driver-sos".equalsIgnoreCase(alert.getSourceType())
            && alert.getSourceId() != null
            && alert.getSourceId().equalsIgnoreCase(driverId);
    }

    private double calculateSafetyScore(int telemetryPoints, long overspeedEvents, List<Alert> safetyAlerts) {
        double telemetryScore = telemetryPoints == 0
            ? 100.0
            : Math.max(0.0, (1.0 - (overspeedEvents / (double) telemetryPoints)) * 100.0);

        double alertPenalty = safetyAlerts.stream()
            .mapToDouble(alert -> switch (alert.getSeverity()) {
                case LOW -> 2.0;
                case MEDIUM -> 5.0;
                case HIGH -> 8.0;
                case CRITICAL -> 12.0;
            })
            .sum();

        return roundOneDecimal(clamp(telemetryScore - alertPenalty, 0.0, 100.0));
    }

    private String buildDriverPerformanceNote(int totalTrips, int completedTrips, long overspeedEvents, int safetyIncidents) {
        if (totalTrips == 0) {
            return "No trip records in the selected range.";
        }

        List<String> notes = new ArrayList<>();
        notes.add(completedTrips + " completed");

        if (overspeedEvents > 0) {
            notes.add(overspeedEvents + " overspeed events");
        }

        if (safetyIncidents > 0) {
            notes.add(safetyIncidents + " safety incidents");
        }

        if (overspeedEvents == 0 && safetyIncidents == 0) {
            notes.add("clean safety run");
        }

        return String.join(" | ", notes);
    }

    private double roundPercent(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private double roundOneDecimal(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private double roundTwoDecimals(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private String formatPercent(double value) {
        return String.format(Locale.ROOT, "%.1f%%", value);
    }

    private String formatMinutes(double value) {
        return String.format(Locale.ROOT, "%.1f min", value);
    }

    private String formatSpeed(double value) {
        return String.format(Locale.ROOT, "%.1f km/h", value);
    }

    private String formatScore(double value) {
        return String.format(Locale.ROOT, "%.1f / 100", value);
    }

    private double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private LocalDateTime now() {
        return LocalDateTime.now();
    }

    private boolean isDriverOnDuty(String value) {
        try {
            return DriverDutyStatus.fromValue(value) == DriverDutyStatus.ON_DUTY;
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    private boolean isVehicleInMaintenance(String value) {
        try {
            return VehicleOperationalStatus.fromValue(value) == VehicleOperationalStatus.MAINTENANCE;
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }
}
