package com.fleet.modules.alert.service;

import com.fleet.modules.alert.dto.AlertDTO;
import com.fleet.modules.alert.dto.CreateAlertRequest;
import com.fleet.modules.alert.entity.Alert;
import com.fleet.modules.alert.entity.AlertCategory;
import com.fleet.modules.alert.entity.AlertLifecycleStatus;
import com.fleet.modules.alert.entity.AlertSeverity;
import com.fleet.modules.alert.repository.AlertRepository;
import com.fleet.modules.telemetry.entity.Telemetry;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AlertService {

    private static final List<AlertLifecycleStatus> OPEN_STATUSES = List.of(
        AlertLifecycleStatus.OPEN,
        AlertLifecycleStatus.ACKNOWLEDGED,
        AlertLifecycleStatus.IN_PROGRESS
    );

    private final AlertRepository alertRepository;

    public AlertService(AlertRepository alertRepository) {
        this.alertRepository = alertRepository;
    }

    public List<AlertDTO> getAlerts() {
        return alertRepository.findAll().stream()
            .sorted((left, right) -> right.getCreatedAt().compareTo(left.getCreatedAt()))
            .map(this::toDto)
            .toList();
    }

    public AlertDTO getAlertById(String id) {
        return toDto(findAlert(id));
    }

    @Transactional
    public AlertDTO createAlert(CreateAlertRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Alert request is required.");
        }

        Alert alert = new Alert(
            nextId(),
            request.category(),
            request.severity(),
            AlertLifecycleStatus.OPEN,
            normalize(request.title()),
            normalize(request.description()),
            normalize(request.sourceType()),
            normalize(request.sourceId()),
            normalize(request.relatedTripId()),
            normalize(request.relatedVehicleId()),
            normalize(request.metadataJson()),
            LocalDateTime.now(),
            LocalDateTime.now()
        );

        return toDto(alertRepository.save(alert));
    }

    @Transactional
    public AlertDTO acknowledge(String id) {
        Alert alert = findAlert(id);
        if (alert.getStatus() == AlertLifecycleStatus.CLOSED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Closed alerts cannot be acknowledged.");
        }

        alert.setStatus(AlertLifecycleStatus.ACKNOWLEDGED);
        alert.setAcknowledgedAt(alert.getAcknowledgedAt() == null ? LocalDateTime.now() : alert.getAcknowledgedAt());
        alert.setUpdatedAt(LocalDateTime.now());
        return toDto(alertRepository.save(alert));
    }

    @Transactional
    public AlertDTO resolve(String id) {
        Alert alert = findAlert(id);
        if (alert.getStatus() == AlertLifecycleStatus.CLOSED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Closed alerts cannot be resolved.");
        }

        alert.setStatus(AlertLifecycleStatus.RESOLVED);
        alert.setResolvedAt(LocalDateTime.now());
        alert.setUpdatedAt(LocalDateTime.now());
        return toDto(alertRepository.save(alert));
    }

    @Transactional
    public AlertDTO raiseTelemetryAlerts(Telemetry telemetry) {
        if (telemetry == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Telemetry is required.");
        }

        if (telemetry.getSpeed() > 80) {
            return upsertAlert(
                AlertCategory.SAFETY,
                AlertSeverity.CRITICAL,
                "Speeding detected",
                "Vehicle exceeded safe speed threshold at " + Math.round(telemetry.getSpeed()) + " km/h.",
                "telemetry",
                telemetry.getVehicleId(),
                telemetry.getTripId(),
                telemetry.getVehicleId(),
                "{\"speed\":" + telemetry.getSpeed() + "}"
            );
        }

        if (telemetry.getFuelLevel() < 10) {
            return upsertAlert(
                AlertCategory.LOW_FUEL,
                AlertSeverity.MEDIUM,
                "Low fuel warning",
                "Fuel level dropped to " + Math.round(telemetry.getFuelLevel()) + "% during latest telemetry update.",
                "telemetry",
                telemetry.getVehicleId(),
                telemetry.getTripId(),
                telemetry.getVehicleId(),
                "{\"fuelLevel\":" + telemetry.getFuelLevel() + "}"
            );
        }

        return null;
    }

    public AlertDTO createDispatchException(
        String title,
        String description,
        String tripId,
        String vehicleId,
        String sourceId,
        String metadataJson
    ) {
        return upsertAlert(
            AlertCategory.DISPATCH_EXCEPTION,
            AlertSeverity.HIGH,
            title,
            description,
            "dispatch",
            sourceId,
            tripId,
            vehicleId,
            metadataJson
        );
    }

    public List<AlertDTO> getOpenCriticalAlerts() {
        return alertRepository.findBySeverityInAndStatusInOrderByCreatedAtDesc(
                List.of(AlertSeverity.CRITICAL),
                OPEN_STATUSES
            )
            .stream()
            .map(this::toDto)
            .toList();
    }

    public List<AlertDTO> getOpenAlerts() {
        return alertRepository.findByStatusInOrderByCreatedAtDesc(OPEN_STATUSES)
            .stream()
            .map(this::toDto)
            .toList();
    }

    public List<Alert> findOpenAlertEntities() {
        return alertRepository.findByStatusInOrderByCreatedAtDesc(OPEN_STATUSES);
    }

    private AlertDTO upsertAlert(
        AlertCategory category,
        AlertSeverity severity,
        String title,
        String description,
        String sourceType,
        String sourceId,
        String relatedTripId,
        String relatedVehicleId,
        String metadataJson
    ) {
        String normalizedSourceType = normalize(sourceType);
        String normalizedSourceId = normalize(sourceId);

        Alert alert = alertRepository
            .findTopBySourceTypeAndSourceIdAndTitleAndStatusInOrderByCreatedAtDesc(
                normalizedSourceType,
                normalizedSourceId,
                title,
                OPEN_STATUSES
            )
            .orElseGet(Alert::new);

        if (alert.getId() == null) {
            alert.setId(nextId());
            alert.setCreatedAt(LocalDateTime.now());
        }

        alert.setCategory(category);
        alert.setSeverity(severity);
        alert.setStatus(AlertLifecycleStatus.OPEN);
        alert.setTitle(title);
        alert.setDescription(description);
        alert.setSourceType(normalizedSourceType);
        alert.setSourceId(normalizedSourceId);
        alert.setRelatedTripId(normalize(relatedTripId));
        alert.setRelatedVehicleId(normalize(relatedVehicleId));
        alert.setMetadataJson(metadataJson);
        alert.setUpdatedAt(LocalDateTime.now());

        return toDto(alertRepository.save(alert));
    }

    private Alert findAlert(String id) {
        if (id == null || id.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Alert ID is required.");
        }

        return alertRepository.findById(id.trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alert not found."));
    }

    private AlertDTO toDto(Alert alert) {
        return new AlertDTO(
            alert.getId(),
            alert.getCategory(),
            alert.getSeverity(),
            alert.getStatus(),
            alert.getTitle(),
            alert.getDescription(),
            alert.getSourceType(),
            alert.getSourceId(),
            alert.getRelatedTripId(),
            alert.getRelatedVehicleId(),
            alert.getMetadataJson(),
            alert.getCreatedAt(),
            alert.getUpdatedAt(),
            alert.getAcknowledgedAt(),
            alert.getResolvedAt(),
            alert.getClosedAt()
        );
    }

    private String nextId() {
        int nextNumber = alertRepository.findAll().stream()
            .map(Alert::getId)
            .mapToInt(id -> parseNumericSuffix(id, "AL-"))
            .max()
            .orElse(0) + 1;
        return "AL-" + nextNumber;
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
}
