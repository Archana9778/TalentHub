package com.talenthub.controller;

import com.talenthub.model.Job;
import com.talenthub.model.User;
import com.talenthub.repository.JobRepository;
import org.springframework.http.HttpStatus;
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
        if (job == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Job not found"));

        job.setViewsCount(job.getViewsCount() + 1);
        jobRepository.save(job);
        return ResponseEntity.ok(Map.of("job", job));
    }

    @GetMapping("/recruiter/my-jobs")
    public ResponseEntity<?> getRecruiterJobs(@AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Unauthorized"));
        List<Job> jobs = "admin".equalsIgnoreCase(user.getRole())
                ? jobRepository.findAll()
                : jobRepository.findByRecruiterIdOrderByCreatedAtDesc(user.getId());
        return ResponseEntity.ok(Map.of("total", jobs.size(), "jobs", jobs));
    }

    @PostMapping
    public ResponseEntity<?> createJob(@AuthenticationPrincipal User user, @RequestBody Job jobPayload) {
        if (user == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Unauthorized"));

        jobPayload.setId("job-" + UUID.randomUUID().toString().substring(0, 8));
        jobPayload.setRecruiterId(user.getId());
        jobPayload.setRecruiterName(user.getName());
        if (jobPayload.getCompanyName() == null || jobPayload.getCompanyName().isBlank()) {
            jobPayload.setCompanyName(user.getCompanyName() != null ? user.getCompanyName() : "TechCorp");
        }

        Job created = jobRepository.save(jobPayload);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("message", "Job created successfully", "job", created));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateJob(
            @PathVariable String id,
            @AuthenticationPrincipal User user,
            @RequestBody Job updates) {

        if (user == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Unauthorized"));

        Job existing = jobRepository.findById(id).orElse(null);
        if (existing == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Job not found"));

        // Only owner recruiter or admin can update
        if (!"admin".equalsIgnoreCase(user.getRole()) && !existing.getRecruiterId().equals(user.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "You can only edit jobs you posted"));
        }

        if (updates.getTitle() != null) existing.setTitle(updates.getTitle());
        if (updates.getDescription() != null) existing.setDescription(updates.getDescription());
        if (updates.getLocation() != null) existing.setLocation(updates.getLocation());
        if (updates.getWorkplaceType() != null) existing.setWorkplaceType(updates.getWorkplaceType());
        if (updates.getJobType() != null) existing.setJobType(updates.getJobType());
        if (updates.getExperienceLevel() != null) existing.setExperienceLevel(updates.getExperienceLevel());
        if (updates.getSalaryMin() > 0) existing.setSalaryMin(updates.getSalaryMin());
        if (updates.getSalaryMax() > 0) existing.setSalaryMax(updates.getSalaryMax());
        if (updates.getSkillsJson() != null) existing.setSkillsJson(updates.getSkillsJson());
        if (updates.getStatus() != null) existing.setStatus(updates.getStatus());

        Job saved = jobRepository.save(existing);
        return ResponseEntity.ok(Map.of("message", "Job updated successfully", "job", saved));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteJob(@PathVariable String id, @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Unauthorized"));

        Job existing = jobRepository.findById(id).orElse(null);
        if (existing == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Job not found"));

        if (!"admin".equalsIgnoreCase(user.getRole()) && !existing.getRecruiterId().equals(user.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "You can only delete jobs you posted"));
        }

        jobRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Job deleted successfully"));
    }
}
