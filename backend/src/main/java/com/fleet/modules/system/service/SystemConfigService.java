package com.fleet.modules.system.service;

import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.system.dto.SystemConfigUpdateItemRequest;
import com.fleet.modules.system.dto.SystemConfigValueDTO;
import com.fleet.modules.system.dto.UpdateSystemConfigRequest;
import com.fleet.modules.system.entity.SystemConfigEntry;
import com.fleet.modules.system.repository.SystemConfigRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SystemConfigService {

    public static final String SPEED_LIMIT_KPH = "speed.limit.kph";
    public static final String LOW_FUEL_ALERT_THRESHOLD_PERCENT = "alerts.low-fuel-threshold-percent";
    public static final String IDLE_ALERT_THRESHOLD_SECONDS = "alerts.idle-threshold-seconds";
    public static final String ROUTE_DEVIATION_THRESHOLD_METERS = "alerts.route-deviation-threshold-meters";
    public static final String ROUTE_RECOVERY_THRESHOLD_METERS = "alerts.route-recovery-threshold-meters";
    public static final String ROUTE_DEVIATION_DEBOUNCE_SECONDS = "alerts.route-deviation-debounce-seconds";

    private final SystemConfigRepository systemConfigRepository;
    private final CurrentUserService currentUserService;
    private final AuditLogService auditLogService;
    private final List<SettingDefinition> definitions;
    private final Map<String, SettingDefinition> definitionByKey;

    public SystemConfigService(
        SystemConfigRepository systemConfigRepository,
        CurrentUserService currentUserService,
        AuditLogService auditLogService,
        @Value("${app.tracking.overspeed-threshold-kph:80}") long speedLimitKph,
        @Value("${app.alerts.low-fuel-threshold-percent:10}") long lowFuelAlertThresholdPercent,
        @Value("${app.tracking.idle-threshold-seconds:120}") long idleAlertThresholdSeconds,
        @Value("${app.tracking.route-deviation-threshold-meters:250}") long routeDeviationThresholdMeters,
        @Value("${app.tracking.route-recovery-threshold-meters:150}") long routeRecoveryThresholdMeters,
        @Value("${app.tracking.route-deviation-debounce-seconds:20}") long routeDeviationDebounceSeconds
    ) {
        this.systemConfigRepository = systemConfigRepository;
        this.currentUserService = currentUserService;
        this.auditLogService = auditLogService;
        this.definitions = List.of(
            new SettingDefinition(
                SPEED_LIMIT_KPH,
                "Speed",
                "Fleet speed limit",
                "Maximum allowed vehicle speed before an overspeed alert is raised.",
                String.valueOf(speedLimitKph),
                30,
                200
            ),
            new SettingDefinition(
                LOW_FUEL_ALERT_THRESHOLD_PERCENT,
                "Alerts",
                "Low fuel threshold",
                "Raise a low-fuel notification when telemetry drops below this percentage.",
                String.valueOf(lowFuelAlertThresholdPercent),
                1,
                100
            ),
            new SettingDefinition(
                IDLE_ALERT_THRESHOLD_SECONDS,
                "Alerts",
                "Idle alert threshold",
                "Trigger an idle-vehicle alert when movement stops longer than this many seconds.",
                String.valueOf(idleAlertThresholdSeconds),
                30,
                3600
            ),
            new SettingDefinition(
                ROUTE_DEVIATION_THRESHOLD_METERS,
                "Alerts",
                "Route deviation threshold",
                "Raise a route-deviation alert when the vehicle drifts outside this route corridor.",
                String.valueOf(routeDeviationThresholdMeters),
                25,
                5000
            ),
            new SettingDefinition(
                ROUTE_RECOVERY_THRESHOLD_METERS,
                "Alerts",
                "Route recovery threshold",
                "Clear route deviation after the vehicle returns within this distance from the route.",
                String.valueOf(routeRecoveryThresholdMeters),
                10,
                5000
            ),
            new SettingDefinition(
                ROUTE_DEVIATION_DEBOUNCE_SECONDS,
                "Alerts",
                "Route alert debounce",
                "Wait this many seconds before confirming that a route deviation is real.",
                String.valueOf(routeDeviationDebounceSeconds),
                5,
                600
            )
        );
        this.definitionByKey = definitions.stream()
            .collect(Collectors.toMap(SettingDefinition::key, Function.identity(), (left, right) -> left, LinkedHashMap::new));
    }

    @Transactional
    public List<SystemConfigValueDTO> getSettings() {
        Map<String, SystemConfigEntry> entries = ensureDefaults();
        return definitions.stream()
            .map(definition -> toDto(entries.get(definition.key())))
            .toList();
    }

    @Transactional(readOnly = true)
    public TrackingSettings getTrackingSettings() {
        Map<String, SystemConfigEntry> entries = ensureDefaultsReadOnly();

        long speedLimitKph = readLong(entries, SPEED_LIMIT_KPH);
        long lowFuelThresholdPercent = readLong(entries, LOW_FUEL_ALERT_THRESHOLD_PERCENT);
        long idleThresholdSeconds = readLong(entries, IDLE_ALERT_THRESHOLD_SECONDS);
        long routeDeviationThresholdMeters = readLong(entries, ROUTE_DEVIATION_THRESHOLD_METERS);
        long routeRecoveryThresholdMeters = readLong(entries, ROUTE_RECOVERY_THRESHOLD_METERS);
        long routeDeviationDebounceSeconds = readLong(entries, ROUTE_DEVIATION_DEBOUNCE_SECONDS);

        long safeRouteDeviationThreshold = Math.max(25, routeDeviationThresholdMeters);
        long safeRouteRecoveryThreshold = Math.max(10, Math.min(safeRouteDeviationThreshold, routeRecoveryThresholdMeters));

        return new TrackingSettings(
            Math.max(30, speedLimitKph),
            clamp(lowFuelThresholdPercent, 1, 100),
            Duration.ofSeconds(Math.max(30, idleThresholdSeconds)),
            safeRouteDeviationThreshold,
            safeRouteRecoveryThreshold,
            Duration.ofSeconds(Math.max(5, routeDeviationDebounceSeconds))
        );
    }

    @Transactional
    public List<SystemConfigValueDTO> updateSettings(UpdateSystemConfigRequest request) {
        if (request == null || request.entries() == null || request.entries().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one configuration entry is required.");
        }

        Map<String, SystemConfigEntry> entries = ensureDefaults();
        String actor = currentUserService.getCurrentActor();
        LocalDateTime now = LocalDateTime.now();
        Map<String, Map<String, Object>> changes = new LinkedHashMap<>();
        List<SystemConfigEntry> mutatedEntries = new java.util.ArrayList<>();

        for (SystemConfigUpdateItemRequest item : request.entries()) {
            if (item == null || item.key() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Configuration key is required.");
            }

            SettingDefinition definition = definitionByKey.get(item.key());
            if (definition == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported configuration key: " + item.key());
            }

            SystemConfigEntry entry = entries.get(definition.key());
            String nextValue = sanitizeValue(definition, item.value());
            if (Objects.equals(entry.getValue(), nextValue)) {
                continue;
            }

            changes.put(definition.key(), Map.of(
                "previousValue", entry.getValue(),
                "value", nextValue,
                "label", definition.label()
            ));

            entry.setValue(nextValue);
            entry.setUpdatedAt(now);
            entry.setUpdatedBy(actor);
            mutatedEntries.add(entry);
        }

        if (!mutatedEntries.isEmpty()) {
            systemConfigRepository.saveAll(mutatedEntries);
            auditLogService.record(
                actor,
                "SYSTEM_CONFIG_UPDATED",
                "SYSTEM_CONFIG",
                "GLOBAL",
                "System configuration updated.",
                Map.of("changes", changes)
            );
        }

        return getSettings();
    }

    private Map<String, SystemConfigEntry> ensureDefaults() {
        Map<String, SystemConfigEntry> entries = systemConfigRepository.findAll().stream()
            .collect(Collectors.toMap(SystemConfigEntry::getKey, Function.identity(), (left, right) -> left, LinkedHashMap::new));

        List<SystemConfigEntry> missingEntries = definitions.stream()
            .filter(definition -> !entries.containsKey(definition.key()))
            .map(definition -> createEntry(definition, "system"))
            .toList();

        if (!missingEntries.isEmpty()) {
            systemConfigRepository.saveAll(missingEntries);
            missingEntries.forEach(entry -> entries.put(entry.getKey(), entry));
        }

        return entries;
    }

    private Map<String, SystemConfigEntry> ensureDefaultsReadOnly() {
        Map<String, SystemConfigEntry> entries = systemConfigRepository.findAll().stream()
            .collect(Collectors.toMap(SystemConfigEntry::getKey, Function.identity(), (left, right) -> left, LinkedHashMap::new));

        for (SettingDefinition definition : definitions) {
            entries.computeIfAbsent(definition.key(), key -> createEntry(definition, "system"));
        }

        return entries;
    }

    private SystemConfigEntry createEntry(SettingDefinition definition, String actor) {
        SystemConfigEntry entry = new SystemConfigEntry();
        entry.setKey(definition.key());
        entry.setCategory(definition.category());
        entry.setLabel(definition.label());
        entry.setDescription(definition.description());
        entry.setValue(definition.defaultValue());
        entry.setUpdatedAt(LocalDateTime.now());
        entry.setUpdatedBy(actor);
        return entry;
    }

    private long readLong(Map<String, SystemConfigEntry> entries, String key) {
        SettingDefinition definition = definitionByKey.get(key);
        SystemConfigEntry entry = entries.get(key);
        String rawValue = entry != null ? entry.getValue() : definition.defaultValue();

        try {
            return Long.parseLong(rawValue);
        } catch (NumberFormatException exception) {
            return Long.parseLong(definition.defaultValue());
        }
    }

    private String sanitizeValue(SettingDefinition definition, String value) {
        if (value == null || value.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, definition.label() + " is required.");
        }

        long numericValue;
        try {
            numericValue = Long.parseLong(value.trim());
        } catch (NumberFormatException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, definition.label() + " must be a number.");
        }

        if (numericValue < definition.minValue() || numericValue > definition.maxValue()) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                definition.label() + " must be between " + definition.minValue() + " and " + definition.maxValue() + "."
            );
        }

        return String.valueOf(numericValue);
    }

    private SystemConfigValueDTO toDto(SystemConfigEntry entry) {
        return new SystemConfigValueDTO(
            entry.getKey(),
            entry.getCategory(),
            entry.getLabel(),
            entry.getDescription(),
            entry.getValue(),
            entry.getUpdatedAt(),
            entry.getUpdatedBy()
        );
    }

    private long clamp(long value, long min, long max) {
        return Math.max(min, Math.min(max, value));
    }

    public record TrackingSettings(
        long speedLimitKph,
        long lowFuelAlertThresholdPercent,
        Duration idleThreshold,
        long routeDeviationThresholdMeters,
        long routeRecoveryThresholdMeters,
        Duration routeDeviationDebounce
    ) {
    }

    private record SettingDefinition(
        String key,
        String category,
        String label,
        String description,
        String defaultValue,
        long minValue,
        long maxValue
    ) {
    }
}
