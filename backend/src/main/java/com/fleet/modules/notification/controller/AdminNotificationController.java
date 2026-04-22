package com.fleet.modules.notification.controller;

import com.fleet.modules.notification.dto.CreateBroadcastMessageRequest;
import com.fleet.modules.notification.dto.NotificationBroadcastDTO;
import com.fleet.modules.notification.service.AdminNotificationService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/notifications/broadcasts")
public class AdminNotificationController {

    private final AdminNotificationService adminNotificationService;

    public AdminNotificationController(AdminNotificationService adminNotificationService) {
        this.adminNotificationService = adminNotificationService;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<NotificationBroadcastDTO>> getBroadcasts() {
        return ResponseEntity.ok(adminNotificationService.getBroadcasts());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<NotificationBroadcastDTO> createBroadcast(@RequestBody CreateBroadcastMessageRequest request) {
        return ResponseEntity.ok(adminNotificationService.createBroadcast(request));
    }
}
