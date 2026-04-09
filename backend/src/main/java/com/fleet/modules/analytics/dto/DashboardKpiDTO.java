package com.fleet.modules.analytics.dto;

public record DashboardKpiDTO(
    String key,
    String label,
    String value,
    String note,
    String tone
) {}
