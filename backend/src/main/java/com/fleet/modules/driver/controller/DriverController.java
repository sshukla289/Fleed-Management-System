package com.fleet.modules.driver.controller;

import com.fleet.modules.driver.dto.AssignShiftRequest;
import com.fleet.modules.driver.dto.CreateDriverRequest;
import com.fleet.modules.driver.dto.DriverDTO;
import com.fleet.modules.driver.dto.UpdateDriverRequest;
import com.fleet.modules.driver.service.DriverService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;

@RestController
@RequestMapping("/api/drivers")
public class DriverController {

    private final DriverService driverService;

    public DriverController(DriverService driverService) {
        this.driverService = driverService;
    }

    @GetMapping
    public ResponseEntity<List<DriverDTO>> getDrivers() {
        return ResponseEntity.ok(driverService.getDrivers());
    }

    @PostMapping
    public ResponseEntity<DriverDTO> createDriver(@RequestBody CreateDriverRequest request) {
        return ResponseEntity.ok(driverService.createDriver(request));
    }

    @PostMapping("/assign-shift")
    public ResponseEntity<DriverDTO> assignShift(@RequestBody AssignShiftRequest request) {
        return ResponseEntity.ok(driverService.assignShift(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<DriverDTO> updateDriver(@PathVariable String id, @RequestBody UpdateDriverRequest request) {
        return ResponseEntity.ok(driverService.updateDriver(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDriver(@PathVariable String id) {
        driverService.deleteDriver(id);
        return ResponseEntity.noContent().build();
    }
}
