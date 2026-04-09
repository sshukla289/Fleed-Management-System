package com.fleet.modules.alert.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "alerts")
public class Alert {

    @Id
    private String id;

    @Enumerated(EnumType.STRING)
    private AlertCategory category;

    @Enumerated(EnumType.STRING)
    private AlertSeverity severity;

    @Enumerated(EnumType.STRING)
    private AlertLifecycleStatus status;

    private String title;

    @Column(length = 2000)
    private String description;

    private String sourceType;
    private String sourceId;
    private String relatedTripId;
    private String relatedVehicleId;

    @Column(length = 2000)
    private String metadataJson;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime acknowledgedAt;
    private LocalDateTime resolvedAt;
    private LocalDateTime closedAt;

    public Alert() {
    }

    public Alert(
        String id,
        AlertCategory category,
        AlertSeverity severity,
        AlertLifecycleStatus status,
        String title,
        String description,
        String sourceType,
        String sourceId,
        String relatedTripId,
        String relatedVehicleId,
        String metadataJson,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
    ) {
        this.id = id;
        this.category = category;
        this.severity = severity;
        this.status = status;
        this.title = title;
        this.description = description;
        this.sourceType = sourceType;
        this.sourceId = sourceId;
        this.relatedTripId = relatedTripId;
        this.relatedVehicleId = relatedVehicleId;
        this.metadataJson = metadataJson;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public AlertCategory getCategory() {
        return category;
    }

    public void setCategory(AlertCategory category) {
        this.category = category;
    }

    public AlertSeverity getSeverity() {
        return severity;
    }

    public void setSeverity(AlertSeverity severity) {
        this.severity = severity;
    }

    public AlertLifecycleStatus getStatus() {
        return status;
    }

    public void setStatus(AlertLifecycleStatus status) {
        this.status = status;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getSourceType() {
        return sourceType;
    }

    public void setSourceType(String sourceType) {
        this.sourceType = sourceType;
    }

    public String getSourceId() {
        return sourceId;
    }

    public void setSourceId(String sourceId) {
        this.sourceId = sourceId;
    }

    public String getRelatedTripId() {
        return relatedTripId;
    }

    public void setRelatedTripId(String relatedTripId) {
        this.relatedTripId = relatedTripId;
    }

    public String getRelatedVehicleId() {
        return relatedVehicleId;
    }

    public void setRelatedVehicleId(String relatedVehicleId) {
        this.relatedVehicleId = relatedVehicleId;
    }

    public String getMetadataJson() {
        return metadataJson;
    }

    public void setMetadataJson(String metadataJson) {
        this.metadataJson = metadataJson;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public LocalDateTime getAcknowledgedAt() {
        return acknowledgedAt;
    }

    public void setAcknowledgedAt(LocalDateTime acknowledgedAt) {
        this.acknowledgedAt = acknowledgedAt;
    }

    public LocalDateTime getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(LocalDateTime resolvedAt) {
        this.resolvedAt = resolvedAt;
    }

    public LocalDateTime getClosedAt() {
        return closedAt;
    }

    public void setClosedAt(LocalDateTime closedAt) {
        this.closedAt = closedAt;
    }
}
