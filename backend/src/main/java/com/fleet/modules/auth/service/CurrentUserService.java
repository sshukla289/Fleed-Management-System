package com.fleet.modules.auth.service;

import com.fleet.modules.auth.entity.AppRole;
import com.fleet.modules.auth.entity.AppUser;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CurrentUserService {

    public Optional<AppUser> getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return Optional.empty();
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof AppUser appUser) {
            return Optional.of(appUser);
        }

        return Optional.empty();
    }

    public AppUser getRequiredUser() {
        return getCurrentUser()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required."));
    }

    public String getCurrentActor() {
        return getCurrentUser()
            .map(user -> user.getLoginEmail() != null && !user.getLoginEmail().isBlank() ? user.getLoginEmail() : user.getId())
            .orElse("system");
    }

    public AppRole getCurrentRole() {
        return AppRole.fromStoredValue(getRequiredUser().getRole());
    }
}
