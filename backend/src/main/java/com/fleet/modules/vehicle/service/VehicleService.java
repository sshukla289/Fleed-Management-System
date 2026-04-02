package com.fleet.modules.vehicle.service;

import com.fleet.modules.vehicle.dto.CreateVehicleRequest;
import com.fleet.modules.vehicle.dto.UpdateVehicleRequest;
import com.fleet.modules.vehicle.dto.VehicleDTO;
import com.fleet.modules.vehicle.entity.Vehicle;
import com.fleet.modules.vehicle.repository.VehicleRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class VehicleService {

    private final VehicleRepository vehicleRepository;

    public VehicleService(VehicleRepository vehicleRepository) {
        this.vehicleRepository = vehicleRepository;
    }

    public List<VehicleDTO> getVehicles() {
        return vehicleRepository.findAll().stream()
            .map(this::toDto)
            .toList();
    }

    public Optional<VehicleDTO> getVehicleById(String id) {
        return vehicleRepository.findById(id).map(this::toDto);
    }

    public VehicleDTO createVehicle(CreateVehicleRequest request) {
        validateVehicleRequest(
            request.name(),
            request.type(),
            request.status(),
            request.location(),
            request.fuelLevel(),
            request.mileage(),
            request.driverId()
        );

        Vehicle vehicle = new Vehicle(
            nextId(),
            request.name(),
            request.type(),
            request.status(),
            request.location(),
            request.fuelLevel(),
            request.mileage(),
            request.driverId()
        );

        return toDto(vehicleRepository.save(vehicle));
    }

    public VehicleDTO updateVehicle(String id, UpdateVehicleRequest request) {
        validateVehicleRequest(
            request.name(),
            request.type(),
            request.status(),
            request.location(),
            request.fuelLevel(),
            request.mileage(),
            request.driverId()
        );

        Vehicle vehicle = vehicleRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vehicle not found."));

        vehicle.setName(request.name().trim());
        vehicle.setType(request.type().trim());
        vehicle.setStatus(request.status().trim());
        vehicle.setLocation(request.location().trim());
        vehicle.setFuelLevel(request.fuelLevel());
        vehicle.setMileage(request.mileage());
        vehicle.setDriverId(request.driverId().trim());
        return toDto(vehicleRepository.save(vehicle));
    }

    public void deleteVehicle(String id) {
        if (!vehicleRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Vehicle not found.");
        }

        vehicleRepository.deleteById(id);
    }

    private VehicleDTO toDto(Vehicle vehicle) {
        return new VehicleDTO(
            vehicle.getId(),
            vehicle.getName(),
            vehicle.getType(),
            vehicle.getStatus(),
            vehicle.getLocation(),
            vehicle.getFuelLevel(),
            vehicle.getMileage(),
            vehicle.getDriverId()
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
        int fuelLevel,
        int mileage,
        String driverId
    ) {
        if (isBlank(name) || isBlank(type) || isBlank(status) || isBlank(location) || isBlank(driverId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vehicle fields are required.");
        }

        if (!List.of("Active", "Idle", "Maintenance").contains(status.trim())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vehicle status is invalid.");
        }

        if (fuelLevel < 0 || fuelLevel > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fuel level must be between 0 and 100.");
        }

        if (mileage < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mileage must be zero or greater.");
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
