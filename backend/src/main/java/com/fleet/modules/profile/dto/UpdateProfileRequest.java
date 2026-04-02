package com.fleet.modules.profile.dto;

public record UpdateProfileRequest(
    String name,
    String role,
    String email,
    String assignedRegion
) {
}
