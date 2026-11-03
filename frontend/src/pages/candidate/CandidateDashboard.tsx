import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileCheck2,
  Calendar,
  Award,
  Sparkles,
  ArrowRight,
  Search,
  Briefcase,
  AlertCircle,
  FileText,
  Clock,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Application, Job } from '../../types';
import { JobCard } from '../../components/JobCard';
import { Loading } from '../../components/Loading';

export const CandidateDashboard: React.FC = () => {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [recommendedJobs, setRecommendedJobs] = useState<Job[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [appsRes, jobsRes, analyticsRes] = await Promise.all([
          api.getMyApplications(),
          api.getJobs({ status: 'active' }),
          api.getDashboardAnalytics().catch(() => null),
        ]);
        setApplications(appsRes.applications);
        setRecommendedJobs(jobsRes.jobs.slice(0, 3));
        if (analyticsRes?.analytics) {
          setAnalytics(analyticsRes.analytics);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <Loading message="Loading candidate workspace..." />;

  // Derived metrics from actual data
  const totalApps = analytics?.totalApplications ?? applications.length;
  const underReview = analytics?.underReview ?? applications.filter((a) => a.stage === 'Applied' || a.stage === 'Screening').length;
  const interviewsCount = analytics?.interviewsScheduled ?? applications.filter((a) => a.stage === 'Interview').length;
  const offersCount = analytics?.offersReceived ?? applications.filter((a) => a.stage === 'Offer' || a.stage === 'Hired').length;
  const rejectedCount = analytics?.rejectedApplications ?? applications.filter((a) => a.stage === 'Rejected').length;

  // Profile completion calculation
  let profileScore = 30;
  if (user?.name) profileScore += 10;
  if (user?.email) profileScore += 10;
  if (user?.resumeUrl) profileScore += 25;
  if (user?.skills && user.skills.length >= 3) profileScore += 15;
  if (user?.experience && user.experience.length > 0) profileScore += 10;
  profileScore = Math.min(100, profileScore);

  return (
    <div className="dashboard-container space-y-6 w-full">
      {/* Welcome & Profile Completion Banner */}
      <div className="saas-card p-6 sm:p-8 bg-slate-900 text-white relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex-1 max-w-3xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-xs font-semibold mb-3 border border-blue-500/30">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>ATS Candidate Workspace</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Welcome back, {user?.name}!
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
              Track your technical applications in real time through the enterprise hiring pipeline and explore verified engineering opportunities.
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link
                to="/candidate/jobs"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-xs shadow-xs transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Browse All Jobs</span>
              </Link>
              <Link
                to="/candidate/profile"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-xs border border-slate-700 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Update Resume &amp; Profile</span>
              </Link>
            </div>
          </div>

          {/* Profile Completion Meter */}
          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 w-full md:w-64 shrink-0">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-slate-300">Profile Completion</span>
              <span className="font-bold text-blue-400">{profileScore}%</span>
            </div>
            <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${profileScore}%` }}
              />
            </div>
            <div className="mt-3 text-[11px] text-slate-400 flex items-center justify-between">
              <span>{user?.resumeUrl ? '✓ Resume attached' : '• No resume uploaded'}</span>
              <Link to="/candidate/profile" className="text-blue-400 hover:underline">
                Complete
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4 w-full">
        <div className="saas-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Applied
            </span>
            <FileCheck2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">{totalApps}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Submitted resumes</div>
        </div>

        <div className="saas-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Under Review
            </span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-indigo-700">{underReview}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Screening stage</div>
        </div>

        <div className="saas-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Interviews
            </span>
            <Calendar className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-emerald-700">{interviewsCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Rounds scheduled</div>
        </div>

        <div className="saas-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Offers &amp; Hired
            </span>
            <Award className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-amber-700">{offersCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Advanced to offer</div>
        </div>

        <div className="saas-card p-4 sm:p-5 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Unsuccessful
            </span>
            <XCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-slate-600">{rejectedCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Archived applications</div>
        </div>
      </div>

      {/* Main Grid: Recent Activity & Recommended Jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 2xl:grid-cols-4 gap-6 w-full">
        {/* Recent Applications Activity (2 Cols on lg / 3 on 2xl) */}
        <div className="lg:col-span-2 2xl:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Recent Application Activity
              </h2>
              <p className="text-xs text-slate-500">Live progress across your submissions</p>
            </div>
            <Link
              to="/candidate/applications"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>View All ({applications.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {applications.length === 0 ? (
            <div className="saas-card p-8 text-center text-slate-500">
              <FileCheck2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <div className="text-sm font-semibold text-slate-800">No applications submitted yet</div>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Explore engineering and technology roles and apply with your profile resume.
              </p>
              <Link
                to="/candidate/jobs"
                className="saas-btn-primary text-xs mt-4"
              >
                Find Open Positions
              </Link>
            </div>
          ) : (
            <div className="saas-card divide-y divide-slate-100 overflow-hidden">
              {applications.slice(0, 5).map((app) => (
                <div key={app.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-xs sm:text-sm truncate">
                        {app.jobTitle}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                        {app.matchScore}% Match
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {app.companyName} • Applied {new Date(app.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
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
                      to="/candidate/applications"
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
                      title="View timeline"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recommended Jobs Column (1 Col) */}
        <div className="space-y-4 2xl:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Recommended For You
              </h2>
              <p className="text-xs text-slate-500">Based on your skills &amp; profile</p>
            </div>
            <Link
              to="/candidate/jobs"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Browse
            </Link>
          </div>

          <div className="space-y-3">
            {recommendedJobs.map((job) => (
              <div key={job.id} className="saas-card p-4 hover:border-slate-300 transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      to={`/candidate/jobs/${job.id}`}
                      className="font-bold text-slate-900 text-xs sm:text-sm hover:text-blue-600 transition-colors line-clamp-1"
                    >
                      {job.title}
                    </Link>
                    <div className="text-xs text-slate-500 mt-0.5">{job.companyName}</div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
                    {job.workplaceType}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs pt-3 border-t border-slate-100">
                  <span className="font-semibold text-slate-800">
                    ${(job.salaryMin / 1000).toFixed(0)}k - ${(job.salaryMax / 1000).toFixed(0)}k
                  </span>
                  <Link
                    to={`/candidate/jobs/${job.id}`}
                    className="font-semibold text-blue-600 hover:text-blue-700 text-xs flex items-center gap-1"
                  >
                    <span>Details</span>
                    <ArrowRight className="w-3 h-3" />
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
