package com.fleet.modules.auth.service;

import com.fleet.modules.auth.dto.AuthResponse;
import com.fleet.modules.auth.dto.LoginRequest;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.repository.AppUserRepository;
import com.fleet.modules.profile.dto.ProfileDTO;
import com.fleet.modules.profile.service.ProfileService;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private final AppUserRepository appUserRepository;
    private final ProfileService profileService;
    private final PasswordEncoder passwordEncoder;

    public AuthService(
        AppUserRepository appUserRepository,
        ProfileService profileService,
        PasswordEncoder passwordEncoder
    ) {
        this.appUserRepository = appUserRepository;
        this.profileService = profileService;
        this.passwordEncoder = passwordEncoder;
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

        ProfileDTO profile = profileService.getProfile();
        String token = "fleet-session-" + UUID.randomUUID();
        return new AuthResponse(token, profile);
    }
}
