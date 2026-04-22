package com.fleet.modules.pod.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.auth.entity.AppRole;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.otp.service.OtpService;
import com.fleet.modules.pod.dto.CreatePODRequest;
import com.fleet.modules.pod.dto.PODDTO;
import com.fleet.modules.pod.entity.POD;
import com.fleet.modules.pod.repository.PODRepository;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class PODServiceTest {

    @Mock
    private PODRepository podRepository;

    @Mock
    private TripRepository tripRepository;

    @Mock
    private CurrentUserService currentUserService;

    @Mock
    private AuditLogService auditLogService;

    @Mock
    private PODEvidenceStorageService storageService;

    @Mock
    private OtpService otpService;

    private PODService podService;

    @BeforeEach
    void setUp() {
        podService = new PODService(
            podRepository,
            tripRepository,
            currentUserService,
            auditLogService,
            storageService,
            otpService
        );
    }

    @Test
    void submitRejectsDriverOutsideAssignedTrip() {
        AppUser driver = new AppUser();
        driver.setId("DR-999");
        driver.setRole("DRIVER");
        when(currentUserService.getCurrentRole()).thenReturn(AppRole.DRIVER);
        when(currentUserService.getRequiredUser()).thenReturn(driver);

        Trip trip = activeTrip();
        when(tripRepository.findById("TRIP-1001")).thenReturn(Optional.of(trip));

        CreatePODRequest request = new CreatePODRequest();
        request.setSignatureDataUrl("data:image/png;base64,abc");
        request.setPhoto(new MockMultipartFile("photo", "photo.jpg", "image/jpeg", "demo".getBytes()));

        ResponseStatusException exception = assertThrows(
            ResponseStatusException.class,
            () -> podService.submit("TRIP-1001", request)
        );

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
        verify(otpService, never()).assertVerifiedOtp(trip);
    }

    @Test
    void getPodRedactsSensitiveAssetsForNonDriverRoles() {
        when(currentUserService.getCurrentRole()).thenReturn(AppRole.OPERATIONS_MANAGER);

        Trip trip = activeTrip();
        POD pod = new POD();
        pod.setId("POD-1");
        pod.setTripId("TRIP-1001");
        pod.setSignatureUrl("/uploads/pod/signatures/signature.png");
        pod.setPhotoUrl("/uploads/pod/photos/photo.jpg");
        pod.setOtpVerified(true);
        pod.setTimestamp(LocalDateTime.now());

        when(tripRepository.findById("TRIP-1001")).thenReturn(Optional.of(trip));
        when(podRepository.findByTripId("TRIP-1001")).thenReturn(Optional.of(pod));

        PODDTO response = podService.getPod("TRIP-1001");

        assertEquals(true, response.redacted());
        assertNull(response.signatureUrl());
        assertNull(response.photoUrl());
        assertEquals(true, response.signatureCaptured());
        assertEquals(true, response.photoCaptured());
    }

    private Trip activeTrip() {
        Trip trip = new Trip();
        trip.setId("TRIP-1001");
        trip.setAssignedDriverId("DR-201");
        trip.setStatus(TripStatus.IN_PROGRESS);
        return trip;
    }
}
