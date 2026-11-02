package com.talenthub.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false, unique = true, length = 191)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, length = 32)
    private String role; // "candidate", "recruiter", "admin"

    @Column(nullable = false, length = 32)
    @Builder.Default
    private String status = "active"; // "active", "suspended"

    private String title;
    private String location;
    private String phone;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @Column(columnDefinition = "TEXT")
    private String bio;

    @Column(name = "company_id", length = 64)
    private String companyId;

    @Column(name = "company_name", length = 150)
    private String companyName;

    @Column(name = "resume_url", length = 500)
    private String resumeUrl;

    @Column(name = "resume_original_name")
    private String resumeOriginalName;

    @Column(name = "skills_json", columnDefinition = "JSON")
    private String skillsJson;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}

