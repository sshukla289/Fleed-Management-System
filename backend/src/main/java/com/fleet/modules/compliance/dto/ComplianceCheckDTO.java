package com.fleet.modules.compliance.dto;

public record ComplianceCheckDTO(
    String code,
    String label,
    boolean passed,
    boolean blocking,
    String message
) {}
