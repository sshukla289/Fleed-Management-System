package com.fleet.modules.otp.service;

import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.auth.entity.AppRole;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.otp.dto.TripOtpSummaryDTO;
import com.fleet.modules.otp.entity.TripOtp;
import com.fleet.modules.otp.entity.TripOtpStatus;
import com.fleet.modules.otp.repository.TripOtpRepository;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OtpService {

    private final TripOtpRepository tripOtpRepository;
    private final TripRepository tripRepository;
    private final CurrentUserService currentUserService;
    private final AuditLogService auditLogService;
    private final OtpEmailNotificationService otpEmailNotificationService;
    private final PasswordEncoder passwordEncoder;
    private final int otpTtlMinutes;
    private final int resendLimitPerHour;
    private final int resendCooldownSeconds;
    private final int maxDeliveryRetries;
    private final int retryInitialDelaySeconds;

    public OtpService(
        TripOtpRepository tripOtpRepository,
        TripRepository tripRepository,
        CurrentUserService currentUserService,
        AuditLogService auditLogService,
        OtpEmailNotificationService otpEmailNotificationService,
        PasswordEncoder passwordEncoder,
        @Value("${app.pod.otp-ttl-minutes:5}") int otpTtlMinutes,
        @Value("${app.pod.otp-resend-limit-per-hour:3}") int resendLimitPerHour,
        @Value("${app.pod.otp-resend-cooldown-seconds:30}") int resendCooldownSeconds,
        @Value("${app.pod.otp-max-delivery-retries:5}") int maxDeliveryRetries,
        @Value("${app.pod.otp-retry-initial-delay-seconds:30}") int retryInitialDelaySeconds
    ) {
        this.tripOtpRepository = tripOtpRepository;
        this.tripRepository = tripRepository;
        this.currentUserService = currentUserService;
        this.auditLogService = auditLogService;
        this.otpEmailNotificationService = otpEmailNotificationService;
        this.passwordEncoder = passwordEncoder;
        this.otpTtlMinutes = otpTtlMinutes;
        this.resendLimitPerHour = resendLimitPerHour;
        this.resendCooldownSeconds = resendCooldownSeconds;
        this.maxDeliveryRetries = maxDeliveryRetries;
        this.retryInitialDelaySeconds = retryInitialDelaySeconds;
    }

    @Transactional
    public TripOtpSummaryDTO issueOtpForTripStart(Trip trip) {
        ensureOtpEligibleTrip(trip);
        ensureDriverOwnership(trip, "start trips");

        TripOtp latest = tripOtpRepository.findTopByTripIdOrderByCreatedAtDesc(trip.getId()).orElse(null);
        if (isReusableActiveOtp(latest)) {
            return toSummary(latest);
        }

        return toSummary(createAndDispatchOtp(trip, latest, "OTP_ISSUED"));
    }

    @Transactional
    public TripOtpSummaryDTO resendOtp(String tripId) {
        Trip trip = findTrip(tripId);
        ensureOtpEligibleTrip(trip);
        ensureDriverOwnership(trip, "resend delivery OTPs for");

        TripOtp latest = tripOtpRepository.findTopByTripIdOrderByCreatedAtDesc(trip.getId()).orElse(null);
        if (latest != null && effectiveStatus(latest) == TripOtpStatus.VERIFIED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The delivery OTP has already been verified.");
        }

        enforceRateLimit(trip, latest);

        return toSummary(createAndDispatchOtp(trip, latest, "OTP_RESENT"));
    }

    @Transactional
    public TripOtpSummaryDTO validateOtp(String tripId, String otp) {
        Trip trip = findTrip(tripId);
        ensureOtpEligibleTrip(trip);
        ensureDriverOwnership(trip, "verify delivery OTPs for");

        TripOtp challenge = tripOtpRepository.findTopByTripIdOrderByCreatedAtDesc(trip.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "No delivery OTP has been issued for this trip."));

        TripOtpStatus status = effectiveStatus(challenge);
        if (status == TripOtpStatus.VERIFIED) {
            return toSummary(challenge);
        }

        if (status == TripOtpStatus.EXPIRED) {
            challenge.setStatus(TripOtpStatus.EXPIRED);
            tripOtpRepository.save(challenge);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The delivery OTP has expired. Request a new code.");
        }

        if (otp == null || otp.isBlank() || !passwordEncoder.matches(otp.trim(), challenge.getOtpCodeHash())) {
            challenge.setValidationAttemptCount(challenge.getValidationAttemptCount() + 1);
            tripOtpRepository.save(challenge);
            auditLogService.record(
                currentUserService.getCurrentActor(),
                "OTP_VALIDATION_FAILED",
                "TRIP_OTP",
                challenge.getId(),
                "Delivery OTP validation failed.",
                details("tripId", trip.getId(), "attemptCount", challenge.getValidationAttemptCount())
            );
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The delivery OTP is invalid.");
        }

        challenge.setStatus(TripOtpStatus.VERIFIED);
        challenge.setVerifiedAt(LocalDateTime.now());
        challenge.setNextRetryAt(null);
        TripOtp saved = tripOtpRepository.save(challenge);
        auditLogService.record(
            currentUserService.getCurrentActor(),
            "OTP_VERIFIED",
            "TRIP_OTP",
            saved.getId(),
            "Delivery OTP verified.",
            details("tripId", trip.getId(), "verifiedAt", saved.getVerifiedAt())
        );
        return toSummary(saved);
    }

    public TripOtpSummaryDTO getSummary(Trip trip) {
        if (trip == null) {
            return null;
        }

        return tripOtpRepository.findTopByTripIdOrderByCreatedAtDesc(trip.getId())
            .map(this::toSummary)
            .orElse(null);
    }

    public void assertVerifiedOtp(Trip trip) {
        TripOtp challenge = tripOtpRepository.findTopByTripIdOrderByCreatedAtDesc(trip.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "A verified delivery OTP is required before POD submission."));

        if (effectiveStatus(challenge) != TripOtpStatus.VERIFIED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A verified delivery OTP is required before POD submission.");
        }
    }

    @Transactional
    @Scheduled(fixedDelayString = "${app.pod.otp-retry-scan-delay-ms:30000}")
    public void processRetryQueue() {
        LocalDateTime now = LocalDateTime.now();
        List<TripOtp> dueChallenges = tripOtpRepository.findTop20ByStatusInAndNextRetryAtLessThanEqualOrderByNextRetryAtAsc(
            List.of(TripOtpStatus.FAILED, TripOtpStatus.CREATED),
            now
        );

        for (TripOtp challenge : dueChallenges) {
            Trip trip = tripRepository.findById(challenge.getTripId()).orElse(null);
            if (trip == null || !isOtpEligibleTrip(trip)) {
                challenge.setStatus(TripOtpStatus.EXPIRED);
                challenge.setNextRetryAt(null);
                tripOtpRepository.save(challenge);
                continue;
            }

            if (effectiveStatus(challenge) == TripOtpStatus.EXPIRED) {
                challenge.setStatus(TripOtpStatus.EXPIRED);
                challenge.setNextRetryAt(null);
                tripOtpRepository.save(challenge);
                continue;
            }

            if (challenge.getRetryCount() >= maxDeliveryRetries) {
                challenge.setNextRetryAt(null);
                tripOtpRepository.save(challenge);
                continue;
            }

            rotateCodeAndAttemptDelivery(trip, challenge, "OTP_DELIVERY_RETRIED");
        }
    }

    private TripOtp createAndDispatchOtp(Trip trip, TripOtp latest, String auditAction) {
        ensureRecipientEmail(trip);

        if (latest != null && effectiveStatus(latest) != TripOtpStatus.VERIFIED) {
            latest.setStatus(TripOtpStatus.EXPIRED);
            latest.setNextRetryAt(null);
            tripOtpRepository.save(latest);
        }

        TripOtp challenge = new TripOtp();
        challenge.setId(nextId());
        challenge.setTripId(trip.getId());
        challenge.setRecipientEmail(trip.getRecipientEmail().trim());
        challenge.setCreatedAt(LocalDateTime.now());
        challenge.setResendAvailableAt(challenge.getCreatedAt().plusSeconds(resendCooldownSeconds));
        challenge.setRetryCount(0);
        challenge.setDeliveryAttemptCount(0);
        challenge.setValidationAttemptCount(0);

        rotateCodeAndAttemptDelivery(trip, challenge, auditAction);
        return challenge;
    }

    private void rotateCodeAndAttemptDelivery(Trip trip, TripOtp challenge, String auditAction) {
        String otp = generateOtp();
        LocalDateTime now = LocalDateTime.now();
        challenge.setOtpCodeHash(passwordEncoder.encode(otp));
        challenge.setExpiresAt(now.plusMinutes(otpTtlMinutes));
        challenge.setStatus(TripOtpStatus.CREATED);
        challenge.setLastFailureReason(null);
        challenge.setVerifiedAt(null);
        challenge.setDeliveryAttemptCount(challenge.getDeliveryAttemptCount() + 1);

        try {
            otpEmailNotificationService.sendOtp(trip, challenge.getRecipientEmail(), otp, challenge.getExpiresAt());
            challenge.setStatus(TripOtpStatus.SENT);
            challenge.setSentAt(now);
            challenge.setNextRetryAt(null);
            TripOtp saved = tripOtpRepository.save(challenge);
            auditLogService.record(
                currentUserService.getCurrentActor(),
                auditAction,
                "TRIP_OTP",
                saved.getId(),
                "Delivery OTP dispatched.",
                details(
                    "tripId", trip.getId(),
                    "recipientEmail", saved.getRecipientEmail(),
                    "expiresAt", saved.getExpiresAt(),
                    "deliveryAttemptCount", saved.getDeliveryAttemptCount()
                )
            );
        } catch (IllegalStateException exception) {
            challenge.setStatus(TripOtpStatus.FAILED);
            challenge.setRetryCount(challenge.getRetryCount() + 1);
            challenge.setLastFailureReason(exception.getMessage());
            challenge.setNextRetryAt(now.plusSeconds(backoffSeconds(challenge.getRetryCount())));
            TripOtp saved = tripOtpRepository.save(challenge);
            auditLogService.record(
                currentUserService.getCurrentActor(),
                "OTP_DELIVERY_FAILED",
                "TRIP_OTP",
                saved.getId(),
                "Delivery OTP email delivery failed.",
                details(
                    "tripId", trip.getId(),
                    "recipientEmail", saved.getRecipientEmail(),
                    "retryCount", saved.getRetryCount(),
                    "nextRetryAt", saved.getNextRetryAt(),
                    "failureReason", saved.getLastFailureReason()
                )
            );
        }
    }

    private void enforceRateLimit(Trip trip, TripOtp latest) {
        LocalDateTime now = LocalDateTime.now();
        if (latest != null && latest.getResendAvailableAt() != null && latest.getResendAvailableAt().isAfter(now)) {
            throw new ResponseStatusException(
                HttpStatus.TOO_MANY_REQUESTS,
                "Please wait before requesting another OTP."
            );
        }

        long issuedInLastHour = tripOtpRepository.countByTripIdAndCreatedAtAfter(trip.getId(), now.minusHours(1));
        if (issuedInLastHour >= resendLimitPerHour) {
            throw new ResponseStatusException(
                HttpStatus.TOO_MANY_REQUESTS,
                "OTP request limit reached for this trip. Try again later."
            );
        }
    }

    private boolean isReusableActiveOtp(TripOtp challenge) {
        if (challenge == null) {
            return false;
        }

        TripOtpStatus status = effectiveStatus(challenge);
        return status == TripOtpStatus.CREATED || status == TripOtpStatus.SENT || status == TripOtpStatus.FAILED;
    }

    private TripOtpStatus effectiveStatus(TripOtp challenge) {
        if (challenge == null) {
            return TripOtpStatus.EXPIRED;
        }

        if (challenge.getStatus() == TripOtpStatus.VERIFIED) {
            return TripOtpStatus.VERIFIED;
        }

        if (challenge.getExpiresAt() == null || challenge.getExpiresAt().isBefore(LocalDateTime.now())) {
            return TripOtpStatus.EXPIRED;
        }

        return challenge.getStatus();
    }

    private boolean isOtpEligibleTrip(Trip trip) {
        return trip != null && (trip.getStatus() == TripStatus.IN_PROGRESS || trip.getStatus() == TripStatus.PAUSED);
    }

    private void ensureOtpEligibleTrip(Trip trip) {
        if (!isOtpEligibleTrip(trip)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Delivery OTP is available only for in-progress or paused trips.");
        }
    }

    private void ensureRecipientEmail(Trip trip) {
        if (trip.getRecipientEmail() == null || trip.getRecipientEmail().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Recipient email is required before issuing a delivery OTP.");
        }
    }

    private void ensureDriverOwnership(Trip trip, String action) {
        if (currentUserService.getCurrentRole() != AppRole.DRIVER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only drivers can " + action + ".");
        }

        String actorId = currentUserService.getRequiredUser().getId();
        if (trip.getAssignedDriverId() == null || !trip.getAssignedDriverId().equalsIgnoreCase(actorId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Drivers can only " + action + " their own trips.");
        }
    }

    private Trip findTrip(String tripId) {
        if (tripId == null || tripId.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip ID is required.");
        }

        return tripRepository.findById(tripId.trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found."));
    }

    private TripOtpSummaryDTO toSummary(TripOtp challenge) {
        TripOtpStatus status = effectiveStatus(challenge);
        long cooldownSecondsRemaining = 0;
        if (challenge.getResendAvailableAt() != null && challenge.getResendAvailableAt().isAfter(LocalDateTime.now())) {
            cooldownSecondsRemaining = java.time.Duration.between(LocalDateTime.now(), challenge.getResendAvailableAt()).getSeconds();
        }

        int requestsInLastHour = (int) tripOtpRepository.countByTripIdAndCreatedAtAfter(
            challenge.getTripId(),
            LocalDateTime.now().minusHours(1)
        );

        return new TripOtpSummaryDTO(
            challenge.getId(),
            challenge.getTripId(),
            status,
            challenge.getCreatedAt(),
            challenge.getSentAt(),
            challenge.getExpiresAt(),
            challenge.getVerifiedAt(),
            challenge.getResendAvailableAt(),
            challenge.getNextRetryAt(),
            Math.max(0, cooldownSecondsRemaining),
            requestsInLastHour,
            resendLimitPerHour,
            cooldownSecondsRemaining <= 0 && requestsInLastHour < resendLimitPerHour && status != TripOtpStatus.VERIFIED,
            status == TripOtpStatus.VERIFIED,
            status == TripOtpStatus.FAILED ? challenge.getLastFailureReason() : null
        );
    }

    private long backoffSeconds(int retryCount) {
        return (long) retryInitialDelaySeconds * (1L << Math.max(0, retryCount - 1));
    }

    private String nextId() {
        int nextNumber = tripOtpRepository.findAll().stream()
            .map(TripOtp::getId)
            .mapToInt(id -> parseNumericSuffix(id, "OTP-"))
            .max()
            .orElse(0) + 1;
        return "OTP-" + nextNumber;
    }

    private int parseNumericSuffix(String id, String prefix) {
        if (id == null || !id.startsWith(prefix)) {
            return 0;
        }

        try {
            return Integer.parseInt(id.substring(prefix.length()));
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    private String generateOtp() {
        return String.valueOf(ThreadLocalRandom.current().nextInt(100000, 1000000));
    }

    private Map<String, Object> details(Object... items) {
        Map<String, Object> result = new LinkedHashMap<>();
        if (items == null) {
            return result;
        }

        for (int index = 0; index < items.length; index += 2) {
            Object key = items[index];
            Object value = index + 1 < items.length ? items[index + 1] : null;
            if (key != null && value != null) {
                result.put(String.valueOf(key), value);
            }
        }

        return result;
    }
}
