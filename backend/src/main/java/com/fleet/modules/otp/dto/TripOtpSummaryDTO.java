package com.fleet.modules.otp.dto;

import com.fleet.modules.otp.entity.TripOtpStatus;
import java.time.LocalDateTime;

public record TripOtpSummaryDTO(
    String id,
    String tripId,
    TripOtpStatus status,
    LocalDateTime issuedAt,
    LocalDateTime sentAt,
    LocalDateTime expiresAt,
    LocalDateTime verifiedAt,
    LocalDateTime resendAvailableAt,
    LocalDateTime nextRetryAt,
    long cooldownSecondsRemaining,
    int requestsInLastHour,
    int requestLimitPerHour,
    boolean canResend,
    boolean verified,
    String failureReason
) {}
