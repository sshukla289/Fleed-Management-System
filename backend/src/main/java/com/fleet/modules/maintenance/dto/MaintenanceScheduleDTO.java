package com.fleet.modules.maintenance.dto;

import com.fleet.modules.maintenance.entity.MaintenanceScheduleStatus;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record MaintenanceScheduleDTO(
    String id,
    String vehicleId,
    String title,
    MaintenanceScheduleStatus status,
    LocalDate plannedStartDate,
    LocalDate plannedEndDate,
    boolean blockDispatch,
    String reasonCode,
    String notes,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {}
