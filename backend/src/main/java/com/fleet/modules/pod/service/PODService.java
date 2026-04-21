package com.fleet.modules.pod.service;

import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.auth.entity.AppRole;
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
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PODService {

    private final PODRepository podRepository;
    private final TripRepository tripRepository;
    private final CurrentUserService currentUserService;
    private final AuditLogService auditLogService;
    private final PODEvidenceStorageService storageService;
    private final OtpService otpService;

    public PODService(
        PODRepository podRepository,
        TripRepository tripRepository,
        CurrentUserService currentUserService,
        AuditLogService auditLogService,
        PODEvidenceStorageService storageService,
        OtpService otpService
    ) {
        this.podRepository = podRepository;
        this.tripRepository = tripRepository;
        this.currentUserService = currentUserService;
        this.auditLogService = auditLogService;
        this.storageService = storageService;
        this.otpService = otpService;
    }

    @Transactional
    public PODDTO submit(String tripId, CreatePODRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Proof of delivery request is required.");
        }

        Trip trip = tripRepository.findById(normalize(tripId))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found."));

        ensureProofCanBeCaptured(trip);
        enforceDriverOwnership(trip, "submit proof of delivery for");
        otpService.assertVerifiedOtp(trip);

        POD pod = podRepository.findByTripId(trip.getId()).orElseGet(POD::new);
        if (pod.getId() == null) {
            pod.setId(nextId());
            pod.setTripId(trip.getId());
        }
        StoredPODAsset signature = storageService.storeSignature(request.getSignatureDataUrl());
        StoredPODAsset photo = storageService.storePhoto(request.getPhoto());

        pod.setSignatureUrl(signature.publicUrl());
        pod.setPhotoUrl(photo.publicUrl());
        pod.setSignatureDigest(signature.sha256());
        pod.setPhotoDigest(photo.sha256());
        pod.setOtpVerified(true);
        pod.setTimestamp(LocalDateTime.now());
        pod.setCapturedByUserId(currentUserService.getRequiredUser().getId());

        POD saved = podRepository.save(pod);
        auditLogService.record(
            currentUserService.getCurrentActor(),
            "POD_CAPTURED",
            "POD",
            saved.getId(),
            "Proof of delivery captured.",
            details(
                "tripId", saved.getTripId(),
                "signatureHash", saved.getSignatureDigest(),
                "photoHash", saved.getPhotoDigest(),
                "otpVerified", saved.isOtpVerified(),
                "capturedAt", saved.getTimestamp()
            )
        );
        return toDriverDto(saved);
    }

    public PODDTO getPod(String tripId) {
        Trip trip = tripRepository.findById(normalize(tripId))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found."));
        enforceReadAccess(trip);

        POD pod = podRepository.findByTripId(trip.getId()).orElse(null);
        if (pod == null) {
            return null;
        }

        return currentUserService.getCurrentRole() == AppRole.DRIVER
            ? toDriverDto(pod)
            : toRedactedDto(pod);
    }

    public PODDTO getTripSummary(Trip trip) {
        if (trip == null) {
            return null;
        }

        return podRepository.findByTripId(trip.getId())
            .map(this::toRedactedDto)
            .orElse(null);
    }

    public void assertReadyForCompletion(Trip trip) {
        POD pod = podRepository.findByTripId(trip.getId())
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "A verified proof of delivery is required before the trip can be completed."
            ));

        if (!isCompletionReady(pod)) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Trip completion is blocked until signature, OTP verification, and delivery photo are captured."
            );
        }
    }

    private PODDTO toDriverDto(POD pod) {
        if (pod == null) {
            return null;
        }

        boolean signatureCaptured = pod.getSignatureUrl() != null && !pod.getSignatureUrl().isBlank();
        boolean photoCaptured = pod.getPhotoUrl() != null && !pod.getPhotoUrl().isBlank();
        return new PODDTO(
            pod.getId(),
            pod.getTripId(),
            pod.getSignatureUrl(),
            pod.getPhotoUrl(),
            pod.isOtpVerified(),
            pod.getTimestamp(),
            signatureCaptured,
            photoCaptured,
            isCompletionReady(pod),
            false
        );
    }

    private void ensureProofCanBeCaptured(Trip trip) {
        if (trip.getStatus() != TripStatus.IN_PROGRESS && trip.getStatus() != TripStatus.PAUSED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Proof of delivery can only be captured for active trips.");
        }
    }

    private PODDTO toRedactedDto(POD pod) {
        if (pod == null) {
            return null;
        }

        boolean signatureCaptured = pod.getSignatureUrl() != null && !pod.getSignatureUrl().isBlank();
        boolean photoCaptured = pod.getPhotoUrl() != null && !pod.getPhotoUrl().isBlank();
        return new PODDTO(
            pod.getId(),
            pod.getTripId(),
            null,
            null,
            pod.isOtpVerified(),
            pod.getTimestamp(),
            signatureCaptured,
            photoCaptured,
            isCompletionReady(pod),
            true
        );
    }

    private boolean isCompletionReady(POD pod) {
        return pod != null
            && pod.isOtpVerified()
            && pod.getTimestamp() != null
            && pod.getSignatureUrl() != null
            && !pod.getSignatureUrl().isBlank()
            && pod.getPhotoUrl() != null
            && !pod.getPhotoUrl().isBlank();
    }

    private void enforceReadAccess(Trip trip) {
        if (currentUserService.getCurrentRole() != AppRole.DRIVER) {
            return;
        }

        enforceDriverOwnership(trip, "view proof of delivery for");
    }

    private void enforceDriverOwnership(Trip trip, String action) {
        if (currentUserService.getCurrentRole() != AppRole.DRIVER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only drivers can " + action + ".");
        }

        String actorId = currentUserService.getRequiredUser().getId();
        if (trip.getAssignedDriverId() == null || !trip.getAssignedDriverId().equalsIgnoreCase(actorId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Drivers can only " + action + " their own trips.");
        }
    }

    private String nextId() {
        int nextNumber = podRepository.findAll().stream()
            .map(POD::getId)
            .mapToInt(id -> parseNumericSuffix(id, "POD-"))
            .max()
            .orElse(0) + 1;
        return "POD-" + nextNumber;
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

    private String normalize(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
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
