package com.fleet.modules.profile.service;

import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.repository.AppUserRepository;
import com.fleet.modules.profile.dto.ProfileDTO;
import com.fleet.modules.profile.dto.UpdateProfileRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProfileService {

    private final AppUserRepository appUserRepository;

    public ProfileService(AppUserRepository appUserRepository) {
        this.appUserRepository = appUserRepository;
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
}
