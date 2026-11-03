package com.talenthub.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.talenthub.dto.ApplicationDto;
import com.talenthub.model.Application;
import com.talenthub.model.ApplicationStageHistory;
import com.talenthub.model.Job;
import com.talenthub.model.User;
import com.talenthub.repository.ApplicationRepository;
import com.talenthub.repository.ApplicationStageHistoryRepository;
import com.talenthub.repository.JobRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class ApplicationService {

    private final ApplicationRepository applicationRepository;
    private final ApplicationStageHistoryRepository stageHistoryRepository;
    private final JobRepository jobRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ApplicationService(
            ApplicationRepository applicationRepository,
            ApplicationStageHistoryRepository stageHistoryRepository,
            JobRepository jobRepository) {
        this.applicationRepository = applicationRepository;
        this.stageHistoryRepository = stageHistoryRepository;
        this.jobRepository = jobRepository;
    }

    @Transactional
    public Application apply(User candidate, ApplicationDto.ApplyRequest request, String resumeUrl) {
        Job job = jobRepository.findById(request.getJobId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job posting not found"));

        // Duplicate application check
        List<Application> existing = applicationRepository.findByCandidateIdOrderByCreatedAtDesc(candidate.getId());
        boolean alreadyApplied = existing.stream().anyMatch(a -> a.getJobId().equals(job.getId()));
        if (alreadyApplied) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You have already applied for this position");
        }

        // Match Score Calculation (simulating Azure AI Document Intelligence)
        int matchScore = computeMatchScore(candidate, job);
        String matchDetailsJson = buildMatchDetailsJson(candidate, job, matchScore);

        String appId = "app-" + UUID.randomUUID().toString().substring(0, 8);
        String timelineJson = String.format(
            "[{\"stage\":\"Applied\",\"changedByName\":\"%s\",\"changedAt\":\"%s\",\"comment\":\"Application submitted via TalentHub candidate portal.\"}]",
            candidate.getName(), LocalDateTime.now()
        );

        Application application = Application.builder()
                .id(appId)
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

        Application savedApp = applicationRepository.save(application);

        // Record stage audit entry
        ApplicationStageHistory initialAudit = ApplicationStageHistory.builder()
                .id("aud-" + UUID.randomUUID().toString().substring(0, 8))
                .applicationId(appId)
                .fromStage(null)
                .toStage("Applied")
                .changedByUserId(candidate.getId())
                .changedByName(candidate.getName())
                .comment("Application submitted via TalentHub candidate portal.")
                .build();
        stageHistoryRepository.save(initialAudit);

        return savedApp;
    }

    @Transactional
    public Application updateStage(String applicationId, User actor, ApplicationDto.StageUpdateRequest request) {
        Application application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found"));

        String oldStage = application.getStage();
        String newStage = request.getStage();

        application.setStage(newStage);
        if (request.getRecruiterNotes() != null) {
            application.setRecruiterNotes(request.getRecruiterNotes());
        }
        if (request.getInterviewType() != null) {
            application.setInterviewType(request.getInterviewType());
        }
        if (request.getInterviewDate() != null) {
            application.setInterviewDate(request.getInterviewDate());
        }

        // Persist Audit History Entity
        ApplicationStageHistory history = ApplicationStageHistory.builder()
                .id("aud-" + UUID.randomUUID().toString().substring(0, 8))
                .applicationId(applicationId)
                .fromStage(oldStage)
                .toStage(newStage)
                .changedByUserId(actor != null ? actor.getId() : "system")
                .changedByName(actor != null ? actor.getName() : "TalentHub ATS")
                .comment(request.getComment() != null ? request.getComment() : "Stage advanced to " + newStage)
                .interviewType(request.getInterviewType())
                .interviewDate(request.getInterviewDate())
                .build();
        stageHistoryRepository.save(history);

        return applicationRepository.save(application);
    }

    public List<ApplicationStageHistory> getAuditHistory(String applicationId) {
        return stageHistoryRepository.findByApplicationIdOrderByCreatedAtAsc(applicationId);
    }

    private int computeMatchScore(User candidate, Job job) {
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

        String notes = String.format("Calculated %d%% match rating. Matched %d of %d requested skills.",
                score, matched.size(), jobSkills.size());

        try {
            return objectMapper.writeValueAsString(Map.of(
                    "score", score,
                    "matchedSkills", matched,
                    "missingSkills", missing,
                    "analysisNotes", notes
            ));
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
