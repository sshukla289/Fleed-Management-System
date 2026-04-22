package com.fleet.modules.notification.repository;

import com.fleet.modules.notification.entity.NotificationBroadcast;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationBroadcastRepository extends JpaRepository<NotificationBroadcast, String> {

    List<NotificationBroadcast> findAllByOrderByCreatedAtDesc();
}
