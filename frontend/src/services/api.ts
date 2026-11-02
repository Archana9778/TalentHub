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
} from '../types';

const API_BASE = '/api';

export const getToken = (): string | null => {
  return localStorage.getItem('talenthub_token');
};

export const setToken = (token: string): void => {
  localStorage.setItem('talenthub_token', token);
};

export const clearToken = (): void => {
  localStorage.removeItem('talenthub_token');
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If body is NOT FormData, set JSON content type
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export const api = {
  // --- Auth & Profile ---
  login: (credentials: { email: string; password: string }) =>
    request<{ token: string; user: User; message: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  register: (payload: {
    email: string;
    password: string;
    name: string;
    role: string;
    companyName?: string;
    title?: string;
    location?: string;
  }) =>
    request<{ token: string; user: User; message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMe: () => request<{ user: User }>('/auth/me'),

  updateProfile: (updates: Partial<User>) =>
    request<{ message: string; user: User }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  uploadResume: (file: File) => {
    const formData = new FormData();
    formData.append('resume', file);
    return request<{ message: string; resumeUrl: string; user: User; parsedData: any }>('/auth/resume', {
      method: 'POST',
      body: formData,
    });
  },

  // --- Jobs ---
  getJobs: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return request<{ total: number; jobs: Job[] }>(`/jobs${query}`);
  },

  getJobById: (id: string) =>
    request<{ job: Job; company?: Company }>(`/jobs/${id}`),

  createJob: (payload: Partial<Job>) =>
    request<{ message: string; job: Job }>('/jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateJob: (id: string, updates: Partial<Job>) =>
    request<{ message: string; job: Job }>(`/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  deleteJob: (id: string) =>
    request<{ message: string }>(`/jobs/${id}`, {
      method: 'DELETE',
    }),

  getRecruiterJobs: () =>
    request<{ total: number; jobs: Job[] }>('/jobs/recruiter/my-jobs'),

  reportJob: (payload: { jobId: string; reason: string; details: string }) =>
    request<{ message: string; report: ReportedJob }>('/jobs/report', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // --- Applications ---
  applyForJob: (jobId: string, coverLetter?: string, resumeFile?: File) => {
    const formData = new FormData();
    formData.append('jobId', jobId);
    if (coverLetter) formData.append('coverLetter', coverLetter);
    if (resumeFile) formData.append('resume', resumeFile);

    return request<{ message: string; application: Application }>('/applications/apply', {
      method: 'POST',
      body: formData,
    });
  },

  getMyApplications: () =>
    request<{ total: number; applications: Application[] }>('/applications/my-applications'),

  getJobApplicants: (jobId?: string, stage?: string) => {
    const params = new URLSearchParams();
    if (jobId) params.append('jobId', jobId);
    if (stage) params.append('stage', stage);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<{ total: number; applications: Application[] }>(`/applications/applicants${query}`);
  },

  getApplicationById: (id: string) =>
    request<{ application: Application; candidate: User | null; job: Job | null }>(`/applications/${id}`),

  updateApplicationStage: (
    id: string,
    payload: {
      stage: ApplicationStage;
      comment?: string;
      interviewDate?: string;
      interviewType?: string;
      recruiterNotes?: string;
    }
  ) =>
    request<{ message: string; application: Application }>(`/applications/${id}/stage`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // --- Companies ---
  getCompanies: () =>
    request<{ total: number; companies: Company[] }>('/companies'),

  getCompanyById: (id: string) =>
    request<{ company: Company; jobs: Job[] }>(`/companies/${id}`),

  createCompany: (payload: Partial<Company>) =>
    request<{ message: string; company: Company }>('/companies', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateCompany: (id: string, updates: Partial<Company>) =>
    request<{ message: string; company: Company }>(`/companies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  deleteCompany: (id: string) =>
    request<{ message: string }>(`/companies/${id}`, {
      method: 'DELETE',
    }),

  // --- Categories ---
  getCategories: () =>
    request<{ total: number; categories: JobCategory[] }>('/categories'),

  createCategory: (payload: Partial<JobCategory>) =>
    request<{ message: string; category: JobCategory }>('/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateCategory: (id: string, updates: Partial<JobCategory>) =>
    request<{ message: string; category: JobCategory }>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  deleteCategory: (id: string) =>
    request<{ message: string }>(`/categories/${id}`, {
      method: 'DELETE',
    }),

  // --- Job Alerts ---
  getMyAlerts: () =>
    request<{ total: number; alerts: JobAlert[] }>('/job-alerts'),

  createAlert: (payload: Partial<JobAlert>) =>
    request<{ message: string; alert: JobAlert }>('/job-alerts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  toggleAlert: (id: string, isActive: boolean) =>
    request<{ message: string; alert: JobAlert }>(`/job-alerts/${id}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),

  deleteAlert: (id: string) =>
    request<{ message: string }>(`/job-alerts/${id}`, {
      method: 'DELETE',
    }),

  // --- Admin ---
  getSystemStats: () =>
    request<{ stats: SystemStats }>('/admin/statistics'),

  getAdminUsers: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return request<{ total: number; users: User[] }>(`/admin/users${query}`);
  },

  updateUserStatus: (id: string, payload: { status?: string; role?: string }) =>
    request<{ message: string; user: User }>(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteUser: (id: string) =>
    request<{ message: string }>(`/admin/users/${id}`, {
      method: 'DELETE',
    }),

  getReportedJobs: () =>
    request<{ total: number; reports: ReportedJob[] }>('/admin/reported-jobs'),

  updateReportStatus: (id: string, payload: { status: 'pending' | 'resolved' | 'dismissed'; removeJob?: boolean }) =>
    request<{ message: string; report: ReportedJob }>(`/admin/reported-jobs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};

