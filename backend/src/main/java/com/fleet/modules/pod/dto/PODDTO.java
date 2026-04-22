package com.fleet.modules.pod.dto;

import java.time.LocalDateTime;

public record PODDTO(
    String id,
    String tripId,
    String signatureUrl,
    String photoUrl,
    boolean otpVerified,
    LocalDateTime timestamp,
    boolean signatureCaptured,
    boolean photoCaptured,
    boolean readyForCompletion,
    boolean redacted
) {}
