package com.fleet.modules.audit.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreRemove;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.UUID;

@Entity
@Table(name = "audit_logs")
public class AuditLog {

    @Id
    @Column(updatable = false)
    private String id;

    @Column(updatable = false)
    private String actor;

    @Column(updatable = false)
    private String action;

    @Column(updatable = false)
    private String entityType;

    @Column(updatable = false)
    private String entityId;

    @Column(length = 1000, updatable = false)
    private String summary;

    @Column(length = 4000, updatable = false)
    private String detailsJson;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getActor() {
        return actor;
    }

    public void setActor(String actor) {
        this.actor = actor;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getEntityType() {
        return entityType;
    }

    public void setEntityType(String entityType) {
        this.entityType = entityType;
    }

    public String getEntityId() {
        return entityId;
    }

    public void setEntityId(String entityId) {
        this.entityId = entityId;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }

    public String getDetailsJson() {
        return detailsJson;
    }

    public void setDetailsJson(String detailsJson) {
        this.detailsJson = detailsJson;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    @PrePersist
    void initializeImmutableFields() {
        if (id == null || id.isBlank()) {
            id = "AU-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase(Locale.ROOT);
        }

        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }

        actor = normalize(actor, "system");
        action = normalize(action, "UNKNOWN_ACTION");
        entityType = normalize(entityType, "UNKNOWN_ENTITY");
        entityId = normalize(entityId, "UNKNOWN_ID");
        summary = normalize(summary, "Audit event recorded.");
    }

    @PreUpdate
    @PreRemove
    void blockMutation() {
        throw new UnsupportedOperationException("Audit logs are immutable and cannot be changed.");
    }

    private String normalize(String value, String fallback) {
        if (value == null) {
            return fallback;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? fallback : trimmed;
    }
}
