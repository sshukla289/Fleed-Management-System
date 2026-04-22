package com.fleet.modules.maintenance.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fleet.modules.alert.service.AlertService;
import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.maintenance.dto.CreateMaintenanceScheduleRequest;
import com.fleet.modules.maintenance.dto.MaintenanceScheduleDTO;
import com.fleet.modules.maintenance.dto.UpdateMaintenanceScheduleStatusRequest;
import com.fleet.modules.maintenance.entity.MaintenanceSchedule;
import com.fleet.modules.maintenance.entity.MaintenanceScheduleStatus;
import com.fleet.modules.maintenance.repository.MaintenanceScheduleRepository;
import com.fleet.modules.notification.service.NotificationService;
import com.fleet.modules.trip.repository.TripRepository;
import com.fleet.modules.vehicle.entity.Vehicle;
import com.fleet.modules.vehicle.entity.VehicleOperationalStatus;
import com.fleet.modules.vehicle.repository.VehicleRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class MaintenanceScheduleServiceTest {

    @Mock
    private MaintenanceScheduleRepository maintenanceScheduleRepository;

    @Mock
    private VehicleRepository vehicleRepository;

    @Mock
    private TripRepository tripRepository;

    @Mock
    private MaintenanceService maintenanceService;

    @Mock
    private AlertService alertService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private AuditLogService auditLogService;

    @Mock
    private CurrentUserService currentUserService;

    private MaintenanceScheduleService maintenanceScheduleService;

    @BeforeEach
    void setUp() {
        maintenanceScheduleService = new MaintenanceScheduleService(
            maintenanceScheduleRepository,
            vehicleRepository,
            tripRepository,
            maintenanceService,
            alertService,
            notificationService,
            auditLogService,
            currentUserService
        );

        lenient().when(currentUserService.getCurrentActor()).thenReturn("maintenance.manager@example.com");
    }

    @Test
    void createSchedulePromotesVehicleIntoMaintenanceWhenWorkStarts() {
        Vehicle vehicle = buildVehicle("VH-101", VehicleOperationalStatus.ACTIVE);
        when(vehicleRepository.findById("VH-101")).thenReturn(Optional.of(vehicle));
        when(tripRepository.existsByAssignedVehicleIdAndStatusIn(any(), any())).thenReturn(false);
        when(maintenanceScheduleRepository.findAll()).thenReturn(List.of());
        when(maintenanceScheduleRepository.save(any(MaintenanceSchedule.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
        when(vehicleRepository.save(any(Vehicle.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MaintenanceScheduleDTO created = maintenanceScheduleService.createSchedule(new CreateMaintenanceScheduleRequest(
            "VH-101",
            "Brake overhaul",
            MaintenanceScheduleStatus.IN_PROGRESS,
            LocalDate.now(),
            LocalDate.now().plusDays(2),
            false,
            "BRAKES",
            "Front axle inspection and pad replacement."
        ));

        assertEquals(MaintenanceScheduleStatus.IN_PROGRESS, created.status());
        assertTrue(created.blockDispatch());
        assertEquals(VehicleOperationalStatus.MAINTENANCE.value(), vehicle.getStatus());
        verify(maintenanceService).createSystemAlertIfAbsent(
            "VH-101",
            "Brake overhaul",
            "Critical",
            "Vehicle VH-101 is scheduled for Brake overhaul. Reason: BRAKES. Front axle inspection and pad replacement."
        );
    }

    @Test
    void updateScheduleStatusReleasesVehicleBlockWhenMaintenanceCompletes() {
        MaintenanceSchedule schedule = new MaintenanceSchedule(
            "MS-1",
            "VH-101",
            "Brake overhaul",
            MaintenanceScheduleStatus.IN_PROGRESS,
            LocalDate.now(),
            LocalDate.now().plusDays(1),
            true,
            "BRAKES",
            "Ready for release.",
            LocalDateTime.now().minusHours(4),
            LocalDateTime.now().minusHours(2)
        );
        Vehicle vehicle = buildVehicle("VH-101", VehicleOperationalStatus.MAINTENANCE);

        when(maintenanceScheduleRepository.findById("MS-1")).thenReturn(Optional.of(schedule));
        when(maintenanceScheduleRepository.save(any(MaintenanceSchedule.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
        when(maintenanceScheduleRepository.findByVehicleIdOrderByPlannedStartDateAsc("VH-101")).thenReturn(List.of(schedule));
        when(vehicleRepository.findById("VH-101")).thenReturn(Optional.of(vehicle));
        when(vehicleRepository.save(any(Vehicle.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MaintenanceScheduleDTO updated = maintenanceScheduleService.updateScheduleStatus(
            "MS-1",
            new UpdateMaintenanceScheduleStatusRequest(MaintenanceScheduleStatus.COMPLETED, "Signed off by workshop lead.")
        );

        assertEquals(MaintenanceScheduleStatus.COMPLETED, updated.status());
        assertFalse(updated.blockDispatch());
        assertEquals("Signed off by workshop lead.", updated.notes());
        assertEquals(VehicleOperationalStatus.IDLE.value(), vehicle.getStatus());
        verify(maintenanceService).deleteSystemAlertIfPresent("VH-101", "Brake overhaul");
    }

    @Test
    void createScheduleRejectsStartingMaintenanceForVehicleWithActiveTrip() {
        Vehicle vehicle = buildVehicle("VH-101", VehicleOperationalStatus.ACTIVE);
        when(vehicleRepository.findById("VH-101")).thenReturn(Optional.of(vehicle));
        when(tripRepository.existsByAssignedVehicleIdAndStatusIn(any(), any())).thenReturn(true);

        ResponseStatusException thrown = assertThrows(
            ResponseStatusException.class,
            () -> maintenanceScheduleService.createSchedule(new CreateMaintenanceScheduleRequest(
                "VH-101",
                "Brake overhaul",
                MaintenanceScheduleStatus.IN_PROGRESS,
                LocalDate.now(),
                LocalDate.now().plusDays(1),
                true,
                "BRAKES",
                "Conflict check"
            ))
        );

        assertEquals(HttpStatus.CONFLICT, thrown.getStatusCode());
        verify(maintenanceScheduleRepository, never()).save(any(MaintenanceSchedule.class));
    }

    private Vehicle buildVehicle(String id, VehicleOperationalStatus status) {
        Vehicle vehicle = new Vehicle();
        vehicle.setId(id);
        vehicle.setName("Atlas Prime");
        vehicle.setType("Heavy Truck");
        vehicle.setStatus(status.value());
        vehicle.setLocation("Workshop");
        vehicle.setAssignedRegion("West India");
        vehicle.setFuelLevel(72);
        vehicle.setMileage(128540);
        vehicle.setDriverId("DR-201");
        return vehicle;
    }
}
