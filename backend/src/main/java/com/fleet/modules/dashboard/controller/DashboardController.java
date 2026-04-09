package com.fleet.modules.dashboard.controller;

import com.fleet.modules.analytics.dto.DashboardActionQueueItemDTO;
import com.fleet.modules.analytics.dto.DashboardExceptionDTO;
import com.fleet.modules.analytics.service.DashboardAnalyticsService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardAnalyticsService dashboardAnalyticsService;

    public DashboardController(DashboardAnalyticsService dashboardAnalyticsService) {
        this.dashboardAnalyticsService = dashboardAnalyticsService;
    }

    @GetMapping("/action-queue")
    public ResponseEntity<List<DashboardActionQueueItemDTO>> getActionQueue() {
        return ResponseEntity.ok(dashboardAnalyticsService.getActionQueue());
    }

    @GetMapping("/exceptions")
    public ResponseEntity<List<DashboardExceptionDTO>> getExceptions() {
        return ResponseEntity.ok(dashboardAnalyticsService.getExceptions());
    }
}
