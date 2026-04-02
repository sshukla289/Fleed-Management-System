package com.fleet.modules.profile.service;

import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.repository.AppUserRepository;
import com.fleet.modules.profile.dto.ChangePasswordRequest;
import com.fleet.modules.profile.dto.ProfileDTO;
import com.fleet.modules.profile.dto.UpdateProfileRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProfileService {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;

    public ProfileService(AppUserRepository appUserRepository, PasswordEncoder passwordEncoder) {
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public ProfileDTO getProfile() {
        return toDto(getPrimaryUser());
    }

    public ProfileDTO updateProfile(UpdateProfileRequest request) {
        AppUser user = getPrimaryUser();
        user.setName(request.name());
        user.setRole(request.role());
        user.setEmail(request.email());
        user.setAssignedRegion(request.assignedRegion());
        return toDto(appUserRepository.save(user));
    }

    public void changePassword(ChangePasswordRequest request) {
        if (
            request == null ||
            isBlank(request.currentPassword()) ||
            isBlank(request.newPassword()) ||
            isBlank(request.confirmPassword())
        ) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password fields are required.");
        }

        if (!request.newPassword().equals(request.confirmPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New passwords do not match.");
        }

        if (request.newPassword().length() < 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New password must be at least 8 characters.");
        }

        AppUser user = getPrimaryUser();
        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Current password is incorrect.");
        }

        user.setPassword(passwordEncoder.encode(request.newPassword()));
        appUserRepository.save(user);
    }

    private AppUser getPrimaryUser() {
        return appUserRepository.findAll().stream()
            .findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Profile not found."));
    }

    private ProfileDTO toDto(AppUser user) {
        return new ProfileDTO(
            user.getId(),
            user.getName(),
            user.getRole(),
            user.getEmail(),
            user.getAssignedRegion()
        );
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
