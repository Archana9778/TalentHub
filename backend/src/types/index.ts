export type UserRole = 'candidate' | 'recruiter' | 'admin';
export type UserStatus = 'active' | 'suspended';

export interface UserExperience {
  title: string;
  company: string;
  period: string;
  description: string;
}

export interface UserEducation {
  degree: string;
  school: string;
  year: string;
}

export interface User {
  id: string;
  email: string;
  password?: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  tokenVersion?: number;
  lastLoginAt?: string;
  passwordChangedAt?: string;
  avatarUrl?: string;
  companyId?: string;
  companyName?: string;
  phone?: string;
  title?: string;
  location?: string;
  bio?: string;
  skills?: string[];
  certifications?: string[];
  experience?: UserExperience[];
  education?: UserEducation[];
  resumeUrl?: string;
  resumeOriginalName?: string;
  parsedResumeData?: ParsedResumeData;
  createdAt: string;
  updatedAt?: string;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt?: string | null;
  createdAt: string;
}

export interface RevokedToken {
  id: string;
  tokenJti: string;
  expiresAt: string;
  createdAt: string;
}

export interface ParsedResumeData {
  fullName: string;
  email: string;
  phone: string;
  summary: string;
  extractedSkills: string[];
  experienceYears: number;
  educationLevel: string;
  extractedAt: string;
}

export interface Company {
  id: string;
  name: string;
  description: string;
  logo: string;
  website: string;
  location: string;
  industry: string;
  size: string;
  verified: boolean;
  status?: 'active' | 'suspended';
  createdAt: string;
}

export interface JobCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  jobCount: number;
  isActive?: boolean;
}

export type WorkplaceType = 'Remote' | 'On-site' | 'Hybrid';
export type JobType = 'Full-time' | 'Part-time' | 'Contract' | 'Internship';
export type ExperienceLevel = 'Entry-level' | 'Mid-level' | 'Senior' | 'Lead / Principal';
export type JobStatus = 'active' | 'closed' | 'draft';

export interface Job {
  id: string;
  title: string;
  companyId: string;
  companyName: string;
  companyLogo?: string;
  recruiterId: string;
  recruiterName: string;
  categoryId: string;
  categoryName: string;
  location: string;
  workplaceType: WorkplaceType;
  jobType: JobType;
  experienceLevel: ExperienceLevel;
  salaryMin: number;
  salaryMax: number;
  salaryCurrency: string;
  description: string;
  requirements: string[];
  skills: string[];
  benefits: string[];
  status: JobStatus;
  isFeatured: boolean;
  applicantsCount: number;
  viewsCount: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export type ApplicationStage = 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Hired' | 'Rejected';

export interface StageTimelineItem {
  stage: ApplicationStage;
  changedBy: string;
  changedByName: string;
  changedAt: string;
  comment?: string;
}

export type MatchCategory = 'Excellent Match' | 'Good Match' | 'Moderate Match' | 'Low Match';

export interface MatchDetails {
  score: number;
  category?: MatchCategory;
  matchedSkills: string[];
  missingSkills: string[];
  skillScore: number; // 0-100 (40% weight)
  experienceScore: number; // 0-100 (25% weight)
  educationScore?: number; // 0-100 (15% weight)
  certificationsScore?: number; // 0-100 (10% weight)
  additionalScore?: number; // 0-100 (10% weight)
  relevantExperience?: string[];
  matchingCertifications?: string[];
  missingQualifications?: string[];
  analysisNotes: string;
}

export interface CandidateJobMatch {
  rank: number;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidateTitle?: string;
  candidateAvatar?: string;
  candidateLocation?: string;
  candidatePhone?: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  applicationId?: string;
  applicationStage?: ApplicationStage;
  appliedDate?: string;
  matchScore: number;
  matchCategory: MatchCategory;
  matchDetails: MatchDetails;
}

export interface SkillComparisonResult {
  candidateId: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  matchingPercentage: number;
  totalRequiredSkills: number;
  matchedCount: number;
  missingCount: number;
  additionalCount: number;
  matchedSkills: string[];
  missingSkills: string[];
  additionalSkills: string[];
  applicationId?: string;
  applicationStage?: ApplicationStage;
}

export interface Application {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  candidateAvatar?: string;
  candidateTitle?: string;
  resumeUrl: string;
  coverLetter?: string;
  stage: ApplicationStage;
  matchScore: number;
  matchDetails: MatchDetails;
  recruiterNotes: string;
  interviewDate?: string;
  interviewType?: 'Video Call' | 'Technical Round' | 'On-site' | 'HR Discussion';
  timeline: StageTimelineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ReportedJob {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  reportedByUserId: string;
  reportedByName: string;
  reason: string;
  details: string;
  status: 'pending' | 'resolved' | 'dismissed';
  reviewedByUserId?: string;
  reviewedByName?: string;
  adminAction?: 'deactivate_job' | 'restore_job' | 'dismiss' | 'resolve';
  adminReason?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface JobAlert {
  id: string;
  userId: string;
  title: string;
  keywords: string;
  category: string;
  location: string;
  jobType: string;
  frequency: 'daily' | 'weekly';
  isActive: boolean;
  createdAt: string;
}

export interface SystemStats {
  totalUsers: number;
  totalCandidates: number;
  totalRecruiters: number;
  totalCompanies: number;
  totalJobs: number;
  activeJobs: number;
  totalApplications: number;
  pendingReports: number;
  stageCounts: Record<ApplicationStage, number>;
  topSkillsInDemand: { skill: string; count: number }[];
  timeToHireDaysAverage: number;
}


// ─── Match Results ────────────────────────────────────────────────────────────

export interface MatchResult {
  id: string;
  applicationId: string;
  candidateId: string;
  jobId: string;
  /** true = this is the most recent calculation; false = historical */
  isLatest: boolean;
  overallScore: number;
  skillScore: number;
  experienceScore: number;
  educationScore: number;
  matchedSkills?: string[];
  missingSkills?: string[];
  analysisNotes?: string;
  recruiterOverride?: number;
  overrideById?: string;
  overrideReason?: string;
  computedAt: string;
  createdAt: string;
}

// ─── Resume Documents (Blob Storage versions) ────────────────────────────────

export type ResumeUploadStatus = 'uploaded' | 'failed' | 'deleted';

export interface ResumeDocument {
  id: string;
  candidateId: string;
  originalFilename: string;
  blobName: string;
  containerName: string;
  fileExtension: string;
  mimeType: string;
  fileSizeBytes: number;
  checksumSha256: string;
  uploadStatus: ResumeUploadStatus;
  isCurrent: boolean;
  uploadedAt: string;
  createdAt: string;
}
