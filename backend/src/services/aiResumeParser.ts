import { Job, MatchDetails, ParsedResumeData, ExperienceLevel } from '../types';

export class AzureDocumentIntelligenceService {
  /**
   * Simulates Azure AI Document Intelligence prebuilt resume / layout extraction
   */
  static parseResumeFile(
    filename: string,
    providedSkills?: string[],
    providedExperienceYears?: number
  ): ParsedResumeData {
    const commonTechSkills = [
      'React',
      'TypeScript',
      'JavaScript',
      'Java',
      'Spring Boot',
      'Node.js',
      'Python',
      'Azure',
      'Docker',
      'Kubernetes',
      'MySQL',
      'PostgreSQL',
      'Terraform',
      'Ansible',
      'Packer',
      'CI/CD',
      'Tailwind CSS',
      'REST API',
      'Git',
      'Linux',
      'Microservices',
      'Cloud Architecture',
      'GraphQL',
      'Next.js',
    ];

    // Select a realistic skill bundle based on filename or provided skills
    let extractedSkills: string[] = providedSkills && providedSkills.length > 0 ? [...providedSkills] : [];

    if (extractedSkills.length === 0) {
      const lower = filename.toLowerCase();
      if (lower.includes('devops') || lower.includes('chen')) {
        extractedSkills = ['Terraform', 'Azure', 'Packer', 'Ansible', 'Kubernetes', 'CI/CD', 'Linux', 'Docker', 'Python'];
      } else if (lower.includes('frontend') || lower.includes('patel')) {
        extractedSkills = ['React', 'TypeScript', 'Tailwind CSS', 'REST API', 'JavaScript', 'HTML5', 'CSS3', 'Next.js'];
      } else {
        extractedSkills = ['React', 'TypeScript', 'Node.js', 'Java', 'Spring Boot', 'MySQL', 'Azure', 'Docker'];
      }
    }

    return {
      fullName: filename.replace(/[-_]/g, ' ').replace(/\.[^/.]+$/, ''),
      email: 'candidate.parsed@talenthub.com',
      phone: '+1 (555) 012-3456',
      summary: 'Experienced engineering professional with proven track record in architecting cloud-native applications and scalable backend systems.',
      extractedSkills,
      experienceYears: providedExperienceYears || 5,
      educationLevel: 'Bachelor of Science in Computer Science',
      extractedAt: new Date().toISOString(),
    };
  }

  /**
   * Computes Match Score (0 - 100%) between candidate skills/experience and target Job
   */
  static computeMatchScore(candidateSkills: string[], candidateYears: number, job: Job): MatchDetails {
    if (!job.skills || job.skills.length === 0) {
      return {
        score: 85,
        matchedSkills: candidateSkills,
        missingSkills: [],
        skillScore: 85,
        experienceScore: 85,
        analysisNotes: 'Job does not specify explicit required skills; scored on overall candidate qualifications.',
      };
    }

    const norm = (s: string) => s.trim().toLowerCase();
    const candidateSkillsNorm = new Set(candidateSkills.map(norm));

    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];

    job.skills.forEach((skill) => {
      if (candidateSkillsNorm.has(norm(skill))) {
        matchedSkills.push(skill);
      } else {
        missingSkills.push(skill);
      }
    });

    // Skill match percentage (70% weight)
    const skillRatio = matchedSkills.length / job.skills.length;
    const skillScore = Math.round(skillRatio * 100);

    // Experience match (30% weight)
    const requiredYearsMap: Record<ExperienceLevel, number> = {
      'Entry-level': 1,
      'Mid-level': 3,
      'Senior': 5,
      'Lead / Principal': 8,
    };
    const targetYears = requiredYearsMap[job.experienceLevel] || 3;
    let expRatio = candidateYears / targetYears;
    if (expRatio > 1.2) expRatio = 1.0;
    if (expRatio < 0.4) expRatio = 0.4;
    const experienceScore = Math.round(expRatio * 100);

    const overallScore = Math.min(100, Math.max(30, Math.round(skillScore * 0.7 + experienceScore * 0.3)));

    let analysisNotes = '';
    if (overallScore >= 85) {
      analysisNotes = `Top candidate match (${overallScore}%). Strong alignment with required core stack (${matchedSkills.join(', ')}).`;
    } else if (overallScore >= 65) {
      analysisNotes = `Good candidate match (${overallScore}%). Missing key requirements: ${missingSkills.join(', ')}. Worth screening for transferable skills.`;
    } else {
      analysisNotes = `Lower match score (${overallScore}%). Lacks essential proficiencies: ${missingSkills.join(', ')}.`;
    }

    return {
      score: overallScore,
      matchedSkills,
      missingSkills,
      skillScore,
      experienceScore,
      analysisNotes,
    };
  }
}

