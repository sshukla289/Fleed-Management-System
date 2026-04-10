package com.fleet.modules.auth.entity;

import java.util.Locale;

public enum AppRole {
    ADMIN("Admin"),
    FLEET_MANAGER("Fleet Manager"),
    DISPATCHER_PLANNER("Dispatcher / Planner"),
    MAINTENANCE_MANAGER("Maintenance Manager"),
    DRIVER("Driver");

    private final String label;

    AppRole(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public String authority() {
        return "ROLE_" + name();
    }

    public static AppRole fromStoredValue(String value) {
        if (value == null || value.trim().isEmpty()) {
            return DRIVER;
        }

        String normalized = value.trim()
            .replace('-', '_')
            .replace('/', '_')
            .replace(' ', '_')
            .toUpperCase(Locale.ROOT);

        return switch (normalized) {
            case "ADMIN", "ROLE_ADMIN" -> ADMIN;
            case "FLEET_MANAGER", "ROLE_FLEET_MANAGER", "FLEET_OPERATIONS_MANAGER", "FLEET_MANAGER_ADMIN" -> FLEET_MANAGER;
            case "DISPATCHER", "PLANNER", "DISPATCHER_PLANNER", "DISPATCH_PLANNER", "ROLE_DISPATCHER_PLANNER" -> DISPATCHER_PLANNER;
            case "MAINTENANCE_MANAGER", "ROLE_MAINTENANCE_MANAGER" -> MAINTENANCE_MANAGER;
            case "DRIVER", "ROLE_DRIVER" -> DRIVER;
            default -> DRIVER;
        };
    }
}
