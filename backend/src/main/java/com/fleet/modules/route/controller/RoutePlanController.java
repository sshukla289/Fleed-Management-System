package com.fleet.modules.route.controller;

import com.fleet.modules.route.dto.CreateRoutePlanRequest;
import com.fleet.modules.route.dto.RoutePlanDTO;
import com.fleet.modules.route.dto.UpdateRoutePlanRequest;
import com.fleet.modules.route.service.RoutePlanService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/routes")
public class RoutePlanController {

    private final RoutePlanService routePlanService;

    public RoutePlanController(RoutePlanService routePlanService) {
        this.routePlanService = routePlanService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','FLEET_MANAGER','DISPATCHER_PLANNER','MAINTENANCE_MANAGER','DRIVER')")
    public ResponseEntity<List<RoutePlanDTO>> getRoutes() {
        return ResponseEntity.ok(routePlanService.getRoutes());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','FLEET_MANAGER','DISPATCHER_PLANNER')")
    public ResponseEntity<RoutePlanDTO> createRoute(@RequestBody CreateRoutePlanRequest request) {
        return ResponseEntity.ok(routePlanService.createRoute(request));
    }

    @PostMapping("/optimize")
    @PreAuthorize("hasAnyRole('ADMIN','FLEET_MANAGER','DISPATCHER_PLANNER')")
    public ResponseEntity<List<RoutePlanDTO>> optimizeRoutes() {
        return ResponseEntity.ok(routePlanService.optimizeRoutes());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','FLEET_MANAGER','DISPATCHER_PLANNER')")
    public ResponseEntity<RoutePlanDTO> updateRoute(@PathVariable String id, @RequestBody UpdateRoutePlanRequest request) {
        return ResponseEntity.ok(routePlanService.updateRoute(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','FLEET_MANAGER','DISPATCHER_PLANNER')")
    public ResponseEntity<Void> deleteRoute(@PathVariable String id) {
        routePlanService.deleteRoute(id);
        return ResponseEntity.noContent().build();
    }
}
