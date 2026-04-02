package com.fleet.modules.maintenance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;

@Entity
@Table(name = "maintenance_alerts")
public class MaintenanceAlert {

    @Id
    private String id;

    private String vehicleId;
    private String title;
    private String severity;
    private LocalDate dueDate;

    @Column(length = 1000)
    private String description;

    public MaintenanceAlert() {
    }

    public MaintenanceAlert(
        String id,
        String vehicleId,
        String title,
        String severity,
        LocalDate dueDate,
        String description
    ) {
        this.id = id;
        this.vehicleId = vehicleId;
        this.title = title;
        this.severity = severity;
        this.dueDate = dueDate;
        this.description = description;
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

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
