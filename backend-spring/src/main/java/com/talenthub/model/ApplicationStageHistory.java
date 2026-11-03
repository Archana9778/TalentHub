package com.talenthub.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "application_stage_history")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApplicationStageHistory {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "application_id", nullable = false, length = 64)
    private String applicationId;

    @Column(name = "from_stage", length = 32)
    private String fromStage;

    @Column(name = "to_stage", nullable = false, length = 32)
    private String toStage;

    @Column(name = "changed_by_user_id", length = 64)
    private String changedByUserId;

    @Column(name = "changed_by_name", length = 150)
    private String changedByName;

    @Column(columnDefinition = "TEXT")
    private String comment;

    @Column(name = "interview_type", length = 64)
    private String interviewType;

    @Column(name = "interview_date")
    private LocalDateTime interviewDate;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}

