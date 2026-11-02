package com.talenthub.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
public class HealthCheckController {

    @GetMapping({"/health", "/actuator/health"})
    public ResponseEntity<?> health() {
        return ResponseEntity.ok(Map.of(
            "status", "UP",
            "platform", "TalentHub Spring Boot 3 & Java 21 Tier",
            "timestamp", LocalDateTime.now().toString(),
            "details", Map.of(
                "database", Map.of("status", "UP"),
                "azureDocumentIntelligence", Map.of("status", "READY")
            )
        ));
    }
}

