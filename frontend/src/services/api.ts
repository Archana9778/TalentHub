import axios, { AxiosError } from 'axios';
import {
  User,
  Job,
  Application,
  Company,
  JobCategory,
  JobAlert,
  ReportedJob,
  SystemStats,
  ApplicationStage,
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
    const res = await apiClient.get<{ job: Job; company?: Company }>(`/jobs/${id}`);
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

  getRecruiterJobs: async () => {
    const res = await apiClient.get<{ total: number; jobs: Job[] }>('/jobs/recruiter/my-jobs');
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
    const res = await apiClient.get<{ application: Application; candidate: User | null; job: Job | null }>(
      `/applications/${id}`
    );
    return res.data;
  },

  updateApplicationStage: async (
    id: string,
    payload: {
      stage: ApplicationStage;
      comment?: string;
      interviewDate?: string;
      interviewType?: string;
      recruiterNotes?: string;
    }
  ) => {
    const res = await apiClient.patch<{ message: string; application: Application }>(
      `/applications/${id}/stage`,
      payload
    );
    return res.data;
  },

  getApplicationAuditTimeline: async (id: string) => {
    const res = await apiClient.get<{ total: number; timeline: any[] }>(`/applications/${id}/audit`);
    return res.data;
  },

  // --- Companies ---
  getCompanies: async () => {
    const res = await apiClient.get<{ total: number; companies: Company[] }>('/companies');
    return res.data;
  },

  getCompanyById: async (id: string) => {
    const res = await apiClient.get<{ company: Company; jobs: Job[] }>(`/companies/${id}`);
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

  deleteCompany: async (id: string) => {
    const res = await apiClient.delete<{ message: string }>(`/companies/${id}`);
    return res.data;
  },

  // --- Categories ---
  getCategories: async () => {
    const res = await apiClient.get<{ total: number; categories: JobCategory[] }>('/categories');
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

  getReportedJobs: async () => {
    const res = await apiClient.get<{ total: number; reports: ReportedJob[] }>('/admin/reported-jobs');
    return res.data;
  },

  updateReportStatus: async (
    id: string,
    payload: { status: 'pending' | 'resolved' | 'dismissed'; removeJob?: boolean }
  ) => {
    const res = await apiClient.patch<{ message: string; report: ReportedJob }>(
      `/admin/reported-jobs/${id}`,
      payload
    );
    return res.data;
  },
};
