import { db } from '../database/db';
import { Job, User, SkillComparisonResult } from '../types';

/**
 * Known canonical mappings & aliases for common technical skills.
 * Prevents false positives (e.g. Java vs JavaScript, Go vs Google Cloud)
 * while smoothly matching common variations (e.g. Node.js vs Nodejs vs Node).
 */
const SKILL_ALIASES: Record<string, string> = {
  // JavaScript & TypeScript
  javascript: 'javascript',
  js: 'javascript',
  'vanilla js': 'javascript',
  typescript: 'typescript',
  ts: 'typescript',

  // Frontend Frameworks & Libraries
  react: 'react',
  reactjs: 'react',
  'react.js': 'react',
  'react native': 'react native',
  'react-native': 'react native',
  next: 'nextjs',
  nextjs: 'nextjs',
  'next.js': 'nextjs',
  vue: 'vuejs',
  vuejs: 'vuejs',
  'vue.js': 'vuejs',
  nuxt: 'nuxtjs',
  nuxtjs: 'nuxtjs',
  'nuxt.js': 'nuxtjs',
  angular: 'angular',
  angularjs: 'angular',
  svelte: 'svelte',

  // Backend Frameworks & Runtimes
  node: 'nodejs',
  nodejs: 'nodejs',
  'node.js': 'nodejs',
  express: 'expressjs',
  expressjs: 'expressjs',
  'express.js': 'expressjs',
  nest: 'nestjs',
  nestjs: 'nestjs',
  'nest.js': 'nestjs',
  fastapi: 'fastapi',
  django: 'django',
  flask: 'flask',
  'spring boot': 'spring boot',
  springboot: 'spring boot',
  spring: 'spring',

  // Languages (Explicit distinct tokens)
  java: 'java',
  'core java': 'java',
  python: 'python',
  python3: 'python',
  golang: 'golang',
  go: 'golang',
  rust: 'rust',
  ruby: 'ruby',
  'ruby on rails': 'ruby on rails',
  rails: 'ruby on rails',
  php: 'php',
  c: 'c_lang',
  'c++': 'cpp',
  cpp: 'cpp',
  'c#': 'csharp',
  csharp: 'csharp',
  'c-sharp': 'csharp',
  '.net': 'dotnet',
  dotnet: 'dotnet',
  'asp.net': 'aspnet',

  // Cloud Platforms
  aws: 'aws',
  'amazon web services': 'aws',
  azure: 'azure',
  'microsoft azure': 'azure',
  gcp: 'gcp',
  'google cloud': 'gcp',
  'google cloud platform': 'gcp',

  // DevOps, Infrastructure & Containers
  docker: 'docker',
  kubernetes: 'kubernetes',
  k8s: 'kubernetes',
  terraform: 'terraform',
  ansible: 'ansible',
  packer: 'packer',
  jenkins: 'jenkins',
  'ci/cd': 'cicd',
  cicd: 'cicd',
  'ci-cd': 'cicd',
  linux: 'linux',
  git: 'git',
  github: 'github',
  gitlab: 'gitlab',

  // Databases
  postgresql: 'postgresql',
  postgres: 'postgresql',
  mysql: 'mysql',
  mongodb: 'mongodb',
  mongo: 'mongodb',
  redis: 'redis',
  sqlite: 'sqlite',
  sql: 'sql',
  nosql: 'nosql',

  // APIs & Web Standards
  rest: 'rest api',
  'rest api': 'rest api',
  'rest apis': 'rest api',
  restful: 'rest api',
  'restful api': 'rest api',
  graphql: 'graphql',
  html: 'html',
  html5: 'html',
  css: 'css',
  css3: 'css',
  tailwind: 'tailwind css',
  tailwindcss: 'tailwind css',
  'tailwind css': 'tailwind css',
};

export class SkillComparisonService {
  /**
   * Normalizes a skill string for comparison:
   * - Trims whitespace
   * - Converts to lowercase
   * - Collapses internal whitespace
   */
  static normalizeSkill(skill: string): string {
    if (!skill || typeof skill !== 'string') return '';
    return skill.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Returns a canonical key for known aliases, or a cleaned normalized form.
   */
  static getCanonicalSkill(skill: string): string {
    const norm = this.normalizeSkill(skill);
    if (!norm) return '';
    if (SKILL_ALIASES[norm]) {
      return SKILL_ALIASES[norm];
    }
    // Also check alphanumeric string (e.g. "node.js" -> "nodejs", "react-native" -> "reactnative")
    const cleanAlpha = norm.replace(/[^a-z0-9]/g, '');
    if (cleanAlpha && SKILL_ALIASES[cleanAlpha]) {
      return SKILL_ALIASES[cleanAlpha];
    }
    return norm;
  }

  /**
   * Determines whether two skill names represent the same technical qualification.
   * Strictly guards against partial collisions (e.g. Java !== JavaScript, Go !== Google Cloud, C !== C++/C#/CSS).
   */
  static areSkillsMatching(skillA: string, skillB: string): boolean {
    const normA = this.normalizeSkill(skillA);
    const normB = this.normalizeSkill(skillB);
    if (!normA || !normB) return false;

    // Direct case-insensitive equality
    if (normA === normB) return true;

    // Canonical key equality
    const canonA = this.getCanonicalSkill(skillA);
    const canonB = this.getCanonicalSkill(skillB);
    if (canonA && canonB && canonA === canonB) return true;

    // If either has a defined known alias or canonical mapping that differed, they do not match
    const hasAliasA = Boolean(SKILL_ALIASES[normA]);
    const hasAliasB = Boolean(SKILL_ALIASES[normB]);
    if (hasAliasA || hasAliasB) return false;

    // Never strip '+' or '#' which distinguish C, C++, C#
    if (normA.includes('+') !== normB.includes('+') || normA.includes('#') !== normB.includes('#')) {
      return false;
    }

    // Normalized separator equality (e.g. "react-native" vs "react native", "next.js" vs "nextjs")
    const cleanA = normA.replace(/[\s\-_.]/g, '');
    const cleanB = normB.replace(/[\s\-_.]/g, '');
    if (cleanA.length >= 2 && cleanA === cleanB) {
      return true;
    }

    return false;
  }

  /**
   * Extracts clean, deduplicated candidate skills.
   * Preserves original display casing while removing case-insensitive duplicates.
   */
  static extractCandidateSkills(candidate: Partial<User> | null | undefined): string[] {
    if (!candidate) return [];

    const rawSkills: string[] = [];

    // 1. Direct candidate profile skills
    if (Array.isArray(candidate.skills)) {
      for (const s of candidate.skills) {
        if (typeof s === 'string' && s.trim()) {
          rawSkills.push(s.trim());
        }
      }
    }

    // 2. Extracted skills from resume parser (if any)
    if (Array.isArray(candidate.parsedResumeData?.extractedSkills)) {
      for (const s of candidate.parsedResumeData.extractedSkills) {
        if (typeof s === 'string' && s.trim()) {
          rawSkills.push(s.trim());
        }
      }
    }

    // Deduplicate preserving first-seen original capitalization
    const seen = new Set<string>();
    const deduplicated: string[] = [];

    for (const skill of rawSkills) {
      const canon = this.getCanonicalSkill(skill);
      if (!seen.has(canon)) {
        seen.add(canon);
        deduplicated.push(skill);
      }
    }

    return deduplicated;
  }

  /**
   * Extracts clean, deduplicated job-required skills.
   * Preserves original display casing.
   */
  static extractJobSkills(job: Partial<Job> | null | undefined): string[] {
    if (!job) return [];

    const rawSkills: string[] = [];

    if (Array.isArray(job.skills)) {
      for (const s of job.skills) {
        if (typeof s === 'string' && s.trim()) {
          rawSkills.push(s.trim());
        }
      }
    }

    // Deduplicate preserving first-seen original capitalization
    const seen = new Set<string>();
    const deduplicated: string[] = [];

    for (const skill of rawSkills) {
      const canon = this.getCanonicalSkill(skill);
      if (!seen.has(canon)) {
        seen.add(canon);
        deduplicated.push(skill);
      }
    }

    return deduplicated;
  }

  /**
   * Core comparison method:
   * Categorizes into Matching Skills, Missing Skills, and Additional Skills.
   * Calculates matching percentage strictly against total required job skills.
   */
  static compareSkills(
    candidateSkills: string[],
    jobSkills: string[]
  ): {
    matchedSkills: string[];
    missingSkills: string[];
    additionalSkills: string[];
    matchingPercentage: number;
    totalRequiredSkills: number;
    matchedCount: number;
    missingCount: number;
    additionalCount: number;
  } {
    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];
    const additionalSkills: string[] = [];

    // Track which candidate skills have been matched
    const matchedCandidateIndices = new Set<number>();

    // For each required job skill, find if candidate possesses a match
    for (const jSkill of jobSkills) {
      let isMatched = false;

      for (let i = 0; i < candidateSkills.length; i++) {
        const cSkill = candidateSkills[i];
        if (this.areSkillsMatching(cSkill, jSkill)) {
          isMatched = true;
          matchedCandidateIndices.add(i);
          matchedSkills.push(jSkill); // display job requirement name
          break;
        }
      }

      if (!isMatched) {
        missingSkills.push(jSkill);
      }
    }

    // Identify candidate additional skills (not required by the job)
    for (let i = 0; i < candidateSkills.length; i++) {
      if (!matchedCandidateIndices.has(i)) {
        additionalSkills.push(candidateSkills[i]);
      }
    }

    const totalRequiredSkills = jobSkills.length;
    const matchedCount = matchedSkills.length;
    const missingCount = missingSkills.length;
    const additionalCount = additionalSkills.length;

    // Formula: (Number of Matching Required Skills / Total Required Job Skills) * 100
    let matchingPercentage = 0;
    if (totalRequiredSkills === 0) {
      // Safe handling when job specifies no required skills
      matchingPercentage = matchedCount > 0 || candidateSkills.length > 0 ? 100 : 100;
    } else {
      matchingPercentage = Math.round((matchedCount / totalRequiredSkills) * 100);
    }

    // Clamp score between 0% and 100%
    matchingPercentage = Math.max(0, Math.min(100, matchingPercentage));

    return {
      matchedSkills,
      missingSkills,
      additionalSkills,
      matchingPercentage,
      totalRequiredSkills,
      matchedCount,
      missingCount,
      additionalCount,
    };
  }

  /**
   * Retrieves candidate profile & job requisition from DB and performs comparison.
   */
  static async compareCandidateToJob(
    jobId: string,
    candidateId: string
  ): Promise<SkillComparisonResult> {
    const job = await db.getJobById(jobId);
    if (!job) {
      throw new Error(`Job posting with ID "${jobId}" was not found.`);
    }

    const candidate = await db.getUserById(candidateId);
    if (!candidate) {
      throw new Error(`Candidate with ID "${candidateId}" was not found.`);
    }

    const jobSkills = this.extractJobSkills(job);
    const candidateSkills = this.extractCandidateSkills(candidate);

    const comparison = this.compareSkills(candidateSkills, jobSkills);

    // Retrieve application relationship if candidate has applied to this job
    let applicationId: string | undefined;
    let applicationStage: any | undefined;
    try {
      const apps = await db.getApplicationsByJobId(jobId);
      const app = apps.find((a) => a.candidateId === candidateId);
      if (app) {
        applicationId = app.id;
        applicationStage = app.stage;
      }
    } catch {
      // Non-blocking lookup
    }

    return {
      candidateId: candidate.id,
      candidateName: candidate.name || 'Candidate',
      jobId: job.id,
      jobTitle: job.title || 'Job Requisition',
      matchingPercentage: comparison.matchingPercentage,
      totalRequiredSkills: comparison.totalRequiredSkills,
      matchedCount: comparison.matchedCount,
      missingCount: comparison.missingCount,
      additionalCount: comparison.additionalCount,
      matchedSkills: comparison.matchedSkills,
      missingSkills: comparison.missingSkills,
      additionalSkills: comparison.additionalSkills,
      applicationId,
      applicationStage,
    };
  }
}
