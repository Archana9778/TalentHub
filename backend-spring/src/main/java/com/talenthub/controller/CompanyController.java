package com.talenthub.controller;

import com.talenthub.model.Company;
import com.talenthub.repository.CompanyRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/companies")
public class CompanyController {

    private final CompanyRepository companyRepository;

    public CompanyController(CompanyRepository companyRepository) {
        this.companyRepository = companyRepository;
    }

    @GetMapping
    public ResponseEntity<?> getAll() {
        List<Company> list = companyRepository.findAll();
        return ResponseEntity.ok(Map.of("total", list.size(), "companies", list));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable String id) {
        Company c = companyRepository.findById(id).orElse(null);
        if (c == null) return ResponseEntity.status(404).body(Map.of("message", "Not found"));
        return ResponseEntity.ok(Map.of("company", c));
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Company company) {
        company.setId("comp-" + UUID.randomUUID().toString().substring(0, 8));
        Company saved = companyRepository.save(company);
        return ResponseEntity.status(201).body(Map.of("message", "Created", "company", saved));
    }
}

