package com.fleet.modules.system.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.system.dto.SystemConfigValueDTO;
import com.fleet.modules.system.dto.SystemConfigUpdateItemRequest;
import com.fleet.modules.system.dto.UpdateSystemConfigRequest;
import com.fleet.modules.system.entity.SystemConfigEntry;
import com.fleet.modules.system.repository.SystemConfigRepository;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SystemConfigServiceTest {

    @Mock
    private SystemConfigRepository systemConfigRepository;

    @Mock
    private CurrentUserService currentUserService;

    @Mock
    private AuditLogService auditLogService;

    private SystemConfigService systemConfigService;

    @BeforeEach
    void setUp() {
        systemConfigService = new SystemConfigService(
            systemConfigRepository,
            currentUserService,
            auditLogService,
            80,
            10,
            120,
            250,
            150,
            20
        );

        when(systemConfigRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void getSettingsSeedsDynamicDefaultsWhenRepositoryIsEmpty() {
        when(systemConfigRepository.findAll()).thenReturn(List.of());

        List<SystemConfigValueDTO> settings = systemConfigService.getSettings();

        assertEquals(6, settings.size());
        assertEquals("80", valueFor(settings, SystemConfigService.SPEED_LIMIT_KPH));
        assertEquals("10", valueFor(settings, SystemConfigService.LOW_FUEL_ALERT_THRESHOLD_PERCENT));
        verify(systemConfigRepository).saveAll(any());
    }

    @Test
    void updateSettingsPersistsChangesAndWritesAuditLog() {
        when(currentUserService.getCurrentActor()).thenReturn("admin@example.com");
        List<SystemConfigEntry> entries = List.of(
            buildEntry(SystemConfigService.SPEED_LIMIT_KPH, "Speed", "Fleet speed limit", "Speed cap", "80"),
            buildEntry(SystemConfigService.LOW_FUEL_ALERT_THRESHOLD_PERCENT, "Alerts", "Low fuel threshold", "Fuel alert", "10"),
            buildEntry(SystemConfigService.IDLE_ALERT_THRESHOLD_SECONDS, "Alerts", "Idle alert threshold", "Idle alert", "120"),
            buildEntry(SystemConfigService.ROUTE_DEVIATION_THRESHOLD_METERS, "Alerts", "Route deviation threshold", "Deviation alert", "250"),
            buildEntry(SystemConfigService.ROUTE_RECOVERY_THRESHOLD_METERS, "Alerts", "Route recovery threshold", "Recovery alert", "150"),
            buildEntry(SystemConfigService.ROUTE_DEVIATION_DEBOUNCE_SECONDS, "Alerts", "Route alert debounce", "Debounce", "20")
        );
        when(systemConfigRepository.findAll()).thenReturn(entries);

        List<SystemConfigValueDTO> updated = systemConfigService.updateSettings(
            new UpdateSystemConfigRequest(List.of(
                new SystemConfigUpdateItemRequest(SystemConfigService.SPEED_LIMIT_KPH, "85")
            ))
        );

        assertEquals("85", valueFor(updated, SystemConfigService.SPEED_LIMIT_KPH));
        verify(auditLogService).record(
            eq("admin@example.com"),
            eq("SYSTEM_CONFIG_UPDATED"),
            eq("SYSTEM_CONFIG"),
            eq("GLOBAL"),
            eq("System configuration updated."),
            any()
        );
        assertTrue(entries.stream().anyMatch(entry ->
            SystemConfigService.SPEED_LIMIT_KPH.equals(entry.getKey()) && "85".equals(entry.getValue())
        ));
    }

    private String valueFor(List<SystemConfigValueDTO> settings, String key) {
        return settings.stream()
            .filter(entry -> key.equals(entry.key()))
            .findFirst()
            .map(SystemConfigValueDTO::value)
            .orElseThrow();
    }

    private SystemConfigEntry buildEntry(String key, String category, String label, String description, String value) {
        SystemConfigEntry entry = new SystemConfigEntry();
        entry.setKey(key);
        entry.setCategory(category);
        entry.setLabel(label);
        entry.setDescription(description);
        entry.setValue(value);
        entry.setUpdatedAt(LocalDateTime.of(2026, 4, 22, 10, 0));
        entry.setUpdatedBy("system");
        return entry;
    }
}
