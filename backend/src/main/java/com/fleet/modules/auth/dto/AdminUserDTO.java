package com.fleet.modules.auth.dto;

public record AdminUserDTO(
    String id,
    String name,
    String role,
    String email,
    String loginEmail,
    String assignedRegion
) {
}
