package com.fleet.modules.auth.repository;

import com.fleet.modules.auth.entity.AuthSession;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthSessionRepository extends JpaRepository<AuthSession, String> {

    Optional<AuthSession> findByTokenAndRevokedAtIsNull(String token);

    List<AuthSession> findByUserIdAndRevokedAtIsNull(String userId);

    void deleteByExpiresAtBefore(LocalDateTime expiresAt);
}
