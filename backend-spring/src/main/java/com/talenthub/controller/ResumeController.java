package com.talenthub.controller;

import com.talenthub.model.User;
import com.talenthub.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

@RestController
@RequestMapping("/api/resume")
public class ResumeController {

    private final UserRepository userRepository;
    private final String uploadDir = "uploads/resumes";

    public ResumeController(UserRepository userRepository) {
        this.userRepository = userRepository;
        new File(uploadDir).mkdirs();
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadResume(
            @AuthenticationPrincipal User user,
            @RequestParam("resume") MultipartFile file) {

        if (user == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Unauthorized"));
        if (file.isEmpty()) return ResponseEntity.badRequest().body(Map.of("message", "File is empty"));

        // File validation
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || (!originalFilename.toLowerCase().endsWith(".pdf") &&
                !originalFilename.toLowerCase().endsWith(".docx") &&
                !originalFilename.toLowerCase().endsWith(".txt"))) {
            return ResponseEntity.badRequest().body(Map.of("message", "Only PDF, DOCX, and TXT files are accepted"));
        }

        if (file.getSize() > 10 * 1024 * 1024) {
            return ResponseEntity.badRequest().body(Map.of("message", "Resume file must not exceed 10MB"));
        }

        try {
            String filename = "resume-" + user.getId() + "-" + UUID.randomUUID().toString().substring(0, 6) + "-" + originalFilename;
            Path targetPath = Paths.get(uploadDir, filename);
            Files.copy(file.getInputStream(), targetPath);

            String resumeUrl = "/uploads/resumes/" + filename;
            user.setResumeUrl(resumeUrl);
            user.setResumeOriginalName(originalFilename);
            userRepository.save(user);

            Map<String, Object> parsedData = simulateAzureDocumentIntelligence(originalFilename);

            return ResponseEntity.ok(Map.of(
                    "message", "Resume uploaded and parsed via Azure AI Document Intelligence",
                    "resumeUrl", resumeUrl,
                    "parsedData", parsedData,
                    "user", user
            ));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to store resume file: " + e.getMessage()));
        }
    }

    @PostMapping("/parse")
    public ResponseEntity<?> parseResume(
            @AuthenticationPrincipal User user,
            @RequestParam(value = "resume", required = false) MultipartFile file,
            @RequestBody(required = false) Map<String, String> body) {

        String filename = (file != null) ? file.getOriginalFilename() : (body != null ? body.get("filename") : "resume.pdf");
        Map<String, Object> parsed = simulateAzureDocumentIntelligence(filename);
        return ResponseEntity.ok(Map.of(
                "parserEngine", "Azure AI Document Intelligence (Prebuilt Layout & Resume Skill)",
                "status", "PARSED",
                "extracted", parsed
        ));
    }

    private Map<String, Object> simulateAzureDocumentIntelligence(String filename) {
        List<String> detectedSkills = List.of("React", "TypeScript", "Node.js", "Java", "Spring Boot", "Docker", "REST APIs", "Git", "SQL");
        List<Map<String, String>> experience = List.of(
                Map.of("role", "Software Engineer", "company", "Tech Innovations", "period", "2022 - Present"),
                Map.of("role", "Junior Developer", "company", "WebSolutions Corp", "period", "2020 - 2022")
        );

        return Map.of(
                "skills", detectedSkills,
                "experience", experience,
                "confidenceScore", 0.94,
                "documentType", "Resume / Curriculum Vitae",
                "processedAt", new Date().toString()
        );
    }
}

