package com.fleet.modules.driver.entity;

import java.util.Arrays;

public enum DriverDutyStatus {
    ON_DUTY("On Duty"),
    OFF_DUTY("Off Duty"),
    RESTING("Resting");

    private final String value;

    DriverDutyStatus(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static DriverDutyStatus fromValue(String candidate) {
        if (candidate == null) {
            return OFF_DUTY;
        }

        return Arrays.stream(values())
            .filter(status -> status.value.equalsIgnoreCase(candidate.trim()) || status.name().equalsIgnoreCase(candidate.trim()))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Unsupported driver duty status: " + candidate));
    }

    public static boolean isSupported(String candidate) {
        if (candidate == null) {
            return false;
        }

        return Arrays.stream(values()).anyMatch(status -> status.value.equalsIgnoreCase(candidate.trim()) || status.name().equalsIgnoreCase(candidate.trim()));
    }
}
