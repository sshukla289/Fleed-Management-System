package com.fleet.modules.compliance.dto;

import com.fleet.modules.trip.entity.TripComplianceStatus;
import java.util.List;

public record ComplianceCheckResultDTO(
    String tripId,
    boolean compliant,
    TripComplianceStatus complianceStatus,
    List<ComplianceCheckDTO> checks,
    List<String> blockingReasons,
    List<String> warnings,
    String recommendedAction
) {}
