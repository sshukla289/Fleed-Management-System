package com.fleet.modules.maintenance.service;

import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.maintenance.dto.CreateMaintenanceAlertRequest;
import com.fleet.modules.maintenance.dto.MaintenanceAlertDTO;
import com.fleet.modules.maintenance.dto.UpdateMaintenanceAlertRequest;
import com.fleet.modules.maintenance.entity.MaintenanceAlert;
import com.fleet.modules.maintenance.repository.MaintenanceAlertRepository;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MaintenanceService {

    private final MaintenanceAlertRepository maintenanceAlertRepository;
    private final AuditLogService auditLogService;
    private final CurrentUserService currentUserService;

    public MaintenanceService(
        MaintenanceAlertRepository maintenanceAlertRepository,
        AuditLogService auditLogService,
        CurrentUserService currentUserService
    ) {
        this.maintenanceAlertRepository = maintenanceAlertRepository;
        this.auditLogService = auditLogService;
        this.currentUserService = currentUserService;
    }

    public List<MaintenanceAlertDTO> getAlerts() {
        return maintenanceAlertRepository.findAll().stream()
            .sorted((left, right) -> left.getDueDate().compareTo(right.getDueDate()))
            .map(this::toDto)
            .toList();
    }

    @Transactional
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

        MaintenanceAlert saved = maintenanceAlertRepository.save(alert);
        auditLogService.record(
            currentUserService.getCurrentActor(),
            "MAINTENANCE_ALERT_CREATED",
            "MAINTENANCE_ALERT",
            saved.getId(),
            "Maintenance alert created.",
            details("after", snapshot(saved))
        );

        return toDto(saved);
    }

    @Transactional
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
        Map<String, Object> before = snapshot(alert);

        alert.setVehicleId(request.vehicleId().trim());
        alert.setTitle(request.title().trim());
        alert.setSeverity(request.severity().trim());
        alert.setDueDate(LocalDate.parse(request.dueDate()));
        alert.setDescription(request.description().trim());
        MaintenanceAlert saved = maintenanceAlertRepository.save(alert);
        auditLogService.record(
            currentUserService.getCurrentActor(),
            "MAINTENANCE_ALERT_UPDATED",
            "MAINTENANCE_ALERT",
            saved.getId(),
            "Maintenance alert updated.",
            details(
                "before", before,
                "after", snapshot(saved)
            )
        );

        return toDto(saved);
    }

    @Transactional
    public void deleteAlert(String id) {
        MaintenanceAlert alert = maintenanceAlertRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Maintenance alert not found."));

        maintenanceAlertRepository.delete(alert);
        auditLogService.record(
            currentUserService.getCurrentActor(),
            "MAINTENANCE_ALERT_DELETED",
            "MAINTENANCE_ALERT",
            alert.getId(),
            "Maintenance alert deleted.",
            details("before", snapshot(alert))
        );
    }

    public void deleteSystemAlertIfPresent(String vehicleId, String title) {
        if (isBlank(vehicleId) || isBlank(title)) {
            return;
        }

        maintenanceAlertRepository.findByVehicleIdAndTitle(vehicleId.trim(), title.trim())
            .ifPresent(maintenanceAlertRepository::delete);
    }

    public MaintenanceAlertDTO createSystemAlertIfAbsent(
        String vehicleId,
        String title,
        String severity,
        String description
    ) {
        validateAlertRequest(
            vehicleId,
            title,
            severity,
            LocalDate.now().plusDays(1).toString(),
            description
        );

        if (maintenanceAlertRepository.existsByVehicleIdAndTitle(vehicleId, title)) {
            MaintenanceAlert existingAlert = maintenanceAlertRepository.findByVehicleIdAndTitle(vehicleId, title)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Maintenance alert not found."));

            existingAlert.setSeverity(severity);
            existingAlert.setDescription(description);
            existingAlert.setDueDate(LocalDate.now().plusDays(1));
            return toDto(maintenanceAlertRepository.save(existingAlert));
        }

        MaintenanceAlert alert = new MaintenanceAlert(
            nextId(),
            vehicleId,
            title,
            severity,
            LocalDate.now().plusDays(1),
            description
        );

        return toDto(maintenanceAlertRepository.save(alert));
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

    private Map<String, Object> snapshot(MaintenanceAlert alert) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("vehicleId", alert.getVehicleId());
        values.put("title", alert.getTitle());
        values.put("severity", alert.getSeverity());
        values.put("dueDate", alert.getDueDate() == null ? null : alert.getDueDate().toString());
        values.put("description", alert.getDescription());
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
