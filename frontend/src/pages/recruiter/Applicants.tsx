import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Users,
  Sparkles,
  Filter,
  CheckCircle2,
  XCircle,
  Calendar,
  ArrowRight,
  Layers,
  Table as TableIcon,
  Columns,
  Building,
  ChevronRight,
  Send,
  TrendingUp,
  ArrowUpDown,
  Award,
  BarChart2,
} from 'lucide-react';
import { api } from '../../services/api';
import { Application, Job, ApplicationStage, MatchCategory } from '../../types';
import { Loading } from '../../components/Loading';
import { MatchDetailsModal } from '../../components/MatchDetailsModal';

export const Applicants: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialJobId = searchParams.get('jobId') || 'all';

  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState(initialJobId);
  const [selectedStage, setSelectedStage] = useState('all');
  const [sortOrder, setSortOrder] = useState<'highest' | 'lowest' | 'recent'>('highest');
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [loading, setLoading] = useState(true);

  // Match details review modal
  const [inspectingApp, setInspectingApp] = useState<Application | null>(null);

  // Advance Stage Dialog
  const [stageModalApp, setStageModalApp] = useState<Application | null>(null);
  const [targetStage, setTargetStage] = useState<ApplicationStage>('Interview');
  const [stageComment, setStageComment] = useState('');
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewType, setInterviewType] = useState('Technical Round');
  const [updatingStage, setUpdatingStage] = useState(false);

  const fetchApplicants = async () => {
    try {
      const [appsRes, jobsRes] = await Promise.all([
        api.getJobApplicants(selectedJobId !== 'all' ? selectedJobId : undefined, undefined, sortOrder),
        api.getRecruiterJobs(),
      ]);
      setApplications(appsRes.applications);
      setJobs(jobsRes.jobs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplicants();
  }, [selectedJobId, sortOrder]);

  // Compute job-specific ranking positions (#1, #2, #3...) independently per job
  const jobRankings = useMemo(() => {
    const ranks = new Map<string, number>();
    const byJob = new Map<string, Application[]>();
    for (const app of applications) {
      if (!byJob.has(app.jobId)) byJob.set(app.jobId, []);
      byJob.get(app.jobId)!.push(app);
    }
    byJob.forEach((apps) => {
      const sorted = [...apps].sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
      sorted.forEach((app, idx) => {
        ranks.set(app.id, idx + 1);
      });
    });
    return ranks;
  }, [applications]);

  // Category styling helper
  const getCategoryInfo = (score: number) => {
    if (score >= 80) {
      return {
        label: 'Excellent Match' as MatchCategory,
        badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        bar: 'bg-emerald-500',
        text: 'text-emerald-700',
      };
    }
    if (score >= 60) {
      return {
        label: 'Good Match' as MatchCategory,
        badge: 'bg-blue-50 text-blue-800 border-blue-200',
        bar: 'bg-blue-500',
        text: 'text-blue-700',
      };
    }
    if (score >= 40) {
      return {
        label: 'Moderate Match' as MatchCategory,
        badge: 'bg-amber-50 text-amber-800 border-amber-200',
        bar: 'bg-amber-500',
        text: 'text-amber-700',
      };
    }
    return {
      label: 'Low Match' as MatchCategory,
      badge: 'bg-rose-50 text-rose-800 border-rose-200',
      bar: 'bg-rose-500',
      text: 'text-rose-700',
    };
  };

  const handleStageChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stageModalApp) return;

    setUpdatingStage(true);
    try {
      const res = await api.updateApplicationStage(stageModalApp.id, {
        stage: targetStage,
        comment: stageComment || `Moved to ${targetStage}`,
        interviewDate: targetStage === 'Interview' ? interviewDate : undefined,
        interviewType: targetStage === 'Interview' ? (interviewType as any) : undefined,
      });

      setApplications(
        applications.map((a) => (a.id === stageModalApp.id ? res.application : a))
      );
      setStageModalApp(null);
      setStageComment('');
    } catch (err: any) {
      alert(err.message || 'Failed to update stage');
    } finally {
      setUpdatingStage(false);
    }
  };

  const openMoveModal = (app: Application, nextStage: ApplicationStage) => {
    setStageModalApp(app);
    setTargetStage(nextStage);
    setStageComment(`Candidate progressed to ${nextStage} stage.`);
  };

  const stages: ApplicationStage[] = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];

  const filteredApps = applications.filter((app) => {
    if (selectedStage !== 'all' && app.stage !== selectedStage) return false;
    return true;
  });

  if (loading) return <Loading message="Loading applicant tracking board..." />;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Applicant Tracking System (ATS)</span>
            <span className="text-xs bg-purple-100 text-purple-800 font-bold px-2.5 py-0.5 rounded-full">
              {applications.length} Candidates
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Ranked by AI Match Score. Drag or click actions to advance through the hiring funnel.
          </p>
        </div>

        {/* View mode switcher */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl shrink-0 self-start lg:self-auto">
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'kanban'
                ? 'bg-white text-purple-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Columns className="w-4 h-4" />
            <span>Kanban Board</span>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'table'
                ? 'bg-white text-purple-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TableIcon className="w-4 h-4" />
            <span>Table View</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-700">Filter by Requisition:</span>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500 max-w-xs"
            >
              <option value="all">All Active Job Postings ({jobs.length})</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-700">Sort Candidates:</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-semibold text-purple-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
              aria-label="Sort candidate rankings"
            >
              <option value="highest">Highest Match First</option>
              <option value="lowest">Lowest Match First</option>
              <option value="recent">Recently Applied</option>
            </select>
          </div>
        </div>

        {viewMode === 'table' && (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Stage:</span>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-medium text-slate-800 focus:outline-none"
            >
              <option value="all">All Stages</option>
              {stages.map((stg) => (
                <option key={stg} value={stg}>
                  {stg}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* KANBAN BOARD VIEW */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 overflow-x-auto pb-6">
          {stages.map((stage) => {
            const stageApps = applications.filter((a) => a.stage === stage);

            const stageTheme: Record<ApplicationStage, { bg: string; border: string; header: string }> = {
              Applied: { bg: 'bg-slate-50/80', border: 'border-slate-200', header: 'text-slate-700' },
              Screening: { bg: 'bg-blue-50/40', border: 'border-blue-200', header: 'text-blue-800' },
              Interview: { bg: 'bg-purple-50/40', border: 'border-purple-200', header: 'text-purple-800' },
              Offer: { bg: 'bg-emerald-50/40', border: 'border-emerald-200', header: 'text-emerald-800' },
              Hired: { bg: 'bg-teal-50/40', border: 'border-teal-200', header: 'text-teal-800' },
              Rejected: { bg: 'bg-rose-50/30', border: 'border-rose-200', header: 'text-rose-800' },
            };

            const currentTheme = stageTheme[stage];

            return (
              <div
                key={stage}
                className={`${currentTheme.bg} rounded-2xl border ${currentTheme.border} p-3 flex flex-col min-w-[240px]`}
              >
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200/60">
                  <span className={`text-xs font-bold uppercase tracking-wider ${currentTheme.header}`}>
                    {stage}
                  </span>
                  <span className="text-xs font-bold bg-white px-2 py-0.5 rounded-full border border-slate-200/80 text-slate-700 shadow-2xs">
                    {stageApps.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[70vh]">
                  {stageApps.map((app) => {
                    const rank = jobRankings.get(app.id) || 1;
                    const cat = getCategoryInfo(app.matchScore || 0);

                    return (
                      <div
                        key={app.id}
                        className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0 border border-slate-200"
                              title={`Ranking position #${rank} for this requisition`}
                            >
                              #{rank}
                            </span>
                            <Link
                              to={`/recruiter/applicants/${app.id}`}
                              className="font-bold text-slate-900 text-xs hover:text-purple-600 line-clamp-1"
                            >
                              {app.candidateName}
                            </Link>
                          </div>
                          <span
                            className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border shrink-0 flex items-center gap-0.5 ${cat.badge}`}
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            {app.matchScore}%
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 line-clamp-1">
                          {app.candidateTitle ? `${app.candidateTitle} • ` : ''}{app.jobTitle}
                        </div>

                        {/* Visual Progress Bar & Category Label */}
                        <div className="space-y-1 pt-0.5">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className={`font-bold ${cat.text}`}>{cat.label}</span>
                            <span className="font-extrabold text-slate-800">{app.matchScore}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${cat.bar}`}
                              style={{ width: `${Math.min(100, Math.max(0, app.matchScore || 0))}%` }}
                            />
                          </div>
                        </div>

                        {/* View Match Details Clickable Action */}
                        <button
                          type="button"
                          onClick={() => setInspectingApp(app)}
                          className="w-full py-1 px-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors border border-purple-100"
                        >
                          <Sparkles className="w-3 h-3 text-purple-600" />
                          <span>View Match Details</span>
                        </button>

                        {app.interviewDate && (
                          <div className="flex items-center gap-1 text-[10px] font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(app.interviewDate).toLocaleDateString()}</span>
                          </div>
                        )}

                        {/* Action buttons to advance */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                          <Link
                            to={`/recruiter/applicants/${app.id}`}
                            className="text-slate-500 hover:text-slate-900 font-medium"
                          >
                            Details
                          </Link>

                          <div className="flex items-center gap-1">
                            {stage === 'Applied' && (
                              <button
                                onClick={() => openMoveModal(app, 'Screening')}
                                className="px-2 py-0.5 bg-blue-50 text-blue-700 font-semibold rounded hover:bg-blue-100"
                              >
                                Screen →
                              </button>
                            )}
                            {stage === 'Screening' && (
                              <button
                                onClick={() => openMoveModal(app, 'Interview')}
                                className="px-2 py-0.5 bg-purple-50 text-purple-700 font-semibold rounded hover:bg-purple-100"
                              >
                                Interview →
                              </button>
                            )}
                            {stage === 'Interview' && (
                              <button
                                onClick={() => openMoveModal(app, 'Offer')}
                                className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-semibold rounded hover:bg-emerald-100"
                              >
                                Offer →
                              </button>
                            )}
                            {stage === 'Offer' && (
                              <button
                                onClick={() => openMoveModal(app, 'Hired')}
                                className="px-2 py-0.5 bg-teal-50 text-teal-700 font-semibold rounded hover:bg-teal-100"
                              >
                                Hire ✓
                              </button>
                            )}
                            {stage !== 'Rejected' && stage !== 'Hired' && (
                              <button
                                onClick={() => openMoveModal(app, 'Rejected')}
                                className="text-slate-400 hover:text-rose-600 p-0.5"
                                title="Reject candidate"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {stageApps.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-xs italic">
                      No candidates in {stage}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-4 w-16 text-center">Rank</th>
                  <th className="px-6 py-4">Candidate Profile</th>
                  <th className="px-6 py-4">Target Requisition</th>
                  <th className="px-6 py-4">Matching Score & Category</th>
                  <th className="px-6 py-4">Current Stage</th>
                  <th className="px-6 py-4">Applied</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredApps.map((app) => {
                  const rank = jobRankings.get(app.id) || 1;
                  const cat = getCategoryInfo(app.matchScore || 0);

                  return (
                    <tr key={app.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Rank Position */}
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black ${
                            rank === 1
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs'
                              : rank === 2
                              ? 'bg-slate-200 text-slate-800 border border-slate-300'
                              : rank === 3
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                          title={`Job Requisition Rank #${rank}`}
                        >
                          #{rank}
                        </span>
                      </td>

                      {/* Candidate Info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              app.candidateAvatar ||
                              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                                app.candidateName
                              )}`
                            }
                            alt={app.candidateName}
                            className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                          <div>
                            <div className="font-bold text-slate-900 text-sm">
                              <Link to={`/recruiter/applicants/${app.id}`} className="hover:text-purple-600">
                                {app.candidateName}
                              </Link>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {app.candidateTitle ? `${app.candidateTitle} • ` : ''}{app.candidateEmail}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Target Requisition */}
                      <td className="px-6 py-4 font-medium text-slate-800">
                        <div>{app.jobTitle}</div>
                        <div className="text-[10px] text-slate-400">{app.companyName}</div>
                      </td>

                      {/* Matching Score, Progress Bar & Category */}
                      <td className="px-6 py-4 min-w-[200px]">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${cat.badge}`}>
                              {cat.label}
                            </span>
                            <span className="text-xs font-black text-slate-900">{app.matchScore}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200/60">
                            <div
                              className={`h-1.5 rounded-full ${cat.bar}`}
                              style={{ width: `${Math.min(100, Math.max(0, app.matchScore || 0))}%` }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setInspectingApp(app)}
                            className="text-[10px] font-bold text-purple-700 hover:text-purple-900 hover:underline flex items-center gap-1 pt-0.5"
                          >
                            <Sparkles className="w-3 h-3 text-purple-600" />
                            <span>View Match Details →</span>
                          </button>
                        </div>
                      </td>

                      {/* Current Stage */}
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            app.stage === 'Interview'
                              ? 'bg-purple-100 text-purple-800'
                              : app.stage === 'Offer' || app.stage === 'Hired'
                              ? 'bg-emerald-100 text-emerald-800'
                              : app.stage === 'Screening'
                              ? 'bg-blue-100 text-blue-800'
                              : app.stage === 'Rejected'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {app.stage}
                        </span>
                      </td>

                      {/* Applied Date */}
                      <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                        {new Date(app.createdAt).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openMoveModal(app, 'Screening')}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-700 rounded-lg font-medium transition-colors"
                          >
                            Move Stage
                          </button>
                          <Link
                            to={`/recruiter/applicants/${app.id}`}
                            className="p-1.5 text-slate-400 hover:text-slate-800"
                            title="Candidate application details"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Advance Stage Modal */}
      {stageModalApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h2 className="text-base font-bold text-slate-900">
              Move Candidate: {stageModalApp.candidateName}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Role: {stageModalApp.jobTitle} • Current: {stageModalApp.stage}
            </p>

            <form onSubmit={handleStageChangeSubmit} className="space-y-4 mt-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Target Pipeline Stage *
                </label>
                <select
                  value={targetStage}
                  onChange={(e) => setTargetStage(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="Applied">Applied (Initial Intake)</option>
                  <option value="Screening">Screening (Recruiter Phone Call)</option>
                  <option value="Interview">Interview (Technical / Team Round)</option>
                  <option value="Offer">Offer (Compensation Extended)</option>
                  <option value="Hired">Hired (Candidate Accepted)</option>
                  <option value="Rejected">Rejected (Not Selected)</option>
                </select>
              </div>

              {targetStage === 'Interview' && (
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-purple-900 uppercase mb-1">
                      Interview Type
                    </label>
                    <select
                      value={interviewType}
                      onChange={(e) => setInterviewType(e.target.value)}
                      className="w-full bg-white border border-purple-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                    >
                      <option value="Technical Round">Technical Round (Architecture & Coding)</option>
                      <option value="Video Call">Video Call (Recruiter Screening)</option>
                      <option value="On-site">On-site Executive Interview</option>
                      <option value="HR Discussion">HR & Culture Alignment</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-purple-900 uppercase mb-1">
                      Scheduled Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={interviewDate}
                      onChange={(e) => setInterviewDate(e.target.value)}
                      className="w-full bg-white border border-purple-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Audit Log Comment / Note
                </label>
                <textarea
                  rows={3}
                  value={stageComment}
                  onChange={(e) => setStageComment(e.target.value)}
                  placeholder="Reason for stage change, interviewer feedback, or offer notes..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStageModalApp(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingStage}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {updatingStage ? 'Updating Stage...' : 'Confirm Stage Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Match Details Breakdown Modal */}
      {inspectingApp && (
        <MatchDetailsModal
          isOpen={!!inspectingApp}
          onClose={() => setInspectingApp(null)}
          candidateName={inspectingApp.candidateName}
          candidateTitle={inspectingApp.candidateTitle}
          jobTitle={inspectingApp.jobTitle}
          matchScore={inspectingApp.matchScore || 0}
          matchCategory={inspectingApp.matchDetails?.category}
          rank={jobRankings.get(inspectingApp.id)}
          matchDetails={inspectingApp.matchDetails}
        />
      )}
    </div>
  );
};

