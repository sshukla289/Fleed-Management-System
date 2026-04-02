package com.fleet.modules.auth.dto;

public record LoginRequest(
    String email,
    String password
) {
}
