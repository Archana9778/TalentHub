package com.talenthub;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication
@EnableJpaAuditing
public class TalentHubApplication {

    public static void main(String[] args) {
        SpringApplication.run(TalentHubApplication.class, args);
        System.out.println("====================================================");
        System.out.println("🚀 TalentHub Spring Boot 3 API running on Port 5000");
        System.out.println("📡 Health probe available at /actuator/health");
        System.out.println("📚 Swagger API docs at /swagger-ui.html");
        System.out.println("====================================================");
    }
}

