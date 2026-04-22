package com.fleet.modules.system.repository;

import com.fleet.modules.system.entity.SystemConfigEntry;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SystemConfigRepository extends JpaRepository<SystemConfigEntry, String> {
}
