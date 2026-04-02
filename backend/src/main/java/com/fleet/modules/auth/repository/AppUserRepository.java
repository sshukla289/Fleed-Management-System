package com.fleet.modules.auth.repository;

import com.fleet.modules.auth.entity.AppUser;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppUserRepository extends JpaRepository<AppUser, String> {
    Optional<AppUser> findByLoginEmailIgnoreCase(String loginEmail);
}
