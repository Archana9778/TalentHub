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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [appsRes, jobsRes] = await Promise.all([
          api.getMyApplications(),
          api.getJobs({ featuredOnly: 'true' }),
        ]);
        setApplications(appsRes.applications);
        setRecommendedJobs(jobsRes.jobs.slice(0, 3));
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <Loading message="Loading candidate dashboard..." />;

  const interviewsCount = applications.filter((a) => a.stage === 'Interview').length;
  const offersCount = applications.filter((a) => a.stage === 'Offer' || a.stage === 'Hired').length;
  const activeCount = applications.filter((a) => a.stage !== 'Rejected').length;

  // Profile completion score
  let profileScore = 40;
  if (user?.resumeUrl) profileScore += 30;
  if (user?.skills && user.skills.length > 3) profileScore += 15;
  if (user?.experience && user.experience.length > 0) profileScore += 15;

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-cyan-600 rounded-2xl p-6 sm:p-8 text-white shadow-xl shadow-blue-900/10 relative overflow-hidden">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold text-white mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Azure AI Match Powered</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Welcome back, {user?.name}!
          </h1>
          <p className="mt-2 text-sm sm:text-base text-blue-100 leading-relaxed">
            Track your job applications through the Azure-powered recruitment pipeline and explore opportunities matched to your skill set.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/candidate/jobs"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-blue-700 font-semibold rounded-xl text-xs sm:text-sm hover:bg-blue-50 transition-colors shadow-sm"
            >
              <Search className="w-4 h-4" />
              <span>Browse Open Positions</span>
            </Link>
            <Link
              to="/candidate/profile"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-800/60 hover:bg-blue-800 text-white font-semibold rounded-xl text-xs sm:text-sm border border-white/20 transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Manage Resume & Profile</span>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Applications
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileCheck2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">{activeCount}</div>
          <p className="mt-1 text-xs text-slate-400">Total active in pipeline</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Interviews
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">{interviewsCount}</div>
          <p className="mt-1 text-xs text-slate-400">Scheduled rounds</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Offers Received
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">{offersCount}</div>
          <p className="mt-1 text-xs text-slate-400">Pending offers</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Profile Score
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{profileScore}%</span>
            <span className="text-xs font-medium text-emerald-600">
              {profileScore >= 80 ? 'Complete' : 'Needs resume'}
            </span>
          </div>
          <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${profileScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content Grid: Recent Applications & Recommended Jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Recent Applications */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Your Active Applications</h2>
            <Link
              to="/candidate/applications"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <span>View All ({applications.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {applications.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              <Briefcase className="w-10 h-10 mx-auto text-slate-400 mb-2" />
              <p className="font-semibold text-slate-700">No applications yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Explore available roles and apply with your uploaded resume.
              </p>
              <Link
                to="/candidate/jobs"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors"
              >
                <span>Find Jobs Now</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.slice(0, 4).map((app) => (
                <div
                  key={app.id}
                  className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-300 transition-all"
                >
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
                      {app.jobTitle}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <span className="font-medium text-slate-700">{app.companyName}</span>
                      <span>•</span>
                      <span>Applied {new Date(app.createdAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full text-[11px]">
                        AI Match {app.matchScore}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-bold px-3 py-1.5 rounded-full capitalize ${
                        app.stage === 'Offer' || app.stage === 'Hired'
                          ? 'bg-emerald-100 text-emerald-800'
                          : app.stage === 'Interview'
                          ? 'bg-purple-100 text-purple-800'
                          : app.stage === 'Screening'
                          ? 'bg-blue-100 text-blue-800'
                          : app.stage === 'Rejected'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {app.stage}
                    </span>
                    <Link
                      to="/candidate/applications"
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      Track
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: AI Match Recommendations & Resume Status */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Azure Document Intelligence</span>
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your resume skills are parsed automatically to calculate Match Scores for open jobs.
            </p>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="text-xs font-semibold text-slate-700 mb-2">
                Active Candidate Skills:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(user?.skills || ['React', 'TypeScript', 'Node.js', 'Spring Boot', 'MySQL', 'Azure']).map((s) => (
                  <span
                    key={s}
                    className="text-[11px] bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg font-medium"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <Link
              to="/candidate/profile"
              className="mt-4 block text-center py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
            >
              Update Skills & Upload New Resume
            </Link>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Featured Opportunities</h3>
              <Link to="/candidate/jobs" className="text-xs text-blue-600 font-semibold">
                View all
              </Link>
            </div>
            {recommendedJobs.map((job) => (
              <JobCard key={job.id} job={job} candidateSkills={user?.skills} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

