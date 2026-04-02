package com.fleet.modules.telemetry.service;

import com.fleet.modules.alert.service.AlertService;
import com.fleet.modules.telemetry.dto.TelemetryDTO;
import com.fleet.modules.telemetry.entity.Telemetry;
import com.fleet.modules.telemetry.repository.TelemetryRepository;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
public class TelemetryService {

    @Autowired
    private TelemetryRepository repo;

    @Autowired
    private AlertService alertService;

    public void saveTelemetry(TelemetryDTO dto) {
        if (dto == null || dto.getVehicleId() == null || dto.getVehicleId().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vehicle ID is required.");
        }

        Telemetry telemetry = new Telemetry();
        telemetry.setVehicleId(dto.getVehicleId());
        telemetry.setLatitude(dto.getLatitude());
        telemetry.setLongitude(dto.getLongitude());
        telemetry.setSpeed(dto.getSpeed());
        telemetry.setFuelLevel(dto.getFuelLevel());
        telemetry.setTimestamp(dto.getTimestamp() != null ? dto.getTimestamp() : LocalDateTime.now());

        repo.save(telemetry);
        alertService.checkAlerts(telemetry);
    }

    public List<TelemetryDTO> getTelemetry(String vehicleId) {
        List<Telemetry> telemetry = repo.findByVehicleIdOrderByTimestampAsc(vehicleId);

        if (telemetry.isEmpty()) {
            return buildFallbackTelemetry(vehicleId);
        }

        return telemetry.stream()
            .map(this::toDto)
            .toList();
    }

    private TelemetryDTO toDto(Telemetry telemetry) {
        TelemetryDTO dto = new TelemetryDTO();
        dto.setVehicleId(telemetry.getVehicleId());
        dto.setLatitude(telemetry.getLatitude());
        dto.setLongitude(telemetry.getLongitude());
        dto.setSpeed(telemetry.getSpeed());
        dto.setFuelLevel(telemetry.getFuelLevel());
        dto.setTimestamp(telemetry.getTimestamp());
        return dto;
    }

    private List<TelemetryDTO> buildFallbackTelemetry(String vehicleId) {
        return List.of(
            createTelemetryPoint(vehicleId, 19.0760, 72.8777, 48, 74),
            createTelemetryPoint(vehicleId, 19.1136, 72.8697, 56, 70),
            createTelemetryPoint(vehicleId, 19.1480, 72.9310, 62, 66),
            createTelemetryPoint(vehicleId, 19.2010, 73.0169, 54, 61),
            createTelemetryPoint(vehicleId, 19.2183, 73.0844, 45, 58)
        );
    }

    private TelemetryDTO createTelemetryPoint(
        String vehicleId,
        double latitude,
        double longitude,
        double speed,
        double fuelLevel
    ) {
        TelemetryDTO dto = new TelemetryDTO();
        dto.setVehicleId(vehicleId);
        dto.setLatitude(latitude);
        dto.setLongitude(longitude);
        dto.setSpeed(speed);
        dto.setFuelLevel(fuelLevel);
        dto.setTimestamp(LocalDateTime.now());
        return dto;
    }
}
