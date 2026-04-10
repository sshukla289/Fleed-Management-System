package com.fleet.modules.profile.dto;

public record UpdateProfileRequest(
    String name,
    String email,
    String assignedRegion
) {
}
