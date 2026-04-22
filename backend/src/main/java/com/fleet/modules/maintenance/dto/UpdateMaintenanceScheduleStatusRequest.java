package com.fleet.modules.maintenance.dto;

import com.fleet.modules.maintenance.entity.MaintenanceScheduleStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateMaintenanceScheduleStatusRequest(
    @NotNull MaintenanceScheduleStatus status,
    String notes
) {}
