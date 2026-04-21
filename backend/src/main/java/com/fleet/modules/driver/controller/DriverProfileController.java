package com.fleet.modules.driver.controller;

import com.fleet.modules.driver.dto.DriverProfileDTO;
import com.fleet.modules.driver.dto.UpdateDriverProfileRequest;
import com.fleet.modules.driver.service.DriverProfileService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/driver/profile")
@PreAuthorize("hasRole('DRIVER')")
public class DriverProfileController {

    private final DriverProfileService driverProfileService;

    public DriverProfileController(DriverProfileService driverProfileService) {
        this.driverProfileService = driverProfileService;
    }

    @GetMapping
    public ResponseEntity<DriverProfileDTO> getProfile() {
        return ResponseEntity.ok(driverProfileService.getProfile());
    }

    @PutMapping
    public ResponseEntity<DriverProfileDTO> updateProfile(@RequestBody UpdateDriverProfileRequest request) {
        return ResponseEntity.ok(driverProfileService.updateProfile(request));
    }
}
