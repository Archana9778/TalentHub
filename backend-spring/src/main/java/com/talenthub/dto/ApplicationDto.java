package com.talenthub.dto;

import lombok.*;
import java.util.Map;
import java.util.List;

public class ApplicationDto {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ApplyRequest {
        private String jobId;
        private String coverLetter;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StageUpdateRequest {
        private String stage; // Applied, Screening, Interview, Offer, Hired, Rejected
        private String comment;
        private String interviewDate;
        private String interviewType;
        private String recruiterNotes;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SystemStatsDto {
        private long totalUsers;
        private long totalCandidates;
        private long totalRecruiters;
        private long totalCompanies;
        private long totalJobs;
        private long activeJobs;
        private long totalApplications;
        private long pendingReports;
        private Map<String, Long> stageCounts;
        private List<Map<String, Object>> topSkillsInDemand;
        private double timeToHireDaysAverage;
    }
}

