package com.talenthub.repository;

import com.talenthub.model.ApplicationStageHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ApplicationStageHistoryRepository extends JpaRepository<ApplicationStageHistory, String> {
    List<ApplicationStageHistory> findByApplicationIdOrderByCreatedAtAsc(String applicationId);
}

