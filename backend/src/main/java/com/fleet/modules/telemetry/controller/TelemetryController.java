package com.fleet.modules.telemetry.controller;

import com.fleet.modules.telemetry.dto.TelemetryDTO;
import com.fleet.modules.telemetry.service.TelemetryService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/telemetry")
public class TelemetryController {

    private final TelemetryService telemetryService;

    public TelemetryController(TelemetryService telemetryService) {
        this.telemetryService = telemetryService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','FLEET_MANAGER','DISPATCHER_PLANNER','DRIVER')")
    public ResponseEntity<String> receiveData(@RequestBody TelemetryDTO dto) {
        telemetryService.saveTelemetry(dto);
        return ResponseEntity.ok("Telemetry saved");
    }

    @GetMapping("/{vehicleId}")
    @PreAuthorize("hasAnyRole('ADMIN','FLEET_MANAGER','DISPATCHER_PLANNER','MAINTENANCE_MANAGER','DRIVER')")
    public ResponseEntity<List<TelemetryDTO>> getTelemetry(@PathVariable String vehicleId) {
        return ResponseEntity.ok(telemetryService.getTelemetry(vehicleId));
    }

    @GetMapping("/trip/{tripId}")
    @PreAuthorize("hasAnyRole('ADMIN','FLEET_MANAGER','DISPATCHER_PLANNER','MAINTENANCE_MANAGER','DRIVER')")
    public ResponseEntity<List<TelemetryDTO>> getTripTelemetry(@PathVariable String tripId) {
        return ResponseEntity.ok(telemetryService.getTelemetryByTripId(tripId));
    }
}
