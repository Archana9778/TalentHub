package com.talenthub.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "jobs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Job {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(name = "company_id", nullable = false, length = 64)
    private String companyId;

    @Column(name = "company_name", nullable = false, length = 150)
    private String companyName;

    @Column(name = "company_logo", length = 500)
    private String companyLogo;

    @Column(name = "recruiter_id", nullable = false, length = 64)
    private String recruiterId;

    @Column(name = "recruiter_name", nullable = false, length = 150)
    private String recruiterName;

    @Column(name = "category_id", nullable = false, length = 64)
    private String categoryId;

    @Column(name = "category_name", nullable = false, length = 100)
    private String categoryName;

    @Column(nullable = false, length = 150)
    private String location;

    @Column(name = "workplace_type", nullable = false, length = 32)
    private String workplaceType; // Remote, On-site, Hybrid

    @Column(name = "job_type", nullable = false, length = 32)
    private String jobType; // Full-time, Part-time, Contract, Internship

    @Column(name = "experience_level", nullable = false, length = 32)
    private String experienceLevel; // Entry-level, Mid-level, Senior, Lead / Principal

    @Column(name = "salary_min", nullable = false)
    private Integer salaryMin;

    @Column(name = "salary_max", nullable = false)
    private Integer salaryMax;

    @Column(name = "salary_currency", length = 10)
    @Builder.Default
    private String salaryCurrency = "USD";

    @Column(columnDefinition = "TEXT", nullable = false)
    private String description;

    @Column(name = "skills_json", columnDefinition = "JSON")
    private String skillsJson;

    @Column(name = "requirements_json", columnDefinition = "JSON")
    private String requirementsJson;

    @Column(name = "benefits_json", columnDefinition = "JSON")
    private String benefitsJson;

    @Column(nullable = false, length = 32)
    @Builder.Default
    private String status = "active"; // active, closed, draft

    @Column(name = "is_featured")
    @Builder.Default
    private Boolean isFeatured = false;

    @Column(name = "applicants_count")
    @Builder.Default
    private Integer applicantsCount = 0;

    @Column(name = "views_count")
    @Builder.Default
    private Integer viewsCount = 0;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}

