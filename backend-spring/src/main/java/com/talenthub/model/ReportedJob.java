package com.talenthub.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "reported_jobs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReportedJob {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "job_id", nullable = false, length = 64)
    private String jobId;

    @Column(name = "job_title", nullable = false, length = 200)
    private String jobTitle;

    @Column(name = "company_name", nullable = false, length = 150)
    private String companyName;

    @Column(name = "reported_by_user_id", nullable = false, length = 64)
    private String reportedByUserId;

    @Column(name = "reported_by_name", nullable = false, length = 150)
    private String reportedByName;

    @Column(nullable = false)
    private String reason;

    @Column(columnDefinition = "TEXT")
    private String details;

    @Column(nullable = false, length = 32)
    @Builder.Default
    private String status = "pending"; // pending, resolved, dismissed

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}

