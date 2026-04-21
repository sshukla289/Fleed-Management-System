package com.fleet.modules.otp.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.auth.entity.AppRole;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.otp.dto.TripOtpSummaryDTO;
import com.fleet.modules.otp.entity.TripOtp;
import com.fleet.modules.otp.entity.TripOtpStatus;
import com.fleet.modules.otp.repository.TripOtpRepository;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class OtpServiceTest {

    @Mock
    private TripOtpRepository tripOtpRepository;

    @Mock
    private TripRepository tripRepository;

    @Mock
    private CurrentUserService currentUserService;

    @Mock
    private AuditLogService auditLogService;

    @Mock
    private OtpEmailNotificationService otpEmailNotificationService;

    private PasswordEncoder passwordEncoder;
    private OtpService otpService;

    @BeforeEach
    void setUp() {
        passwordEncoder = new BCryptPasswordEncoder();
        otpService = new OtpService(
            tripOtpRepository,
            tripRepository,
            currentUserService,
            auditLogService,
            otpEmailNotificationService,
            passwordEncoder,
            5,
            3,
            30,
            5,
            30
        );

        AppUser driver = new AppUser();
        driver.setId("DR-201");
        driver.setRole("DRIVER");

        when(currentUserService.getCurrentRole()).thenReturn(AppRole.DRIVER);
        when(currentUserService.getRequiredUser()).thenReturn(driver);
        lenient().when(currentUserService.getCurrentActor()).thenReturn("driver@gmail.com");
        lenient().when(tripOtpRepository.findAll()).thenReturn(List.of());
        lenient().when(tripOtpRepository.save(any(TripOtp.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void issueOtpForTripStartCreatesSentOtpWhenMailSucceeds() {
        Trip trip = activeTrip();
        when(tripOtpRepository.findTopByTripIdOrderByCreatedAtDesc("TRIP-1001")).thenReturn(Optional.empty());
        when(tripOtpRepository.countByTripIdAndCreatedAtAfter(eq("TRIP-1001"), any(LocalDateTime.class))).thenReturn(1L);

        TripOtpSummaryDTO summary = otpService.issueOtpForTripStart(trip);

        assertEquals(TripOtpStatus.SENT, summary.status());
        assertNotNull(summary.issuedAt());
        assertNotNull(summary.expiresAt());
        verify(otpEmailNotificationService).sendOtp(eq(trip), eq("recipient@example.com"), any(String.class), any(LocalDateTime.class));
    }

    @Test
    void validateOtpRejectsExpiredChallenge() {
        Trip trip = activeTrip();
        TripOtp challenge = new TripOtp();
        challenge.setId("OTP-1");
        challenge.setTripId("TRIP-1001");
        challenge.setOtpCodeHash(passwordEncoder.encode("123456"));
        challenge.setRecipientEmail("recipient@example.com");
        challenge.setStatus(TripOtpStatus.SENT);
        challenge.setCreatedAt(LocalDateTime.now().minusMinutes(10));
        challenge.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        when(tripRepository.findById("TRIP-1001")).thenReturn(Optional.of(trip));
        when(tripOtpRepository.findTopByTripIdOrderByCreatedAtDesc("TRIP-1001")).thenReturn(Optional.of(challenge));

        ResponseStatusException exception = assertThrows(
            ResponseStatusException.class,
            () -> otpService.validateOtp("TRIP-1001", "123456")
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals(TripOtpStatus.EXPIRED, challenge.getStatus());
        verify(tripOtpRepository).save(challenge);
    }

    @Test
    void resendOtpEnforcesHourlyRateLimit() {
        Trip trip = activeTrip();
        TripOtp previous = new TripOtp();
        previous.setTripId("TRIP-1001");
        previous.setStatus(TripOtpStatus.SENT);
        previous.setCreatedAt(LocalDateTime.now().minusMinutes(20));
        previous.setExpiresAt(LocalDateTime.now().plusMinutes(3));
        previous.setResendAvailableAt(LocalDateTime.now().minusSeconds(1));
        when(tripRepository.findById("TRIP-1001")).thenReturn(Optional.of(trip));
        when(tripOtpRepository.findTopByTripIdOrderByCreatedAtDesc("TRIP-1001")).thenReturn(Optional.of(previous));
        when(tripOtpRepository.countByTripIdAndCreatedAtAfter(eq("TRIP-1001"), any(LocalDateTime.class))).thenReturn(3L);

        ResponseStatusException exception = assertThrows(
            ResponseStatusException.class,
            () -> otpService.resendOtp("TRIP-1001")
        );

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, exception.getStatusCode());
    }

    @Test
    void failedMailDeliveryIsQueuedAndRetried() {
        Trip trip = activeTrip();
        when(tripOtpRepository.findTopByTripIdOrderByCreatedAtDesc("TRIP-1001")).thenReturn(Optional.empty());
        when(tripOtpRepository.countByTripIdAndCreatedAtAfter(eq("TRIP-1001"), any(LocalDateTime.class))).thenReturn(1L);
        org.mockito.Mockito.doThrow(new IllegalStateException("SMTP temporarily unavailable"))
            .doNothing()
            .when(otpEmailNotificationService)
            .sendOtp(eq(trip), eq("recipient@example.com"), any(String.class), any(LocalDateTime.class));

        TripOtpSummaryDTO failedSummary = otpService.issueOtpForTripStart(trip);

        assertEquals(TripOtpStatus.FAILED, failedSummary.status());
        assertNotNull(failedSummary.nextRetryAt());

        TripOtp queued = new TripOtp();
        queued.setId(failedSummary.id());
        queued.setTripId("TRIP-1001");
        queued.setRecipientEmail("recipient@example.com");
        queued.setStatus(TripOtpStatus.FAILED);
        queued.setCreatedAt(LocalDateTime.now().minusSeconds(5));
        queued.setExpiresAt(LocalDateTime.now().plusMinutes(5));
        queued.setRetryCount(1);
        queued.setDeliveryAttemptCount(1);
        queued.setNextRetryAt(LocalDateTime.now().minusSeconds(1));
        queued.setOtpCodeHash(passwordEncoder.encode("654321"));
        when(tripRepository.findById("TRIP-1001")).thenReturn(Optional.of(trip));
        when(tripOtpRepository.findTop20ByStatusInAndNextRetryAtLessThanEqualOrderByNextRetryAtAsc(any(), any(LocalDateTime.class)))
            .thenReturn(List.of(queued));

        otpService.processRetryQueue();

        assertEquals(TripOtpStatus.SENT, queued.getStatus());
        verify(otpEmailNotificationService, times(2)).sendOtp(eq(trip), eq("recipient@example.com"), any(String.class), any(LocalDateTime.class));
    }

    private Trip activeTrip() {
        Trip trip = new Trip();
        trip.setId("TRIP-1001");
        trip.setAssignedDriverId("DR-201");
        trip.setRecipientEmail("recipient@example.com");
        trip.setStatus(TripStatus.IN_PROGRESS);
        trip.setDestination("Pune Depot");
        return trip;
    }
}
