package com.fleet.modules.notification.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.repository.AppUserRepository;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.notification.dto.CreateBroadcastMessageRequest;
import com.fleet.modules.notification.dto.NotificationBroadcastDTO;
import com.fleet.modules.notification.entity.NotificationBroadcast;
import com.fleet.modules.notification.entity.NotificationSeverity;
import com.fleet.modules.notification.repository.NotificationBroadcastRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AdminNotificationServiceTest {

    @Mock
    private NotificationBroadcastRepository notificationBroadcastRepository;

    @Mock
    private AppUserRepository appUserRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private CurrentUserService currentUserService;

    @Mock
    private AuditLogService auditLogService;

    private AdminNotificationService adminNotificationService;

    @BeforeEach
    void setUp() {
        adminNotificationService = new AdminNotificationService(
            notificationBroadcastRepository,
            appUserRepository,
            notificationService,
            currentUserService,
            auditLogService
        );

        when(currentUserService.getCurrentActor()).thenReturn("admin@example.com");
        when(notificationBroadcastRepository.save(any(NotificationBroadcast.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void createBroadcastTargetsOnlyActiveUsersMatchingSelectedRoles() {
        AppUser dispatcher = buildUser("USR-D1", "DISPATCHER", true);
        AppUser operationsManager = buildUser("USR-O1", "OPERATIONS_MANAGER", true);
        AppUser inactiveDispatcher = buildUser("USR-D2", "DISPATCHER", false);
        AppUser driver = buildUser("USR-R1", "DRIVER", true);
        when(appUserRepository.findAll()).thenReturn(List.of(dispatcher, operationsManager, inactiveDispatcher, driver));

        NotificationBroadcastDTO created = adminNotificationService.createBroadcast(
            new CreateBroadcastMessageRequest(
                " Dispatch advisory ",
                " Use the alternate east gate for the next two hours. ",
                NotificationSeverity.CRITICAL,
                List.of("dispatcher", "operations_manager")
            )
        );

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<AppUser>> recipientsCaptor = ArgumentCaptor.forClass(List.class);

        verify(notificationService).createBroadcastNotifications(any(NotificationBroadcast.class), recipientsCaptor.capture(), any());
        verify(auditLogService).record(
            eq("admin@example.com"),
            eq("NOTIFICATION_BROADCAST_SENT"),
            eq("NOTIFICATION_BROADCAST"),
            eq(created.id()),
            eq("Broadcast notification sent."),
            any()
        );

        assertEquals("Dispatch advisory", created.title());
        assertEquals("Use the alternate east gate for the next two hours.", created.message());
        assertEquals(NotificationSeverity.CRITICAL, created.severity());
        assertEquals(2, created.recipientCount());
        assertEquals("admin@example.com", created.createdBy());
        assertIterableEquals(List.of("DISPATCHER", "OPERATIONS_MANAGER"), created.targetRoles());
        assertIterableEquals(
            List.of("USR-D1", "USR-O1"),
            recipientsCaptor.getValue().stream().map(AppUser::getId).toList()
        );
    }

    private AppUser buildUser(String id, String role, boolean active) {
        AppUser user = new AppUser();
        user.setId(id);
        user.setName(role + " User");
        user.setRole(role);
        user.setEmail(id.toLowerCase() + "@example.com");
        user.setLoginEmail(id.toLowerCase() + "@example.com");
        user.setAssignedRegion("Global");
        user.setPassword("encoded-password");
        user.setActive(active);
        return user;
    }
}
