import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  MapPin,
  DollarSign,
  Briefcase,
  Building2,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Send,
  Upload,
} from 'lucide-react';
import { api } from '../../services/api';
import { Job, Company } from '../../types';
import { Loading } from '../../components/Loading';
import { useAuth } from '../../context/AuthContext';

export const JobDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Application submission state
  const [coverLetter, setCoverLetter] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [applying, setApplying] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Report job state
  const [reportingOpen, setReportingOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Misleading salary or job requirements');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);

  useEffect(() => {
    const fetchJob = async () => {
      if (!id) return;
      try {
        const data = await api.getJobById(id);
        setJob(data.job);
        if (data.company) setCompany(data.company);
      } catch (err: any) {
        setError(err.message || 'Failed to load job details');
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [id]);

  if (loading) return <Loading message="Loading job details..." />;
  if (error || !job) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
        <p className="text-rose-600 font-semibold">{error || 'Job not found'}</p>
        <Link
          to="/candidate/jobs"
          className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Jobs</span>
        </Link>
      </div>
    );
  }

  // Calculate Match Score
  const candidateSkillsNorm = new Set((user?.skills || []).map((s) => s.toLowerCase()));
  const matchedSkills = job.skills.filter((s) => candidateSkillsNorm.has(s.toLowerCase()));
  const missingSkills = job.skills.filter((s) => !candidateSkillsNorm.has(s.toLowerCase()));
  const matchPct = job.skills.length > 0 ? Math.round((matchedSkills.length / job.skills.length) * 100) : 80;

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplying(true);
    setApplyError(null);

    try {
      await api.applyForJob(job.id, coverLetter, resumeFile || undefined);
      setAppliedSuccess(true);
    } catch (err: any) {
      setApplyError(err.message || 'Failed to submit application.');
    } finally {
      setApplying(false);
    }
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.reportJob({ jobId: job.id, reason: reportReason, details: reportDetails });
      setReportSuccess(true);
      setTimeout(() => {
        setReportingOpen(false);
        setReportSuccess(false);
      }, 2500);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Back button */}
      <Link
        to="/candidate/jobs"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to search listings</span>
      </Link>

      {/* Main Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <img
              src={job.companyLogo || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120'}
              alt={job.companyName}
              className="w-16 h-16 rounded-2xl object-cover border border-slate-100 p-1 shadow-xs shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
                  {job.categoryName}
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {job.workplaceType}
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                  {job.jobType}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-2">
                {job.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
                <div className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold text-slate-700">{job.companyName}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{job.location}</span>
                </div>
                <div className="flex items-center gap-1 text-emerald-700 font-semibold">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    ${(job.salaryMin / 1000).toFixed(0)}k - ${(job.salaryMax / 1000).toFixed(0)}k / year
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0">
            <div className="text-right hidden sm:block">
              <div className="text-xs text-slate-400">Application Status</div>
              <div className="text-xs font-bold text-emerald-600">Active & Accepting</div>
            </div>
            <button
              onClick={() => {
                const formElem = document.getElementById('apply-form-section');
                if (formElem) formElem.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md shadow-blue-600/20 transition-all"
            >
              Apply for this Role
            </button>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Details & AI Match Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Description & Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Overview */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-2">Job Description</h2>
              <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
                {job.description}
              </p>
            </div>

            {job.requirements && job.requirements.length > 0 && (
              <div>
                <h2 className="text-base font-bold text-slate-900 mb-2">Requirements & Qualifications</h2>
                <ul className="space-y-2">
                  {job.requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-600">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {job.benefits && job.benefits.length > 0 && (
              <div>
                <h2 className="text-base font-bold text-slate-900 mb-2">Benefits & Perks</h2>
                <ul className="space-y-2">
                  {job.benefits.map((ben, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-2" />
                      <span>{ben}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Application Submission Section */}
          <div id="apply-form-section" className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 mb-1">
              Submit Your Application
            </h2>
            <p className="text-xs text-slate-500 mb-5">
              Your profile skills and experience will be used for a local match estimate.
            </p>

            {appliedSuccess ? (
              <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h3 className="font-bold text-emerald-900 text-base">Application Submitted!</h3>
                <p className="text-xs text-emerald-700">
                  The hiring team has received your application and resume. You can track your progress on the applications board.
                </p>
                <Link
                  to="/candidate/applications"
                  className="mt-3 inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold"
                >
                  View in Applications Tracker
                </Link>
              </div>
            ) : (
              <form onSubmit={handleApply} className="space-y-4">
                {applyError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                    {applyError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Cover Letter / Personal Statement
                  </label>
                  <textarea
                    rows={4}
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    placeholder="Introduce yourself and explain why you're a great fit for this team..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Resume Selection
                  </label>
                  <div className="p-4 border border-dashed border-slate-300 rounded-xl bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-800">
                          {resumeFile ? resumeFile.name : user?.resumeOriginalName || 'Use Saved Profile Resume'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          PDF, DOCX up to 10MB
                        </div>
                      </div>
                    </div>

                    <label className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium cursor-pointer transition-colors shrink-0">
                      <span>Choose Different File</span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setResumeFile(e.target.files[0]);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setReportingOpen(true)}
                    className="text-xs text-slate-400 hover:text-rose-600 flex items-center gap-1"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Report Job</span>
                  </button>

                  <button
                    type="submit"
                    disabled={applying}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md disabled:opacity-50 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    <span>{applying ? 'Submitting Application...' : 'Send Application'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: AI Match Score & Company Card */}
        <div className="space-y-6">
          {/* AI Match Score Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>AI Candidate Match</span>
              </h3>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {matchPct}% Match
              </span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2 mb-4 overflow-hidden">
              <div
                className={`h-2 rounded-full ${
                  matchPct >= 80 ? 'bg-emerald-500' : matchPct >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                }`}
                style={{ width: `${matchPct}%` }}
              />
            </div>

            {/* Matched skills */}
            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold text-slate-700">Matched Skills ({matchedSkills.length}):</span>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {matchedSkills.map((s) => (
                    <span
                      key={s}
                      className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-medium text-[11px]"
                    >
                      ✓ {s}
                    </span>
                  ))}
                  {matchedSkills.length === 0 && (
                    <span className="text-slate-400 italic">No skills directly matched</span>
                  )}
                </div>
              </div>

              {missingSkills.length > 0 && (
                <div>
                  <span className="font-semibold text-slate-700">Missing Key Skills:</span>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {missingSkills.map((s) => (
                      <span
                        key={s}
                        className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium text-[11px]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Company Info Box */}
          {company && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
              <h3 className="font-bold text-slate-900 text-sm mb-3">About the Company</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                {company.description}
              </p>
              <div className="text-xs text-slate-500 space-y-1 pt-3 border-t border-slate-100">
                <div><span className="font-medium">Industry:</span> {company.industry}</div>
                <div><span className="font-medium">Company Size:</span> {company.size}</div>
                <div><span className="font-medium">Headquarters:</span> {company.location}</div>
                {company.website && (
                  <div className="pt-1">
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      Visit Website →
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Report Modal */}
      {reportingOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <span>Report Job Posting</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Help our administrator team keep TalentHub clean and secure.
            </p>

            {reportSuccess ? (
              <div className="my-6 p-4 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-xl text-center">
                Report logged for Admin moderation. Thank you!
              </div>
            ) : (
              <form onSubmit={handleReport} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Reason
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  >
                    <option value="Misleading salary or job requirements">Misleading salary or job requirements</option>
                    <option value="Suspected fraudulent or phishing posting">Suspected fraudulent or phishing posting</option>
                    <option value="Expired position still listed">Expired position still listed</option>
                    <option value="Discrimination or inappropriate content">Discrimination or inappropriate content</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Additional Details
                  </label>
                  <textarea
                    rows={3}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Provide specific details about the issue..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReportingOpen(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold"
                  >
                    Submit Report
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


