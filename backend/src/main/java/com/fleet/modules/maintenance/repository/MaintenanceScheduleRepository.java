package com.fleet.modules.maintenance.repository;

import com.fleet.modules.maintenance.entity.MaintenanceSchedule;
import com.fleet.modules.maintenance.entity.MaintenanceScheduleStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MaintenanceScheduleRepository extends JpaRepository<MaintenanceSchedule, String> {
    List<MaintenanceSchedule> findByVehicleIdOrderByPlannedStartDateAsc(String vehicleId);

    List<MaintenanceSchedule> findByBlockDispatchTrueAndStatusIn(
        java.util.Collection<MaintenanceScheduleStatus> statuses
    );

    List<MaintenanceSchedule> findByStatusInOrderByPlannedStartDateAsc(
        java.util.Collection<MaintenanceScheduleStatus> statuses
    );
}
