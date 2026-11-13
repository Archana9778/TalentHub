import axios, { AxiosError } from 'axios';
import {
  User,
  CandidateProfile,
  UserEducation,
  UserExperience,
  Job,
  Application,
  Company,
  JobCategory,
  JobAlert,
  ReportedJob,
  SystemStats,
  ApplicationStage,
  ApplicationStatusHistory,
  MatchDetails,
  CandidateJobMatch,
  SkillComparisonResult,
} from '../types';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string) || '/api';

// In-memory token management (prevents sensitive JWT storage in persistent localStorage)
let inMemoryToken: string | null = null;

export const getToken = (): string | null => {
  return inMemoryToken;
};

export const setToken = (token: string): void => {
  inMemoryToken = token;
};

export const clearToken = (): void => {
  inMemoryToken = null;
  try {
    localStorage.removeItem('talenthub_token');
  } catch {}
};

// Create Centralized Axios Instance with cookie credential transport
export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Accept': 'application/json',
  },
  withCredentials: true,
  timeout: 30000,
});

// Request Interceptor: Attach JWT Bearer Token if present in memory
apiClient.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Standardize API responses & errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; errors?: string[] }>) => {
    if (error.response?.status === 401) {
      // Do not clear during login or reset attempts
      const url = error.config?.url || '';
      if (!url.includes('/auth/login') && !url.includes('/auth/reset-password')) {
        clearToken();
      }
    }
    const message =
      error.response?.data?.message ||
      error.message ||
      'An unexpected network error occurred';
    return Promise.reject(new Error(message));
  }
);

export const api = {
  // --- Auth & Profile ---
  login: async (credentials: { email: string; password: string }) => {
    const res = await apiClient.post<{ token: string; user: User; message: string }>(
      '/auth/login',
      credentials
    );
    return res.data;
  },

  register: async (payload: {
    email: string;
    password: string;
    confirmPassword?: string;
    name: string;
    role: string;
    companyName?: string;
    title?: string;
    location?: string;
  }) => {
    const res = await apiClient.post<{ token: string; user: User; message: string }>(
      '/auth/register',
      payload
    );
    return res.data;
  },

  logout: async () => {
    const res = await apiClient.post<{ message: string }>('/auth/logout');
    return res.data;
  },

  forgotPassword: async (email: string) => {
    const res = await apiClient.post<{ message: string }>('/auth/forgot-password', { email });
    return res.data;
  },

  resetPassword: async (payload: {
    token: string;
    newPassword: string;
    confirmPassword?: string;
  }) => {
    const res = await apiClient.post<{ message: string }>('/auth/reset-password', payload);
    return res.data;
  },

  getMe: async () => {
    const res = await apiClient.get<{ user: User }>('/auth/me');
    return res.data;
  },

  updateProfile: async (updates: Partial<User>) => {
    const res = await apiClient.put<{ message: string; user: User }>(
      '/auth/profile',
      updates
    );
    return res.data;
  },

  getCandidateProfile: async () => {
    const res = await apiClient.get<{ profile: CandidateProfile }>('/candidate/profile');
    return res.data;
  },

  updateCandidateProfile: async (updates: Partial<CandidateProfile>) => {
    const res = await apiClient.put<{ message: string; profile: CandidateProfile }>(
      '/candidate/profile',
      updates
    );
    return res.data;
  },

  addCandidateSkill: async (skill: string) => {
    const res = await apiClient.post<{ message: string; skills: string[] }>(
      '/candidate/skills',
      { skill }
    );
    return res.data;
  },

  removeCandidateSkill: async (skill: string) => {
    const res = await apiClient.delete<{ message: string; skills: string[] }>(
      `/candidate/skills/${encodeURIComponent(skill)}`
    );
    return res.data;
  },

  addCandidateEducation: async (edu: Partial<UserEducation>) => {
    const res = await apiClient.post<{ message: string; education: UserEducation[]; entry: UserEducation }>(
      '/candidate/education',
      edu
    );
    return res.data;
  },

  updateCandidateEducation: async (id: string, edu: Partial<UserEducation>) => {
    const res = await apiClient.put<{ message: string; education: UserEducation[]; entry: UserEducation }>(
      `/candidate/education/${encodeURIComponent(id)}`,
      edu
    );
    return res.data;
  },

  deleteCandidateEducation: async (id: string) => {
    const res = await apiClient.delete<{ message: string; education: UserEducation[] }>(
      `/candidate/education/${encodeURIComponent(id)}`
    );
    return res.data;
  },

  addCandidateExperience: async (exp: Partial<UserExperience>) => {
    const res = await apiClient.post<{ message: string; experience: UserExperience[]; entry: UserExperience }>(
      '/candidate/experience',
      exp
    );
    return res.data;
  },

  updateCandidateExperience: async (id: string, exp: Partial<UserExperience>) => {
    const res = await apiClient.put<{ message: string; experience: UserExperience[]; entry: UserExperience }>(
      `/candidate/experience/${encodeURIComponent(id)}`,
      exp
    );
    return res.data;
  },

  deleteCandidateExperience: async (id: string) => {
    const res = await apiClient.delete<{ message: string; experience: UserExperience[] }>(
      `/candidate/experience/${encodeURIComponent(id)}`
    );
    return res.data;
  },

  uploadResume: async (file: File, onProgress?: (pct: number) => void) => {
    const formData = new FormData();
    formData.append('resume', file);
    const res = await apiClient.post<{
      message: string;
      resume: any;
      user: User;
      parsedData: any;
    }>('/resume/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
        ? (evt: any) => {
            const pct = evt.total ? Math.round((evt.loaded * 100) / evt.total) : 0;
            onProgress(pct);
          }
        : undefined,
    });
    return res.data;
  },

  getMyResume: async () => {
    const res = await apiClient.get<{ resume: any | null; message?: string }>('/resume/my');
    return res.data;
  },

  getResumeHistory: async () => {
    const res = await apiClient.get<{ total: number; history: any[] }>('/resume/history');
    return res.data;
  },

  getResumeDownloadUrl: async (idOrCandidateId?: string) => {
    const url = idOrCandidateId ? `/resume/download/${idOrCandidateId}` : '/resume/download';
    const res = await apiClient.get<{
      message?: string;
      candidateId?: string;
      originalName?: string;
      filename?: string;
      downloadUrl: string;
      expiresInMinutes: number;
    }>(url);
    return res.data;
  },

  parseResume: async (file?: File) => {
    if (file) {
      const formData = new FormData();
      formData.append('resume', file);
      const res = await apiClient.post('/resume/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    }
    const res = await apiClient.post('/resume/parse', {});
    return res.data;
  },

  // --- Analytics ---
  getDashboardAnalytics: async () => {
    const res = await apiClient.get<{ analytics: any }>('/analytics/dashboard');
    return res.data;
  },

  // --- Jobs ---
  getJobs: async (params?: Record<string, string>) => {
    const res = await apiClient.get<{ total: number; jobs: Job[] }>('/jobs', {
      params,
    });
    return res.data;
  },

  getJobById: async (id: string) => {
    const res = await apiClient.get<{ job: Job; company?: Company; recruiter?: any }>(`/jobs/${id}`);
    return res.data;
  },

  createJob: async (payload: Partial<Job>) => {
    const res = await apiClient.post<{ message: string; job: Job }>('/jobs', payload);
    return res.data;
  },

  updateJob: async (id: string, updates: Partial<Job>) => {
    const res = await apiClient.put<{ message: string; job: Job }>(`/jobs/${id}`, updates);
    return res.data;
  },

  deleteJob: async (id: string) => {
    const res = await apiClient.delete<{ message: string }>(`/jobs/${id}`);
    return res.data;
  },

  assignJob: async (jobId: string, recruiterId: string) => {
    const res = await apiClient.patch<{ message: string; job: Job }>(`/jobs/${jobId}/assign`, {
      recruiterId,
    });
    return res.data;
  },

  getRecruiterJobs: async (params?: { scope?: string; recruiterId?: string }) => {
    const res = await apiClient.get<{ total: number; jobs: Job[] }>('/jobs/recruiter/my-jobs', {
      params,
    });
    return res.data;
  },

  reportJob: async (payload: { jobId: string; reason: string; details: string }) => {
    const res = await apiClient.post<{ message: string; report: ReportedJob }>('/jobs/report', payload);
    return res.data;
  },

  // --- Applications ---
  applyForJob: async (jobId: string, coverLetter?: string, resumeFile?: File) => {
    const formData = new FormData();
    formData.append('jobId', jobId);
    if (coverLetter) formData.append('coverLetter', coverLetter);
    if (resumeFile) formData.append('resume', resumeFile);

    const res = await apiClient.post<{ message: string; application: Application }>(
      '/applications/apply',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return res.data;
  },

  getMyApplications: async () => {
    const res = await apiClient.get<{ total: number; applications: Application[] }>('/applications/my-applications');
    return res.data;
  },

  getApplications: async (params?: Record<string, string | undefined>) => {
    const res = await apiClient.get<{ total: number; applications: Application[] }>('/applications', {
      params,
    });
    return res.data;
  },

  getJobApplicants: async (jobId?: string, stage?: string, sort?: 'highest' | 'lowest' | 'recent') => {
    const res = await apiClient.get<{ total: number; sort?: string; applications: Application[] }>('/applications/applicants', {
      params: {
        jobId: jobId !== 'all' ? jobId : undefined,
        stage: stage !== 'all' ? stage : undefined,
        sort: sort || 'highest',
      },
    });
    return res.data;
  },

  getJobMatches: async (jobId: string, sort: 'highest' | 'lowest' | 'recent' = 'highest', stage: string = 'all') => {
    const res = await apiClient.get<{
      total: number;
      jobId: string;
      jobTitle: string;
      companyName: string;
      sort: string;
      stage: string;
      matches: CandidateJobMatch[];
    }>(`/jobs/${jobId}/matches`, {
      params: { sort, stage: stage !== 'all' ? stage : undefined },
    });
    return res.data;
  },

  getJobCandidateMatch: async (jobId: string, candidateId: string) => {
    const res = await apiClient.get<{
      job: Job;
      candidate: User;
      matchDetails: MatchDetails;
      rank?: number;
    }>(`/jobs/${jobId}/matches/${candidateId}`);
    return res.data;
  },

  getCandidateSkillMatch: async (jobId: string, candidateId: string) => {
    const res = await apiClient.get<SkillComparisonResult>(
      `/jobs/${jobId}/candidates/${candidateId}/skill-match`
    );
    return res.data;
  },

  getApplicationById: async (id: string) => {
    const res = await apiClient.get<{
      application: Application;
      candidate: User | null;
      job: Job | null;
      history?: ApplicationStatusHistory[];
    }>(`/applications/${id}`);
    return res.data;
  },

  updateApplicationStatus: async (
    id: string,
    payload: {
      status?: ApplicationStage;
      stage?: ApplicationStage;
      comment?: string;
      reason?: string;
      rejectionReason?: string;
      adminOverride?: boolean;
      adminOverrideReason?: string;
      interviewDate?: string;
      interviewType?: string;
      recruiterNotes?: string;
    }
  ) => {
    const res = await apiClient.patch<{
      message: string;
      application: Application;
      historyEntry?: ApplicationStatusHistory;
    }>(`/applications/${id}/status`, payload);
    return res.data;
  },

  // Backward compatibility alias for updateApplicationStage
  updateApplicationStage: async (
    id: string,
    payload: {
      stage: ApplicationStage;
      comment?: string;
      interviewDate?: string;
      interviewType?: string;
      recruiterNotes?: string;
      rejectionReason?: string;
      adminOverride?: boolean;
    }
  ) => {
    const res = await apiClient.patch<{ message: string; application: Application }>(
      `/applications/${id}/status`,
      { ...payload, status: payload.stage }
    );
    return res.data;
  },

  getApplicationHistory: async (id: string) => {
    const res = await apiClient.get<{
      total: number;
      history: ApplicationStatusHistory[];
      timeline: any[];
    }>(`/applications/${id}/history`);
    return res.data;
  },

  getApplicationAuditTimeline: async (id: string) => {
    const res = await apiClient.get<{ total: number; timeline: any[]; history?: ApplicationStatusHistory[] }>(
      `/applications/${id}/history`
    );
    return res.data;
  },

  // --- Companies ---
  getCompanies: async (params?: { search?: string; status?: string }) => {
    const res = await apiClient.get<{ total: number; companies: Company[] }>('/companies', { params });
    return res.data;
  },

  getCompanyById: async (id: string) => {
    const res = await apiClient.get<{
      company: Company;
      jobs: Job[];
      stats?: { totalJobs: number; totalRecruiters: number; activeRecruiters: number };
    }>(`/companies/${id}`);
    return res.data;
  },

  createCompany: async (payload: Partial<Company>) => {
    const res = await apiClient.post<{ message: string; company: Company }>('/companies', payload);
    return res.data;
  },

  updateCompany: async (id: string, updates: Partial<Company>) => {
    const res = await apiClient.put<{ message: string; company: Company }>(`/companies/${id}`, updates);
    return res.data;
  },

  updateCompanyStatus: async (id: string, status: 'active' | 'suspended') => {
    const res = await apiClient.patch<{ message: string; company: Company }>(`/admin/companies/${id}/status`, {
      status,
    });
    return res.data;
  },

  uploadCompanyLogo: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('logo', file);
    const res = await apiClient.post<{ message: string; logoUrl: string; company: Company }>(
      `/companies/${id}/logo`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return res.data;
  },

  getCompanyRecruiters: async (companyId: string) => {
    const res = await apiClient.get<{ total: number; recruiters: User[] }>(
      `/companies/${companyId}/recruiters`
    );
    return res.data;
  },

  deleteCompany: async (id: string) => {
    const res = await apiClient.delete<{ message: string }>(`/companies/${id}`);
    return res.data;
  },

  // --- Recruiters ---
  getRecruiters: async (params?: { status?: string; search?: string; companyId?: string }) => {
    const res = await apiClient.get<{ total: number; recruiters: User[] }>('/recruiters', { params });
    return res.data;
  },

  getRecruiterById: async (id: string) => {
    const res = await apiClient.get<{ recruiter: User; assignedJobs: Job[] }>(`/recruiters/${id}`);
    return res.data;
  },

  addRecruiter: async (payload: {
    name: string;
    email: string;
    password: string;
    contactNumber?: string;
    phone?: string;
    designation?: string;
    title?: string;
    role?: string;
    companyRole?: string;
    status?: string;
    companyId?: string;
  }) => {
    const res = await apiClient.post<{ message: string; recruiter: User }>('/recruiters', payload);
    return res.data;
  },

  updateRecruiter: async (id: string, updates: Partial<User> & { password?: string }) => {
    const res = await apiClient.put<{ message: string; recruiter: User }>(`/recruiters/${id}`, updates);
    return res.data;
  },

  updateRecruiterStatus: async (id: string, status: 'active' | 'inactive' | 'suspended') => {
    const res = await apiClient.patch<{ message: string; recruiter: User }>(`/recruiters/${id}/status`, {
      status,
    });
    return res.data;
  },

  getJobsByRecruiter: async (recruiterId: string) => {
    const res = await apiClient.get<{ total: number; jobs: Job[] }>(`/recruiters/${recruiterId}/jobs`);
    return res.data;
  },

  // --- Categories ---
  getCategories: async (params?: { includeInactive?: boolean }) => {
    const res = await apiClient.get<{ total: number; categories: JobCategory[] }>('/categories', { params });
    return res.data;
  },

  createCategory: async (payload: Partial<JobCategory>) => {
    const res = await apiClient.post<{ message: string; category: JobCategory }>('/categories', payload);
    return res.data;
  },

  updateCategory: async (id: string, updates: Partial<JobCategory>) => {
    const res = await apiClient.put<{ message: string; category: JobCategory }>(`/categories/${id}`, updates);
    return res.data;
  },

  toggleCategoryStatus: async (id: string) => {
    const res = await apiClient.patch<{ message: string; category: JobCategory }>(`/categories/${id}/toggle`);
    return res.data;
  },

  deleteCategory: async (id: string) => {
    const res = await apiClient.delete<{ message: string }>(`/categories/${id}`);
    return res.data;
  },

  // --- Job Alerts ---
  getMyAlerts: async () => {
    const res = await apiClient.get<{ total: number; alerts: JobAlert[] }>('/job-alerts');
    return res.data;
  },

  createAlert: async (payload: Partial<JobAlert>) => {
    const res = await apiClient.post<{ message: string; alert: JobAlert }>('/job-alerts', payload);
    return res.data;
  },

  toggleAlert: async (id: string, isActive: boolean) => {
    const res = await apiClient.patch<{ message: string; alert: JobAlert }>(`/job-alerts/${id}/toggle`, {
      isActive,
    });
    return res.data;
  },

  deleteAlert: async (id: string) => {
    const res = await apiClient.delete<{ message: string }>(`/job-alerts/${id}`);
    return res.data;
  },

  // --- Admin ---
  getSystemStats: async () => {
    const res = await apiClient.get<{ stats: SystemStats }>('/admin/statistics');
    return res.data;
  },

  getAdminUsers: async (params?: Record<string, string>) => {
    const res = await apiClient.get<{ total: number; users: User[] }>('/admin/users', { params });
    return res.data;
  },

  updateUserStatus: async (id: string, payload: { status?: string; role?: string }) => {
    const res = await apiClient.patch<{ message: string; user: User }>(`/admin/users/${id}`, payload);
    return res.data;
  },

  deleteUser: async (id: string) => {
    const res = await apiClient.delete<{ message: string }>(`/admin/users/${id}`);
    return res.data;
  },

  getAdminRecruiters: async (params?: { search?: string; companyId?: string }) => {
    const res = await apiClient.get<{ total: number; recruiters: User[] }>('/admin/recruiters', { params });
    return res.data;
  },

  getReportedJobs: async (params?: { status?: string; search?: string }) => {
    const res = await apiClient.get<{ total: number; reports: ReportedJob[] }>('/admin/reported-jobs', { params });
    return res.data;
  },

  updateReportStatus: async (
    id: string,
    payload: {
      status: 'resolved' | 'dismissed';
      adminAction?: 'deactivate_job' | 'restore_job' | 'dismiss' | 'resolve';
      adminReason?: string;
    }
  ) => {
    const res = await apiClient.patch<{ message: string; report: ReportedJob }>(
      `/admin/reported-jobs/${id}`,
      payload
    );
    return res.data;
  },
};
