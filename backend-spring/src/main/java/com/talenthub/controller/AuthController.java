package com.talenthub.controller;

import com.talenthub.config.JwtTokenProvider;
import com.talenthub.dto.AuthDto;
import com.talenthub.model.User;
import com.talenthub.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    public AuthController(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtTokenProvider tokenProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthDto.LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail().toLowerCase().trim()).orElse(null);
        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            return ResponseEntity.status(401).body(Map.of("message", "Invalid email or password"));
        }

        if ("suspended".equalsIgnoreCase(user.getStatus())) {
            return ResponseEntity.status(403).body(Map.of("message", "Account suspended by administrator"));
        }

        String token = tokenProvider.generateToken(user.getId(), user.getEmail(), user.getRole());
        return ResponseEntity.ok(Map.of("token", token, "user", user, "message", "Login successful"));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody AuthDto.RegisterRequest request) {
        if (userRepository.findByEmail(request.getEmail().toLowerCase().trim()).isPresent()) {
            return ResponseEntity.status(409).body(Map.of("message", "An account with this email already exists"));
        }

        String role = "recruiter".equalsIgnoreCase(request.getRole()) ? "recruiter" : "candidate";

        User newUser = User.builder()
                .id("user-" + UUID.randomUUID().toString().substring(0, 8))
                .email(request.getEmail().toLowerCase().trim())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .name(request.getName().trim())
                .role(role)
                .status("active")
                .companyName("recruiter".equals(role) ? request.getCompanyName() : null)
                .title(request.getTitle() != null ? request.getTitle() : "Software Engineer")
                .location(request.getLocation() != null ? request.getLocation() : "Remote, US")
                .avatarUrl("https://api.dicebear.com/7.x/initials/svg?seed=" + request.getName())
                .skillsJson("[\"React\", \"TypeScript\", \"Java\", \"Spring Boot\", \"MySQL\"]")
                .build();

        userRepository.save(newUser);
        String token = tokenProvider.generateToken(newUser.getId(), newUser.getEmail(), newUser.getRole());
        return ResponseEntity.status(201).ok(Map.of("token", token, "user", newUser, "message", "Registered successfully"));
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMe(@AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
        return ResponseEntity.ok(Map.of("user", user));
    }
}

