package com.fleet.modules.alert.dto;

import com.fleet.modules.alert.entity.AlertCategory;
import com.fleet.modules.alert.entity.AlertSeverity;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateAlertRequest(
    @NotNull AlertCategory category,
    @NotNull AlertSeverity severity,
    @NotBlank String title,
    @NotBlank String description,
    String sourceType,
    String sourceId,
    String relatedTripId,
    String relatedVehicleId,
    String metadataJson
) {}
