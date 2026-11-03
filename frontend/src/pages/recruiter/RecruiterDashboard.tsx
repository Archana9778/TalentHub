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
  CheckCircle2,
  Clock,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Job, Application, ApplicationStage } from '../../types';
import { Loading } from '../../components/Loading';

export const RecruiterDashboard: React.FC = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applicants, setApplicants] = useState<Application[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [jobsRes, appsRes, analyticsRes] = await Promise.all([
          api.getRecruiterJobs(),
          api.getJobApplicants(),
          api.getDashboardAnalytics().catch(() => null),
        ]);
        setJobs(jobsRes.jobs);
        setApplicants(appsRes.applications);
        if (analyticsRes?.analytics) {
          setAnalytics(analyticsRes.analytics);
        }
      } catch (err) {
        console.error('Error loading recruiter dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <Loading message="Loading recruiter dashboard & hiring funnel..." />;

  // Real backend metrics
  const activeJobsCount = analytics?.activeJobs ?? jobs.filter((j) => j.status === 'active').length;
  const totalApplicantsCount = analytics?.totalApplicants ?? applicants.length;
  const screeningCount = analytics?.candidatesUnderScreening ?? applicants.filter((a) => a.stage === 'Screening').length;
  const interviewsCount = analytics?.interviewsInProgress ?? applicants.filter((a) => a.stage === 'Interview').length;
  const offersCount = analytics?.offersExtended ?? applicants.filter((a) => a.stage === 'Offer').length;
  const hiresCount = analytics?.hiresCompleted ?? applicants.filter((a) => a.stage === 'Hired').length;
  const avgMatch = analytics?.averageMatchScore ?? (applicants.length > 0
    ? Math.round(applicants.reduce((sum, a) => sum + a.matchScore, 0) / applicants.length)
    : 0);

  const funnel = analytics?.pipelineFunnel || {
    Applied: applicants.filter((a) => a.stage === 'Applied').length,
    Screening: screeningCount,
    Interview: interviewsCount,
    Offer: offersCount,
    Hired: hiresCount,
    Rejected: applicants.filter((a) => a.stage === 'Rejected').length,
  };

  const stages: ApplicationStage[] = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];

  return (
    <div className="dashboard-container space-y-6 w-full">
      {/* Recruiter Workspace Header */}
      <div className="saas-card p-6 sm:p-8 bg-slate-900 text-white relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex-1 max-w-3xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3 border border-indigo-500/30">
              <Building className="w-3.5 h-3.5 text-indigo-400" />
              <span>{user?.companyName || 'CloudScale Technologies'} • ATS Workspace</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Recruiter Dashboard
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
              Real-time candidate pipelines, automated Azure AI match ratings, and full ATS stage governance for your engineering requisitions.
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link
                to="/recruiter/jobs/create"
                className="saas-btn-primary text-xs bg-indigo-600 hover:bg-indigo-700 border-indigo-600"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Post New Job</span>
              </Link>
              <Link
                to="/recruiter/applicants"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-xs border border-slate-700 transition-colors"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Applicant Tracking Board (ATS)</span>
              </Link>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 w-full md:w-60 shrink-0 text-center">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Average AI Match Score
            </div>
            <div className="mt-2 text-3xl font-extrabold text-indigo-400">{avgMatch}%</div>
            <div className="mt-1 text-[11px] text-slate-400">Across {totalApplicantsCount} applicants</div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4 w-full">
        <div className="saas-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Active Jobs
            </span>
            <Briefcase className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">{activeJobsCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Open requisitions</div>
        </div>

        <div className="saas-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Applicants
            </span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">{totalApplicantsCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Candidates received</div>
        </div>

        <div className="saas-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Screening
            </span>
            <Clock className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-purple-700">{screeningCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Under evaluation</div>
        </div>

        <div className="saas-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Interviews
            </span>
            <Calendar className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-emerald-700">{interviewsCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Rounds in progress</div>
        </div>

        <div className="saas-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Offers Extended
            </span>
            <Award className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-amber-700">{offersCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Pending response</div>
        </div>

        <div className="saas-card p-4 sm:p-5 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Hires Completed
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-emerald-800">{hiresCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Successfully placed</div>
        </div>
      </div>

      {/* Recruitment Funnel Bar */}
      <div className="saas-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Recruitment Funnel Distribution
            </h2>
            <p className="text-xs text-slate-500">Applicant conversion across all active stages</p>
          </div>
          <Link
            to="/recruiter/applicants"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            <span>Open ATS Pipeline</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 w-full">
          {stages.map((stg) => {
            const count = (funnel as any)[stg] || 0;
            const pct = totalApplicantsCount > 0 ? Math.round((count / totalApplicantsCount) * 100) : 0;
            return (
              <div key={stg} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>{stg}</span>
                  <span className="font-bold text-slate-900">{count}</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-400 mt-1">{pct}% of candidates</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2 Columns: Top Candidate Matches & Active Requisitions */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full">
        {/* Top Matches */}
        <div className="saas-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Top Candidate Matches
              </h2>
              <p className="text-xs text-slate-500">Ranked by Azure AI Document Intelligence match score</p>
            </div>
            <Link
              to="/recruiter/applicants"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              View Board
            </Link>
          </div>

          {applicants.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No applicants received yet for your requisitions.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {applicants
                .slice()
                .sort((a, b) => b.matchScore - a.matchScore)
                .slice(0, 5)
                .map((app) => (
                  <div key={app.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/recruiter/applicants/${app.id}`}
                        className="font-semibold text-slate-900 text-xs sm:text-sm hover:text-indigo-600 transition-colors block truncate"
                      >
                        {app.candidateName}
                      </Link>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">
                        {app.jobTitle} • {new Date(app.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {app.matchScore}%
                      </span>
                      <span
                        className={`badge-saas ${
                          app.stage === 'Applied'
                            ? 'badge-applied'
                            : app.stage === 'Screening'
                            ? 'badge-screening'
                            : app.stage === 'Interview'
                            ? 'badge-interview'
                            : app.stage === 'Offer' || app.stage === 'Hired'
                            ? 'badge-offer'
                            : 'badge-rejected'
                        }`}
                      >
                        {app.stage}
                      </span>
                      <Link
                        to={`/recruiter/applicants/${app.id}`}
                        className="p-1 text-slate-400 hover:text-slate-700"
                        title="Candidate Details"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Active Requisitions */}
        <div className="saas-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Active Job Requisitions
              </h2>
              <p className="text-xs text-slate-500">Your currently posted positions</p>
            </div>
            <Link
              to="/recruiter/jobs"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Manage ({jobs.length})
            </Link>
          </div>

          {jobs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              You haven't posted any jobs yet.{' '}
              <Link to="/recruiter/jobs/create" className="text-indigo-600 font-semibold hover:underline">
                Create your first job
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {jobs.slice(0, 5).map((job) => (
                <div key={job.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900 text-xs sm:text-sm block truncate">
                      {job.title}
                    </span>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {job.location} • {job.workplaceType} • ${Math.round(job.salaryMin / 1000)}k–${Math.round(job.salaryMax / 1000)}k
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to={`/recruiter/applicants?jobId=${job.id}`}
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Users className="w-3 h-3 text-slate-500" />
                      <span>{job.applicantsCount || 0}</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
