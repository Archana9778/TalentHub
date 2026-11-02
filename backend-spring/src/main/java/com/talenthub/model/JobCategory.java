package com.talenthub.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "job_categories")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobCategory {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Builder.Default
    private String icon = "Briefcase";

    @Column(name = "job_count")
    @Builder.Default
    private Integer jobCount = 0;
}

