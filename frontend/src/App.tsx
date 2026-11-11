import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// Layouts
import { CandidateLayout } from './layouts/CandidateLayout';
import { RecruiterLayout } from './layouts/RecruiterLayout';
import { AdminLayout } from './layouts/AdminLayout';

// Public & Auth Pages
import { LandingPage } from './pages/public/LandingPage';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ResetPassword } from './pages/auth/ResetPassword';

// Candidate Pages
import { CandidateDashboard } from './pages/candidate/CandidateDashboard';
import { Jobs } from './pages/candidate/Jobs';
import { JobDetails } from './pages/candidate/JobDetails';
import { Applications } from './pages/candidate/Applications';
import { Profile } from './pages/candidate/Profile';
import { JobAlerts } from './pages/candidate/JobAlerts';

// Recruiter Pages
import { RecruiterDashboard } from './pages/recruiter/RecruiterDashboard';
import { CompanyProfile } from './pages/recruiter/CompanyProfile';
import { RecruiterManagement } from './pages/recruiter/RecruiterManagement';
import { ManageJobs } from './pages/recruiter/ManageJobs';
import { CreateJob } from './pages/recruiter/CreateJob';
import { Applicants } from './pages/recruiter/Applicants';
import { ApplicantDetails } from './pages/recruiter/ApplicantDetails';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { Users } from './pages/admin/Users';
import { Companies } from './pages/admin/Companies';
import { Categories } from './pages/admin/Categories';
import { ReportedJobs } from './pages/admin/ReportedJobs';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Landing Page */}
          <Route path="/" element={<LandingPage />} />

          {/* Auth routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Candidate Portal Routes */}
          <Route element={<ProtectedRoute allowedRoles={['candidate', 'admin']} />}>
            <Route path="/candidate" element={<CandidateLayout />}>
              <Route index element={<Navigate to="/candidate/dashboard" replace />} />
              <Route path="dashboard" element={<CandidateDashboard />} />
              <Route path="jobs" element={<Jobs />} />
              <Route path="jobs/:id" element={<JobDetails />} />
              <Route path="applications" element={<Applications />} />
              <Route path="profile" element={<Profile />} />
              <Route path="alerts" element={<JobAlerts />} />
            </Route>
          </Route>

          {/* Recruiter Portal Routes */}
          <Route element={<ProtectedRoute allowedRoles={['recruiter', 'admin']} />}>
            <Route path="/recruiter" element={<RecruiterLayout />}>
              <Route index element={<Navigate to="/recruiter/dashboard" replace />} />
              <Route path="dashboard" element={<RecruiterDashboard />} />
              <Route path="company" element={<CompanyProfile />} />
              <Route path="team" element={<RecruiterManagement />} />
              <Route path="recruiters" element={<Navigate to="/recruiter/team" replace />} />
              <Route path="jobs" element={<ManageJobs />} />
              <Route path="jobs/create" element={<CreateJob />} />
              <Route path="applicants" element={<Applicants />} />
              <Route path="applicants/:id" element={<ApplicantDetails />} />
              <Route path="applications" element={<Navigate to="/recruiter/applicants" replace />} />
              <Route path="applications/:id" element={<ApplicantDetails />} />
            </Route>
          </Route>

          {/* Admin Portal Routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="users" element={<Users />} />
              <Route path="companies" element={<Companies />} />
              <Route path="categories" element={<Categories />} />
              <Route path="reported-jobs" element={<ReportedJobs />} />
            </Route>
          </Route>

          {/* Catch all unmatched routes */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
