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

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string;
  companyId?: string;
  companyName?: string;
  phone?: string;
  title?: string;
  location?: string;
  bio?: string;
  skills?: string[];
  experience?: UserExperience[];
  education?: UserEducation[];
  resumeUrl?: string;
  resumeOriginalName?: string;
  parsedResumeData?: ParsedResumeData;
  lastLoginAt?: string;
  createdAt: string;
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
  createdAt: string;
}

export interface JobCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  jobCount: number;
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

export interface MatchDetails {
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  skillScore: number;
  experienceScore: number;
  analysisNotes: string;
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

