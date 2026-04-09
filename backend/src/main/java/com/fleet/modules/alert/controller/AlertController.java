package com.fleet.modules.alert.controller;

import com.fleet.modules.alert.dto.AlertDTO;
import com.fleet.modules.alert.dto.CreateAlertRequest;
import com.fleet.modules.alert.service.AlertService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/alerts")
public class AlertController {

    private final AlertService alertService;

    public AlertController(AlertService alertService) {
        this.alertService = alertService;
    }

    @GetMapping
    public ResponseEntity<List<AlertDTO>> getAlerts() {
        return ResponseEntity.ok(alertService.getAlerts());
    }

    @GetMapping("/{id}")
    public ResponseEntity<AlertDTO> getAlert(@PathVariable String id) {
        return ResponseEntity.ok(alertService.getAlertById(id));
    }

    @PostMapping
    public ResponseEntity<AlertDTO> createAlert(@Valid @RequestBody CreateAlertRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(alertService.createAlert(request));
    }

    @PostMapping("/{id}/acknowledge")
    public ResponseEntity<AlertDTO> acknowledgeAlert(@PathVariable String id) {
        return ResponseEntity.ok(alertService.acknowledge(id));
    }

    @PostMapping("/{id}/resolve")
    public ResponseEntity<AlertDTO> resolveAlert(@PathVariable String id) {
        return ResponseEntity.ok(alertService.resolve(id));
    }
}
