package com.fleet.modules.pod.controller;

import com.fleet.modules.pod.dto.CreatePODRequest;
import com.fleet.modules.pod.dto.PODDTO;
import com.fleet.modules.pod.service.PODService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/trips/{tripId}/pod")
public class PODController {

    private final PODService podService;

    public PODController(PODService podService) {
        this.podService = podService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','DISPATCHER','PLANNER','MAINTENANCE_MANAGER','DRIVER')")
    public ResponseEntity<PODDTO> getPod(@PathVariable String tripId) {
        return ResponseEntity.ok(podService.getPod(tripId));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('DRIVER')")
    public ResponseEntity<PODDTO> createPod(@PathVariable String tripId, @Valid @ModelAttribute CreatePODRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(podService.submit(tripId, request));
    }
}
