package com.talenthub.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.talenthub.dto.ApplicationDto;
import com.talenthub.model.Application;
import com.talenthub.model.Job;
import com.talenthub.model.User;
import com.talenthub.repository.ApplicationRepository;
import com.talenthub.repository.JobRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class ApplicationService {

    private final ApplicationRepository applicationRepository;
    private final JobRepository jobRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ApplicationService(ApplicationRepository applicationRepository, JobRepository jobRepository) {
        this.applicationRepository = applicationRepository;
        this.jobRepository = jobRepository;
    }

    @Transactional
    public Application apply(User candidate, ApplicationDto.ApplyRequest request, String resumeUrl) {
        Job job = jobRepository.findById(request.getJobId())
                .orElseThrow(() -> new RuntimeException("Job posting not found"));

        // Match Score Calculation (Azure AI Document Intelligence simulation)
        int matchScore = computeMatchScore(candidate, job);
        String matchDetailsJson = buildMatchDetailsJson(candidate, job, matchScore);

        String timelineJson = String.format(
            "[{\"stage\":\"Applied\",\"changedByName\":\"%s\",\"changedAt\":\"%s\",\"comment\":\"Application submitted via TalentHub candidate portal.\"}]",
            candidate.getName(), LocalDateTime.now()
        );

        Application application = Application.builder()
                .id("app-" + UUID.randomUUID().toString().substring(0, 8))
                .jobId(job.getId())
                .jobTitle(job.getTitle())
                .companyName(job.getCompanyName())
                .candidateId(candidate.getId())
                .candidateName(candidate.getName())
                .candidateEmail(candidate.getEmail())
                .candidatePhone(candidate.getPhone())
                .candidateAvatar(candidate.getAvatarUrl())
                .candidateTitle(candidate.getTitle())
                .resumeUrl(resumeUrl != null ? resumeUrl : candidate.getResumeUrl())
                .coverLetter(request.getCoverLetter())
                .stage("Applied")
                .matchScore(matchScore)
                .matchDetailsJson(matchDetailsJson)
                .recruiterNotes("Application processed by Azure AI Document Intelligence.")
                .timelineJson(timelineJson)
                .build();

        // Increment applicants count on job
        job.setApplicantsCount(job.getApplicantsCount() + 1);
        jobRepository.save(job);

        return applicationRepository.save(application);
    }

    @Transactional
    public Application updateStage(String applicationId, User actor, ApplicationDto.StageUpdateRequest request) {
        Application application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new RuntimeException("Application not found"));

        application.setStage(request.getStage());
        if (request.getRecruiterNotes() != null) {
            application.setRecruiterNotes(request.getRecruiterNotes());
        }
        if (request.getInterviewType() != null) {
            application.setInterviewType(request.getInterviewType());
        }

        return applicationRepository.save(application);
    }

    private int computeMatchScore(User candidate, Job job) {
        // High quality simulated scoring based on skill set overlap
        List<String> candidateSkills = parseJsonList(candidate.getSkillsJson());
        List<String> jobSkills = parseJsonList(job.getSkillsJson());

        if (jobSkills.isEmpty()) return 85;

        long matched = candidateSkills.stream()
                .filter(cs -> jobSkills.stream().anyMatch(js -> js.equalsIgnoreCase(cs.trim())))
                .count();

        double ratio = (double) matched / jobSkills.size();
        int score = (int) Math.round(ratio * 70.0 + 25.0);
        return Math.min(98, Math.max(45, score));
    }

    private String buildMatchDetailsJson(User candidate, Job job, int score) {
        List<String> candidateSkills = parseJsonList(candidate.getSkillsJson());
        List<String> jobSkills = parseJsonList(job.getSkillsJson());

        List<String> matched = new ArrayList<>();
        List<String> missing = new ArrayList<>();

        for (String js : jobSkills) {
            boolean found = candidateSkills.stream().anyMatch(cs -> cs.equalsIgnoreCase(js.trim()));
            if (found) matched.add(js);
            else missing.add(js);
        }

        try {
            Map<String, Object> map = new HashMap<>();
            map.put("score", score);
            map.put("matchedSkills", matched);
            map.put("missingSkills", missing);
            map.put("analysisNotes", score >= 80 ? "Top match. High technical skill alignment." : "Good potential candidate; review for transferable experience.");
            return objectMapper.writeValueAsString(map);
        } catch (Exception e) {
            return "{}";
        }
    }

    private List<String> parseJsonList(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }
}

