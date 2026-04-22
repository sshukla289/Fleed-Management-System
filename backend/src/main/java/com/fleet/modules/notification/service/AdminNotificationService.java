package com.fleet.modules.notification.service;

import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.auth.entity.AppRole;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.repository.AppUserRepository;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.notification.dto.CreateBroadcastMessageRequest;
import com.fleet.modules.notification.dto.NotificationBroadcastDTO;
import com.fleet.modules.notification.entity.NotificationBroadcast;
import com.fleet.modules.notification.repository.NotificationBroadcastRepository;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminNotificationService {

    private final NotificationBroadcastRepository notificationBroadcastRepository;
    private final AppUserRepository appUserRepository;
    private final NotificationService notificationService;
    private final CurrentUserService currentUserService;
    private final AuditLogService auditLogService;

    public AdminNotificationService(
        NotificationBroadcastRepository notificationBroadcastRepository,
        AppUserRepository appUserRepository,
        NotificationService notificationService,
        CurrentUserService currentUserService,
        AuditLogService auditLogService
    ) {
        this.notificationBroadcastRepository = notificationBroadcastRepository;
        this.appUserRepository = appUserRepository;
        this.notificationService = notificationService;
        this.currentUserService = currentUserService;
        this.auditLogService = auditLogService;
    }

    public List<NotificationBroadcastDTO> getBroadcasts() {
        return notificationBroadcastRepository.findAllByOrderByCreatedAtDesc().stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    public NotificationBroadcastDTO createBroadcast(CreateBroadcastMessageRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Broadcast request is required.");
        }

        String title = requireText(request.title(), "Broadcast title is required.");
        String message = requireText(request.message(), "Broadcast message is required.");
        if (request.severity() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Broadcast severity is required.");
        }

        List<AppRole> targetRoles = parseTargetRoles(request.targetRoles());
        List<AppUser> recipients = appUserRepository.findAll().stream()
            .filter(AppUser::isActiveAccount)
            .filter(user -> targetRoles.contains(AppRole.fromStoredValue(user.getRole())))
            .toList();

        if (recipients.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No active users matched the selected target roles.");
        }

        NotificationBroadcast broadcast = new NotificationBroadcast();
        broadcast.setId(nextId());
        broadcast.setTitle(title);
        broadcast.setMessage(message);
        broadcast.setSeverity(request.severity());
        broadcast.setTargetRolesCsv(targetRoles.stream().map(AppRole::name).collect(Collectors.joining(",")));
        broadcast.setRecipientCount(recipients.size());
        broadcast.setCreatedBy(currentUserService.getCurrentActor());
        broadcast.setCreatedAt(LocalDateTime.now());

        NotificationBroadcast saved = notificationBroadcastRepository.save(broadcast);
        notificationService.createBroadcastNotifications(saved, recipients, buildMetadata(saved, targetRoles));

        auditLogService.record(
            currentUserService.getCurrentActor(),
            "NOTIFICATION_BROADCAST_SENT",
            "NOTIFICATION_BROADCAST",
            saved.getId(),
            "Broadcast notification sent.",
            Map.of(
                "targetRoles", targetRoles.stream().map(AppRole::name).toList(),
                "recipientCount", saved.getRecipientCount(),
                "severity", saved.getSeverity().name(),
                "title", saved.getTitle()
            )
        );

        return toDto(saved);
    }

    private List<AppRole> parseTargetRoles(List<String> targetRoles) {
        if (targetRoles == null || targetRoles.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one target role is required.");
        }

        LinkedHashSet<AppRole> roles = new LinkedHashSet<>();
        for (String value : targetRoles) {
            AppRole role = AppRole.tryParse(value)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported target role: " + value));
            roles.add(role);
        }

        return List.copyOf(roles);
    }

    private NotificationBroadcastDTO toDto(NotificationBroadcast broadcast) {
        List<String> roles = broadcast.getTargetRolesCsv() == null || broadcast.getTargetRolesCsv().isBlank()
            ? List.of()
            : List.of(broadcast.getTargetRolesCsv().split(","));

        return new NotificationBroadcastDTO(
            broadcast.getId(),
            broadcast.getTitle(),
            broadcast.getMessage(),
            broadcast.getSeverity(),
            roles,
            broadcast.getRecipientCount(),
            broadcast.getCreatedBy(),
            broadcast.getCreatedAt()
        );
    }

    private String buildMetadata(NotificationBroadcast broadcast, List<AppRole> targetRoles) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("broadcastId", broadcast.getId());
        metadata.put("createdBy", broadcast.getCreatedBy());
        metadata.put("targetRoles", targetRoles.stream().map(AppRole::name).toList());
        metadata.put("recipientCount", broadcast.getRecipientCount());

        StringBuilder builder = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, Object> entry : metadata.entrySet()) {
            if (!first) {
                builder.append(',');
            }
            first = false;
            builder.append('\"').append(entry.getKey()).append('\"').append(':');
            Object value = entry.getValue();
            if (value instanceof Number || value instanceof Boolean) {
                builder.append(value);
            } else if (value instanceof List<?> list) {
                builder.append('[');
                for (int index = 0; index < list.size(); index++) {
                    if (index > 0) {
                        builder.append(',');
                    }
                    builder.append('\"').append(String.valueOf(list.get(index)).replace("\"", "\\\"")).append('\"');
                }
                builder.append(']');
            } else {
                builder.append('\"').append(String.valueOf(value).replace("\"", "\\\"")).append('\"');
            }
        }
        builder.append('}');
        return builder.toString();
    }

    private String requireText(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }

        return value.trim();
    }

    private String nextId() {
        return "BC-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase();
    }
}
