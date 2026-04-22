package com.fleet.modules.maintenance.service;

import com.fleet.modules.alert.dto.CreateAlertRequest;
import com.fleet.modules.alert.entity.AlertCategory;
import com.fleet.modules.alert.entity.AlertSeverity;
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
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import com.fleet.modules.vehicle.entity.Vehicle;
import com.fleet.modules.vehicle.entity.VehicleOperationalStatus;
import com.fleet.modules.vehicle.repository.VehicleRepository;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MaintenanceScheduleService {

    private static final List<MaintenanceScheduleStatus> BLOCKING_STATUSES = List.of(
        MaintenanceScheduleStatus.PLANNED,
        MaintenanceScheduleStatus.IN_PROGRESS
    );

    private static final List<TripStatus> ACTIVE_TRIP_STATUSES = List.of(
        TripStatus.DRAFT,
        TripStatus.VALIDATED,
        TripStatus.OPTIMIZED,
        TripStatus.DISPATCHED,
        TripStatus.IN_PROGRESS,
        TripStatus.PAUSED
    );

    private final MaintenanceScheduleRepository maintenanceScheduleRepository;
    private final VehicleRepository vehicleRepository;
    private final TripRepository tripRepository;
    private final MaintenanceService maintenanceService;
    private final AlertService alertService;
    private final NotificationService notificationService;
    private final AuditLogService auditLogService;
    private final CurrentUserService currentUserService;

    public MaintenanceScheduleService(
        MaintenanceScheduleRepository maintenanceScheduleRepository,
        VehicleRepository vehicleRepository,
        TripRepository tripRepository,
        MaintenanceService maintenanceService,
        AlertService alertService,
        NotificationService notificationService,
        AuditLogService auditLogService,
        CurrentUserService currentUserService
    ) {
        this.maintenanceScheduleRepository = maintenanceScheduleRepository;
        this.vehicleRepository = vehicleRepository;
        this.tripRepository = tripRepository;
        this.maintenanceService = maintenanceService;
        this.alertService = alertService;
        this.notificationService = notificationService;
        this.auditLogService = auditLogService;
        this.currentUserService = currentUserService;
    }

    public List<MaintenanceScheduleDTO> getSchedules() {
        return maintenanceScheduleRepository.findAll().stream()
            .sorted((left, right) -> left.getPlannedStartDate().compareTo(right.getPlannedStartDate()))
            .map(this::toDto)
            .toList();
    }

    public List<MaintenanceSchedule> findBlockingSchedulesForVehicle(String vehicleId) {
        if (vehicleId == null || vehicleId.trim().isEmpty()) {
            return List.of();
        }

        return maintenanceScheduleRepository.findByVehicleIdOrderByPlannedStartDateAsc(vehicleId.trim()).stream()
            .filter(schedule -> schedule.isBlockDispatch() && BLOCKING_STATUSES.contains(schedule.getStatus()))
            .toList();
    }

    public List<MaintenanceSchedule> findBlockingSchedules() {
        return maintenanceScheduleRepository.findByBlockDispatchTrueAndStatusIn(BLOCKING_STATUSES);
    }

    @Transactional
    public MaintenanceScheduleDTO createSchedule(CreateMaintenanceScheduleRequest request) {
        validateSchedule(request);
        requireVehicle(request.vehicleId());

        boolean effectiveBlockDispatch = resolveBlockDispatch(request.blockDispatch(), request.status());
        if (request.status() == MaintenanceScheduleStatus.IN_PROGRESS) {
            ensureVehicleCanEnterMaintenance(request.vehicleId());
        }

        MaintenanceSchedule schedule = new MaintenanceSchedule(
            nextId(),
            request.vehicleId().trim(),
            request.title().trim(),
            request.status(),
            request.plannedStartDate(),
            request.plannedEndDate(),
            effectiveBlockDispatch,
            normalize(request.reasonCode()),
            normalize(request.notes()),
            LocalDateTime.now(),
            LocalDateTime.now()
        );

        MaintenanceSchedule saved = maintenanceScheduleRepository.save(schedule);
        applyScheduleSignals(saved, false);
        syncVehicleStatusAfterTransition(saved, null);

        auditLogService.record(
            currentUserService.getCurrentActor(),
            saved.isBlockDispatch() ? "MAINTENANCE_BLOCKED" : "MAINTENANCE_SCHEDULE_CREATED",
            "MAINTENANCE_SCHEDULE",
            saved.getId(),
            saved.isBlockDispatch() ? "Maintenance block schedule created." : "Maintenance schedule created.",
            details(
                "vehicleId", saved.getVehicleId(),
                "status", saved.getStatus().name(),
                "blockDispatch", saved.isBlockDispatch(),
                "reasonCode", saved.getReasonCode(),
                "plannedStartDate", String.valueOf(saved.getPlannedStartDate()),
                "plannedEndDate", String.valueOf(saved.getPlannedEndDate())
            )
        );

        return toDto(saved);
    }

    @Transactional
    public MaintenanceScheduleDTO updateScheduleStatus(String id, UpdateMaintenanceScheduleStatusRequest request) {
        if (request == null || request.status() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Maintenance schedule status is required.");
        }

        MaintenanceSchedule schedule = maintenanceScheduleRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Maintenance schedule not found."));

        MaintenanceScheduleStatus previousStatus = schedule.getStatus();
        boolean previousBlockDispatch = schedule.isBlockDispatch();

        validateStatusTransition(previousStatus, request.status());
        if (request.status() == MaintenanceScheduleStatus.IN_PROGRESS && previousStatus != MaintenanceScheduleStatus.IN_PROGRESS) {
            ensureVehicleCanEnterMaintenance(schedule.getVehicleId());
        }

        schedule.setStatus(request.status());
        schedule.setBlockDispatch(resolveBlockDispatch(schedule.isBlockDispatch(), request.status()));
        if (request.notes() != null) {
            schedule.setNotes(normalize(request.notes()));
        }
        schedule.setUpdatedAt(LocalDateTime.now());

        MaintenanceSchedule saved = maintenanceScheduleRepository.save(schedule);
        applyScheduleSignals(saved, previousBlockDispatch);
        syncVehicleStatusAfterTransition(saved, previousStatus);

        auditLogService.record(
            currentUserService.getCurrentActor(),
            resolveStatusAuditAction(previousStatus, saved),
            "MAINTENANCE_SCHEDULE",
            saved.getId(),
            resolveStatusAuditSummary(previousStatus, saved),
            details(
                "vehicleId", saved.getVehicleId(),
                "previousStatus", previousStatus.name(),
                "status", saved.getStatus().name(),
                "blockDispatch", saved.isBlockDispatch(),
                "reasonCode", saved.getReasonCode(),
                "plannedStartDate", String.valueOf(saved.getPlannedStartDate()),
                "plannedEndDate", String.valueOf(saved.getPlannedEndDate())
            )
        );

        return toDto(saved);
    }

    private void validateSchedule(CreateMaintenanceScheduleRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Maintenance schedule request is required.");
        }

        if (request.status() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Maintenance schedule status is required.");
        }

        if (request.plannedStartDate() == null || request.plannedEndDate() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Planned start and end dates are required.");
        }

        if (request.plannedEndDate().isBefore(request.plannedStartDate())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Planned end date must be after the start date.");
        }
    }

    private MaintenanceScheduleDTO toDto(MaintenanceSchedule schedule) {
        return new MaintenanceScheduleDTO(
            schedule.getId(),
            schedule.getVehicleId(),
            schedule.getTitle(),
            schedule.getStatus(),
            schedule.getPlannedStartDate(),
            schedule.getPlannedEndDate(),
            schedule.isBlockDispatch(),
            schedule.getReasonCode(),
            schedule.getNotes(),
            schedule.getCreatedAt(),
            schedule.getUpdatedAt()
        );
    }

    private String nextId() {
        int nextNumber = maintenanceScheduleRepository.findAll().stream()
            .map(MaintenanceSchedule::getId)
            .mapToInt(id -> parseNumericSuffix(id, "MS-"))
            .max()
            .orElse(0) + 1;
        return "MS-" + nextNumber;
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

    private String normalize(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private void validateStatusTransition(
        MaintenanceScheduleStatus currentStatus,
        MaintenanceScheduleStatus nextStatus
    ) {
        if (currentStatus == nextStatus) {
            return;
        }

        if (
            currentStatus == MaintenanceScheduleStatus.COMPLETED ||
            currentStatus == MaintenanceScheduleStatus.CANCELLED
        ) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Completed or cancelled maintenance schedules cannot be reopened."
            );
        }

        if (currentStatus == MaintenanceScheduleStatus.IN_PROGRESS && nextStatus == MaintenanceScheduleStatus.PLANNED) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "In-progress maintenance cannot be moved back to planned."
            );
        }
    }

    private boolean resolveBlockDispatch(boolean requestedBlockDispatch, MaintenanceScheduleStatus status) {
        return switch (status) {
            case IN_PROGRESS -> true;
            case COMPLETED, CANCELLED -> false;
            case PLANNED -> requestedBlockDispatch;
        };
    }

    private void ensureVehicleCanEnterMaintenance(String vehicleId) {
        String normalizedVehicleId = vehicleId == null ? "" : vehicleId.trim();
        requireVehicle(normalizedVehicleId);

        if (tripRepository.existsByAssignedVehicleIdAndStatusIn(normalizedVehicleId, ACTIVE_TRIP_STATUSES)) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Vehicle " + normalizedVehicleId + " is assigned to an active trip and cannot enter maintenance."
            );
        }
    }

    private Vehicle requireVehicle(String vehicleId) {
        return vehicleRepository.findById(vehicleId == null ? "" : vehicleId.trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vehicle not found."));
    }

    private void syncVehicleStatusAfterTransition(
        MaintenanceSchedule schedule,
        MaintenanceScheduleStatus previousStatus
    ) {
        Vehicle vehicle = requireVehicle(schedule.getVehicleId());

        if (schedule.getStatus() == MaintenanceScheduleStatus.IN_PROGRESS) {
            vehicle.setStatus(VehicleOperationalStatus.MAINTENANCE.value());
            vehicleRepository.save(vehicle);
            return;
        }

        if (
            previousStatus == MaintenanceScheduleStatus.IN_PROGRESS &&
            vehicleInMaintenance(vehicle) &&
            hasNoOtherInProgressSchedules(schedule.getVehicleId(), schedule.getId())
        ) {
            vehicle.setStatus(VehicleOperationalStatus.IDLE.value());
            vehicleRepository.save(vehicle);
        }
    }

    private boolean hasNoOtherInProgressSchedules(String vehicleId, String excludedScheduleId) {
        return maintenanceScheduleRepository.findByVehicleIdOrderByPlannedStartDateAsc(vehicleId).stream()
            .filter(schedule -> excludedScheduleId == null || !excludedScheduleId.equals(schedule.getId()))
            .noneMatch(schedule -> schedule.getStatus() == MaintenanceScheduleStatus.IN_PROGRESS);
    }

    private boolean vehicleInMaintenance(Vehicle vehicle) {
        try {
            return VehicleOperationalStatus.fromValue(vehicle.getStatus()) == VehicleOperationalStatus.MAINTENANCE;
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    private void applyScheduleSignals(MaintenanceSchedule schedule, boolean wasBlocking) {
        if (schedule.isBlockDispatch() && !wasBlocking) {
            notificationService.notifyMaintenanceReminder(
                schedule,
                "Dispatch is blocked for vehicle " + schedule.getVehicleId() + " due to maintenance schedule " + schedule.getId() + "."
            );
            alertService.createAlert(new CreateAlertRequest(
                AlertCategory.MAINTENANCE,
                AlertSeverity.HIGH,
                "Maintenance action required",
                "Vehicle " + schedule.getVehicleId() + " is blocked for dispatch by maintenance schedule " + schedule.getId() + ".",
                "maintenance_schedule",
                schedule.getId(),
                null,
                schedule.getVehicleId(),
                "{\"blockDispatch\":" + schedule.isBlockDispatch() + ",\"scheduleId\":\"" + schedule.getId() + "\"}"
            ));
        }

        if (schedule.isBlockDispatch()) {
            maintenanceService.createSystemAlertIfAbsent(
                schedule.getVehicleId(),
                schedule.getTitle(),
                schedule.getStatus() == MaintenanceScheduleStatus.IN_PROGRESS ? "Critical" : "Medium",
                buildMaintenanceAlertDescription(schedule)
            );
            return;
        }

        maintenanceService.deleteSystemAlertIfPresent(schedule.getVehicleId(), schedule.getTitle());
    }

    private String buildMaintenanceAlertDescription(MaintenanceSchedule schedule) {
        StringBuilder description = new StringBuilder("Vehicle ")
            .append(schedule.getVehicleId())
            .append(" is scheduled for ")
            .append(schedule.getTitle())
            .append('.');

        if (schedule.getReasonCode() != null) {
            description.append(" Reason: ").append(schedule.getReasonCode()).append('.');
        }

        if (schedule.getNotes() != null) {
            description.append(' ').append(schedule.getNotes());
        } else if (schedule.isBlockDispatch()) {
            description.append(" Dispatch remains blocked until the maintenance block is released.");
        }

        return description.toString();
    }

    private String resolveStatusAuditAction(
        MaintenanceScheduleStatus previousStatus,
        MaintenanceSchedule schedule
    ) {
        if (
            previousStatus == MaintenanceScheduleStatus.IN_PROGRESS &&
            (schedule.getStatus() == MaintenanceScheduleStatus.COMPLETED || schedule.getStatus() == MaintenanceScheduleStatus.CANCELLED)
        ) {
            return "MAINTENANCE_BLOCK_RELEASED";
        }

        if (schedule.getStatus() == MaintenanceScheduleStatus.IN_PROGRESS && previousStatus != MaintenanceScheduleStatus.IN_PROGRESS) {
            return "MAINTENANCE_STARTED";
        }

        return "MAINTENANCE_SCHEDULE_STATUS_UPDATED";
    }

    private String resolveStatusAuditSummary(
        MaintenanceScheduleStatus previousStatus,
        MaintenanceSchedule schedule
    ) {
        if (
            previousStatus == MaintenanceScheduleStatus.IN_PROGRESS &&
            schedule.getStatus() == MaintenanceScheduleStatus.COMPLETED
        ) {
            return "Maintenance completed and the vehicle block was released.";
        }

        if (
            previousStatus == MaintenanceScheduleStatus.IN_PROGRESS &&
            schedule.getStatus() == MaintenanceScheduleStatus.CANCELLED
        ) {
            return "Maintenance cancelled and the vehicle block was released.";
        }

        if (schedule.getStatus() == MaintenanceScheduleStatus.IN_PROGRESS && previousStatus != MaintenanceScheduleStatus.IN_PROGRESS) {
            return "Maintenance work started and the vehicle was moved into service bay status.";
        }

        return "Maintenance schedule status updated.";
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
