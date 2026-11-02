package com.talenthub.controller;

import com.talenthub.model.JobCategory;
import com.talenthub.repository.JobCategoryRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/categories")
public class JobCategoryController {

    private final JobCategoryRepository categoryRepository;

    public JobCategoryController(JobCategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    @GetMapping
    public ResponseEntity<?> getAll() {
        List<JobCategory> list = categoryRepository.findAll();
        return ResponseEntity.ok(Map.of("total", list.size(), "categories", list));
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody JobCategory category) {
        category.setId("cat-" + UUID.randomUUID().toString().substring(0, 8));
        JobCategory saved = categoryRepository.save(category);
        return ResponseEntity.status(201).body(Map.of("message", "Created", "category", saved));
    }
}

