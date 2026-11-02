package com.talenthub.repository;

import com.talenthub.model.Job;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JobRepository extends JpaRepository<Job, String> {
    List<Job> findAllByStatusOrderByCreatedAtDesc(String status);
    List<Job> findByRecruiterIdOrderByCreatedAtDesc(String recruiterId);
    List<Job> findByCategoryIdAndStatus(String categoryId, String status);
    List<Job> findByIsFeaturedTrueAndStatus(String status);
    long countByStatus(String status);

    @Query("SELECT j FROM Job j WHERE j.status = 'active' AND " +
           "(:search IS NULL OR LOWER(j.title) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(j.companyName) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(j.description) LIKE LOWER(CONCAT('%', :search, '%'))) AND " +
           "(:category IS NULL OR j.categoryId = :category) AND " +
           "(:workplaceType IS NULL OR j.workplaceType = :workplaceType) AND " +
           "(:jobType IS NULL OR j.jobType = :jobType) AND " +
           "(:experienceLevel IS NULL OR j.experienceLevel = :experienceLevel)")
    List<Job> searchJobs(
        @Param("search") String search,
        @Param("category") String category,
        @Param("workplaceType") String workplaceType,
        @Param("jobType") String jobType,
        @Param("experienceLevel") String experienceLevel
    );
}
