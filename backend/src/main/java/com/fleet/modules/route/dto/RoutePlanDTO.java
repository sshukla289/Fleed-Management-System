package com.fleet.modules.route.dto;

import java.util.List;

public record RoutePlanDTO(
    String id,
    String name,
    String status,
    int distanceKm,
    String estimatedDuration,
    List<String> stops
) {
}
