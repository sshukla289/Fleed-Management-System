package com.fleet.modules.trip.service;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.auth.entity.AppRole;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.checklist.service.ChecklistService;
import com.fleet.modules.driver.repository.DriverRepository;
import com.fleet.modules.notification.service.NotificationService;
import com.fleet.modules.otp.service.OtpService;
import com.fleet.modules.pod.service.PODService;
import com.fleet.modules.telemetry.service.TripTrackingBroadcastService;
import com.fleet.modules.trip.dto.CompleteTripRequest;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import com.fleet.modules.vehicle.repository.VehicleRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class TripServicePodRequirementTest {

    @Mock
    private TripRepository tripRepository;

    @Mock
    private TripValidationService validationService;

    @Mock
    private TripOptimizationService optimizationService;

    @Mock
    private TripDispatchService dispatchService;

    @Mock
    private VehicleRepository vehicleRepository;

    @Mock
    private DriverRepository driverRepository;

    @Mock
    private AuditLogService auditLogService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private CurrentUserService currentUserService;

    @Mock
    private TripTrackingBroadcastService tripTrackingBroadcastService;

    @Mock
    private ChecklistService checklistService;

    @Mock
    private OtpService otpService;

    @Mock
    private PODService podService;

    private TripService tripService;

    @BeforeEach
    void setUp() {
        tripService = new TripService(
            tripRepository,
            validationService,
            optimizationService,
            dispatchService,
            vehicleRepository,
            driverRepository,
            auditLogService,
            notificationService,
            currentUserService,
            tripTrackingBroadcastService,
            checklistService,
            otpService,
            podService
        );

        AppUser driver = new AppUser();
        driver.setId("DR-201");
        driver.setRole("DRIVER");

        when(currentUserService.getCurrentRole()).thenReturn(AppRole.DRIVER);
        when(currentUserService.getRequiredUser()).thenReturn(driver);
    }

    @Test
    void completeTripRequiresVerifiedPodBeforeDispatchCompletion() {
        Trip trip = new Trip();
        trip.setId("TRIP-1001");
        trip.setAssignedDriverId("DR-201");
        trip.setStatus(TripStatus.IN_PROGRESS);
        when(tripRepository.findById("TRIP-1001")).thenReturn(Optional.of(trip));
        org.mockito.Mockito.doThrow(new ResponseStatusException(
            org.springframework.http.HttpStatus.BAD_REQUEST,
            "A verified proof of delivery is required before the trip can be completed."
        )).when(podService).assertReadyForCompletion(trip);

        ResponseStatusException exception = assertThrows(
            ResponseStatusException.class,
            () -> tripService.completeTrip(
                "TRIP-1001",
                new CompleteTripRequest(LocalDateTime.now(), 120, 11.4, "2h 20m", "Completed")
            )
        );

        verify(checklistService).assertPostTripChecklistComplete(trip);
        verify(podService).assertReadyForCompletion(trip);
        verify(dispatchService, never()).complete(any(), any());
        org.junit.jupiter.api.Assertions.assertEquals("400 BAD_REQUEST \"A verified proof of delivery is required before the trip can be completed.\"", exception.getMessage());
    }
}
