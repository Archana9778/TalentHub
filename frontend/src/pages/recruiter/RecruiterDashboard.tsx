import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  Users,
  Calendar,
  Award,
  Sparkles,
  PlusCircle,
  ArrowRight,
  TrendingUp,
  Building,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Job, Application, ApplicationStage } from '../../types';
import { Loading } from '../../components/Loading';

export const RecruiterDashboard: React.FC = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applicants, setApplicants] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [jobsRes, appsRes] = await Promise.all([
          api.getRecruiterJobs(),
          api.getJobApplicants(),
        ]);
        setJobs(jobsRes.jobs);
        setApplicants(appsRes.applications);
      } catch (err) {
        console.error('Error loading recruiter dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <Loading message="Loading recruiter dashboard & hiring funnel..." />;

  const stageCounts: Record<ApplicationStage, number> = {
    Applied: 0,
    Screening: 0,
    Interview: 0,
    Offer: 0,
    Hired: 0,
    Rejected: 0,
  };

  applicants.forEach((a) => {
    if (stageCounts[a.stage] !== undefined) {
      stageCounts[a.stage] += 1;
    }
  });

  const totalCandidates = applicants.length;
  const interviewsCount = stageCounts['Interview'];
  const offersCount = stageCounts['Offer'] + stageCounts['Hired'];

  return (
    <div className="space-y-8">
      {/* Banner */}
      <div className="bg-gradient-to-r from-purple-800 via-indigo-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold text-white mb-3">
            <Building className="w-3.5 h-3.5 text-purple-200" />
            <span>{user?.companyName || 'CloudScale Technologies'} • Recruiter Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Welcome back, {user?.name}
          </h1>
          <p className="mt-2 text-sm text-purple-100 leading-relaxed">
            Manage your open engineering requisitions, review candidates ranked by Azure AI Document Intelligence match score, and advance applicants through the hiring pipeline.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/recruiter/jobs/create"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-purple-900 font-semibold rounded-xl text-xs sm:text-sm hover:bg-purple-50 transition-colors shadow-sm"
            >
              <PlusCircle className="w-4 h-4 text-purple-600" />
              <span>Post New Requisition</span>
            </Link>
            <Link
              to="/recruiter/applicants"
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-700/60 hover:bg-purple-700 text-white font-semibold rounded-xl text-xs sm:text-sm border border-purple-500/40 transition-colors"
            >
              <Users className="w-4 h-4" />
              <span>Open ATS Kanban Board</span>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Jobs
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">{jobs.length}</div>
          <p className="mt-1 text-xs text-slate-400">Published requisitions</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Applicants
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">{totalCandidates}</div>
          <p className="mt-1 text-xs text-slate-400">Across all postings</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Interviews Scheduled
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">{interviewsCount}</div>
          <p className="mt-1 text-xs text-slate-400">In interview round</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Offers & Hired
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">{offersCount}</div>
          <p className="mt-1 text-xs text-slate-400">Accepted or pending</p>
        </div>
      </div>

      {/* Recruitment Funnel Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            <h2 className="text-base font-bold text-slate-900">
              Talent Pipeline Funnel (Stage Distribution)
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Total In Process: {totalCandidates - stageCounts['Rejected']}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          {(['Applied', 'Screening', 'Interview', 'Offer', 'Hired'] as ApplicationStage[]).map(
            (stg) => {
              const count = stageCounts[stg];
              const pct = totalCandidates > 0 ? Math.round((count / totalCandidates) * 100) : 0;
              return (
                <div key={stg} className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                  <div className="text-xs font-semibold text-slate-500 uppercase">{stg}</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">{count}</div>
                  <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-purple-600 h-1.5 rounded-full"
                      style={{ width: `${Math.max(pct, 5)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">{pct}% of applicants</div>
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* Top Ranked Candidates Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Recent Applicants (Ranked by AI Match Score)
            </h2>
            <p className="text-xs text-slate-500">
              Evaluated by comparing extracted resume skills to job requirements.
            </p>
          </div>
          <Link
            to="/recruiter/applicants"
            className="text-xs font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1"
          >
            <span>Open ATS Board</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="divide-y divide-slate-100">
            {applicants.slice(0, 5).map((app) => (
              <div
                key={app.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={
                      app.candidateAvatar ||
                      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                        app.candidateName
                      )}`
                    }
                    alt={app.candidateName}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  />
                  <div>
                    <Link
                      to={`/recruiter/applicants/${app.id}`}
                      className="font-bold text-slate-900 hover:text-purple-600 text-sm"
                    >
                      {app.candidateName}
                    </Link>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span>{app.candidateTitle || 'Candidate'}</span>
                      <span>•</span>
                      <span>Applied for <strong className="text-slate-700">{app.jobTitle}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{app.matchScore}% Match</span>
                  </div>

                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      app.stage === 'Interview'
                        ? 'bg-purple-100 text-purple-800'
                        : app.stage === 'Offer'
                        ? 'bg-emerald-100 text-emerald-800'
                        : app.stage === 'Screening'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {app.stage}
                  </span>

                  <Link
                    to={`/recruiter/applicants/${app.id}`}
                    className="text-xs font-semibold text-purple-600 hover:text-purple-800"
                  >
                    Review Profile →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

