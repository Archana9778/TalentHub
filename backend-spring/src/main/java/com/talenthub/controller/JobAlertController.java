package com.talenthub.controller;

import com.talenthub.model.JobAlert;
import com.talenthub.model.User;
import com.talenthub.repository.JobAlertRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/job-alerts")
public class JobAlertController {

    private final JobAlertRepository alertRepository;

    public JobAlertController(JobAlertRepository alertRepository) {
        this.alertRepository = alertRepository;
    }

    @GetMapping
    public ResponseEntity<?> getMyAlerts(@AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
        List<JobAlert> list = alertRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        return ResponseEntity.ok(Map.of("total", list.size(), "alerts", list));
    }

    @PostMapping
    public ResponseEntity<?> createAlert(@AuthenticationPrincipal User user, @RequestBody JobAlert alert) {
        if (user == null) return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
        alert.setId("alert-" + UUID.randomUUID().toString().substring(0, 8));
        alert.setUserId(user.getId());
        JobAlert saved = alertRepository.save(alert);
        return ResponseEntity.status(201).body(Map.of("message", "Alert created", "alert", saved));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteAlert(@PathVariable String id) {
        alertRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Alert deleted"));
    }
}

