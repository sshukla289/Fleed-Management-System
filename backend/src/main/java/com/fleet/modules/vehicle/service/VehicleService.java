package com.fleet.modules.vehicle.service;

import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.vehicle.dto.CreateVehicleRequest;
import com.fleet.modules.vehicle.dto.UpdateVehicleRequest;
import com.fleet.modules.vehicle.dto.VehicleDTO;
import com.fleet.modules.vehicle.entity.Vehicle;
import com.fleet.modules.vehicle.entity.VehicleOperationalStatus;
import com.fleet.modules.vehicle.repository.VehicleRepository;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class VehicleService {

    private final VehicleRepository vehicleRepository;
    private final TripRepository tripRepository;
    private final AuditLogService auditLogService;
    private final CurrentUserService currentUserService;

    public VehicleService(
        VehicleRepository vehicleRepository,
        TripRepository tripRepository,
        AuditLogService auditLogService,
        CurrentUserService currentUserService
    ) {
        this.vehicleRepository = vehicleRepository;
        this.tripRepository = tripRepository;
        this.auditLogService = auditLogService;
        this.currentUserService = currentUserService;
    }

    public List<VehicleDTO> getVehicles() {
        return vehicleRepository.findAll().stream()
            .map(this::toDto)
            .toList();
    }

    public Optional<VehicleDTO> getVehicleById(String id) {
        return vehicleRepository.findById(id).map(this::toDto);
    }

    @Transactional
    public VehicleDTO createVehicle(CreateVehicleRequest request) {
        validateVehicleRequest(
            request.name(),
            request.type(),
            request.status(),
            request.location(),
            request.assignedRegion(),
            request.fuelLevel(),
            request.mileage(),
            request.driverId()
        );

        String nextId = nextId();
        String normalizedDriverId = normalizeNullable(request.driverId());
        enforceTripAssignmentConsistency(nextId, normalizedDriverId);

        Vehicle vehicle = new Vehicle(
            nextId,
            request.name().trim(),
            request.type().trim(),
            VehicleOperationalStatus.fromValue(request.status()).value(),
            request.location().trim(),
            normalizeRegion(request.assignedRegion(), request.location()),
            request.fuelLevel(),
            request.mileage(),
            normalizedDriverId
        );

        Vehicle saved = vehicleRepository.save(vehicle);
        auditLogService.record(
            currentUserService.getCurrentActor(),
            "VEHICLE_CREATED",
            "VEHICLE",
            saved.getId(),
            "Vehicle created.",
            details("after", snapshot(saved))
        );

        return toDto(saved);
    }

    @Transactional
    public VehicleDTO updateVehicle(String id, UpdateVehicleRequest request) {
        validateVehicleRequest(
            request.name(),
            request.type(),
            request.status(),
            request.location(),
            request.assignedRegion(),
            request.fuelLevel(),
            request.mileage(),
            request.driverId()
        );

        Vehicle vehicle = vehicleRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vehicle not found."));
        Map<String, Object> before = snapshot(vehicle);

        String normalizedDriverId = normalizeNullable(request.driverId());
        enforceTripAssignmentConsistency(vehicle.getId(), normalizedDriverId);

        vehicle.setName(request.name().trim());
        vehicle.setType(request.type().trim());
        vehicle.setStatus(VehicleOperationalStatus.fromValue(request.status()).value());
        vehicle.setLocation(request.location().trim());
        vehicle.setAssignedRegion(normalizeRegion(request.assignedRegion(), request.location()));
        vehicle.setFuelLevel(request.fuelLevel());
        vehicle.setMileage(request.mileage());
        vehicle.setDriverId(normalizedDriverId);
        Vehicle saved = vehicleRepository.save(vehicle);

        auditLogService.record(
            currentUserService.getCurrentActor(),
            "VEHICLE_UPDATED",
            "VEHICLE",
            saved.getId(),
            "Vehicle updated.",
            details(
                "before", before,
                "after", snapshot(saved)
            )
        );

        return toDto(saved);
    }

    @Transactional
    public void deleteVehicle(String id) {
        Vehicle vehicle = vehicleRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vehicle not found."));

        vehicleRepository.delete(vehicle);
        auditLogService.record(
            currentUserService.getCurrentActor(),
            "VEHICLE_DELETED",
            "VEHICLE",
            vehicle.getId(),
            "Vehicle deleted.",
            details("before", snapshot(vehicle))
        );
    }

    private VehicleDTO toDto(Vehicle vehicle) {
        return new VehicleDTO(
            vehicle.getId(),
            vehicle.getName(),
            vehicle.getType(),
            vehicle.getStatus(),
            vehicle.getLocation(),
            safe(vehicle.getAssignedRegion()),
            vehicle.getFuelLevel(),
            vehicle.getMileage(),
            safe(vehicle.getDriverId())
        );
    }

    private String nextId() {
        int nextNumber = vehicleRepository.findAll().stream()
            .map(Vehicle::getId)
            .mapToInt(id -> parseNumericSuffix(id, "VH-"))
            .max()
            .orElse(100) + 1;
        return "VH-" + nextNumber;
    }

    private int parseNumericSuffix(String id, String prefix) {
        if (id == null || !id.startsWith(prefix)) {
            return 0;
        }

        try {
            return Integer.parseInt(id.substring(prefix.length()));
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    private void validateVehicleRequest(
        String name,
        String type,
        String status,
        String location,
        String assignedRegion,
        int fuelLevel,
        int mileage,
        String driverId
    ) {
        if (isBlank(name) || isBlank(type) || isBlank(status) || isBlank(location)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vehicle fields are required.");
        }

        if (!VehicleOperationalStatus.isSupported(status.trim())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vehicle status is invalid.");
        }

        if (!isBlank(assignedRegion) && assignedRegion.trim().length() > 120) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assigned region is too long.");
        }

        if (fuelLevel < 0 || fuelLevel > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fuel level must be between 0 and 100.");
        }

        if (mileage < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mileage must be zero or greater.");
        }
    }

    private void enforceTripAssignmentConsistency(String vehicleId, String driverId) {
        List<TripStatus> activeStatuses = List.of(
            TripStatus.DRAFT,
            TripStatus.VALIDATED,
            TripStatus.OPTIMIZED,
            TripStatus.DISPATCHED,
            TripStatus.IN_PROGRESS,
            TripStatus.PAUSED
        );

        tripRepository
            .findTopByAssignedVehicleIdAndStatusInOrderByPlannedStartTimeDesc(vehicleId, activeStatuses)
            .ifPresent(trip -> {
                if (driverId == null || !driverId.equalsIgnoreCase(String.valueOf(trip.getAssignedDriverId()))) {
                    throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Vehicle assignment is managed by active trip " + trip.getId() + "."
                    );
                }
            });

        if (driverId == null) {
            return;
        }

        tripRepository
            .findTopByAssignedDriverIdAndStatusInOrderByPlannedStartTimeDesc(driverId, activeStatuses)
            .ifPresent(trip -> {
                if (!vehicleId.equalsIgnoreCase(String.valueOf(trip.getAssignedVehicleId()))) {
                    throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Driver assignment is managed by active trip " + trip.getId() + "."
                    );
                }
            });
    }

    private String normalizeNullable(String value) {
        return isBlank(value) ? null : value.trim();
    }

    private String normalizeRegion(String assignedRegion, String location) {
        if (!isBlank(assignedRegion)) {
            return assignedRegion.trim();
        }

        if (!isBlank(location)) {
            return location.trim();
        }

        return "Unassigned";
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private Map<String, Object> snapshot(Vehicle vehicle) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("name", vehicle.getName());
        values.put("type", vehicle.getType());
        values.put("status", vehicle.getStatus());
        values.put("location", vehicle.getLocation());
        values.put("assignedRegion", vehicle.getAssignedRegion());
        values.put("fuelLevel", vehicle.getFuelLevel());
        values.put("mileage", vehicle.getMileage());
        values.put("driverId", vehicle.getDriverId());
        return values;
    }

    private Map<String, Object> details(Object... items) {
        Map<String, Object> values = new LinkedHashMap<>();
        if (items == null) {
            return values;
        }

        for (int index = 0; index < items.length; index += 2) {
            Object key = items[index];
            Object value = index + 1 < items.length ? items[index + 1] : null;
            if (key != null && value != null) {
                values.put(String.valueOf(key), value);
            }
        }

        return values;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
