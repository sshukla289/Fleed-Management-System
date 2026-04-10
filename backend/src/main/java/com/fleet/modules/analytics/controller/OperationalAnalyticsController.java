package com.fleet.modules.analytics.controller;

import com.fleet.modules.analytics.dto.DriverAnalyticsDTO;
import com.fleet.modules.analytics.dto.TripAnalyticsDTO;
import com.fleet.modules.analytics.dto.VehicleAnalyticsDTO;
import com.fleet.modules.analytics.service.OperationalAnalyticsService;
import com.fleet.modules.trip.entity.TripStatus;
import java.time.LocalDateTime;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analytics")
public class OperationalAnalyticsController {

    private final OperationalAnalyticsService operationalAnalyticsService;

    public OperationalAnalyticsController(OperationalAnalyticsService operationalAnalyticsService) {
        this.operationalAnalyticsService = operationalAnalyticsService;
    }

    @GetMapping("/trips")
    @PreAuthorize("hasAnyRole('ADMIN','FLEET_MANAGER','DISPATCHER_PLANNER','MAINTENANCE_MANAGER')")
    public ResponseEntity<TripAnalyticsDTO> getTripAnalytics(
        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
        LocalDateTime startDate,

        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
        LocalDateTime endDate,

        @RequestParam(required = false)
        TripStatus status
    ) {
        return ResponseEntity.ok(operationalAnalyticsService.getTripAnalytics(startDate, endDate, status));
    }

    @GetMapping("/vehicles")
    @PreAuthorize("hasAnyRole('ADMIN','FLEET_MANAGER','DISPATCHER_PLANNER','MAINTENANCE_MANAGER')")
    public ResponseEntity<VehicleAnalyticsDTO> getVehicleAnalytics(
        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
        LocalDateTime startDate,

        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
        LocalDateTime endDate
    ) {
        return ResponseEntity.ok(operationalAnalyticsService.getVehicleAnalytics(startDate, endDate));
    }

    @GetMapping("/drivers")
    @PreAuthorize("hasAnyRole('ADMIN','FLEET_MANAGER','DISPATCHER_PLANNER','MAINTENANCE_MANAGER')")
    public ResponseEntity<DriverAnalyticsDTO> getDriverAnalytics(
        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
        LocalDateTime startDate,

        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
        LocalDateTime endDate
    ) {
        return ResponseEntity.ok(operationalAnalyticsService.getDriverAnalytics(startDate, endDate));
    }
}
