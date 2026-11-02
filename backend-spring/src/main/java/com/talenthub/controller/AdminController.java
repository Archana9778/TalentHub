package com.talenthub.controller;

import com.talenthub.dto.ApplicationDto;
import com.talenthub.model.User;
import com.talenthub.repository.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final UserRepository userRepository;
    private final JobRepository jobRepository;
    private final ApplicationRepository applicationRepository;
    private final CompanyRepository companyRepository;
    private final ReportedJobRepository reportedJobRepository;

    public AdminController(
            UserRepository userRepository,
            JobRepository jobRepository,
            ApplicationRepository applicationRepository,
            CompanyRepository companyRepository,
            ReportedJobRepository reportedJobRepository) {
        this.userRepository = userRepository;
        this.jobRepository = jobRepository;
        this.applicationRepository = applicationRepository;
        this.companyRepository = companyRepository;
        this.reportedJobRepository = reportedJobRepository;
    }

    @GetMapping("/statistics")
    public ResponseEntity<?> getStatistics() {
        Map<String, Long> stageCounts = new HashMap<>();
        for (String stg : List.of("Applied", "Screening", "Interview", "Offer", "Hired", "Rejected")) {
            stageCounts.put(stg, applicationRepository.countByStage(stg));
        }

        List<Map<String, Object>> topSkills = List.of(
            Map.of("skill", "React", "count", 14),
            Map.of("skill", "Spring Boot", "count", 12),
            Map.of("skill", "Azure", "count", 10),
            Map.of("skill", "MySQL", "count", 9),
            Map.of("skill", "Docker", "count", 8)
        );

        ApplicationDto.SystemStatsDto stats = ApplicationDto.SystemStatsDto.builder()
                .totalUsers(userRepository.count())
                .totalCandidates(userRepository.countByRole("candidate"))
                .totalRecruiters(userRepository.countByRole("recruiter"))
                .totalCompanies(companyRepository.count())
                .totalJobs(jobRepository.count())
                .activeJobs(jobRepository.countByStatus("active"))
                .totalApplications(applicationRepository.count())
                .pendingReports(reportedJobRepository.countByStatus("pending"))
                .stageCounts(stageCounts)
                .topSkillsInDemand(topSkills)
                .timeToHireDaysAverage(18.5)
                .build();

        return ResponseEntity.ok(Map.of("stats", stats));
    }

    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers() {
        List<User> users = userRepository.findAll();
        return ResponseEntity.ok(Map.of("total", users.size(), "users", users));
    }

    @PatchMapping("/users/{id}")
    public ResponseEntity<?> updateUserStatus(@PathVariable String id, @RequestBody Map<String, String> body) {
        User user = userRepository.findById(id).orElseThrow();
        if (body.containsKey("status")) user.setStatus(body.get("status"));
        if (body.containsKey("role")) user.setRole(body.get("role"));
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "User updated", "user", user));
    }

    @GetMapping("/reported-jobs")
    public ResponseEntity<?> getReportedJobs() {
        var reports = reportedJobRepository.findAll();
        return ResponseEntity.ok(Map.of("total", reports.size(), "reports", reports));
    }
}

