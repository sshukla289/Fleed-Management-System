package com.fleet.modules.vehicle.entity;

import java.util.Arrays;

public enum VehicleOperationalStatus {
    ACTIVE("Active"),
    IDLE("Idle"),
    MAINTENANCE("Maintenance");

    private final String value;

    VehicleOperationalStatus(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static VehicleOperationalStatus fromValue(String candidate) {
        if (candidate == null) {
            return IDLE;
        }

        return Arrays.stream(values())
            .filter(status -> status.value.equalsIgnoreCase(candidate.trim()) || status.name().equalsIgnoreCase(candidate.trim()))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Unsupported vehicle operational status: " + candidate));
    }

    public static boolean isSupported(String candidate) {
        if (candidate == null) {
            return false;
        }

        return Arrays.stream(values()).anyMatch(status -> status.value.equalsIgnoreCase(candidate.trim()) || status.name().equalsIgnoreCase(candidate.trim()));
    }
}
