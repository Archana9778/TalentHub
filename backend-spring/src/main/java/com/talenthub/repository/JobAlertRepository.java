package com.talenthub.repository;

import com.talenthub.model.JobAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JobAlertRepository extends JpaRepository<JobAlert, String> {
    List<JobAlert> findByUserIdOrderByCreatedAtDesc(String userId);
}

