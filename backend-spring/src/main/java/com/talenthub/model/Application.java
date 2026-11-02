package com.talenthub.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "applications")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Application {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "job_id", nullable = false, length = 64)
    private String jobId;

    @Column(name = "job_title", nullable = false, length = 200)
    private String jobTitle;

    @Column(name = "company_name", nullable = false, length = 150)
    private String companyName;

    @Column(name = "candidate_id", nullable = false, length = 64)
    private String candidateId;

    @Column(name = "candidate_name", nullable = false, length = 150)
    private String candidateName;

    @Column(name = "candidate_email", nullable = false, length = 191)
    private String candidateEmail;

    @Column(name = "candidate_phone")
    private String candidatePhone;

    @Column(name = "candidate_avatar", length = 500)
    private String candidateAvatar;

    @Column(name = "candidate_title")
    private String candidateTitle;

    @Column(name = "resume_url", nullable = false, length = 500)
    private String resumeUrl;

    @Column(name = "cover_letter", columnDefinition = "TEXT")
    private String coverLetter;

    @Column(nullable = false, length = 32)
    @Builder.Default
    private String stage = "Applied"; // Applied, Screening, Interview, Offer, Hired, Rejected

    @Column(name = "match_score", nullable = false)
    @Builder.Default
    private Integer matchScore = 70;

    @Column(name = "match_details_json", columnDefinition = "JSON")
    private String matchDetailsJson;

    @Column(name = "recruiter_notes", columnDefinition = "TEXT")
    private String recruiterNotes;

    @Column(name = "interview_date")
    private LocalDateTime interviewDate;

    @Column(name = "interview_type", length = 50)
    private String interviewType;

    @Column(name = "timeline_json", columnDefinition = "JSON")
    private String timelineJson;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}

