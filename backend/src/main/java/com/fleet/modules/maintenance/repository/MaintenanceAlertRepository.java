package com.fleet.modules.maintenance.repository;

import com.fleet.modules.maintenance.entity.MaintenanceAlert;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MaintenanceAlertRepository extends JpaRepository<MaintenanceAlert, String> {
}
