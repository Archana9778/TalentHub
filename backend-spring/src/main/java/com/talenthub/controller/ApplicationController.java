package com.talenthub.controller;

import com.talenthub.dto.ApplicationDto;
import com.talenthub.model.Application;
import com.talenthub.model.ApplicationStageHistory;
import com.talenthub.model.User;
import com.talenthub.repository.ApplicationRepository;
import com.talenthub.service.ApplicationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/applications")
public class ApplicationController {

    private final ApplicationService applicationService;
    private final ApplicationRepository applicationRepository;

    public ApplicationController(ApplicationService applicationService, ApplicationRepository applicationRepository) {
        this.applicationService = applicationService;
        this.applicationRepository = applicationRepository;
    }

    @PostMapping({"", "/apply"})
    public ResponseEntity<?> apply(
            @AuthenticationPrincipal User user,
            @RequestBody ApplicationDto.ApplyRequest request) {

        if (user == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Unauthorized"));
        Application application = applicationService.apply(user, request, null);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("message", "Application submitted successfully", "application", application));
    }

    @GetMapping({"/my-applications", "/candidate/{candidateId}"})
    public ResponseEntity<?> getCandidateApplications(
            @AuthenticationPrincipal User user,
            @PathVariable(required = false) String candidateId) {

        if (user == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Unauthorized"));
        String targetCandidateId = (candidateId != null && !candidateId.isBlank()) ? candidateId : user.getId();
        
        // Ensure candidates can only view their own
        if (!"admin".equalsIgnoreCase(user.getRole()) && !user.getId().equals(targetCandidateId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Access denied"));
        }

        List<Application> apps = applicationRepository.findByCandidateIdOrderByCreatedAtDesc(targetCandidateId);
        return ResponseEntity.ok(Map.of("total", apps.size(), "applications", apps));
    }

    @GetMapping({"/applicants", "/job/{jobId}"})
    public ResponseEntity<?> getApplicants(
            @PathVariable(required = false) String jobId,
            @RequestParam(required = false) String stage) {

        List<Application> apps = (jobId != null && !jobId.isBlank() && !"all".equalsIgnoreCase(jobId))
                ? applicationRepository.findByJobIdOrderByMatchScoreDesc(jobId)
                : applicationRepository.findAll();

        if (stage != null && !stage.isBlank() && !"all".equalsIgnoreCase(stage)) {
            apps = apps.stream().filter(a -> a.getStage().equalsIgnoreCase(stage)).toList();
        }

        return ResponseEntity.ok(Map.of("total", apps.size(), "applications", apps));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable String id) {
        Application application = applicationRepository.findById(id).orElse(null);
        if (application == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Application not found"));
        return ResponseEntity.ok(Map.of("application", application));
    }

    @RequestMapping(value = "/{id}/stage", method = {RequestMethod.PUT, RequestMethod.PATCH})
    public ResponseEntity<?> updateStage(
            @PathVariable String id,
            @AuthenticationPrincipal User user,
            @RequestBody ApplicationDto.StageUpdateRequest request) {

        Application updated = applicationService.updateStage(id, user, request);
        return ResponseEntity.ok(Map.of("message", "Stage updated successfully", "application", updated));
    }

    @GetMapping("/{id}/audit")
    public ResponseEntity<?> getAuditTimeline(@PathVariable String id) {
        List<ApplicationStageHistory> history = applicationService.getAuditHistory(id);
        return ResponseEntity.ok(Map.of("total", history.size(), "timeline", history));
    }
}
