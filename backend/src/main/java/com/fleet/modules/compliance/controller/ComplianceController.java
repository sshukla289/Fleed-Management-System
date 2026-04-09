package com.fleet.modules.compliance.controller;

import com.fleet.modules.compliance.dto.ComplianceCheckResultDTO;
import com.fleet.modules.compliance.service.ComplianceService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/compliance")
public class ComplianceController {

    private final ComplianceService complianceService;

    public ComplianceController(ComplianceService complianceService) {
        this.complianceService = complianceService;
    }

    @GetMapping("/checks/{tripId}")
    public ResponseEntity<ComplianceCheckResultDTO> getTripCompliance(@PathVariable String tripId) {
        return ResponseEntity.ok(complianceService.checkTrip(tripId));
    }
}
