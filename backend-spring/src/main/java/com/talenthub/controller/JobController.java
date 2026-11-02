package com.talenthub.controller;

import com.talenthub.model.Job;
import com.talenthub.model.User;
import com.talenthub.repository.JobRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/jobs")
public class JobController {

    private final JobRepository jobRepository;

    public JobController(JobRepository jobRepository) {
        this.jobRepository = jobRepository;
    }

    @GetMapping
    public ResponseEntity<?> getAllJobs(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String workplaceType,
            @RequestParam(required = false) String jobType,
            @RequestParam(required = false) String experienceLevel) {

        List<Job> jobs = jobRepository.searchJobs(search, category, workplaceType, jobType, experienceLevel);
        return ResponseEntity.ok(Map.of("total", jobs.size(), "jobs", jobs));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getJobById(@PathVariable String id) {
        Job job = jobRepository.findById(id).orElse(null);
        if (job == null) return ResponseEntity.status(404).body(Map.of("message", "Job not found"));

        job.setViewsCount(job.getViewsCount() + 1);
        jobRepository.save(job);
        return ResponseEntity.ok(Map.of("job", job));
    }

    @GetMapping("/recruiter/my-jobs")
    public ResponseEntity<?> getRecruiterJobs(@AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
        List<Job> jobs = "admin".equalsIgnoreCase(user.getRole())
                ? jobRepository.findAll()
                : jobRepository.findByRecruiterIdOrderByCreatedAtDesc(user.getId());
        return ResponseEntity.ok(Map.of("total", jobs.size(), "jobs", jobs));
    }

    @PostMapping
    public ResponseEntity<?> createJob(@AuthenticationPrincipal User user, @RequestBody Job jobPayload) {
        if (user == null) return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));

        jobPayload.setId("job-" + UUID.randomUUID().toString().substring(0, 8));
        jobPayload.setRecruiterId(user.getId());
        jobPayload.setRecruiterName(user.getName());
        if (jobPayload.getCompanyName() == null) jobPayload.setCompanyName(user.getCompanyName() != null ? user.getCompanyName() : "TechCorp");

        Job created = jobRepository.save(jobPayload);
        return ResponseEntity.status(201).body(Map.of("message", "Job created", "job", created));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteJob(@PathVariable String id) {
        jobRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Job deleted"));
    }
}

