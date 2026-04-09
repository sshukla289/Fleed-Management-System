package com.fleet.modules.analytics.dto;

public record DashboardResourceDTO(
    String id,
    String title,
    String subtitle,
    String status,
    String note,
    String actionPath
) {}
