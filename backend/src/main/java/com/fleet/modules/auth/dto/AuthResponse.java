package com.fleet.modules.auth.dto;

import com.fleet.modules.profile.dto.ProfileDTO;

public record AuthResponse(
    String token,
    ProfileDTO profile
) {
}
