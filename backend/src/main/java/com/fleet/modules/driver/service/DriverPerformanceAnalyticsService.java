package com.fleet.modules.driver.service;

import com.fleet.modules.alert.entity.Alert;
import com.fleet.modules.alert.entity.AlertCategory;
import com.fleet.modules.alert.repository.AlertRepository;
import com.fleet.modules.analytics.dto.DashboardKpiDTO;
import com.fleet.modules.analytics.dto.DriverBehaviorInsightDTO;
import com.fleet.modules.analytics.dto.DriverFuelEfficiencyPointDTO;
import com.fleet.modules.analytics.dto.DriverPerformanceDashboardDTO;
import com.fleet.modules.analytics.dto.DriverPerformanceRowDTO;
import com.fleet.modules.analytics.dto.DriverPerformanceTrendPointDTO;
import com.fleet.modules.analytics.dto.DriverTimeComparisonPointDTO;
import com.fleet.modules.analytics.dto.DriverTripHistoryDTO;
import com.fleet.modules.analytics.dto.DriverTripHistoryRowDTO;
import com.fleet.modules.auth.entity.AppRole;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.driver.entity.Driver;
import com.fleet.modules.driver.repository.DriverRepository;
import com.fleet.modules.telemetry.entity.Telemetry;
import com.fleet.modules.telemetry.repository.TelemetryRepository;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class DriverPerformanceAnalyticsService {

    private static final double OVERSPEED_THRESHOLD_KPH = 80.0;
    private static final double IDLE_SPEED_THRESHOLD_KPH = 5.0;
    private static final long IDLE_GAP_THRESHOLD_MINUTES = 2L;
    private static final DateTimeFormatter SHORT_DAY_FORMAT = DateTimeFormatter.ofPattern("dd MMM", Locale.ROOT);

    private final TripRepository tripRepository;
    private final DriverRepository driverRepository;
    private final TelemetryRepository telemetryRepository;
    private final AlertRepository alertRepository;
    private final CurrentUserService currentUserService;

    public DriverPerformanceAnalyticsService(
        TripRepository tripRepository,
        DriverRepository driverRepository,
        TelemetryRepository telemetryRepository,
        AlertRepository alertRepository,
        CurrentUserService currentUserService
    ) {
        this.tripRepository = tripRepository;
        this.driverRepository = driverRepository;
        this.telemetryRepository = telemetryRepository;
        this.alertRepository = alertRepository;
        this.currentUserService = currentUserService;
    }

    public DriverPerformanceDashboardDTO getDriverPerformance(LocalDateTime startDate, LocalDateTime endDate) {
        Scope scope = resolveScope();
        List<Driver> drivers = driverRepository.findAll().stream()
            .filter(driver -> scope.driverIds() == null || scope.driverIds().contains(driver.getId()))
            .toList();

        List<Trip> scopedTrips = scopedTrips(startDate, endDate, null, scope.driverIds());
        DriverAggregation overall = aggregate(scope.driverIds(), scopedTrips);
        DriverAggregation previous = aggregatePreviousPeriod(startDate, endDate, scope.driverIds());

        Map<String, List<Trip>> tripsByDriver = scopedTrips.stream()
            .filter(trip -> trip.getAssignedDriverId() != null && !trip.getAssignedDriverId().isBlank())
            .collect(Collectors.groupingBy(Trip::getAssignedDriverId));

        List<DriverPerformanceRowDTO> rows = drivers.stream()
            .map(driver -> buildDriverRow(driver, tripsByDriver.getOrDefault(driver.getId(), List.of())))
            .sorted(Comparator.comparing(DriverPerformanceRowDTO::tripsCompleted).reversed()
                .thenComparing(Comparator.comparing(DriverPerformanceRowDTO::safetyScore).reversed()))
            .toList();

        return new DriverPerformanceDashboardDTO(
            now(),
            startDate,
            endDate,
            List.of(
                new DashboardKpiDTO(
                    "driver-performance-trips-completed",
                    "Trips completed",
                    String.valueOf(overall.completedTrips()),
                    "Historical trips completed in the selected period",
                    "blue"
                ),
                new DashboardKpiDTO(
                    "driver-performance-on-time",
                    "On-time delivery %",
                    formatPercent(overall.onTimePercent()),
                    "Completed trips delivered on or before plan",
                    "teal"
                ),
                new DashboardKpiDTO(
                    "driver-performance-distance",
                    "Total distance covered",
                    formatDistance(overall.totalDistanceCoveredKm()),
                    "Actual completed distance from persisted trip records",
                    "mint"
                ),
                new DashboardKpiDTO(
                    "driver-performance-duration",
                    "Avg trip duration",
                    formatDuration(overall.averageTripDurationMinutes()),
                    "Average actual trip duration across completed trips",
                    "amber"
                )
            ),
            overall.onTimePercent(),
            overall.completedTrips(),
            overall.totalDistanceCoveredKm(),
            overall.averageTripDurationMinutes(),
            overall.safetyScore(),
            safetyStatus(overall.safetyScore()),
            overall.overspeedEvents(),
            overall.routeDeviationEvents(),
            overall.idleMinutes(),
            overall.averageSpeedKph(),
            overall.averageFuelConsumptionPer100Km(),
            overall.averageFuelEfficiencyKmPerUnit(),
            overall.averageDelayMinutes(),
            overall.delayFrequencyPercent(),
            buildTripsOverTime(overall.completedTripsList()),
            buildDistanceVsFuel(overall.completedTripsList(), overall.telemetryByTrip()),
            buildPlannedVsActualTime(overall.completedTripsList()),
            buildInsights(overall, previous),
            rows
        );
    }

    public DriverTripHistoryDTO getTripHistory(LocalDateTime startDate, LocalDateTime endDate, TripStatus status) {
        Scope scope = resolveScope();
        List<Trip> trips = scopedTrips(startDate, endDate, status, scope.driverIds());

        List<DriverTripHistoryRowDTO> rows = trips.stream()
            .sorted(Comparator.comparing(this::referenceTime, Comparator.nullsLast(Comparator.naturalOrder())).reversed())
            .map(this::toHistoryRow)
            .toList();

        double totalDistanceCoveredKm = roundOneDecimal(rows.stream().mapToInt(DriverTripHistoryRowDTO::distanceKm).sum());
        double averageTripDurationMinutes = rows.isEmpty()
            ? 0.0
            : roundOneDecimal(rows.stream().mapToLong(DriverTripHistoryRowDTO::durationMinutes).average().orElse(0.0));

        return new DriverTripHistoryDTO(
            now(),
            startDate,
            endDate,
            status == null ? "ALL" : status.name(),
            rows.size(),
            totalDistanceCoveredKm,
            averageTripDurationMinutes,
            rows
        );
    }

    private DriverPerformanceRowDTO buildDriverRow(Driver driver, List<Trip> trips) {
        DriverAggregation aggregation = aggregate(Set.of(driver.getId()), trips);
        return new DriverPerformanceRowDTO(
            driver.getId(),
            driver.getName(),
            driver.getStatus(),
            driver.getLicenseType(),
            driver.getAssignedVehicleId(),
            aggregation.totalTrips(),
            aggregation.completedTrips(),
            aggregation.onTimePercent(),
            aggregation.safetyScore(),
            aggregation.averageSpeedKph(),
            aggregation.overspeedEvents(),
            aggregation.routeDeviationEvents(),
            buildDriverNote(aggregation)
        );
    }

    private DriverAggregation aggregatePreviousPeriod(LocalDateTime startDate, LocalDateTime endDate, Set<String> scopedDriverIds) {
        if (startDate == null || endDate == null || !endDate.isAfter(startDate)) {
            return DriverAggregation.empty(Map.of());
        }

        Duration window = Duration.between(startDate, endDate);
        LocalDateTime previousEnd = startDate.minusSeconds(1);
        LocalDateTime previousStart = previousEnd.minus(window);
        return aggregate(scopedDriverIds, scopedTrips(previousStart, previousEnd, null, scopedDriverIds));
    }

    private DriverAggregation aggregate(Set<String> scopedDriverIds, List<Trip> trips) {
        Set<String> tripIds = trips.stream()
            .map(Trip::getId)
            .filter(id -> id != null && !id.isBlank())
            .collect(Collectors.toSet());

        Map<String, List<Telemetry>> telemetryByTrip = telemetryRepository.findAll().stream()
            .filter(telemetry -> telemetry.getTripId() != null && tripIds.contains(telemetry.getTripId()))
            .collect(Collectors.groupingBy(
                Telemetry::getTripId,
                Collectors.collectingAndThen(Collectors.toList(), list -> list.stream()
                    .sorted(Comparator.comparing(Telemetry::getTimestamp, Comparator.nullsLast(Comparator.naturalOrder())))
                    .toList())
            ));

        List<Alert> routeDeviationAlerts = alertRepository.findAll().stream()
            .filter(alert -> alert.getCategory() == AlertCategory.ROUTE_DEVIATION)
            .filter(alert -> alert.getRelatedTripId() != null && tripIds.contains(alert.getRelatedTripId()))
            .toList();

        List<Trip> completedTrips = trips.stream()
            .filter(trip -> trip.getStatus() == TripStatus.COMPLETED)
            .sorted(Comparator.comparing(this::referenceTime, Comparator.nullsLast(Comparator.naturalOrder())))
            .toList();

        long onTimeCompleted = completedTrips.stream().filter(this::isTripOnTime).count();
        double onTimePercent = completedTrips.isEmpty()
            ? 0.0
            : roundPercent(onTimeCompleted * 100.0 / completedTrips.size());

        double totalDistanceCoveredKm = roundOneDecimal(completedTrips.stream().mapToInt(Trip::getActualDistance).sum());
        double averageTripDurationMinutes = completedTrips.isEmpty()
            ? 0.0
            : roundOneDecimal(completedTrips.stream().mapToLong(this::resolveActualDurationMinutes).average().orElse(0.0));

        long overspeedEvents = telemetryByTrip.values().stream()
            .flatMap(List::stream)
            .filter(point -> point.getSpeed() > OVERSPEED_THRESHOLD_KPH)
            .count();

        long idleMinutes = telemetryByTrip.values().stream()
            .mapToLong(this::calculateIdleMinutes)
            .sum();

        long routeDeviationEvents = routeDeviationAlerts.size();

        double averageSpeedKph = telemetryByTrip.values().stream()
            .flatMap(List::stream)
            .mapToDouble(Telemetry::getSpeed)
            .average()
            .orElseGet(() -> fallbackAverageSpeed(trips));
        averageSpeedKph = roundOneDecimal(averageSpeedKph);

        FuelMetrics fuelMetrics = calculateFuelMetrics(completedTrips, telemetryByTrip);

        List<Trip> delayedTrips = completedTrips.stream()
            .filter(trip -> resolveDelayMinutes(trip) > 0)
            .toList();
        double averageDelayMinutes = delayedTrips.isEmpty()
            ? 0.0
            : roundOneDecimal(delayedTrips.stream().mapToLong(this::resolveDelayMinutes).average().orElse(0.0));
        double delayFrequencyPercent = completedTrips.isEmpty()
            ? 0.0
            : roundPercent(delayedTrips.size() * 100.0 / completedTrips.size());

        double safetyScore = calculateSafetyScore(completedTrips.size(), overspeedEvents, routeDeviationEvents, idleMinutes);

        return new DriverAggregation(
            trips.size(),
            completedTrips.size(),
            onTimePercent,
            totalDistanceCoveredKm,
            averageTripDurationMinutes,
            safetyScore,
            averageSpeedKph,
            overspeedEvents,
            routeDeviationEvents,
            idleMinutes,
            fuelMetrics.averageFuelConsumptionPer100Km(),
            fuelMetrics.averageKmPerFuelUnit(),
            averageDelayMinutes,
            delayFrequencyPercent,
            completedTrips,
            telemetryByTrip
        );
    }

    private List<Trip> scopedTrips(LocalDateTime startDate, LocalDateTime endDate, TripStatus status, Set<String> scopedDriverIds) {
        return tripRepository.findAll().stream()
            .filter(trip -> scopedDriverIds == null || scopedDriverIds.contains(trip.getAssignedDriverId()))
            .filter(trip -> status == null || trip.getStatus() == status)
            .filter(trip -> isTripWithinRange(trip, startDate, endDate))
            .toList();
    }

    private Scope resolveScope() {
        AppRole role = currentUserService.getCurrentRole();
        if (role == AppRole.DRIVER) {
            return new Scope(role, Set.of(currentUserService.getRequiredUser().getId()));
        }

        return new Scope(role, null);
    }

    private DriverTripHistoryRowDTO toHistoryRow(Trip trip) {
        long plannedDurationMinutes = resolvePlannedDurationMinutes(trip);
        long actualDurationMinutes = resolveActualDurationMinutes(trip);
        long durationMinutes = actualDurationMinutes > 0 ? actualDurationMinutes : plannedDurationMinutes;

        return new DriverTripHistoryRowDTO(
            trip.getId(),
            referenceTime(trip),
            trip.getStatus(),
            trip.getActualDistance(),
            durationMinutes,
            plannedDurationMinutes,
            actualDurationMinutes,
            resolveDelayMinutes(trip),
            trip.getFuelUsed()
        );
    }

    private List<DriverPerformanceTrendPointDTO> buildTripsOverTime(List<Trip> completedTrips) {
        if (completedTrips.isEmpty()) {
            return List.of();
        }

        Map<LocalDate, List<Trip>> byDate = completedTrips.stream()
            .filter(trip -> referenceTime(trip) != null)
            .collect(Collectors.groupingBy(trip -> referenceTime(trip).toLocalDate(), LinkedHashMap::new, Collectors.toList()));

        return byDate.entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .map(entry -> {
                List<Trip> dailyTrips = entry.getValue();
                long onTime = dailyTrips.stream().filter(this::isTripOnTime).count();
                double onTimePercent = dailyTrips.isEmpty() ? 0.0 : roundPercent(onTime * 100.0 / dailyTrips.size());
                double distanceKm = roundOneDecimal(dailyTrips.stream().mapToInt(Trip::getActualDistance).sum());
                return new DriverPerformanceTrendPointDTO(
                    entry.getKey().format(SHORT_DAY_FORMAT),
                    dailyTrips.size(),
                    onTimePercent,
                    distanceKm
                );
            })
            .toList();
    }

    private List<DriverFuelEfficiencyPointDTO> buildDistanceVsFuel(List<Trip> completedTrips, Map<String, List<Telemetry>> telemetryByTrip) {
        return completedTrips.stream()
            .sorted(Comparator.comparing(this::referenceTime, Comparator.nullsLast(Comparator.naturalOrder())))
            .map(trip -> {
                double fuelUsed = resolveFuelUsed(trip, telemetryByTrip.getOrDefault(trip.getId(), List.of()));
                if (trip.getActualDistance() <= 0 || fuelUsed <= 0) {
                    return null;
                }

                return new DriverFuelEfficiencyPointDTO(
                    trip.getId(),
                    buildTripLabel(trip),
                    trip.getActualDistance(),
                    roundOneDecimal(fuelUsed),
                    roundOneDecimal((fuelUsed / trip.getActualDistance()) * 100.0)
                );
            })
            .filter(point -> point != null)
            .limit(8)
            .toList();
    }

    private List<DriverTimeComparisonPointDTO> buildPlannedVsActualTime(List<Trip> completedTrips) {
        return completedTrips.stream()
            .sorted(Comparator.comparing(this::referenceTime, Comparator.nullsLast(Comparator.naturalOrder())))
            .map(trip -> new DriverTimeComparisonPointDTO(
                trip.getId(),
                buildTripLabel(trip),
                resolvePlannedDurationMinutes(trip),
                resolveActualDurationMinutes(trip),
                resolveDelayMinutes(trip)
            ))
            .limit(8)
            .toList();
    }

    private List<DriverBehaviorInsightDTO> buildInsights(DriverAggregation current, DriverAggregation previous) {
        List<DriverBehaviorInsightDTO> insights = new ArrayList<>();

        if (current.overspeedEvents() > 0) {
            insights.add(new DriverBehaviorInsightDTO(
                "overspeed-alert",
                "You exceeded the speed threshold " + current.overspeedEvents() + " time" + (current.overspeedEvents() == 1 ? "" : "s") + " in this period.",
                "amber"
            ));
        } else {
            insights.add(new DriverBehaviorInsightDTO(
                "overspeed-clean",
                "No over-speeding events were detected in the selected period.",
                "emerald"
            ));
        }

        if (current.routeDeviationEvents() > 0) {
            insights.add(new DriverBehaviorInsightDTO(
                "route-deviation",
                "Route deviation alerts were triggered " + current.routeDeviationEvents() + " time" + (current.routeDeviationEvents() == 1 ? "" : "s") + ".",
                "rose"
            ));
        }

        if (previous != null && previous.completedTrips() > 0) {
            double onTimeDelta = roundOneDecimal(current.onTimePercent() - previous.onTimePercent());
            if (Math.abs(onTimeDelta) >= 0.1) {
                insights.add(new DriverBehaviorInsightDTO(
                    "on-time-delta",
                    "On-time delivery " + (onTimeDelta >= 0 ? "improved" : "declined") + " by " + formatPercent(Math.abs(onTimeDelta)) + " versus the previous period.",
                    onTimeDelta >= 0 ? "teal" : "rose"
                ));
            }

            double delayDelta = roundOneDecimal(previous.delayFrequencyPercent() - current.delayFrequencyPercent());
            if (Math.abs(delayDelta) >= 0.1) {
                insights.add(new DriverBehaviorInsightDTO(
                    "delay-delta",
                    "Delay frequency " + (delayDelta >= 0 ? "improved" : "worsened") + " by " + formatPercent(Math.abs(delayDelta)) + " versus the previous period.",
                    delayDelta >= 0 ? "emerald" : "amber"
                ));
            }
        }

        if (current.idleMinutes() > 0) {
            insights.add(new DriverBehaviorInsightDTO(
                "idle-time",
                "Idle time reached " + current.idleMinutes() + " minute" + (current.idleMinutes() == 1 ? "" : "s") + " based on historical telemetry gaps.",
                "violet"
            ));
        }

        if (current.completedTrips() == 0) {
            insights.add(new DriverBehaviorInsightDTO(
                "no-history",
                "Complete a few trips in the selected range to unlock richer trend insights.",
                "slate"
            ));
        }

        return insights.stream().limit(4).toList();
    }

    private FuelMetrics calculateFuelMetrics(List<Trip> completedTrips, Map<String, List<Telemetry>> telemetryByTrip) {
        double totalDistance = 0.0;
        double totalFuelUsed = 0.0;

        for (Trip trip : completedTrips) {
            if (trip.getActualDistance() <= 0) {
                continue;
            }

            double fuelUsed = resolveFuelUsed(trip, telemetryByTrip.getOrDefault(trip.getId(), List.of()));
            if (fuelUsed <= 0) {
                continue;
            }

            totalDistance += trip.getActualDistance();
            totalFuelUsed += fuelUsed;
        }

        if (totalDistance <= 0 || totalFuelUsed <= 0) {
            return new FuelMetrics(0.0, 0.0);
        }

        return new FuelMetrics(
            roundOneDecimal((totalFuelUsed / totalDistance) * 100.0),
            roundTwoDecimals(totalDistance / totalFuelUsed)
        );
    }

    private double resolveFuelUsed(Trip trip, List<Telemetry> telemetry) {
        if (trip.getFuelUsed() != null && trip.getFuelUsed() > 0) {
            return trip.getFuelUsed();
        }

        if (telemetry.size() < 2) {
            return 0.0;
        }

        double consumed = telemetry.get(0).getFuelLevel() - telemetry.get(telemetry.size() - 1).getFuelLevel();
        return consumed > 0 ? consumed : 0.0;
    }

    private long calculateIdleMinutes(List<Telemetry> telemetry) {
        long idleMinutes = 0L;
        for (int index = 1; index < telemetry.size(); index += 1) {
            Telemetry previous = telemetry.get(index - 1);
            Telemetry current = telemetry.get(index);
            if (previous.getTimestamp() == null || current.getTimestamp() == null) {
                continue;
            }

            if (previous.getSpeed() > IDLE_SPEED_THRESHOLD_KPH || current.getSpeed() > IDLE_SPEED_THRESHOLD_KPH) {
                continue;
            }

            long minutes = Duration.between(previous.getTimestamp(), current.getTimestamp()).toMinutes();
            if (minutes >= IDLE_GAP_THRESHOLD_MINUTES) {
                idleMinutes += minutes;
            }
        }

        return idleMinutes;
    }

    private double calculateSafetyScore(int completedTrips, long overspeedEvents, long routeDeviationEvents, long idleMinutes) {
        double base = 100.0;
        double overspeedPenalty = overspeedEvents * 4.0;
        double routeDeviationPenalty = routeDeviationEvents * 10.0;
        double idlePenalty = idleMinutes * 0.2;
        double workloadBuffer = Math.min(15.0, completedTrips * 1.5);
        return roundOneDecimal(clamp(base - overspeedPenalty - routeDeviationPenalty - idlePenalty + workloadBuffer, 0.0, 100.0));
    }

    private String buildDriverNote(DriverAggregation aggregation) {
        if (aggregation.totalTrips() == 0) {
            return "No historical trips in the selected period.";
        }

        List<String> parts = new ArrayList<>();
        parts.add(aggregation.completedTrips() + " completed");

        if (aggregation.overspeedEvents() > 0) {
            parts.add(aggregation.overspeedEvents() + " overspeed");
        }

        if (aggregation.routeDeviationEvents() > 0) {
            parts.add(aggregation.routeDeviationEvents() + " route deviations");
        }

        if (aggregation.overspeedEvents() == 0 && aggregation.routeDeviationEvents() == 0) {
            parts.add("clean run");
        }

        return String.join(" | ", parts);
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

    private boolean isTripOnTime(Trip trip) {
        return trip != null
            && trip.getActualEndTime() != null
            && trip.getPlannedEndTime() != null
            && !trip.getActualEndTime().isAfter(trip.getPlannedEndTime());
    }

    private long resolveDelayMinutes(Trip trip) {
        if (trip.getDelayMinutes() != null && trip.getDelayMinutes() > 0) {
            return trip.getDelayMinutes();
        }

        if (trip.getActualEndTime() != null && trip.getPlannedEndTime() != null && trip.getActualEndTime().isAfter(trip.getPlannedEndTime())) {
            return Duration.between(trip.getPlannedEndTime(), trip.getActualEndTime()).toMinutes();
        }

        return 0L;
    }

    private long resolvePlannedDurationMinutes(Trip trip) {
        if (trip.getPlannedStartTime() != null && trip.getPlannedEndTime() != null && trip.getPlannedEndTime().isAfter(trip.getPlannedStartTime())) {
            return Duration.between(trip.getPlannedStartTime(), trip.getPlannedEndTime()).toMinutes();
        }

        return parseDurationMinutes(trip.getEstimatedDuration());
    }

    private long resolveActualDurationMinutes(Trip trip) {
        if (trip.getActualStartTime() != null && trip.getActualEndTime() != null && trip.getActualEndTime().isAfter(trip.getActualStartTime())) {
            return Duration.between(trip.getActualStartTime(), trip.getActualEndTime()).toMinutes();
        }

        return parseDurationMinutes(trip.getActualDuration());
    }

    private long parseDurationMinutes(String value) {
        if (value == null || value.isBlank()) {
            return 0L;
        }

        long hours = 0L;
        long minutes = 0L;

        for (String token : value.trim().split("\\s+")) {
            if (token.endsWith("h")) {
                hours = parseLong(token.substring(0, token.length() - 1));
            } else if (token.endsWith("m")) {
                minutes = parseLong(token.substring(0, token.length() - 1));
            }
        }

        return (hours * 60L) + minutes;
    }

    private long parseLong(String value) {
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException exception) {
            return 0L;
        }
    }

    private double fallbackAverageSpeed(List<Trip> trips) {
        double totalDistance = 0.0;
        double totalHours = 0.0;

        for (Trip trip : trips) {
            if (trip.getActualDistance() <= 0 || trip.getActualStartTime() == null || trip.getActualEndTime() == null) {
                continue;
            }

            long minutes = Duration.between(trip.getActualStartTime(), trip.getActualEndTime()).toMinutes();
            if (minutes <= 0) {
                continue;
            }

            totalDistance += trip.getActualDistance();
            totalHours += minutes / 60.0;
        }

        if (totalDistance <= 0 || totalHours <= 0) {
            return 0.0;
        }

        return totalDistance / totalHours;
    }

    private String buildTripLabel(Trip trip) {
        LocalDateTime reference = referenceTime(trip);
        if (reference == null) {
            return trip.getId();
        }

        return trip.getId() + " · " + reference.format(SHORT_DAY_FORMAT);
    }

    private String safetyStatus(double score) {
        if (score >= 85.0) {
            return "Excellent";
        }
        if (score >= 65.0) {
            return "Good";
        }
        return "Poor";
    }

    private String formatPercent(double value) {
        return String.format(Locale.ROOT, "%.1f%%", value);
    }

    private String formatDistance(double value) {
        return String.format(Locale.ROOT, "%.1f km", value);
    }

    private String formatDuration(double minutes) {
        if (minutes <= 0) {
            return "0 min";
        }

        long roundedMinutes = Math.round(minutes);
        long hours = roundedMinutes / 60;
        long remainingMinutes = roundedMinutes % 60;
        if (hours <= 0) {
            return remainingMinutes + " min";
        }

        return hours + "h " + remainingMinutes + "m";
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

    private double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private LocalDateTime now() {
        return LocalDateTime.now();
    }

    private record Scope(AppRole role, Set<String> driverIds) {}

    private record FuelMetrics(double averageFuelConsumptionPer100Km, double averageKmPerFuelUnit) {}

    private record DriverAggregation(
        int totalTrips,
        int completedTrips,
        double onTimePercent,
        double totalDistanceCoveredKm,
        double averageTripDurationMinutes,
        double safetyScore,
        double averageSpeedKph,
        long overspeedEvents,
        long routeDeviationEvents,
        long idleMinutes,
        double averageFuelConsumptionPer100Km,
        double averageFuelEfficiencyKmPerUnit,
        double averageDelayMinutes,
        double delayFrequencyPercent,
        List<Trip> completedTripsList,
        Map<String, List<Telemetry>> telemetryByTrip
    ) {
        private static DriverAggregation empty(Map<String, List<Telemetry>> telemetryByTrip) {
            return new DriverAggregation(
                0,
                0,
                0.0,
                0.0,
                0.0,
                100.0,
                0.0,
                0L,
                0L,
                0L,
                0.0,
                0.0,
                0.0,
                0.0,
                List.of(),
                telemetryByTrip
            );
        }
    }
}
