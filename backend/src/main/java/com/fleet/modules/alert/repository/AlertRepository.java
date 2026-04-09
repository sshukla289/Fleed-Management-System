package com.fleet.modules.alert.repository;

import com.fleet.modules.alert.entity.Alert;
import com.fleet.modules.alert.entity.AlertCategory;
import com.fleet.modules.alert.entity.AlertLifecycleStatus;
import com.fleet.modules.alert.entity.AlertSeverity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AlertRepository extends JpaRepository<Alert, String> {

    List<Alert> findByStatusInOrderByCreatedAtDesc(Collection<AlertLifecycleStatus> statuses);

    List<Alert> findByCategoryInAndStatusInOrderByCreatedAtDesc(
        Collection<AlertCategory> categories,
        Collection<AlertLifecycleStatus> statuses
    );

    List<Alert> findBySeverityInAndStatusInOrderByCreatedAtDesc(
        Collection<AlertSeverity> severities,
        Collection<AlertLifecycleStatus> statuses
    );

    Optional<Alert> findTopBySourceTypeAndSourceIdAndTitleAndStatusInOrderByCreatedAtDesc(
        String sourceType,
        String sourceId,
        String title,
        Collection<AlertLifecycleStatus> statuses
    );

    boolean existsBySourceTypeAndSourceIdAndTitleAndStatusIn(
        String sourceType,
        String sourceId,
        String title,
        Collection<AlertLifecycleStatus> statuses
    );
}
