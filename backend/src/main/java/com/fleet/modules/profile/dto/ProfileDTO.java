package com.fleet.modules.profile.dto;

public record ProfileDTO(
    String id,
    String name,
    String role,
    String email,
    String assignedRegion
) {
}
