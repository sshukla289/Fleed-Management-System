package com.fleet.modules.otp.repository;

import com.fleet.modules.otp.entity.TripOtp;
import com.fleet.modules.otp.entity.TripOtpStatus;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TripOtpRepository extends JpaRepository<TripOtp, String> {

    Optional<TripOtp> findTopByTripIdOrderByCreatedAtDesc(String tripId);

    long countByTripIdAndCreatedAtAfter(String tripId, LocalDateTime cutoff);

    List<TripOtp> findTop20ByStatusInAndNextRetryAtLessThanEqualOrderByNextRetryAtAsc(
        Collection<TripOtpStatus> statuses,
        LocalDateTime nextRetryAt
    );
}
