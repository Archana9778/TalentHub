import React, { useState, useEffect } from 'react';
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
  Search,
  ArrowUpDown,
  History,
  X,
  AlertTriangle,
  UserCheck,
  Clock,
  Briefcase,
  Eye,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { SkillMatchModal } from '../../components/SkillMatchModal';
import { MatchDetailsModal } from '../../components/MatchDetailsModal';
import { Application, Job, ApplicationStage, ApplicationStatusHistory } from '../../types';
import { Loading } from '../../components/Loading';

const ALLOWED_TRANSITIONS: Record<ApplicationStage, ApplicationStage[]> = {
  Applied: ['Screening'],
  Screening: ['Interview', 'Rejected'],
  Interview: ['Offer', 'Rejected'],
  Offer: ['Hired', 'Rejected'],
  Hired: [],
  Rejected: [],
};

const STAGE_COLORS: Record<ApplicationStage, { bg: string; text: string; border: string; dot: string }> = {
  Applied: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' },
  Screening: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  Interview: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  Offer: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  Hired: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  Rejected: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
};

export const Applicants: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialJobId = searchParams.get('jobId') || 'all';

  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState(initialJobId);
  const [selectedStage, setSelectedStage] = useState('all');
  const [inspectingApp, setInspectingApp] = useState<Application | null>(null);
  const [skillModalTarget, setSkillModalTarget] = useState<{
    isOpen: boolean;
    jobId?: string;
    candidateId?: string;
    candidateName?: string;
    jobTitle?: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'status' | 'matchScore'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Status Transition Dialog
  const [stageModalApp, setStageModalApp] = useState<Application | null>(null);
  const [targetStage, setTargetStage] = useState<ApplicationStage>('Screening');
  const [stageComment, setStageComment] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isAdminOverride, setIsAdminOverride] = useState(false);
  const [adminOverrideReason, setAdminOverrideReason] = useState('');
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewType, setInterviewType] = useState('Technical Round');
  const [updatingStage, setUpdatingStage] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  // Timeline / History Drawer Modal
  const [historyApp, setHistoryApp] = useState<Application | null>(null);
  const [historyRecords, setHistoryRecords] = useState<ApplicationStatusHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const isCompanyAdmin =
    user?.role === 'admin' ||
    user?.companyRole === 'admin' ||
    !user?.companyRole;

  const fetchApplicants = async () => {
    try {
      const [appsRes, jobsRes] = await Promise.all([
        api.getApplications({
          jobId: selectedJobId !== 'all' ? selectedJobId : undefined,
          status: selectedStage !== 'all' ? selectedStage : undefined,
          sortBy,
          sortOrder,
        }),
        api.getRecruiterJobs({ scope: 'company' }),
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
  }, [selectedJobId, selectedStage, sortBy, sortOrder]);

  const openStatusModal = (
    app: Application,
    newStage: ApplicationStage,
    override: boolean = false
  ) => {
    setStageModalApp(app);
    setTargetStage(newStage);
    setIsAdminOverride(override);
    setStageComment(
      newStage === 'Rejected'
        ? ''
        : `Candidate moved to ${newStage} stage by ${user?.name}.`
    );
    setRejectionReason('');
    setAdminOverrideReason('');
    setInterviewDate('');
    setInterviewType('Technical Round');
    setTransitionError(null);
  };

  const handleStageChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stageModalApp) return;

    if (targetStage === 'Rejected' && !rejectionReason.trim()) {
      setTransitionError('A rejection reason is required when moving an application to Rejected.');
      return;
    }

    if (isAdminOverride && !adminOverrideReason.trim()) {
      setTransitionError('Administrative status corrections require a recorded reason.');
      return;
    }

    setUpdatingStage(true);
    setTransitionError(null);

    try {
      const res = await api.updateApplicationStatus(stageModalApp.id, {
        status: targetStage,
        comment: stageComment || `Moved to ${targetStage}`,
        reason: targetStage === 'Rejected' ? rejectionReason : stageComment,
        rejectionReason: targetStage === 'Rejected' ? rejectionReason : undefined,
        adminOverride: isAdminOverride,
        adminOverrideReason: isAdminOverride ? adminOverrideReason : undefined,
        interviewDate: targetStage === 'Interview' ? interviewDate : undefined,
        interviewType: targetStage === 'Interview' ? interviewType : undefined,
      });

      setApplications(
        applications.map((a) => (a.id === stageModalApp.id ? res.application : a))
      );
      setStageModalApp(null);
      setFeedback(`Application moved to ${targetStage} successfully!`);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setTransitionError(err.message || 'Failed to update application status.');
    } finally {
      setUpdatingStage(false);
    }
  };

  const viewHistoryModal = async (app: Application) => {
    setHistoryApp(app);
    setLoadingHistory(true);
    try {
      const res = await api.getApplicationHistory(app.id);
      setHistoryRecords(res.history || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  if (loading) return <Loading message="Loading applicant management board..." />;

  // Filter applications by search and date
  const filteredApps = applications.filter((app) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = app.candidateName.toLowerCase().includes(q);
      const matchEmail = app.candidateEmail.toLowerCase().includes(q);
      const matchJob = app.jobTitle.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchJob) return false;
    }

    if (dateFilter !== 'all') {
      const appDate = new Date(app.createdAt).getTime();
      const now = Date.now();
      if (dateFilter === '7d' && now - appDate > 7 * 86400000) return false;
      if (dateFilter === '30d' && now - appDate > 30 * 86400000) return false;
    }

    return true;
  });

  const stages: ApplicationStage[] = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-semibold mb-1 border border-indigo-200">
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            <span>{user?.companyName || 'CloudScale Technologies'} • Applicant Tracking System</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Application Lifecycle Management
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Track candidates through screening, interviews, offers, and hiring with controlled status transitions and audit history.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="inline-flex p-1 bg-white border border-slate-200 rounded-lg shadow-2xs self-start md:self-center">
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'table'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Table View</span>
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'kanban'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Pipeline Board</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate name, email, or job..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Job Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 font-medium">Job:</span>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 max-w-[200px] truncate"
          >
            <option value="all">All Jobs ({jobs.length})</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </div>

        {/* Stage Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 font-medium">Stage:</span>
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Stages</option>
            {stages.map((stg) => (
              <option key={stg} value={stg}>
                {stg}
              </option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 font-medium">Date:</span>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Time</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [sb, so] = e.target.value.split('-');
              setSortBy(sb as any);
              setSortOrder(so as any);
            }}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="status-asc">Status (A-Z)</option>
            <option value="matchScore-desc">AI Match Score</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'table' ? (
        /* TABLE VIEW (Requirement 2.B) */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Candidate</th>
                  <th className="py-3 px-4">Job Title & Company</th>
                  <th className="py-3 px-4">Application Date</th>
                  <th className="py-3 px-4">AI Match</th>
                  <th className="py-3 px-4">Current Status</th>
                  <th className="py-3 px-4">Assigned Recruiter</th>
                  <th className="py-3 px-4">Last Updated</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredApps.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="font-medium">No candidate applications found.</p>
                    </td>
                  </tr>
                ) : (
                  filteredApps.map((app) => {
                    const stageColor = STAGE_COLORS[app.stage] || STAGE_COLORS.Applied;
                    const validNextTransitions = ALLOWED_TRANSITIONS[app.stage] || [];

                    return (
                      <tr key={app.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Candidate Name & Email */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
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
                            <div>
                              <Link
                                to={`/recruiter/applicants/${app.id}`}
                                className="font-semibold text-slate-900 hover:text-indigo-600 truncate block"
                              >
                                {app.candidateName}
                              </Link>
                              <div className="text-[11px] text-slate-400">{app.candidateEmail}</div>
                            </div>
                          </div>
                        </td>

                        {/* Job Title & Company */}
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800">{app.jobTitle}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Building className="w-3 h-3 text-slate-400" />
                            <span>{app.companyName}</span>
                          </div>
                        </td>

                        {/* Application Date */}
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {new Date(app.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>

                        {/* AI Match Score */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                              app.matchScore >= 80
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : app.matchScore >= 60
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            <Sparkles className="w-3 h-3" />
                            {app.matchScore}%
                          </span>
                        </td>

                        {/* Current Status Badge */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${stageColor.bg} ${stageColor.text} ${stageColor.border}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${stageColor.dot}`}></span>
                            {app.stage}
                          </span>
                        </td>

                        {/* Assigned Recruiter */}
                        <td className="py-3 px-4">
                          <span className="text-slate-700 font-medium flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                            {app.assignedRecruiterName || user?.name || 'Assigned Recruiter'}
                          </span>
                        </td>

                        {/* Last Updated */}
                        <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                          {new Date(app.updatedAt || app.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>

                        {/* Action Menu / Dropdown */}
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Controlled Status Progression Menu */}
                            {validNextTransitions.length > 0 ? (
                              <div className="relative group inline-block text-left">
                                <button className="px-2.5 py-1 text-xs font-semibold rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 flex items-center gap-1">
                                  <span>Advance</span>
                                  <ChevronRight className="w-3 h-3" />
                                </button>
                                <div className="hidden group-hover:block absolute right-0 z-20 mt-0 w-36 bg-white rounded-lg shadow-lg border border-slate-200 py-1 text-left">
                                  {validNextTransitions.map((nextStg) => (
                                    <button
                                      key={nextStg}
                                      onClick={() => openStatusModal(app, nextStg)}
                                      className={`w-full px-3 py-1.5 text-xs text-left hover:bg-slate-50 flex items-center justify-between ${
                                        nextStg === 'Rejected' ? 'text-rose-600 font-semibold' : 'text-slate-700'
                                      }`}
                                    >
                                      <span>Move to {nextStg}</span>
                                      <ArrowRight className="w-3 h-3 opacity-60" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Terminal</span>
                            )}

                            {/* Admin Correction Override */}
                            {isCompanyAdmin && (
                              <button
                                onClick={() => openStatusModal(app, app.stage, true)}
                                title="Admin Status Correction (Override)"
                                className="p-1.5 rounded-md hover:bg-amber-50 text-slate-400 hover:text-amber-600"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* View History Timeline Drawer */}
                            <button
                              onClick={() => viewHistoryModal(app)}
                              title="View Status Audit Timeline"
                              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>

                            {/* View Details Link */}
                            <Link
                              to={`/recruiter/applicants/${app.id}`}
                              title="View Application Details"
                              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-indigo-600"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* KANBAN BOARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          {stages.map((stg) => {
            const stageApps = filteredApps.filter((a) => a.stage === stg);
            const color = STAGE_COLORS[stg];

            return (
              <div
                key={stg}
                className="bg-slate-100/70 rounded-xl p-3 flex flex-col border border-slate-200/80 min-h-[500px]"
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${color.dot}`}></span>
                    <span className="text-xs font-bold text-slate-800">{stg}</span>
                  </div>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200 shadow-2xs">
                    {stageApps.length}
                  </span>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {stageApps.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">No candidates</div>
                  ) : (
                    stageApps.map((app) => {
                      const validTransitions = ALLOWED_TRANSITIONS[app.stage] || [];

                      return (
                        <div
                          key={app.id}
                          className="bg-white rounded-lg p-3 border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-bold text-xs text-slate-900 truncate">
                              <Link
                                to={`/recruiter/applicants/${app.id}`}
                                className="hover:text-indigo-600"
                              >
                                {app.candidateName}
                              </Link>
                            </div>
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100 shrink-0">
                              {app.matchScore}%
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-500 truncate">{app.jobTitle}</div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                            <button
                              onClick={() => viewHistoryModal(app)}
                              className="text-slate-400 hover:text-slate-600 flex items-center gap-1"
                            >
                              <History className="w-3 h-3" />
                              <span>History</span>
                            </button>

                            {validTransitions.length > 0 && (
                              <button
                                onClick={() => openStatusModal(app, validTransitions[0])}
                                className="text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-0.5"
                              >
                                <span>Advance</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Controlled Status Progression & Admin Correction Modal */}
      {stageModalApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  {isAdminOverride ? 'Administrative Status Correction' : 'Advance Application Status'}
                </h3>
              </div>
              <button
                onClick={() => setStageModalApp(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStageChangeSubmit} className="p-6 space-y-4">
              {/* Candidate Banner */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-900">{stageModalApp.candidateName}</div>
                  <div className="text-slate-500">{stageModalApp.jobTitle}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Current Status</div>
                  <div className="font-semibold text-slate-800">{stageModalApp.stage}</div>
                </div>
              </div>

              {transitionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>{transitionError}</span>
                </div>
              )}

              {/* Status Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Status <span className="text-rose-500">*</span>
                </label>
                {isAdminOverride ? (
                  <select
                    value={targetStage}
                    onChange={(e) => setTargetStage(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    {stages.map((stg) => (
                      <option key={stg} value={stg}>
                        {stg}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-100 text-xs font-bold text-indigo-900">
                    Moving to: {targetStage}
                  </div>
                )}
              </div>

              {/* Specific fields if moving to Interview */}
              {targetStage === 'Interview' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Interview Type
                    </label>
                    <select
                      value={interviewType}
                      onChange={(e) => setInterviewType(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="Technical Round">Technical Round</option>
                      <option value="Video Call">Video Call</option>
                      <option value="On-site">On-site</option>
                      <option value="HR Discussion">HR Discussion</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={interviewDate}
                      onChange={(e) => setInterviewDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Mandatory Rejection Reason */}
              {targetStage === 'Rejected' && (
                <div>
                  <label className="block text-xs font-semibold text-rose-700 mb-1">
                    Rejection Reason <span className="text-rose-500">* (Required)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="State reason for candidate rejection (e.g. Missing required production experience with Kubernetes, compensation mismatch, etc.)"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-rose-300 bg-rose-50/20 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                    required
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    This reason is recorded in the permanent audit trail.
                  </p>
                </div>
              )}

              {/* Mandatory Admin Override Reason */}
              {isAdminOverride && (
                <div>
                  <label className="block text-xs font-semibold text-amber-800 mb-1">
                    Administrative Override Reason <span className="text-rose-500">* (Required)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={adminOverrideReason}
                    onChange={(e) => setAdminOverrideReason(e.target.value)}
                    placeholder="Provide justification for manual status correction outside normal workflow..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-amber-300 bg-amber-50/20 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
              )}

              {/* Audit Comments / Notes */}
              {targetStage !== 'Rejected' && !isAdminOverride && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Audit Comment / Notes
                  </label>
                  <textarea
                    rows={2}
                    value={stageComment}
                    onChange={(e) => setStageComment(e.target.value)}
                    placeholder="Add optional notes recorded in the stage audit log..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStageModalApp(null)}
                  className="px-4 py-2 text-xs rounded-lg border border-slate-300 hover:bg-slate-50 font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingStage}
                  className={`saas-btn-primary px-4 py-2 text-xs text-white font-semibold rounded-lg shadow-xs ${
                    targetStage === 'Rejected'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {updatingStage ? 'Saving...' : 'Confirm Status Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Application Status History Timeline Modal (Requirement 2.C) */}
      {historyApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-2xl w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Application Audit Trail Timeline</h3>
                  <p className="text-xs text-slate-500">
                    Chronological progression for {historyApp.candidateName} • {historyApp.jobTitle}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHistoryApp(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {loadingHistory ? (
                <Loading message="Loading history records..." />
              ) : historyRecords.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No historical records logged yet.
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 border-l-2 border-slate-200">
                  {historyRecords.map((item, idx) => {
                    const stgColor = STAGE_COLORS[item.newStatus] || STAGE_COLORS.Applied;

                    return (
                      <div key={item.id || idx} className="relative group">
                        {/* Dot on line */}
                        <div
                          className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white ${stgColor.dot} shadow-xs`}
                        ></div>

                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-500">
                                {item.previousStatus && item.previousStatus !== 'None'
                                  ? `${item.previousStatus} → `
                                  : ''}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${stgColor.bg} ${stgColor.text} ${stgColor.border}`}
                              >
                                {item.newStatus}
                              </span>
                              {item.isAdminOverride && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200">
                                  ADMIN OVERRIDE
                                </span>
                              )}
                            </div>

                            <span className="text-[11px] text-slate-400 font-mono">
                              {new Date(item.timestamp).toLocaleString()}
                            </span>
                          </div>

                          <div className="text-xs text-slate-700">
                            <strong>Reason / Comments:</strong> {item.reason || item.comments || 'No comment provided.'}
                          </div>

                          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200 flex items-center justify-between">
                            <span>
                              Changed By: <strong>{item.changedByName || 'Recruiter'}</strong> (
                              <span className="font-mono">{item.changedBy}</span>)
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end shrink-0">
              <button
                onClick={() => setHistoryApp(null)}
                className="px-4 py-1.5 text-xs rounded-lg border border-slate-300 hover:bg-white text-slate-700 font-medium"
              >
                Close Timeline
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Match Details Modal */}
      {inspectingApp && (
        <MatchDetailsModal
          isOpen={!!inspectingApp}
          onClose={() => setInspectingApp(null)}
          candidateName={inspectingApp.candidateName}
          candidateTitle={inspectingApp.candidateTitle}
          jobTitle={inspectingApp.jobTitle}
          matchScore={inspectingApp.matchScore || 0}
          matchCategory={inspectingApp.matchDetails?.category}
          matchDetails={inspectingApp.matchDetails}
        />
      )}

      {/* Candidate Skills vs Job Requirements Comparison Modal */}
      {skillModalTarget && (
        <SkillMatchModal
          isOpen={skillModalTarget.isOpen}
          onClose={() => setSkillModalTarget(null)}
          jobId={skillModalTarget.jobId}
          candidateId={skillModalTarget.candidateId}
          candidateName={skillModalTarget.candidateName}
          jobTitle={skillModalTarget.jobTitle}
        />
      )}
    </div>
  );
};
