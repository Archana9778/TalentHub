package com.talenthub.repository;

import com.talenthub.model.JobCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface JobCategoryRepository extends JpaRepository<JobCategory, String> {
    Optional<JobCategory> findByName(String name);
}

