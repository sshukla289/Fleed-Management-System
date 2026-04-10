package com.fleet.modules.auth.service;

import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.auth.dto.AdminUserDTO;
import com.fleet.modules.auth.dto.UpdateUserRoleRequest;
import com.fleet.modules.auth.entity.AppRole;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.repository.AppUserRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminUserService {

    private final AppUserRepository appUserRepository;
    private final CurrentUserService currentUserService;
    private final AuditLogService auditLogService;
    private final AuthSessionService authSessionService;

    public AdminUserService(
        AppUserRepository appUserRepository,
        CurrentUserService currentUserService,
        AuditLogService auditLogService,
        AuthSessionService authSessionService
    ) {
        this.appUserRepository = appUserRepository;
        this.currentUserService = currentUserService;
        this.auditLogService = auditLogService;
        this.authSessionService = authSessionService;
    }

    public List<AdminUserDTO> getUsers() {
        return appUserRepository.findAll().stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    public AdminUserDTO updateUserRole(String userId, UpdateUserRoleRequest request) {
        if (request == null || request.role() == null || request.role().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role is required.");
        }

        AppUser user = appUserRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));

        String previousRole = user.getRole();
        AppRole nextRole = AppRole.fromStoredValue(request.role());
        user.setRole(nextRole.name());
        AppUser saved = appUserRepository.save(user);
        authSessionService.revokeSessionsForUser(saved.getId());

        auditLogService.record(
            currentUserService.getCurrentActor(),
            "USER_ROLE_UPDATED",
            "APP_USER",
            saved.getId(),
            "User role updated.",
            details(
                "previousRole", previousRole,
                "role", saved.getRole()
            )
        );

        return toDto(saved);
    }

    private AdminUserDTO toDto(AppUser user) {
        return new AdminUserDTO(
            user.getId(),
            user.getName(),
            AppRole.fromStoredValue(user.getRole()).name(),
            user.getEmail(),
            user.getLoginEmail(),
            user.getAssignedRegion()
        );
    }

    private Map<String, Object> details(Object... items) {
        Map<String, Object> values = new LinkedHashMap<>();
        if (items == null) {
            return values;
        }

        for (int index = 0; index < items.length; index += 2) {
            Object key = items[index];
            Object value = index + 1 < items.length ? items[index + 1] : null;
            if (key != null && value != null) {
                values.put(String.valueOf(key), value);
            }
        }

        return values;
    }
}
