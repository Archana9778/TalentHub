import {
  User,
  Job,
  MatchDetails,
  MatchCategory,
  CandidateJobMatch,
  ExperienceLevel,
  ApplicationStage,
} from '../types';
import { db } from '../database/db';

export class MatchingService {
  /**
   * Determine matching category from overall score (0-100)
   * 80–100%: Excellent Match
   * 60–79%: Good Match
   * 40–59%: Moderate Match
   * 0–39%: Low Match
   */
  static getMatchCategory(score: number): MatchCategory {
    const s = Math.round(score);
    if (s >= 80) return 'Excellent Match';
    if (s >= 60) return 'Good Match';
    if (s >= 40) return 'Moderate Match';
    return 'Low Match';
  }

  /**
   * Calculate detailed 5-criteria matching score between a candidate and a job.
   * Criteria weights:
   *  - Skills match: 40%
   *  - Experience match: 25%
   *  - Education match: 15%
   *  - Certifications match: 10%
   *  - Additional qualifications: 10%
   * Total: 100%
   * 
   * Strictly adheres to non-discriminatory evaluation (no age, gender, religion, etc.).
   * Handles missing/partial fields safely without throwing runtime errors.
   */
  static computeCandidateJobMatch(
    candidate: Partial<User> | null | undefined,
    job: Partial<Job> | null | undefined
  ): MatchDetails {
    if (!job) {
      return {
        score: 0,
        category: 'Low Match',
        matchedSkills: [],
        missingSkills: [],
        skillScore: 0,
        experienceScore: 0,
        educationScore: 0,
        certificationsScore: 0,
        additionalScore: 0,
        relevantExperience: [],
        matchingCertifications: [],
        missingQualifications: ['Target job posting is unavailable.'],
        analysisNotes: 'Cannot calculate match score because job details are missing.',
      };
    }

    const safeCandidate: Partial<User> = candidate || {};

    // ─────────────────────────────────────────────────────────────
    // 1. SKILLS MATCH (40% Weight)
    // ─────────────────────────────────────────────────────────────
    const normalizeSkill = (s: string) => s.trim().toLowerCase();

    // Deduplicate job required skills
    const rawJobSkills = Array.isArray(job.skills) ? job.skills : [];
    const jobSkillsMap = new Map<string, string>(); // norm -> original
    for (const s of rawJobSkills) {
      if (typeof s === 'string' && s.trim()) {
        const norm = normalizeSkill(s);
        if (!jobSkillsMap.has(norm)) {
          jobSkillsMap.set(norm, s.trim());
        }
      }
    }

    // Deduplicate candidate skills from both skills[] and parsedResumeData.extractedSkills
    const candidateSkillStrings: string[] = [];
    if (Array.isArray(safeCandidate.skills)) {
      for (const s of safeCandidate.skills) {
        if (typeof s === 'string' && s.trim()) candidateSkillStrings.push(s.trim());
      }
    }
    if (Array.isArray(safeCandidate.parsedResumeData?.extractedSkills)) {
      for (const s of safeCandidate.parsedResumeData.extractedSkills) {
        if (typeof s === 'string' && s.trim()) candidateSkillStrings.push(s.trim());
      }
    }

    const candidateSkillMap = new Map<string, string>(); // norm -> original
    for (const s of candidateSkillStrings) {
      const norm = normalizeSkill(s);
      if (!candidateSkillMap.has(norm)) {
        candidateSkillMap.set(norm, s);
      }
    }

    const candidateNormSet = new Set(candidateSkillMap.keys());

    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];

    // Helper to check if candidate has skill (supports partial / synonym containment)
    const hasSkill = (jobNorm: string) => {
      if (candidateNormSet.has(jobNorm)) return true;
      for (const candNorm of candidateNormSet) {
        if (candNorm === jobNorm) return true;
        if (candNorm.includes(jobNorm) || jobNorm.includes(candNorm)) return true;
      }
      return false;
    };

    jobSkillsMap.forEach((original, norm) => {
      if (hasSkill(norm)) {
        matchedSkills.push(original);
      } else {
        missingSkills.push(original);
      }
    });

    let skillScore = 0;
    if (jobSkillsMap.size === 0) {
      // If job listed no required skills, score based on general skills availability
      skillScore = candidateSkillMap.size > 0 ? 85 : 50;
    } else {
      const ratio = matchedSkills.length / jobSkillsMap.size;
      skillScore = Math.round(ratio * 100);
      // Small bonus (+5% up to 100) if candidate has extra related technical skills
      if (candidateSkillMap.size > jobSkillsMap.size && skillScore < 100 && skillScore > 0) {
        skillScore = Math.min(100, skillScore + 5);
      }
    }
    skillScore = Math.min(100, Math.max(0, skillScore));

    // ─────────────────────────────────────────────────────────────
    // 2. EXPERIENCE MATCH (25% Weight)
    // ─────────────────────────────────────────────────────────────
    const requiredYearsMap: Record<ExperienceLevel, number> = {
      'Entry-level': 1,
      'Mid-level': 3,
      'Senior': 5,
      'Lead / Principal': 8,
    };
    let requiredYears = requiredYearsMap[job.experienceLevel as ExperienceLevel] || 3;

    // Check if job requirements mention explicit years, e.g. "5+ years"
    if (Array.isArray(job.requirements)) {
      for (const req of job.requirements) {
        if (typeof req === 'string') {
          const match = req.match(/(\d+)\+?\s*years?/i);
          if (match && match[1]) {
            const parsedY = parseInt(match[1], 10);
            if (!isNaN(parsedY) && parsedY > 0 && parsedY <= 15) {
              requiredYears = parsedY;
              break;
            }
          }
        }
      }
    }

    // Determine candidate experience years
    let candidateYears = 0;
    if (
      typeof safeCandidate.parsedResumeData?.experienceYears === 'number' &&
      safeCandidate.parsedResumeData.experienceYears > 0
    ) {
      candidateYears = safeCandidate.parsedResumeData.experienceYears;
    } else if (Array.isArray(safeCandidate.experience) && safeCandidate.experience.length > 0) {
      let estimatedYears = 0;
      for (const exp of safeCandidate.experience) {
        if (exp && typeof exp.period === 'string') {
          const yearsMatch = exp.period.match(/(\d{4})\s*[-–—to]+\s*(\d{4}|present)/i);
          if (yearsMatch) {
            const start = parseInt(yearsMatch[1], 10);
            const end = yearsMatch[2].toLowerCase().includes('present')
              ? new Date().getFullYear()
              : parseInt(yearsMatch[2], 10);
            if (!isNaN(start) && !isNaN(end) && end >= start) {
              estimatedYears += Math.max(1, end - start);
              continue;
            }
          }
        }
        estimatedYears += 2; // fallback per position
      }
      candidateYears = Math.max(1, estimatedYears);
    } else if (safeCandidate.title) {
      const lowerTitle = safeCandidate.title.toLowerCase();
      if (lowerTitle.includes('lead') || lowerTitle.includes('principal') || lowerTitle.includes('director')) {
        candidateYears = 8;
      } else if (lowerTitle.includes('senior')) {
        candidateYears = 5;
      } else if (lowerTitle.includes('mid') || lowerTitle.includes('engineer') || lowerTitle.includes('developer')) {
        candidateYears = 3;
      } else {
        candidateYears = 1;
      }
    }

    const yearsRatio = Math.min(1.0, candidateYears / Math.max(1, requiredYears));
    let yearsScore = Math.round(yearsRatio * 100);
    if (candidateYears >= requiredYears) {
      yearsScore = 100;
    }

    // Role / Title Relevance
    const relevantExperience: string[] = [];
    let titleRelevanceScore = 70; // baseline for relevant software engineer
    const jobTitleTokens = (job.title || '')
      .toLowerCase()
      .split(/[\s,+/()-]+/)
      .filter((t) => t.length > 2);

    if (Array.isArray(safeCandidate.experience)) {
      for (const exp of safeCandidate.experience) {
        if (!exp) continue;
        const expTitle = (exp.title || '').toLowerCase();
        const expDesc = (exp.description || '').toLowerCase();
        const isRelevant = jobTitleTokens.some((tok) => expTitle.includes(tok) || expDesc.includes(tok));
        if (isRelevant) {
          relevantExperience.push(
            `${exp.title || 'Role'} at ${exp.company || 'Company'} (${exp.period || 'Recent'})`
          );
          titleRelevanceScore = Math.min(100, titleRelevanceScore + 15);
        }
      }
    }
    if (relevantExperience.length === 0 && safeCandidate.title) {
      relevantExperience.push(`Current Title: ${safeCandidate.title}`);
    }

    const experienceScore = Math.min(
      100,
      Math.max(0, Math.round(yearsScore * 0.75 + titleRelevanceScore * 0.25))
    );

    // ─────────────────────────────────────────────────────────────
    // 3. EDUCATION MATCH (15% Weight)
    // ─────────────────────────────────────────────────────────────
    let educationScore = 75; // Standard baseline for tech professional
    let candidateDegree = '';

    if (Array.isArray(safeCandidate.education) && safeCandidate.education.length > 0) {
      const degrees = safeCandidate.education.map((e) => (e?.degree || '').toLowerCase()).join(' ');
      candidateDegree = safeCandidate.education[0]?.degree || '';
      if (degrees.includes('phd') || degrees.includes('doctorate')) {
        educationScore = 100;
      } else if (
        degrees.includes('master') ||
        degrees.includes('m.s.') ||
        degrees.includes('m.tech') ||
        degrees.includes('msc')
      ) {
        educationScore = 95;
      } else if (
        degrees.includes('bachelor') ||
        degrees.includes('b.s.') ||
        degrees.includes('b.tech') ||
        degrees.includes('b.e.') ||
        degrees.includes('bsc')
      ) {
        educationScore = 90;
      } else if (degrees.includes('associate') || degrees.includes('diploma') || degrees.includes('bootcamp')) {
        educationScore = 75;
      }
    } else if (safeCandidate.parsedResumeData?.educationLevel) {
      const edLevel = safeCandidate.parsedResumeData.educationLevel.toLowerCase();
      candidateDegree = safeCandidate.parsedResumeData.educationLevel;
      if (edLevel.includes('master') || edLevel.includes('phd')) {
        educationScore = 95;
      } else if (edLevel.includes('bachelor')) {
        educationScore = 90;
      }
    } else if (candidateYears >= 5) {
      educationScore = 70; // Practical industry experience compensates
    } else {
      educationScore = 50;
    }
    educationScore = Math.min(100, Math.max(0, educationScore));

    // ─────────────────────────────────────────────────────────────
    // 4. CERTIFICATIONS MATCH (10% Weight)
    // ─────────────────────────────────────────────────────────────
    const candidateCertifications: string[] = [];
    if (Array.isArray(safeCandidate.certifications)) {
      for (const c of safeCandidate.certifications) {
        if (typeof c === 'string' && c.trim()) candidateCertifications.push(c.trim());
      }
    }

    // Detect certifications mentioned in candidate bio, skills, or experience
    const candidateCorpus = [
      safeCandidate.bio || '',
      safeCandidate.title || '',
      ...(safeCandidate.skills || []),
      safeCandidate.parsedResumeData?.summary || '',
      ...(Array.isArray(safeCandidate.experience)
        ? safeCandidate.experience.map((e) => e?.description || '')
        : []),
    ]
      .join(' ')
      .toLowerCase();

    const certPatterns = [
      { name: 'AWS Certified', regex: /\b(aws certified|aws solutions architect|aws developer|aws sysops)\b/i },
      { name: 'Azure Certified', regex: /\b(azure certified|az-900|az-104|az-204|az-305|az-400|azure solutions architect)\b/i },
      { name: 'Kubernetes (CKA/CKAD)', regex: /\b(cka|ckad|certified kubernetes)\b/i },
      { name: 'HashiCorp Terraform', regex: /\b(terraform associate|hashicorp certified)\b/i },
      { name: 'Scrum / Agile Master', regex: /\b(csm|psm|scrum master|pmp)\b/i },
      { name: 'Google Cloud Certified', regex: /\b(gcp certified|google cloud certified)\b/i },
      { name: 'Security Certification', regex: /\b(cissp|security\+|ceh)\b/i },
    ];

    for (const pat of certPatterns) {
      if (pat.regex.test(candidateCorpus)) {
        if (!candidateCertifications.includes(pat.name)) {
          candidateCertifications.push(pat.name);
        }
      }
    }

    // Check if target job mentions certifications
    const jobCorpus = [
      job.title || '',
      job.description || '',
      ...(Array.isArray(job.requirements) ? job.requirements : []),
      ...(Array.isArray(job.benefits) ? job.benefits : []),
    ]
      .join(' ')
      .toLowerCase();

    const jobRequiresCert = certPatterns.filter((pat) => pat.regex.test(jobCorpus));

    let certificationsScore = 65; // Baseline when certifications are optional
    if (jobRequiresCert.length > 0) {
      const matchedCertPatterns = jobRequiresCert.filter((reqCert) =>
        candidateCertifications.some(
          (c) => c.toLowerCase().includes(reqCert.name.toLowerCase()) || reqCert.regex.test(c)
        )
      );
      if (matchedCertPatterns.length > 0) {
        certificationsScore = 100;
      } else {
        certificationsScore = candidateSkillMap.size > 0 ? 55 : 35;
      }
    } else {
      // Certifications optional - reward candidate for industry credentials
      if (candidateCertifications.length >= 2) {
        certificationsScore = 100;
      } else if (candidateCertifications.length === 1) {
        certificationsScore = 90;
      } else if (
        candidateNormSet.has('aws') ||
        candidateNormSet.has('azure') ||
        candidateNormSet.has('kubernetes') ||
        candidateNormSet.has('docker')
      ) {
        certificationsScore = 80;
      } else {
        certificationsScore = 70;
      }
    }
    certificationsScore = Math.min(100, Math.max(0, certificationsScore));

    // ─────────────────────────────────────────────────────────────
    // 5. ADDITIONAL QUALIFICATIONS (10% Weight)
    // ─────────────────────────────────────────────────────────────
    let additionalScore = 70; // baseline
    const missingQualifications: string[] = [];

    // Location / Workplace match
    const jobWorkplace = (job.workplaceType || '').toLowerCase();
    const jobLocation = (job.location || '').toLowerCase();
    const candidateLocation = (safeCandidate.location || '').toLowerCase();

    if (jobWorkplace === 'remote') {
      additionalScore += 15;
    } else if (candidateLocation && jobLocation) {
      const candidateLocTokens = candidateLocation.split(/[\s,]+/);
      const isLocMatch = candidateLocTokens.some((tok) => tok.length > 2 && jobLocation.includes(tok));
      if (isLocMatch) {
        additionalScore += 15;
      } else {
        missingQualifications.push(
          `Location mismatch: Job is ${job.location || 'on-site'} (${job.workplaceType || 'On-site'}), candidate is in ${safeCandidate.location || 'different location'}`
        );
        additionalScore -= 10;
      }
    }

    // Profile completeness factors
    if (safeCandidate.bio && safeCandidate.bio.length > 20) additionalScore += 5;
    if (safeCandidate.resumeUrl) additionalScore += 5;
    if (safeCandidate.phone) additionalScore += 5;

    // Check missing requirements
    if (missingSkills.length > 0) {
      missingQualifications.push(`Missing key required skills: ${missingSkills.slice(0, 3).join(', ')}`);
    }
    if (candidateYears < requiredYears) {
      missingQualifications.push(
        `Experience gap: Has ~${candidateYears} years vs ${requiredYears} years expected for ${job.experienceLevel || 'this role'}`
      );
    }

    additionalScore = Math.min(100, Math.max(0, additionalScore));

    // ─────────────────────────────────────────────────────────────
    // WEIGHTED TOTAL
    // Skills (40%) + Experience (25%) + Education (15%) + Certifications (10%) + Additional (10%)
    // ─────────────────────────────────────────────────────────────
    const weightedTotal =
      skillScore * 0.40 +
      experienceScore * 0.25 +
      educationScore * 0.15 +
      certificationsScore * 0.10 +
      additionalScore * 0.10;

    const finalScore = Math.min(100, Math.max(0, Math.round(weightedTotal)));
    const category = MatchingService.getMatchCategory(finalScore);

    // Natural Language Explanation
    const explanation = MatchingService.generateExplanation({
      finalScore,
      category,
      skillScore,
      matchedSkillsCount: matchedSkills.length,
      totalSkillsCount: jobSkillsMap.size,
      candidateYears,
      requiredYears,
      experienceScore,
      candidateDegree,
      educationScore,
      certificationsScore,
      candidateCertifications,
      additionalScore,
      jobTitle: job.title || 'the role',
    });

    return {
      score: finalScore,
      category,
      matchedSkills,
      missingSkills,
      skillScore,
      experienceScore,
      educationScore,
      certificationsScore,
      additionalScore,
      relevantExperience,
      matchingCertifications: candidateCertifications,
      missingQualifications,
      analysisNotes: explanation,
    };
  }

  /**
   * Generates a clear, informative natural language explanation for recruiters.
   */
  private static generateExplanation(data: {
    finalScore: number;
    category: MatchCategory;
    skillScore: number;
    matchedSkillsCount: number;
    totalSkillsCount: number;
    candidateYears: number;
    requiredYears: number;
    experienceScore: number;
    candidateDegree: string;
    educationScore: number;
    certificationsScore: number;
    candidateCertifications: string[];
    additionalScore: number;
    jobTitle: string;
  }): string {
    const parts: string[] = [];

    parts.push(`Overall matching score of ${data.finalScore}% (${data.category}) for ${data.jobTitle}.`);

    if (data.totalSkillsCount > 0) {
      parts.push(
        `Skills (${data.skillScore}% score, 40% weight): Candidate matches ${data.matchedSkillsCount} of ${data.totalSkillsCount} required skills.`
      );
    } else {
      parts.push(`Skills (${data.skillScore}% score, 40% weight): Evaluated based on candidate's technical skill portfolio.`);
    }

    parts.push(
      `Experience (${data.experienceScore}% score, 25% weight): Has approximately ${data.candidateYears} years of background (${data.candidateYears >= data.requiredYears ? 'satisfies' : 'approaching'} the ${data.requiredYears}-year requirement).`
    );

    parts.push(
      `Education (${data.educationScore}% score, 15% weight): ${data.candidateDegree ? `Holds ${data.candidateDegree}` : 'Recognized practical industry background'}.`
    );

    if (data.candidateCertifications.length > 0) {
      parts.push(
        `Certifications (${data.certificationsScore}% score, 10% weight): Relevant credentials include ${data.candidateCertifications.slice(0, 2).join(', ')}.`
      );
    } else {
      parts.push(`Certifications (${data.certificationsScore}% score, 10% weight): Standard professional competency assessed.`);
    }

    parts.push(
      `Additional Qualifications (${data.additionalScore}% score, 10% weight): Location, profile completeness, and role alignment verified.`
    );

    return parts.join(' ');
  }

  /**
   * Retrieves and ranks all candidate applicants for a specific job requisition.
   * Ranks are strictly independent for each job.
   */
  static async getJobMatches(
    jobId: string,
    sort: 'highest' | 'lowest' | 'recent' = 'highest',
    stage: string = 'all'
  ): Promise<CandidateJobMatch[]> {
    const job = await db.getJobById(jobId);
    if (!job) {
      throw new Error(`Job posting with ID ${jobId} not found.`);
    }

    // Fetch applications for this job
    let applications = await db.getApplicationsByJobId(jobId);

    if (stage && stage !== 'all') {
      applications = applications.filter((a) => a.stage === stage);
    }

    const matches: CandidateJobMatch[] = [];

    for (const app of applications) {
      const candidateUser: Partial<User> = (await db.getUserById(app.candidateId)) || {
        id: app.candidateId,
        name: app.candidateName,
        email: app.candidateEmail,
        phone: app.candidatePhone,
        avatarUrl: app.candidateAvatar,
        title: app.candidateTitle,
        location: undefined,
        skills: app.matchDetails?.matchedSkills || [],
      };

      // Compute fresh matching score dynamically
      const matchDetails = this.computeCandidateJobMatch(candidateUser, job);

      // Keep application record up to date in memory/persistence
      app.matchScore = matchDetails.score;
      app.matchDetails = matchDetails;

      matches.push({
        rank: 1, // temporary, assigned after sorting
        candidateId: app.candidateId,
        candidateName: app.candidateName,
        candidateEmail: app.candidateEmail,
        candidateTitle: app.candidateTitle || candidateUser.title,
        candidateAvatar: app.candidateAvatar || candidateUser.avatarUrl,
        candidateLocation: candidateUser.location,
        candidatePhone: app.candidatePhone || candidateUser.phone,
        jobId: job.id,
        jobTitle: job.title,
        companyName: job.companyName,
        applicationId: app.id,
        applicationStage: app.stage,
        appliedDate: app.createdAt,
        matchScore: matchDetails.score,
        matchCategory: matchDetails.category || this.getMatchCategory(matchDetails.score),
        matchDetails,
      });
    }

    // Apply sorting
    if (sort === 'lowest') {
      matches.sort((a, b) => a.matchScore - b.matchScore);
    } else if (sort === 'recent') {
      matches.sort((a, b) => {
        const tA = a.appliedDate ? new Date(a.appliedDate).getTime() : 0;
        const tB = b.appliedDate ? new Date(b.appliedDate).getTime() : 0;
        return tB - tA;
      });
    } else {
      // Default: highest match first
      matches.sort((a, b) => b.matchScore - a.matchScore);
    }

    // Assign rank positions (1, 2, 3...)
    matches.forEach((m, idx) => {
      m.rank = idx + 1;
    });

    return matches;
  }

  /**
   * Computes single candidate match breakdown for a specific job.
   */
  static async getCandidateMatchForJob(
    jobId: string,
    candidateId: string
  ): Promise<{ job: Job; candidate: User; matchDetails: MatchDetails; rank?: number }> {
    const job = await db.getJobById(jobId);
    if (!job) {
      throw new Error(`Job posting with ID ${jobId} not found.`);
    }

    const candidate = await db.getUserById(candidateId);
    if (!candidate) {
      throw new Error(`Candidate with ID ${candidateId} not found.`);
    }

    const matchDetails = this.computeCandidateJobMatch(candidate, job);

    // Calculate candidate's rank position among applicants for this job
    let rank: number | undefined;
    try {
      const allMatches = await this.getJobMatches(jobId, 'highest');
      const found = allMatches.find((m) => m.candidateId === candidateId);
      if (found) {
        rank = found.rank;
      }
    } catch {
      // rank calculation non-blocking
    }

    return {
      job,
      candidate,
      matchDetails,
      rank,
    };
  }
}
