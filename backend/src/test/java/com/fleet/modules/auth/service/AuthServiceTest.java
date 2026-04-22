package com.fleet.modules.auth.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.auth.dto.AuthResponse;
import com.fleet.modules.auth.dto.LoginRequest;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.repository.AppUserRepository;
import com.fleet.modules.driver.repository.DriverRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private AppUserRepository appUserRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private AuthSessionService authSessionService;

    @Mock
    private CurrentUserService currentUserService;

    @Mock
    private DriverRepository driverRepository;

    @Mock
    private AuditLogService auditLogService;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(
            appUserRepository,
            passwordEncoder,
            authSessionService,
            currentUserService,
            driverRepository,
            auditLogService
        );
    }

    @Test
    void loginFallsBackToPrimaryEmailWhenLoginEmailLookupMisses() {
        AppUser user = buildUser("USR-1", "operations_manager@gmail.com", "operations_manager@gmail.com", "encoded-password");
        when(appUserRepository.findByLoginEmailIgnoreCase("operations_manager@gmail.com")).thenReturn(Optional.empty());
        when(appUserRepository.findByEmailIgnoreCase("operations_manager@gmail.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("password", "encoded-password")).thenReturn(true);
        when(authSessionService.createSession(user)).thenReturn("token-123");

        AuthResponse response = authService.login(new LoginRequest(" operations_manager@gmail.com ", "password"));

        assertEquals("token-123", response.token());
        assertEquals("operations_manager@gmail.com", response.profile().email());
        verify(authSessionService).revokeSessionsForUser("USR-1");
        verify(auditLogService).record(
            eq("operations_manager@gmail.com"),
            eq("USER_LOGIN"),
            eq("APP_USER"),
            eq("USR-1"),
            eq("User logged in."),
            any()
        );
    }

    @Test
    void loginUpgradesLegacyPlaintextPasswordAndMissingLoginEmail() {
        AppUser user = buildUser("USR-2", "admin@gmail.com", "", "password");
        when(appUserRepository.findByLoginEmailIgnoreCase("admin@gmail.com")).thenReturn(Optional.empty());
        when(appUserRepository.findByEmailIgnoreCase("admin@gmail.com")).thenReturn(Optional.of(user));
        when(appUserRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(passwordEncoder.matches("password", "password")).thenReturn(false);
        when(passwordEncoder.encode("password")).thenReturn("encoded-password");
        when(authSessionService.createSession(any(AppUser.class))).thenReturn("token-456");

        AuthResponse response = authService.login(new LoginRequest("admin@gmail.com", "password"));

        assertEquals("token-456", response.token());
        assertEquals("encoded-password", user.getPassword());
        assertEquals("admin@gmail.com", user.getLoginEmail());
        verify(appUserRepository, times(2)).save(user);
    }

    @Test
    void loginRejectsUnknownCredentials() {
        when(appUserRepository.findByLoginEmailIgnoreCase("missing@gmail.com")).thenReturn(Optional.empty());
        when(appUserRepository.findByEmailIgnoreCase("missing@gmail.com")).thenReturn(Optional.empty());

        ResponseStatusException thrown = assertThrows(
            ResponseStatusException.class,
            () -> authService.login(new LoginRequest("missing@gmail.com", "password"))
        );

        assertEquals(HttpStatus.UNAUTHORIZED, thrown.getStatusCode());
        verify(authSessionService, never()).createSession(any(AppUser.class));
    }

    private AppUser buildUser(String id, String email, String loginEmail, String password) {
        AppUser user = new AppUser();
        user.setId(id);
        user.setName("Console User");
        user.setRole("ADMIN");
        user.setEmail(email);
        user.setLoginEmail(loginEmail);
        user.setAssignedRegion("Global");
        user.setPassword(password);
        return user;
    }
}
