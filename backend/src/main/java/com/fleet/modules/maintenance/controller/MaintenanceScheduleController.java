package com.fleet.modules.maintenance.controller;

import com.fleet.modules.maintenance.dto.CreateMaintenanceScheduleRequest;
import com.fleet.modules.maintenance.dto.MaintenanceScheduleDTO;
import com.fleet.modules.maintenance.service.MaintenanceScheduleService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/maintenance/schedules")
public class MaintenanceScheduleController {

    private final MaintenanceScheduleService maintenanceScheduleService;

    public MaintenanceScheduleController(MaintenanceScheduleService maintenanceScheduleService) {
        this.maintenanceScheduleService = maintenanceScheduleService;
    }

    @GetMapping
    public ResponseEntity<List<MaintenanceScheduleDTO>> getSchedules() {
        return ResponseEntity.ok(maintenanceScheduleService.getSchedules());
    }

    @PostMapping
    public ResponseEntity<MaintenanceScheduleDTO> createSchedule(@Valid @RequestBody CreateMaintenanceScheduleRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(maintenanceScheduleService.createSchedule(request));
    }
}
