package com.fleet.modules.system.controller;

import com.fleet.modules.system.dto.SystemConfigValueDTO;
import com.fleet.modules.system.dto.UpdateSystemConfigRequest;
import com.fleet.modules.system.service.SystemConfigService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/system-config")
public class SystemConfigController {

    private final SystemConfigService systemConfigService;

    public SystemConfigController(SystemConfigService systemConfigService) {
        this.systemConfigService = systemConfigService;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<SystemConfigValueDTO>> getSettings() {
        return ResponseEntity.ok(systemConfigService.getSettings());
    }

    @PutMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<SystemConfigValueDTO>> updateSettings(@RequestBody UpdateSystemConfigRequest request) {
        return ResponseEntity.ok(systemConfigService.updateSettings(request));
    }
}
