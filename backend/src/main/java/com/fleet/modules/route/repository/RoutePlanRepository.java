package com.fleet.modules.route.repository;

import com.fleet.modules.route.entity.RoutePlan;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoutePlanRepository extends JpaRepository<RoutePlan, String> {
}
