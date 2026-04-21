package com.fleet.modules.driver.dto;

public record UpdateDriverProfileRequest(
    String email,
    String phone
) {
}
