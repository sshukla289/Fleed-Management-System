package com.fleet.modules.maintenance.dto;

import com.fleet.modules.maintenance.entity.MaintenanceScheduleStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record CreateMaintenanceScheduleRequest(
    @NotBlank String vehicleId,
    @NotBlank String title,
    @NotNull MaintenanceScheduleStatus status,
    @NotNull LocalDate plannedStartDate,
    @NotNull LocalDate plannedEndDate,
    boolean blockDispatch,
    String reasonCode,
    String notes
) {}
