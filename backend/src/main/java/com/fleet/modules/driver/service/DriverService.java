package com.fleet.modules.driver.service;

import com.fleet.modules.driver.dto.AssignShiftRequest;
import com.fleet.modules.driver.dto.CreateDriverRequest;
import com.fleet.modules.driver.dto.DriverDTO;
import com.fleet.modules.driver.dto.UpdateDriverRequest;
import com.fleet.modules.driver.entity.Driver;
import com.fleet.modules.driver.repository.DriverRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DriverService {

    private final DriverRepository driverRepository;

    public DriverService(DriverRepository driverRepository) {
        this.driverRepository = driverRepository;
    }

    public List<DriverDTO> getDrivers() {
        return driverRepository.findAll().stream()
            .map(this::toDto)
            .toList();
    }

    public DriverDTO createDriver(CreateDriverRequest request) {
        validateDriverRequest(
            request.name(),
            request.status(),
            request.licenseType(),
            request.assignedVehicleId(),
            request.hoursDrivenToday()
        );

        Driver driver = new Driver(
            nextId(),
            request.name().trim(),
            request.status().trim(),
            request.licenseType().trim(),
            normalizeNullable(request.assignedVehicleId()),
            request.hoursDrivenToday()
        );

        return toDto(driverRepository.save(driver));
    }

    public DriverDTO assignShift(AssignShiftRequest request) {
        if (isBlank(request.driverId()) || isBlank(request.status())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Driver ID and status are required.");
        }

        if (!List.of("On Duty", "Off Duty", "Resting").contains(request.status().trim())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Driver status is invalid.");
        }

        Driver driver = driverRepository.findById(request.driverId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Driver not found."));

        driver.setStatus(request.status().trim());
        driver.setAssignedVehicleId(normalizeNullable(request.assignedVehicleId()));
        return toDto(driverRepository.save(driver));
    }

    public DriverDTO updateDriver(String id, UpdateDriverRequest request) {
        validateDriverRequest(
            request.name(),
            request.status(),
            request.licenseType(),
            request.assignedVehicleId(),
            request.hoursDrivenToday()
        );

        Driver driver = driverRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Driver not found."));

        driver.setName(request.name().trim());
        driver.setStatus(request.status().trim());
        driver.setLicenseType(request.licenseType().trim());
        driver.setAssignedVehicleId(normalizeNullable(request.assignedVehicleId()));
        driver.setHoursDrivenToday(request.hoursDrivenToday());
        return toDto(driverRepository.save(driver));
    }

    public void deleteDriver(String id) {
        if (!driverRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Driver not found.");
        }

        driverRepository.deleteById(id);
    }

    private DriverDTO toDto(Driver driver) {
        return new DriverDTO(
            driver.getId(),
            driver.getName(),
            driver.getStatus(),
            driver.getLicenseType(),
            driver.getAssignedVehicleId(),
            driver.getHoursDrivenToday()
        );
    }

    private String nextId() {
        int nextNumber = driverRepository.findAll().stream()
            .map(Driver::getId)
            .mapToInt(id -> parseNumericSuffix(id, "DR-"))
            .max()
            .orElse(200) + 1;
        return "DR-" + nextNumber;
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

    private void validateDriverRequest(
        String name,
        String status,
        String licenseType,
        String assignedVehicleId,
        double hoursDrivenToday
    ) {
        if (isBlank(name) || isBlank(status) || isBlank(licenseType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Driver fields are required.");
        }

        if (!List.of("On Duty", "Off Duty", "Resting").contains(status.trim())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Driver status is invalid.");
        }

        if (hoursDrivenToday < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Hours driven must be zero or greater.");
        }

        if (assignedVehicleId != null && assignedVehicleId.length() > 255) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assigned vehicle ID is too long.");
        }
    }

    private String normalizeNullable(String value) {
        return isBlank(value) ? null : value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
