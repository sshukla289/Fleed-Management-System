package com.fleet.modules.maintenance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "maintenance_schedules")
public class MaintenanceSchedule {

    @Id
    private String id;

    private String vehicleId;
    private String title;

    @Enumerated(EnumType.STRING)
    private MaintenanceScheduleStatus status;

    private LocalDate plannedStartDate;
    private LocalDate plannedEndDate;
    private boolean blockDispatch;

    @Column(length = 500)
    private String reasonCode;

    @Column(length = 1000)
    private String notes;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public MaintenanceSchedule() {
    }

    public MaintenanceSchedule(
        String id,
        String vehicleId,
        String title,
        MaintenanceScheduleStatus status,
        LocalDate plannedStartDate,
        LocalDate plannedEndDate,
        boolean blockDispatch,
        String reasonCode,
        String notes,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
    ) {
        this.id = id;
        this.vehicleId = vehicleId;
        this.title = title;
        this.status = status;
        this.plannedStartDate = plannedStartDate;
        this.plannedEndDate = plannedEndDate;
        this.blockDispatch = blockDispatch;
        this.reasonCode = reasonCode;
        this.notes = notes;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getVehicleId() {
        return vehicleId;
    }

    public void setVehicleId(String vehicleId) {
        this.vehicleId = vehicleId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public MaintenanceScheduleStatus getStatus() {
        return status;
    }

    public void setStatus(MaintenanceScheduleStatus status) {
        this.status = status;
    }

    public LocalDate getPlannedStartDate() {
        return plannedStartDate;
    }

    public void setPlannedStartDate(LocalDate plannedStartDate) {
        this.plannedStartDate = plannedStartDate;
    }

    public LocalDate getPlannedEndDate() {
        return plannedEndDate;
    }

    public void setPlannedEndDate(LocalDate plannedEndDate) {
        this.plannedEndDate = plannedEndDate;
    }

    public boolean isBlockDispatch() {
        return blockDispatch;
    }

    public void setBlockDispatch(boolean blockDispatch) {
        this.blockDispatch = blockDispatch;
    }

    public String getReasonCode() {
        return reasonCode;
    }

    public void setReasonCode(String reasonCode) {
        this.reasonCode = reasonCode;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
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
}
