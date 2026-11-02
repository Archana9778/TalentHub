package com.talenthub.repository;

import com.talenthub.model.ReportedJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReportedJobRepository extends JpaRepository<ReportedJob, String> {
    List<ReportedJob> findByStatusOrderByCreatedAtDesc(String status);
    long countByStatus(String status);
}

