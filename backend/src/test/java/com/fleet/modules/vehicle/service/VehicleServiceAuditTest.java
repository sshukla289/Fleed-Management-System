package com.fleet.modules.vehicle.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.trip.repository.TripRepository;
import com.fleet.modules.vehicle.dto.CreateVehicleRequest;
import com.fleet.modules.vehicle.dto.UpdateVehicleRequest;
import com.fleet.modules.vehicle.dto.VehicleDTO;
import com.fleet.modules.vehicle.entity.Vehicle;
import com.fleet.modules.vehicle.repository.VehicleRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class VehicleServiceAuditTest {

    @Mock
    private VehicleRepository vehicleRepository;

    @Mock
    private TripRepository tripRepository;

    @Mock
    private AuditLogService auditLogService;

    @Mock
    private CurrentUserService currentUserService;

    private VehicleService vehicleService;

    @BeforeEach
    void setUp() {
        vehicleService = new VehicleService(vehicleRepository, tripRepository, auditLogService, currentUserService);

        lenient().when(currentUserService.getCurrentActor()).thenReturn("admin@example.com");
        lenient().when(vehicleRepository.findAll()).thenReturn(List.of());
        lenient().when(vehicleRepository.save(any(Vehicle.class))).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(tripRepository.findTopByAssignedVehicleIdAndStatusInOrderByPlannedStartTimeDesc(any(), any())).thenReturn(Optional.empty());
        lenient().when(tripRepository.findTopByAssignedDriverIdAndStatusInOrderByPlannedStartTimeDesc(any(), any())).thenReturn(Optional.empty());
    }

    @Test
    void createVehicleWritesAuditLog() {
        VehicleDTO created = vehicleService.createVehicle(new CreateVehicleRequest(
            "Atlas Prime",
            "Heavy Truck",
            "Active",
            "Mumbai Hub",
            "West India",
            78,
            125000,
            "DR-201"
        ));

        assertEquals("Atlas Prime", created.name());
        verify(auditLogService).record(
            eq("admin@example.com"),
            eq("VEHICLE_CREATED"),
            eq("VEHICLE"),
            eq(created.id()),
            eq("Vehicle created."),
            any()
        );
    }

    @Test
    void updateVehicleWritesAuditLog() {
        Vehicle vehicle = buildVehicle("VH-101");
        when(vehicleRepository.findById("VH-101")).thenReturn(Optional.of(vehicle));

        VehicleDTO updated = vehicleService.updateVehicle("VH-101", new UpdateVehicleRequest(
            "Atlas Prime X",
            "Heavy Truck",
            "Maintenance",
            "Workshop Bay 2",
            "West India",
            55,
            126200,
            "DR-201"
        ));

        assertEquals("Atlas Prime X", updated.name());
        verify(auditLogService).record(
            eq("admin@example.com"),
            eq("VEHICLE_UPDATED"),
            eq("VEHICLE"),
            eq("VH-101"),
            eq("Vehicle updated."),
            any()
        );
    }

    @Test
    void deleteVehicleWritesAuditLog() {
        Vehicle vehicle = buildVehicle("VH-101");
        when(vehicleRepository.findById("VH-101")).thenReturn(Optional.of(vehicle));

        vehicleService.deleteVehicle("VH-101");

        verify(auditLogService).record(
            eq("admin@example.com"),
            eq("VEHICLE_DELETED"),
            eq("VEHICLE"),
            eq("VH-101"),
            eq("Vehicle deleted."),
            any()
        );
    }

    private Vehicle buildVehicle(String id) {
        Vehicle vehicle = new Vehicle();
        vehicle.setId(id);
        vehicle.setName("Atlas Prime");
        vehicle.setType("Heavy Truck");
        vehicle.setStatus("Active");
        vehicle.setLocation("Mumbai Hub");
        vehicle.setAssignedRegion("West India");
        vehicle.setFuelLevel(72);
        vehicle.setMileage(124500);
        vehicle.setDriverId("DR-201");
        return vehicle;
    }
}
