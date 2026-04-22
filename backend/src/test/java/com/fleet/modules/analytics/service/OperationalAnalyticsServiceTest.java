package com.fleet.modules.analytics.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

import com.fleet.modules.alert.repository.AlertRepository;
import com.fleet.modules.analytics.dto.DriverAnalyticsDTO;
import com.fleet.modules.analytics.dto.TripAnalyticsDTO;
import com.fleet.modules.analytics.dto.VehicleAnalyticsDTO;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.driver.entity.Driver;
import com.fleet.modules.driver.repository.DriverRepository;
import com.fleet.modules.maintenance.service.MaintenanceScheduleService;
import com.fleet.modules.telemetry.repository.TelemetryRepository;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripComplianceStatus;
import com.fleet.modules.trip.entity.TripDispatchStatus;
import com.fleet.modules.trip.entity.TripOptimizationStatus;
import com.fleet.modules.trip.entity.TripPriority;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import com.fleet.modules.vehicle.entity.Vehicle;
import com.fleet.modules.vehicle.repository.VehicleRepository;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class OperationalAnalyticsServiceTest {

    @Mock
    private TripRepository tripRepository;

    @Mock
    private VehicleRepository vehicleRepository;

    @Mock
    private DriverRepository driverRepository;

    @Mock
    private TelemetryRepository telemetryRepository;

    @Mock
    private AlertRepository alertRepository;

    @Mock
    private MaintenanceScheduleService maintenanceScheduleService;

    @Mock
    private CurrentUserService currentUserService;

    private OperationalAnalyticsService operationalAnalyticsService;

    @BeforeEach
    void setUp() {
        operationalAnalyticsService = new OperationalAnalyticsService(
            tripRepository,
            vehicleRepository,
            driverRepository,
            telemetryRepository,
            alertRepository,
            maintenanceScheduleService,
            currentUserService
        );
    }

    @Test
    void analyticsHonorRegionFilterAcrossTripsVehiclesAndDrivers() {
        Vehicle westVehicle = buildVehicle("VH-WEST", "Atlas Prime", "West India", "Mumbai Hub");
        Vehicle southVehicle = buildVehicle("VH-SOUTH", "Urban Sprint", "South India", "Bengaluru Center");
        when(vehicleRepository.findAll()).thenReturn(List.of(westVehicle, southVehicle));

        Driver westDriver = buildDriver("DR-WEST", "Aarav Sharma", "VH-WEST");
        Driver southDriver = buildDriver("DR-SOUTH", "Ishita Mehra", "VH-SOUTH");
        when(driverRepository.findAll()).thenReturn(List.of(westDriver, southDriver));

        LocalDateTime now = LocalDateTime.of(2026, 4, 20, 9, 0);
        Trip westTrip = buildCompletedTrip("TRIP-WEST", "VH-WEST", "DR-WEST", now.minusDays(2), now.minusDays(2).plusHours(5), 240, 24.0);
        Trip southTrip = buildCompletedTrip("TRIP-SOUTH", "VH-SOUTH", "DR-SOUTH", now.minusDays(1), now.minusDays(1).plusHours(4), 180, 18.0);
        when(tripRepository.findAll()).thenReturn(List.of(westTrip, southTrip));

        when(alertRepository.findAll()).thenReturn(List.of());
        when(maintenanceScheduleService.getSchedules()).thenReturn(List.of());

        TripAnalyticsDTO tripAnalytics = operationalAnalyticsService.getTripAnalytics(now.minusDays(7), now, null, "West India");
        VehicleAnalyticsDTO vehicleAnalytics = operationalAnalyticsService.getVehicleAnalytics(now.minusDays(7), now, "West India");
        DriverAnalyticsDTO driverAnalytics = operationalAnalyticsService.getDriverAnalytics(now.minusDays(7), now, "West India");

        assertEquals(1, tripAnalytics.completedTrips());
        assertEquals(1, tripAnalytics.recentTrips().size());
        assertEquals("TRIP-WEST", tripAnalytics.recentTrips().get(0).tripId());
        assertEquals(1, tripAnalytics.tripVolumeTrend().size());
        assertEquals(1, tripAnalytics.tripVolumeTrend().get(0).totalTrips());

        assertEquals(1, vehicleAnalytics.utilizationByVehicle().size());
        assertEquals("VH-WEST", vehicleAnalytics.utilizationByVehicle().get(0).vehicleId());

        assertEquals(1, driverAnalytics.productivityByDriver().size());
        assertEquals("DR-WEST", driverAnalytics.productivityByDriver().get(0).driverId());
    }

    private Vehicle buildVehicle(String id, String name, String region, String location) {
        Vehicle vehicle = new Vehicle();
        vehicle.setId(id);
        vehicle.setName(name);
        vehicle.setType("Heavy Truck");
        vehicle.setStatus("Active");
        vehicle.setLocation(location);
        vehicle.setAssignedRegion(region);
        vehicle.setFuelLevel(75);
        vehicle.setMileage(120000);
        vehicle.setDriverId(id.replace("VH", "DR"));
        return vehicle;
    }

    private Driver buildDriver(String id, String name, String vehicleId) {
        Driver driver = new Driver();
        driver.setId(id);
        driver.setName(name);
        driver.setStatus("On Duty");
        driver.setLicenseType("HMV");
        driver.setAssignedVehicleId(vehicleId);
        driver.setHoursDrivenToday(5.5);
        return driver;
    }

    private Trip buildCompletedTrip(
        String id,
        String vehicleId,
        String driverId,
        LocalDateTime start,
        LocalDateTime end,
        int distance,
        double fuelUsed
    ) {
        Trip trip = new Trip();
        trip.setId(id);
        trip.setRouteId("RT-" + id);
        trip.setAssignedVehicleId(vehicleId);
        trip.setAssignedDriverId(driverId);
        trip.setSource("Regional Hub");
        trip.setDestination("Customer Site");
        trip.setStatus(TripStatus.COMPLETED);
        trip.setPriority(TripPriority.HIGH);
        trip.setDispatchStatus(TripDispatchStatus.DISPATCHED);
        trip.setComplianceStatus(TripComplianceStatus.COMPLIANT);
        trip.setOptimizationStatus(TripOptimizationStatus.OPTIMIZED);
        trip.setPlannedStartTime(start);
        trip.setPlannedEndTime(end);
        trip.setActualStartTime(start);
        trip.setActualEndTime(end);
        trip.setCompletionProcessedAt(end);
        trip.setEstimatedDistance(distance);
        trip.setActualDistance(distance);
        trip.setFuelUsed(fuelUsed);
        return trip;
    }
}
