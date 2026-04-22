package com.fleet.modules.trip.controller;

import com.fleet.modules.otp.dto.TripOtpSummaryDTO;
import com.fleet.modules.otp.dto.ValidateTripOtpRequest;
import com.fleet.modules.otp.service.OtpService;
import com.fleet.modules.telemetry.dto.TelemetryDTO;
import com.fleet.modules.telemetry.service.TelemetryService;
import com.fleet.modules.trip.dto.CompleteTripRequest;
import com.fleet.modules.trip.dto.CreateTripRequest;
import com.fleet.modules.trip.dto.TripDTO;
import com.fleet.modules.trip.dto.TripOptimizationResultDTO;
import com.fleet.modules.trip.dto.TripValidationResultDTO;
import com.fleet.modules.trip.service.TripService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/trips")
public class TripController {

    private final TripService tripService;
    private final OtpService otpService;
    private final TelemetryService telemetryService;
    private final com.fleet.modules.trip.service.TripUpdateService tripUpdateService;

    public TripController(
        TripService tripService,
        OtpService otpService,
        TelemetryService telemetryService,
        com.fleet.modules.trip.service.TripUpdateService tripUpdateService
    ) {
        this.tripService = tripService;
        this.otpService = otpService;
        this.telemetryService = telemetryService;
        this.tripUpdateService = tripUpdateService;
    }

    @PostMapping("/location/update")
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','DISPATCHER','DRIVER')")
    public ResponseEntity<Void> updateLocation(@RequestBody com.fleet.modules.trip.dto.TripUpdateDTO update) {
        tripUpdateService.publishTripUpdate(update);
        return ResponseEntity.ok().build();
    }


    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','DISPATCHER','PLANNER','MAINTENANCE_MANAGER','DRIVER')")
    public ResponseEntity<List<TripDTO>> getTrips() {
        return ResponseEntity.ok(tripService.getTrips());
    }

    @GetMapping("/{tripId}")
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','DISPATCHER','PLANNER','MAINTENANCE_MANAGER','DRIVER')")
    public ResponseEntity<TripDTO> getTrip(@PathVariable String tripId) {
        return ResponseEntity.ok(tripService.getTripById(tripId));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','DISPATCHER','PLANNER')")
    public ResponseEntity<TripDTO> createTrip(@Valid @RequestBody CreateTripRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(tripService.createTrip(request));
    }

    @PostMapping("/{tripId}/validate")
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','DISPATCHER','PLANNER','DRIVER')")

    public ResponseEntity<TripValidationResultDTO> validateTrip(@PathVariable String tripId) {
        return ResponseEntity.ok(tripService.validateTrip(tripId));
    }

    @PostMapping("/{tripId}/optimize")
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','DISPATCHER','PLANNER')")
    public ResponseEntity<TripOptimizationResultDTO> optimizeTrip(@PathVariable String tripId) {
        return ResponseEntity.ok(tripService.optimizeTrip(tripId));
    }

    @PostMapping("/{tripId}/dispatch")
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','DISPATCHER')")
    public ResponseEntity<TripDTO> dispatchTrip(
        @PathVariable String tripId,
        @RequestParam(defaultValue = "false") boolean overrideValidation
    ) {
        return ResponseEntity.ok(tripService.dispatchTrip(tripId, overrideValidation));
    }

    @PostMapping("/{tripId}/start")
    @PreAuthorize("hasRole('DRIVER')")
    public ResponseEntity<TripDTO> startTrip(@PathVariable String tripId) {
        return ResponseEntity.ok(tripService.startTrip(tripId));
    }

    @PostMapping("/{tripId}/resend-otp")
    @PreAuthorize("hasRole('DRIVER')")
    public ResponseEntity<TripOtpSummaryDTO> resendOtp(@PathVariable String tripId) {
        return ResponseEntity.ok(otpService.resendOtp(tripId));
    }

    @PostMapping("/{tripId}/otp/validate")
    @PreAuthorize("hasRole('DRIVER')")
    public ResponseEntity<TripOtpSummaryDTO> validateOtp(
        @PathVariable String tripId,
        @Valid @RequestBody ValidateTripOtpRequest request
    ) {
        return ResponseEntity.ok(otpService.validateOtp(tripId, request.otp()));
    }

    @PostMapping("/{tripId}/pause")
    @PreAuthorize("hasRole('DRIVER')")
    public ResponseEntity<TripDTO> pauseTrip(
        @PathVariable String tripId,
        @RequestParam(required = false) String reason
    ) {
        return ResponseEntity.ok(tripService.pauseTrip(tripId, reason));
    }

    @PostMapping("/{tripId}/resume")
    @PreAuthorize("hasRole('DRIVER')")
    public ResponseEntity<TripDTO> resumeTrip(@PathVariable String tripId) {
        return ResponseEntity.ok(tripService.resumeTrip(tripId));
    }

    @PostMapping("/{tripId}/complete")
    @PreAuthorize("hasRole('DRIVER')")
    public ResponseEntity<TripDTO> completeTrip(
        @PathVariable String tripId,
        @Valid @RequestBody CompleteTripRequest request
    ) {
        return ResponseEntity.ok(tripService.completeTrip(tripId, request));
    }

    @PostMapping("/{tripId}/stops/{sequence}/status")
    @PreAuthorize("hasRole('DRIVER')")
    public ResponseEntity<TripDTO> updateStopStatus(
        @PathVariable String tripId,
        @PathVariable int sequence,
        @RequestParam com.fleet.modules.trip.entity.StopStatus status
    ) {
        return ResponseEntity.ok(tripService.updateStopStatus(tripId, sequence, status));
    }


    @PostMapping("/{tripId}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','DISPATCHER','PLANNER')")
    public ResponseEntity<TripDTO> cancelTrip(
        @PathVariable String tripId,
        @RequestParam(required = false) String reason
    ) {
        return ResponseEntity.ok(tripService.cancelTrip(tripId, reason));
    }

    @GetMapping("/{tripId}/telemetry")
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','DISPATCHER','PLANNER','MAINTENANCE_MANAGER','DRIVER')")
    public ResponseEntity<List<TelemetryDTO>> getTripTelemetry(@PathVariable String tripId) {
        return ResponseEntity.ok(telemetryService.getTelemetryByTripId(tripId));
    }
}
