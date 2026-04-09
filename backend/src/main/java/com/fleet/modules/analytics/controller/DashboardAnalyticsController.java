package com.fleet.modules.analytics.controller;

import com.fleet.modules.analytics.dto.DashboardAnalyticsDTO;
import com.fleet.modules.analytics.service.DashboardAnalyticsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analytics")
public class DashboardAnalyticsController {

    private final DashboardAnalyticsService dashboardAnalyticsService;

    public DashboardAnalyticsController(DashboardAnalyticsService dashboardAnalyticsService) {
        this.dashboardAnalyticsService = dashboardAnalyticsService;
    }

    @GetMapping("/dashboard")
    public ResponseEntity<DashboardAnalyticsDTO> getDashboardAnalytics() {
        return ResponseEntity.ok(dashboardAnalyticsService.getDashboardSummary());
    }
}
