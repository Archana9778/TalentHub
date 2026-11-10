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
  Building2,
  CheckCircle2,
  Clock,
  UserCheck,
  Globe,
  Mail,
  Phone,
  MapPin,
  Settings,
  ArrowRightLeft,
  FileCheck2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Job, Application, ApplicationStage, Company } from '../../types';
import { Loading } from '../../components/Loading';

export const RecruiterDashboard: React.FC = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applicants, setApplicants] = useState<Application[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [jobsRes, appsRes, analyticsRes, compRes] = await Promise.all([
          api.getRecruiterJobs({ scope: 'company' }),
          api.getJobApplicants(),
          api.getDashboardAnalytics().catch(() => null),
          user?.companyId ? api.getCompanyById(user.companyId).catch(() => null) : null,
        ]);
        setJobs(jobsRes.jobs);
        setApplicants(appsRes.applications);
        if (analyticsRes?.analytics) {
          setAnalytics(analyticsRes.analytics);
          if (analyticsRes.analytics.company) {
            setCompany(analyticsRes.analytics.company);
          }
        }
        if (compRes?.company) {
          setCompany(compRes.company);
        }
      } catch (err) {
        console.error('Error loading recruiter dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) return <Loading message="Loading recruiter dashboard & hiring funnel..." />;

  // Real backend metrics
  const totalRecruiters = analytics?.totalRecruiters ?? 2;
  const activeRecruiters = analytics?.activeRecruiters ?? 2;
  const totalCompanyJobs = analytics?.totalCompanyJobs ?? jobs.length;
  const assignedJobsCount = analytics?.assignedJobsCount ?? jobs.filter((j) => j.recruiterId === user?.id).length;
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
  const myAssignedJobs = jobs.filter((j) => j.recruiterId === user?.id);

  return (
    <div className="dashboard-container space-y-6 w-full max-w-7xl mx-auto">
      {/* Workspace Header */}
      <div className="saas-card p-6 sm:p-8 bg-slate-900 text-white relative overflow-hidden rounded-xl shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex-1 max-w-3xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3 border border-indigo-500/30">
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>{company?.name || user?.companyName || 'CloudScale Technologies'} • Recruiter Workspace</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Recruiter Dashboard
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
              Real-time candidate pipelines, recruiter team management, job ownership assignments, skill matching, and full ATS stage governance for your company requisitions.
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link
                to="/recruiter/jobs/create"
                className="saas-btn-primary text-xs bg-indigo-600 hover:bg-indigo-700 border-indigo-600 flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-semibold shadow-xs"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Post New Job</span>
              </Link>
              <Link
                to="/recruiter/applicants"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-xs border border-slate-700 transition-colors"
              >
                <FileCheck2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Applicant Tracking Board (ATS)</span>
              </Link>
              <Link
                to="/recruiter/team"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-xs border border-slate-700 transition-colors"
              >
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span>Manage Recruiters</span>
              </Link>
              <Link
                to="/recruiter/company"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-xs border border-slate-700 transition-colors"
              >
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Company Profile</span>
              </Link>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 w-full md:w-64 shrink-0 text-center">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Average AI Match Score
            </div>
            <div className="mt-2 text-3xl font-extrabold text-indigo-400">{avgMatch}%</div>
            <div className="mt-1 text-[11px] text-slate-400">Across {totalApplicantsCount} total applicants</div>
          </div>
        </div>
      </div>

      {/* Company Profile Overview & Quick Actions Card */}
      {company && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
                {company.logo ? (
                  <img
                    src={company.logo}
                    alt={company.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Building2 className="w-8 h-8 text-indigo-600" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">{company.name}</h2>
                  {company.verified && (
                    <span className="text-[10px] px-2 py-0.2 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                      VERIFIED
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 max-w-2xl">{company.description}</p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                  <span className="flex items-center gap-1 font-medium text-slate-700">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                    {company.industry}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {company.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    {company.size}
                  </span>
                  {company.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {company.email}
                    </span>
                  )}
                  {company.website && (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Website</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/recruiter/company"
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 shadow-2xs"
              >
                <Settings className="w-3.5 h-3.5 text-slate-500" />
                <span>Edit Company Details</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Recruiter & Company KPIs Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4 w-full">
        <div className="saas-card p-4 sm:p-5 bg-white border border-slate-200 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Recruiters
            </span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">{totalRecruiters}</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">{activeRecruiters} Active</div>
        </div>

        <div className="saas-card p-4 sm:p-5 bg-white border border-slate-200 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Company Jobs
            </span>
            <Briefcase className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">{totalCompanyJobs}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Total open & archived</div>
        </div>

        <div className="saas-card p-4 sm:p-5 bg-white border border-slate-200 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Assigned to Me
            </span>
            <UserCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-indigo-600">{assignedJobsCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">My requisitions</div>
        </div>

        <div className="saas-card p-4 sm:p-5 bg-white border border-slate-200 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Screening
            </span>
            <Clock className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-purple-700">{screeningCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Under evaluation</div>
        </div>

        <div className="saas-card p-4 sm:p-5 bg-white border border-slate-200 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Interviews
            </span>
            <Calendar className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-amber-700">{interviewsCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Rounds scheduled</div>
        </div>

        <div className="saas-card p-4 sm:p-5 bg-white border border-slate-200 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Hires Made
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-emerald-700">{hiresCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Successful placements</div>
        </div>
      </div>

      {/* Recruitment Funnel Bar */}
      <div className="saas-card p-6 space-y-4 bg-white border border-slate-200 rounded-xl shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Recruitment Funnel Distribution
            </h2>
            <p className="text-xs text-slate-500">Candidate progression from application to final hire</p>
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

      {/* 2 Columns: Jobs Assigned to Logged-in Recruiter & Top Candidate Matches */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full">
        {/* Jobs Assigned to Logged-In Recruiter */}
        <div className="saas-card p-6 space-y-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                <span>Jobs Assigned to You ({myAssignedJobs.length})</span>
              </h2>
              <p className="text-xs text-slate-500">Your direct recruitment ownership portfolio</p>
            </div>
            <Link
              to="/recruiter/jobs"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Manage All
            </Link>
          </div>

          {myAssignedJobs.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No jobs currently assigned to you. Reassign jobs or post a new job.
            </div>
          ) : (
            <div className="space-y-3">
              {myAssignedJobs.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  className="p-3.5 rounded-lg border border-slate-100 hover:border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/recruiter/applicants?jobId=${job.id}`}
                      className="font-bold text-slate-900 text-xs hover:text-indigo-600 truncate block"
                    >
                      {job.title}
                    </Link>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {job.location} • {job.jobType}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                      {job.applicantsCount} applicants
                    </span>
                    <Link
                      to={`/recruiter/applicants?jobId=${job.id}`}
                      className="p-1 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-700"
                      title="Review Applicants"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Matches */}
        <div className="saas-card p-6 space-y-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Top Candidate Matches</span>
              </h2>
              <p className="text-xs text-slate-500">Ranked by local candidate match score</p>
            </div>
            <Link
              to="/recruiter/applicants"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              View Board
            </Link>
          </div>

          {applicants.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No applicants received yet.
            </div>
          ) : (
            <div className="space-y-3">
              {applicants.slice(0, 5).map((app) => (
                <div
                  key={app.id}
                  className="p-3.5 rounded-lg border border-slate-100 hover:border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={
                        app.candidateAvatar ||
                        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                          app.candidateName
                        )}`
                      }
                      alt={app.candidateName}
                      className="w-8 h-8 rounded-full border border-slate-200 object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <Link
                        to={`/recruiter/applicants/${app.id}`}
                        className="font-bold text-slate-900 text-xs hover:text-indigo-600 truncate block"
                      >
                        {app.candidateName}
                      </Link>
                      <div className="text-[11px] text-slate-500 truncate">{app.jobTitle}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-extrabold text-indigo-600">
                        {app.matchScore}% Match
                      </div>
                      <div className="text-[10px] text-slate-400">{app.stage}</div>
                    </div>
                    <Link
                      to={`/recruiter/applicants/${app.id}`}
                      className="p-1 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-700"
                    >
                      <ArrowRight className="w-4 h-4" />
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
