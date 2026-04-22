package com.fleet.modules.system.dto;

import java.time.LocalDateTime;

public record SystemConfigValueDTO(
    String key,
    String category,
    String label,
    String description,
    String value,
    LocalDateTime updatedAt,
    String updatedBy
) {
}
