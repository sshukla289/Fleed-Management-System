package com.fleet.modules.maintenance.service;

import com.fleet.modules.maintenance.dto.CreateMaintenanceScheduleRequest;
import com.fleet.modules.maintenance.dto.MaintenanceScheduleDTO;
import com.fleet.modules.maintenance.entity.MaintenanceSchedule;
import com.fleet.modules.maintenance.entity.MaintenanceScheduleStatus;
import com.fleet.modules.maintenance.repository.MaintenanceScheduleRepository;
import java.time.LocalDateTime;
import java.util.List;
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

    private final MaintenanceScheduleRepository maintenanceScheduleRepository;

    public MaintenanceScheduleService(MaintenanceScheduleRepository maintenanceScheduleRepository) {
        this.maintenanceScheduleRepository = maintenanceScheduleRepository;
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

        MaintenanceSchedule schedule = new MaintenanceSchedule(
            nextId(),
            request.vehicleId().trim(),
            request.title().trim(),
            request.status(),
            request.plannedStartDate(),
            request.plannedEndDate(),
            request.blockDispatch(),
            normalize(request.reasonCode()),
            normalize(request.notes()),
            LocalDateTime.now(),
            LocalDateTime.now()
        );

        return toDto(maintenanceScheduleRepository.save(schedule));
    }

    private void validateSchedule(CreateMaintenanceScheduleRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Maintenance schedule request is required.");
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
}
