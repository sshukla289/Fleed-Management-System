package com.fleet.modules.alert.service;

import com.fleet.modules.maintenance.service.MaintenanceService;
import com.fleet.modules.telemetry.entity.Telemetry;
import org.springframework.stereotype.Service;

@Service
public class AlertService {

    private final MaintenanceService maintenanceService;

    public AlertService(MaintenanceService maintenanceService) {
        this.maintenanceService = maintenanceService;
    }

    public void checkAlerts(Telemetry telemetry) {
        if (telemetry.getSpeed() > 80) {
            maintenanceService.createSystemAlertIfAbsent(
                telemetry.getVehicleId(),
                "Speeding detected",
                "Critical",
                "Vehicle exceeded safe speed threshold at " + Math.round(telemetry.getSpeed()) + " km/h."
            );
        }

        if (telemetry.getFuelLevel() < 10) {
            maintenanceService.createSystemAlertIfAbsent(
                telemetry.getVehicleId(),
                "Low fuel warning",
                "Medium",
                "Fuel level dropped to " + Math.round(telemetry.getFuelLevel()) + "% during latest telemetry update."
            );
        }
    }
}
