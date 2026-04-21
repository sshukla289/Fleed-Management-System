package com.fleet.modules.driver.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "drivers")
public class Driver {

    @Id
    private String id;

    private String name;
    private String status;
    private String licenseType;
    private String phone;
    private String assignedVehicleId;
    private double hoursDrivenToday;

    public Driver() {
    }

    public Driver(
        String id,
        String name,
        String status,
        String licenseType,
        String phone,
        String assignedVehicleId,
        double hoursDrivenToday
    ) {
        this.id = id;
        this.name = name;
        this.status = status;
        this.licenseType = licenseType;
        this.phone = phone;
        this.assignedVehicleId = assignedVehicleId;
        this.hoursDrivenToday = hoursDrivenToday;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getLicenseType() {
        return licenseType;
    }

    public void setLicenseType(String licenseType) {
        this.licenseType = licenseType;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getAssignedVehicleId() {
        return assignedVehicleId;
    }

    public void setAssignedVehicleId(String assignedVehicleId) {
        this.assignedVehicleId = assignedVehicleId;
    }

    public double getHoursDrivenToday() {
        return hoursDrivenToday;
    }

    public void setHoursDrivenToday(double hoursDrivenToday) {
        this.hoursDrivenToday = hoursDrivenToday;
    }
}
