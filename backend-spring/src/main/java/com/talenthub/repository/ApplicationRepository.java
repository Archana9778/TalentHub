package com.talenthub.repository;

import com.talenthub.model.Application;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ApplicationRepository extends JpaRepository<Application, String> {
    List<Application> findByCandidateIdOrderByCreatedAtDesc(String candidateId);
    List<Application> findByJobIdOrderByMatchScoreDesc(String jobId);
    List<Application> findByStage(String stage);
    long countByStage(String stage);
}

