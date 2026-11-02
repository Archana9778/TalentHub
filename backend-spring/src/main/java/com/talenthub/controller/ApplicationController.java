package com.talenthub.controller;

import com.talenthub.dto.ApplicationDto;
import com.talenthub.model.Application;
import com.talenthub.model.User;
import com.talenthub.repository.ApplicationRepository;
import com.talenthub.service.ApplicationService;
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

    @PostMapping("/apply")
    public ResponseEntity<?> apply(
            @AuthenticationPrincipal User user,
            @RequestBody ApplicationDto.ApplyRequest request) {

        if (user == null) return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
        Application application = applicationService.apply(user, request, null);
        return ResponseEntity.status(201).body(Map.of("message", "Application submitted", "application", application));
    }

    @GetMapping("/my-applications")
    public ResponseEntity<?> getMyApplications(@AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
        List<Application> apps = applicationRepository.findByCandidateIdOrderByCreatedAtDesc(user.getId());
        return ResponseEntity.ok(Map.of("total", apps.size(), "applications", apps));
    }

    @GetMapping("/applicants")
    public ResponseEntity<?> getApplicants(
            @RequestParam(required = false) String jobId,
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
        if (application == null) return ResponseEntity.status(404).body(Map.of("message", "Not found"));
        return ResponseEntity.ok(Map.of("application", application));
    }

    @PatchMapping("/{id}/stage")
    public ResponseEntity<?> updateStage(
            @PathVariable String id,
            @AuthenticationPrincipal User user,
            @RequestBody ApplicationDto.StageUpdateRequest request) {

        Application updated = applicationService.updateStage(id, user, request);
        return ResponseEntity.ok(Map.of("message", "Stage updated", "application", updated));
    }
}

