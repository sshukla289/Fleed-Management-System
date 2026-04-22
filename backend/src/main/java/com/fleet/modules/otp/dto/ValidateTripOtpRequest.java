package com.fleet.modules.otp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record ValidateTripOtpRequest(
    @NotBlank
    @Pattern(regexp = "\\d{6}", message = "OTP must be a 6-digit code.")
    String otp
) {}
