package com.fleet.modules.driver.controller;

import com.fleet.modules.analytics.dto.DriverPerformanceDashboardDTO;
import com.fleet.modules.analytics.dto.DriverTripHistoryDTO;
import com.fleet.modules.driver.service.DriverPerformanceAnalyticsService;
import java.time.LocalDateTime;
import com.fleet.modules.trip.entity.TripStatus;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/driver")
public class DriverPerformanceController {

    private final DriverPerformanceAnalyticsService driverPerformanceAnalyticsService;

    public DriverPerformanceController(DriverPerformanceAnalyticsService driverPerformanceAnalyticsService) {
        this.driverPerformanceAnalyticsService = driverPerformanceAnalyticsService;
    }

    @GetMapping("/performance")
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','DISPATCHER','PLANNER','MAINTENANCE_MANAGER','DRIVER')")
    public ResponseEntity<DriverPerformanceDashboardDTO> getDriverPerformance(
        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
        LocalDateTime startDate,

        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
        LocalDateTime endDate
    ) {
        return ResponseEntity.ok(driverPerformanceAnalyticsService.getDriverPerformance(startDate, endDate));
    }

    @GetMapping("/trips/history")
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','DISPATCHER','PLANNER','MAINTENANCE_MANAGER','DRIVER')")
    public ResponseEntity<DriverTripHistoryDTO> getDriverTripHistory(
        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
        LocalDateTime startDate,

        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
        LocalDateTime endDate,

        @RequestParam(required = false)
        TripStatus status
    ) {
        return ResponseEntity.ok(driverPerformanceAnalyticsService.getTripHistory(startDate, endDate, status));
    }
}
