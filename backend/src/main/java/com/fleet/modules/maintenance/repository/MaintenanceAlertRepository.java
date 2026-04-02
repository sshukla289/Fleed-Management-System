package com.fleet.modules.maintenance.repository;

import com.fleet.modules.maintenance.entity.MaintenanceAlert;
import com.fleet.modules.maintenance.entity.MaintenanceAlert;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MaintenanceAlertRepository extends JpaRepository<MaintenanceAlert, String> {
    boolean existsByVehicleIdAndTitle(String vehicleId, String title);

    java.util.Optional<MaintenanceAlert> findByVehicleIdAndTitle(String vehicleId, String title);
}
