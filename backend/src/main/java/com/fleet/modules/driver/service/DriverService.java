package com.fleet.modules.driver.service;

import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.driver.dto.AssignShiftRequest;
import com.fleet.modules.driver.dto.CreateDriverRequest;
import com.fleet.modules.driver.dto.DriverDTO;
import com.fleet.modules.driver.dto.UpdateDriverRequest;
import com.fleet.modules.driver.entity.Driver;
import com.fleet.modules.driver.entity.DriverDutyStatus;
import com.fleet.modules.driver.repository.DriverRepository;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DriverService {

    private final DriverRepository driverRepository;
    private final TripRepository tripRepository;
    private final AuditLogService auditLogService;
    private final CurrentUserService currentUserService;

    public DriverService(
        DriverRepository driverRepository,
        TripRepository tripRepository,
        AuditLogService auditLogService,
        CurrentUserService currentUserService
    ) {
        this.driverRepository = driverRepository;
        this.tripRepository = tripRepository;
        this.auditLogService = auditLogService;
        this.currentUserService = currentUserService;
    }

    public List<DriverDTO> getDrivers() {
        return driverRepository.findAll().stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    public DriverDTO createDriver(CreateDriverRequest request) {
        validateDriverRequest(
            request.name(),
            request.status(),
            request.licenseType(),
            request.licenseNumber(),
            request.licenseExpiryDate(),
            request.assignedShift(),
            request.phone(),
            request.assignedVehicleId(),
            request.hoursDrivenToday()
        );

        String nextDriverId = nextId();
        String normalizedVehicleId = normalizeNullable(request.assignedVehicleId());
        enforceTripAssignmentConsistency(nextDriverId, normalizedVehicleId);

        Driver driver = new Driver(
            nextDriverId,
            request.name().trim(),
            DriverDutyStatus.fromValue(request.status()).value(),
            request.licenseType().trim(),
            normalizeNullable(request.licenseNumber()),
            normalizeNullable(request.licenseExpiryDate()),
            normalizeShift(request.assignedShift()),
            normalizePhone(request.phone()),
            normalizedVehicleId,
            request.hoursDrivenToday()
        );

        Driver saved = driverRepository.save(driver);
        auditLogService.record(
            currentUserService.getCurrentActor(),
            "DRIVER_CREATED",
            "DRIVER",
            saved.getId(),
            "Driver created.",
            details("after", snapshot(saved))
        );

        return toDto(saved);
    }

    @Transactional
    public DriverDTO assignShift(AssignShiftRequest request) {
        if (isBlank(request.driverId()) || isBlank(request.status())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Driver ID and status are required.");
        }

        if (!DriverDutyStatus.isSupported(request.status().trim())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Driver status is invalid.");
        }

        Driver driver = driverRepository.findById(request.driverId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Driver not found."));
        Map<String, Object> before = snapshot(driver);

        String normalizedVehicleId = normalizeNullable(request.assignedVehicleId());
        enforceTripAssignmentConsistency(driver.getId(), normalizedVehicleId);

        driver.setStatus(DriverDutyStatus.fromValue(request.status()).value());
        driver.setAssignedVehicleId(normalizedVehicleId);
        driver.setAssignedShift(
            isBlank(request.assignedShift()) ? driver.getAssignedShift() : normalizeShift(request.assignedShift())
        );
        Driver saved = driverRepository.save(driver);
        auditLogService.record(
            currentUserService.getCurrentActor(),
            "DRIVER_SHIFT_ASSIGNED",
            "DRIVER",
            saved.getId(),
            "Driver shift assignment updated.",
            details(
                "before", before,
                "after", snapshot(saved)
            )
        );

        return toDto(saved);
    }

    @Transactional
    public DriverDTO updateDriver(String id, UpdateDriverRequest request) {
        validateDriverRequest(
            request.name(),
            request.status(),
            request.licenseType(),
            request.licenseNumber(),
            request.licenseExpiryDate(),
            request.assignedShift(),
            request.phone(),
            request.assignedVehicleId(),
            request.hoursDrivenToday()
        );

        Driver driver = driverRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Driver not found."));
        Map<String, Object> before = snapshot(driver);

        String normalizedVehicleId = request.assignedVehicleId() == null
            ? driver.getAssignedVehicleId()
            : normalizeNullable(request.assignedVehicleId());
        enforceTripAssignmentConsistency(driver.getId(), normalizedVehicleId);

        driver.setName(request.name().trim());
        driver.setStatus(DriverDutyStatus.fromValue(request.status()).value());
        driver.setLicenseType(request.licenseType().trim());
        driver.setLicenseNumber(
            request.licenseNumber() == null ? driver.getLicenseNumber() : normalizeNullable(request.licenseNumber())
        );
        driver.setLicenseExpiryDate(
            request.licenseExpiryDate() == null ? driver.getLicenseExpiryDate() : normalizeNullable(request.licenseExpiryDate())
        );
        driver.setAssignedShift(
            request.assignedShift() == null ? driver.getAssignedShift() : normalizeShift(request.assignedShift())
        );
        driver.setPhone(
            request.phone() == null ? driver.getPhone() : normalizePhone(request.phone())
        );
        driver.setAssignedVehicleId(normalizedVehicleId);
        driver.setHoursDrivenToday(request.hoursDrivenToday());
        Driver saved = driverRepository.save(driver);
        auditLogService.record(
            currentUserService.getCurrentActor(),
            "DRIVER_UPDATED",
            "DRIVER",
            saved.getId(),
            "Driver updated.",
            details(
                "before", before,
                "after", snapshot(saved)
            )
        );

        return toDto(saved);
    }

    @Transactional
    public void deleteDriver(String id) {
        Driver driver = driverRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Driver not found."));
        enforceTripAssignmentConsistency(id, null);
        driverRepository.delete(driver);
        auditLogService.record(
            currentUserService.getCurrentActor(),
            "DRIVER_DELETED",
            "DRIVER",
            driver.getId(),
            "Driver deleted.",
            details("before", snapshot(driver))
        );
    }

    private DriverDTO toDto(Driver driver) {
        return new DriverDTO(
            driver.getId(),
            driver.getName(),
            driver.getStatus(),
            driver.getLicenseType(),
            safe(driver.getLicenseNumber()),
            safe(driver.getLicenseExpiryDate()),
            safe(driver.getAssignedShift()),
            safe(driver.getPhone()),
            safe(driver.getAssignedVehicleId()),
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
        String licenseNumber,
        String licenseExpiryDate,
        String assignedShift,
        String phone,
        String assignedVehicleId,
        double hoursDrivenToday
    ) {
        if (isBlank(name) || isBlank(status) || isBlank(licenseType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Driver fields are required.");
        }

        if (!DriverDutyStatus.isSupported(status.trim())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Driver status is invalid.");
        }

        if (hoursDrivenToday < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Hours driven must be zero or greater.");
        }

        if (!isBlank(licenseNumber) && licenseNumber.trim().length() > 80) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "License number is too long.");
        }

        if (!isBlank(licenseExpiryDate)) {
            try {
                LocalDate.parse(licenseExpiryDate.trim());
            } catch (DateTimeParseException exception) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "License expiry date must be in YYYY-MM-DD format.");
            }
        }

        if (!isBlank(assignedShift) && assignedShift.trim().length() > 40) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assigned shift is too long.");
        }
        if (phone != null) {
            String normalizedPhone = phone.trim();
            if (normalizedPhone.length() > 20) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phone number is too long.");
            }

            if (!normalizedPhone.isEmpty() && !normalizedPhone.matches("^[0-9+()\\-\\s]{7,20}$")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phone number format is invalid.");
            }
        }
        if (assignedVehicleId != null && assignedVehicleId.length() > 255) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assigned vehicle ID is too long.");
        }
    }

    private String normalizePhone(String value) {
        return isBlank(value) ? null : value.trim();
    }

    private String normalizeNullable(String value) {
        return isBlank(value) ? null : value.trim();
    }

    private String normalizeShift(String shift) {
        return isBlank(shift) ? "Unassigned" : shift.trim();
    }

    private void enforceTripAssignmentConsistency(String driverId, String vehicleId) {
        List<TripStatus> activeStatuses = List.of(
            TripStatus.DRAFT,
            TripStatus.VALIDATED,
            TripStatus.OPTIMIZED,
            TripStatus.DISPATCHED,
            TripStatus.IN_PROGRESS,
            TripStatus.PAUSED
        );

        tripRepository
            .findTopByAssignedDriverIdAndStatusInOrderByPlannedStartTimeDesc(driverId, activeStatuses)
            .ifPresent(trip -> {
                if (vehicleId == null || !vehicleId.equalsIgnoreCase(String.valueOf(trip.getAssignedVehicleId()))) {
                    throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Driver assignment is managed by active trip " + trip.getId() + "."
                    );
                }
            });

        if (vehicleId == null) {
            return;
        }

        tripRepository
            .findTopByAssignedVehicleIdAndStatusInOrderByPlannedStartTimeDesc(vehicleId, activeStatuses)
            .ifPresent(trip -> {
                if (!driverId.equalsIgnoreCase(String.valueOf(trip.getAssignedDriverId()))) {
                    throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Vehicle assignment is managed by active trip " + trip.getId() + "."
                    );
                }
            });
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private Map<String, Object> snapshot(Driver driver) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("name", driver.getName());
        values.put("status", driver.getStatus());
        values.put("licenseType", driver.getLicenseType());
        values.put("licenseNumber", driver.getLicenseNumber());
        values.put("licenseExpiryDate", driver.getLicenseExpiryDate());
        values.put("assignedShift", driver.getAssignedShift());
        values.put("phone", driver.getPhone());
        values.put("assignedVehicleId", driver.getAssignedVehicleId());
        values.put("hoursDrivenToday", driver.getHoursDrivenToday());
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
}
