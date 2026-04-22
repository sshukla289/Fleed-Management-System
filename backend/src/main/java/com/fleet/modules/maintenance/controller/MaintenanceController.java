package com.fleet.modules.maintenance.controller;

import com.fleet.modules.maintenance.dto.CreateMaintenanceAlertRequest;
import com.fleet.modules.maintenance.dto.MaintenanceAlertDTO;
import com.fleet.modules.maintenance.dto.UpdateMaintenanceAlertRequest;
import com.fleet.modules.maintenance.service.MaintenanceService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;

@RestController
@RequestMapping("/api/maintenance-alerts")
public class MaintenanceController {

    private final MaintenanceService maintenanceService;

    public MaintenanceController(MaintenanceService maintenanceService) {
        this.maintenanceService = maintenanceService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','DISPATCHER','PLANNER','MAINTENANCE_MANAGER')")
    public ResponseEntity<List<MaintenanceAlertDTO>> getAlerts() {
        return ResponseEntity.ok(maintenanceService.getAlerts());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','MAINTENANCE_MANAGER')")
    public ResponseEntity<MaintenanceAlertDTO> createAlert(@RequestBody CreateMaintenanceAlertRequest request) {
        return ResponseEntity.ok(maintenanceService.createAlert(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','MAINTENANCE_MANAGER')")
    public ResponseEntity<MaintenanceAlertDTO> updateAlert(@PathVariable String id, @RequestBody UpdateMaintenanceAlertRequest request) {
        return ResponseEntity.ok(maintenanceService.updateAlert(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','MAINTENANCE_MANAGER')")
    public ResponseEntity<Void> deleteAlert(@PathVariable String id) {
        maintenanceService.deleteAlert(id);
        return ResponseEntity.noContent().build();
    }
}
