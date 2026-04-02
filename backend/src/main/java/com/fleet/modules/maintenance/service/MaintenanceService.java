package com.fleet.modules.maintenance.service;

import com.fleet.modules.maintenance.dto.CreateMaintenanceAlertRequest;
import com.fleet.modules.maintenance.dto.MaintenanceAlertDTO;
import com.fleet.modules.maintenance.dto.UpdateMaintenanceAlertRequest;
import com.fleet.modules.maintenance.entity.MaintenanceAlert;
import com.fleet.modules.maintenance.repository.MaintenanceAlertRepository;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MaintenanceService {

    private final MaintenanceAlertRepository maintenanceAlertRepository;

    public MaintenanceService(MaintenanceAlertRepository maintenanceAlertRepository) {
        this.maintenanceAlertRepository = maintenanceAlertRepository;
    }

    public List<MaintenanceAlertDTO> getAlerts() {
        return maintenanceAlertRepository.findAll().stream()
            .map(this::toDto)
            .toList();
    }

    public MaintenanceAlertDTO createAlert(CreateMaintenanceAlertRequest request) {
        validateAlertRequest(
            request.vehicleId(),
            request.title(),
            request.severity(),
            request.dueDate(),
            request.description()
        );

        MaintenanceAlert alert = new MaintenanceAlert(
            nextId(),
            request.vehicleId(),
            request.title(),
            request.severity(),
            LocalDate.parse(request.dueDate()),
            request.description()
        );

        return toDto(maintenanceAlertRepository.save(alert));
    }

    public MaintenanceAlertDTO updateAlert(String id, UpdateMaintenanceAlertRequest request) {
        validateAlertRequest(
            request.vehicleId(),
            request.title(),
            request.severity(),
            request.dueDate(),
            request.description()
        );

        MaintenanceAlert alert = maintenanceAlertRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Maintenance alert not found."));

        alert.setVehicleId(request.vehicleId().trim());
        alert.setTitle(request.title().trim());
        alert.setSeverity(request.severity().trim());
        alert.setDueDate(LocalDate.parse(request.dueDate()));
        alert.setDescription(request.description().trim());
        return toDto(maintenanceAlertRepository.save(alert));
    }

    public void deleteAlert(String id) {
        if (!maintenanceAlertRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Maintenance alert not found.");
        }

        maintenanceAlertRepository.deleteById(id);
    }

    private MaintenanceAlertDTO toDto(MaintenanceAlert alert) {
        return new MaintenanceAlertDTO(
            alert.getId(),
            alert.getVehicleId(),
            alert.getTitle(),
            alert.getSeverity(),
            alert.getDueDate().toString(),
            alert.getDescription()
        );
    }

    private String nextId() {
        int nextNumber = maintenanceAlertRepository.findAll().stream()
            .map(MaintenanceAlert::getId)
            .mapToInt(id -> parseNumericSuffix(id, "MA-"))
            .max()
            .orElse(0) + 1;
        return "MA-" + nextNumber;
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

    private void validateAlertRequest(
        String vehicleId,
        String title,
        String severity,
        String dueDate,
        String description
    ) {
        if (isBlank(vehicleId) || isBlank(title) || isBlank(severity) || isBlank(dueDate) || isBlank(description)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Maintenance alert fields are required.");
        }

        if (!List.of("Low", "Medium", "Critical").contains(severity.trim())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Maintenance severity is invalid.");
        }

        try {
            LocalDate.parse(dueDate);
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Due date must be a valid ISO date.");
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
