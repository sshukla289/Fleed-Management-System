package com.fleet.modules.trip.service;

import com.fleet.modules.compliance.dto.ComplianceCheckDTO;
import com.fleet.modules.compliance.dto.ComplianceCheckResultDTO;
import com.fleet.modules.compliance.service.ComplianceService;
import com.fleet.modules.trip.dto.TripValidationResultDTO;
import com.fleet.modules.trip.dto.ValidationCheckDTO;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripComplianceStatus;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class TripValidationService {

    private final ComplianceService complianceService;

    public TripValidationService(ComplianceService complianceService) {
        this.complianceService = complianceService;
    }

    public TripValidationResultDTO evaluate(Trip trip) {
        ComplianceCheckResultDTO complianceResult = complianceService.evaluateTrip(trip);
        List<ValidationCheckDTO> checks = new ArrayList<>();

        for (ComplianceCheckDTO check : complianceResult.checks()) {
            checks.add(new ValidationCheckDTO(check.code(), check.label(), check.passed(), check.message()));
        }

        List<String> warnings = new ArrayList<>(complianceResult.warnings());
        if (warnings.isEmpty() && complianceResult.compliant()) {
            warnings.add("Trip is ready for optimization after validation.");
        }

        TripComplianceStatus complianceStatus = complianceResult.complianceStatus();

        return new TripValidationResultDTO(
            trip.getId(),
            complianceResult.compliant(),
            complianceStatus,
            checks,
            complianceResult.blockingReasons(),
            warnings,
            complianceResult.compliant()
                ? "Proceed to optimization and dispatch."
                : "Resolve blockers before dispatch."
        );
    }
}
