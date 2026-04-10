package com.fleet.modules.auth.service;

import com.fleet.modules.auth.dto.AuthResponse;
import com.fleet.modules.auth.dto.LoginRequest;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.repository.AppUserRepository;
import com.fleet.modules.profile.dto.ProfileDTO;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthSessionService authSessionService;
    private final CurrentUserService currentUserService;

    public AuthService(
        AppUserRepository appUserRepository,
        PasswordEncoder passwordEncoder,
        AuthSessionService authSessionService,
        CurrentUserService currentUserService
    ) {
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
        this.authSessionService = authSessionService;
        this.currentUserService = currentUserService;
    }

    public AuthResponse login(LoginRequest request) {
        if (request == null || request.email() == null || request.password() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email and password are required.");
        }

        AppUser user = appUserRepository.findByLoginEmailIgnoreCase(request.email())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials."));

        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials.");
        }

        authSessionService.revokeSessionsForUser(user.getId());
        String token = authSessionService.createSession(user);
        return new AuthResponse(token, toProfile(user));
    }

    public ProfileDTO getCurrentProfile() {
        return toProfile(currentUserService.getRequiredUser());
    }

    public void logout(String token) {
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Authorization token is required.");
        }

        authSessionService.revokeSession(token);
    }

    private ProfileDTO toProfile(AppUser user) {
        return new ProfileDTO(
            user.getId(),
            user.getName(),
            user.getRole(),
            user.getEmail(),
            user.getAssignedRegion()
        );
    }
}
