package com.fleet.modules.pod.repository;

import com.fleet.modules.pod.entity.POD;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PODRepository extends JpaRepository<POD, String> {

    Optional<POD> findByTripId(String tripId);
}
