package com.talenthub.controller;

import com.talenthub.model.Application;
import com.talenthub.model.Job;
import com.talenthub.model.User;
import com.talenthub.repository.ApplicationRepository;
import com.talenthub.repository.CompanyRepository;
import com.talenthub.repository.JobRepository;
import com.talenthub.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final UserRepository userRepository;
    private final JobRepository jobRepository;
    private final ApplicationRepository applicationRepository;
    private final CompanyRepository companyRepository;

    public AnalyticsController(
            UserRepository userRepository,
            JobRepository jobRepository,
            ApplicationRepository applicationRepository,
            CompanyRepository companyRepository) {
        this.userRepository = userRepository;
        this.jobRepository = jobRepository;
        this.applicationRepository = applicationRepository;
        this.companyRepository = companyRepository;
    }

    @GetMapping("/dashboard")
    public ResponseEntity<?> getDashboardAnalytics(@AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Unauthorized"));

        Map<String, Object> data = new HashMap<>();

        if ("candidate".equalsIgnoreCase(user.getRole())) {
            List<Application> myApps = applicationRepository.findByCandidateIdOrderByCreatedAtDesc(user.getId());
            long total = myApps.size();
            long underReview = myApps.stream().filter(a -> "Applied".equalsIgnoreCase(a.getStage()) || "Screening".equalsIgnoreCase(a.getStage())).count();
            long interviews = myApps.stream().filter(a -> "Interview".equalsIgnoreCase(a.getStage())).count();
            long offers = myApps.stream().filter(a -> "Offer".equalsIgnoreCase(a.getStage()) || "Hired".equalsIgnoreCase(a.getStage())).count();
            long rejected = myApps.stream().filter(a -> "Rejected".equalsIgnoreCase(a.getStage())).count();

            data.put("role", "candidate");
            data.put("totalApplications", total);
            data.put("underReview", underReview);
            data.put("interviewsScheduled", interviews);
            data.put("offersReceived", offers);
            data.put("rejectedApplications", rejected);
            data.put("activeApplications", total - rejected);

        } else if ("recruiter".equalsIgnoreCase(user.getRole())) {
            List<Job> myJobs = jobRepository.findByRecruiterIdOrderByCreatedAtDesc(user.getId());
            List<String> myJobIds = myJobs.stream().map(Job::getId).toList();

            List<Application> allApplicants = applicationRepository.findAll().stream()
                    .filter(a -> myJobIds.contains(a.getJobId()))
                    .toList();

            Map<String, Long> funnel = new HashMap<>();
            for (String stg : List.of("Applied", "Screening", "Interview", "Offer", "Hired", "Rejected")) {
                funnel.put(stg, allApplicants.stream().filter(a -> stg.equalsIgnoreCase(a.getStage())).count());
            }

            double avgMatch = allApplicants.isEmpty() ? 0.0 :
                    allApplicants.stream().mapToInt(Application::getMatchScore).average().orElse(0.0);

            data.put("role", "recruiter");
            data.put("activeJobs", myJobs.stream().filter(j -> "active".equalsIgnoreCase(j.getStatus())).count());
            data.put("totalJobs", myJobs.size());
            data.put("totalApplicants", allApplicants.size());
            data.put("candidatesUnderScreening", funnel.getOrDefault("Screening", 0L));
            data.put("interviewsInProgress", funnel.getOrDefault("Interview", 0L));
            data.put("offersExtended", funnel.getOrDefault("Offer", 0L));
            data.put("hiresCompleted", funnel.getOrDefault("Hired", 0L));
            data.put("averageMatchScore", Math.round(avgMatch));
            data.put("pipelineFunnel", funnel);

        } else {
            // Admin role
            Map<String, Long> stages = new HashMap<>();
            for (String stg : List.of("Applied", "Screening", "Interview", "Offer", "Hired", "Rejected")) {
                stages.put(stg, applicationRepository.countByStage(stg));
            }

            data.put("role", "admin");
            data.put("totalUsers", userRepository.count());
            data.put("totalCandidates", userRepository.countByRole("candidate"));
            data.put("totalRecruiters", userRepository.countByRole("recruiter"));
            data.put("totalCompanies", companyRepository.count());
            data.put("totalJobs", jobRepository.count());
            data.put("activeJobs", jobRepository.countByStatus("active"));
            data.put("totalApplications", applicationRepository.count());
            data.put("pipelineFunnel", stages);
        }

        return ResponseEntity.ok(Map.of("analytics", data));
    }
}

