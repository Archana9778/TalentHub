import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  Layers,
  FileText,
  Calendar,
  CheckCircle2,
  XCircle,
  Building,
  User,
  Clock,
  Phone,
  Mail,
  MapPin,
  Save,
  History,
  AlertTriangle,
  ArrowRight,
  Shield,
  UserCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { SkillMatchModal } from '../../components/SkillMatchModal';
import { MatchDetailsModal } from '../../components/MatchDetailsModal';
import { Application, User as UserType, Job, ApplicationStage, ApplicationStatusHistory } from '../../types';
import { Loading } from '../../components/Loading';

const ALLOWED_TRANSITIONS: Record<ApplicationStage, ApplicationStage[]> = {
  Applied: ['Screening'],
  Screening: ['Interview', 'Rejected'],
  Interview: ['Offer', 'Rejected'],
  Offer: ['Hired', 'Rejected'],
  Hired: [],
  Rejected: [],
};

const STAGES_ORDER: ApplicationStage[] = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];

const STAGE_COLORS: Record<ApplicationStage, { bg: string; text: string; border: string; dot: string }> = {
  Applied: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' },
  Screening: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  Interview: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  Offer: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  Hired: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  Rejected: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
};

export const ApplicantDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [application, setApplication] = useState<Application | null>(null);
  const [candidate, setCandidate] = useState<UserType | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [auditRecords, setAuditRecords] = useState<ApplicationStatusHistory[]>([]);
  const [loading, setLoading] = useState(true);

  // Recruiter notes
  const [recruiterNotes, setRecruiterNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSuccess, setNotesSuccess] = useState(false);

  // Status transition modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [targetStage, setTargetStage] = useState<ApplicationStage>('Screening');
  const [stageComment, setStageComment] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isAdminOverride, setIsAdminOverride] = useState(false);
  const [adminOverrideReason, setAdminOverrideReason] = useState('');
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewType, setInterviewType] = useState('Technical Round');
  const [updatingStage, setUpdatingStage] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);
  const [stageSuccess, setStageSuccess] = useState<string | null>(null);

  const isCompanyAdmin =
    user?.role === 'admin' ||
    user?.companyRole === 'admin' ||
    !user?.companyRole;

  const fetchData = async () => {
    if (!id) return;
    try {
      const data = await api.getApplicationById(id);
      setApplication(data.application);
      setCandidate(data.candidate);
      setJob(data.job);
      setRecruiterNotes(data.application.recruiterNotes || '');
      const historyRes = await api.getApplicationHistory(id).catch(() => null);
      if (historyRes?.history && historyRes.history.length > 0) {
        setAuditRecords(historyRes.history);
      } else if (data.history) {
        setAuditRecords(data.history as any);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleSaveNotes = async () => {
    if (!application) return;
    setSavingNotes(true);
    try {
      const res = await api.updateApplicationStatus(application.id, {
        status: application.stage,
        recruiterNotes,
      });
      setApplication(res.application);
      setNotesSuccess(true);
      setTimeout(() => setNotesSuccess(false), 2500);
    } catch (err: any) {
      alert(err.message || 'Failed to save notes.');
    } finally {
      setSavingNotes(false);
    }
  };

  const openTransitionModal = (newStage: ApplicationStage, override: boolean = false) => {
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
    setStageError(null);
    setShowStatusModal(true);
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!application) return;

    if (targetStage === 'Rejected' && !rejectionReason.trim()) {
      setStageError('A rejection reason is required when moving an application to Rejected.');
      return;
    }

    if (isAdminOverride && !adminOverrideReason.trim()) {
      setStageError('Administrative status corrections require a recorded reason.');
      return;
    }

    setUpdatingStage(true);
    setStageError(null);

    try {
      const res = await api.updateApplicationStatus(application.id, {
        status: targetStage,
        comment: stageComment || `Moved to ${targetStage}`,
        reason: targetStage === 'Rejected' ? rejectionReason : stageComment,
        rejectionReason: targetStage === 'Rejected' ? rejectionReason : undefined,
        adminOverride: isAdminOverride,
        adminOverrideReason: isAdminOverride ? adminOverrideReason : undefined,
        interviewDate: targetStage === 'Interview' ? interviewDate : undefined,
        interviewType: targetStage === 'Interview' ? interviewType : undefined,
      });

      setApplication(res.application);
      setShowStatusModal(false);
      setStageSuccess(`Application status successfully moved to ${targetStage}!`);
      setTimeout(() => setStageSuccess(null), 3000);

      // Refresh history
      const historyRes = await api.getApplicationHistory(application.id);
      setAuditRecords(historyRes.history);
    } catch (err: any) {
      setStageError(err.message || 'Failed to update status.');
    } finally {
      setUpdatingStage(false);
    }
  };

  if (loading) return <Loading message="Loading candidate application review..." />;
  if (!application) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Application not found or you do not have permission to view it.</p>
        <Link to="/recruiter/applicants" className="mt-3 text-indigo-600 hover:underline inline-block text-xs">
          Return to Applicant Board
        </Link>
      </div>
    );
  }

  const validTransitions = ALLOWED_TRANSITIONS[application.stage] || [];
  const stageColor = STAGE_COLORS[application.stage] || STAGE_COLORS.Applied;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/recruiter/applicants"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Applicant Board</span>
        </Link>

        <div className="flex items-center gap-2">
          {validTransitions.map((nextStg) => (
            <button
              key={nextStg}
              onClick={() => openTransitionModal(nextStg)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors ${
                nextStg === 'Rejected'
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              <span>Move to {nextStg}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          ))}

          {isCompanyAdmin && (
            <button
              onClick={() => openTransitionModal(application.stage, true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Admin Override</span>
            </button>
          )}
        </div>
      </div>

      {stageSuccess && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{stageSuccess}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <img
              src={
                application.candidateAvatar ||
                candidate?.avatarUrl ||
                `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                  application.candidateName
                )}`
              }
              alt={application.candidateName}
              className="w-16 h-16 rounded-full border-2 border-indigo-100 object-cover shrink-0"
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-slate-900">{application.candidateName}</h1>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${stageColor.bg} ${stageColor.text} ${stageColor.border}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${stageColor.dot}`}></span>
                  {application.stage}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Applied for <strong>{application.jobTitle}</strong> at {application.companyName}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {application.candidateEmail}
                </span>
                {application.candidatePhone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {application.candidatePhone}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Applied on {new Date(application.createdAt).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1 font-semibold text-slate-700">
                  <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                  Assigned: {application.assignedRecruiterName || user?.name || 'Recruiter'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 text-white text-center md:w-48 shrink-0">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Azure AI Match Score
            </div>
            <div className="mt-1 text-3xl font-extrabold text-indigo-400">
              {application.matchScore}%
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Automated document rating</div>
          </div>
        </div>

        {/* Visual Lifecycle Progress Stepper (Requirement 2.A) */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Application Lifecycle Progression
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {STAGES_ORDER.map((stg, idx) => {
              const currentIdx = STAGES_ORDER.indexOf(application.stage);
              const isPassed = currentIdx >= idx;
              const isCurrent = application.stage === stg;
              const isRejected = application.stage === 'Rejected';

              return (
                <div
                  key={stg}
                  className={`p-2.5 rounded-lg border text-center transition-all ${
                    isCurrent
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : isPassed && !isRejected
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-slate-50 text-slate-400 border-slate-200'
                  }`}
                >
                  <div className="text-[10px] uppercase font-bold tracking-wider">Step {idx + 1}</div>
                  <div className="text-xs font-semibold mt-0.5">{stg}</div>
                </div>
              );
            })}
          </div>
          {application.stage === 'Rejected' && (
            <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                <strong>Application Rejected:</strong> Candidate was not selected for this position.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Grid: Left Column Candidate Details / Right Column Audit History & Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols on LG): Candidate Profile & Match breakdown */}
        <div className="lg:col-span-2 space-y-6">
          {/* Unified AI Match Breakdown */}
          {application.matchDetails && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>AI Skill & Experience Breakdown</span>
                </h3>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                  {application.matchScore ?? application.matchDetails.score ?? 0}% Overall Fit
                </span>
              </div>

              {application.matchDetails.analysisNotes && (
                <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 text-xs text-indigo-900 leading-relaxed">
                  <strong>AI Analysis:</strong> {application.matchDetails.analysisNotes}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-slate-500 font-medium">Skill Alignment Score</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    {application.matchDetails.skillScore ?? 0}%
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-slate-500 font-medium">Experience Score</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    {application.matchDetails.experienceScore ?? 0}%
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="font-semibold text-slate-700 mb-1.5">Matched Technical Skills</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(application.matchDetails.matchedSkills || []).map((sk) => (
                      <span
                        key={sk}
                        className="px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
                      >
                        ✓ {sk}
                      </span>
                    ))}
                    {(!application.matchDetails.matchedSkills || application.matchDetails.matchedSkills.length === 0) && (
                      <span className="text-slate-400 italic text-[11px]">No direct skill matches recorded.</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-slate-700 mb-1.5">Missing Technical Skills</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(application.matchDetails.missingSkills || []).map((sk) => (
                      <span
                        key={sk}
                        className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200 line-through"
                      >
                        {sk}
                      </span>
                    ))}
                    {(!application.matchDetails.missingSkills || application.matchDetails.missingSkills.length === 0) && (
                      <span className="text-emerald-700 italic text-[11px]">No missing skills detected!</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cover Letter */}
          {application.coverLetter && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>Cover Letter / Candidate Statement</span>
              </h3>
              <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-200">
                {application.coverLetter}
              </p>
            </div>
          )}

          {/* Candidate Experience & Education */}
          {candidate && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" />
                <span>Candidate Profile & Experience</span>
              </h3>

              {candidate.bio && (
                <p className="text-xs text-slate-600 leading-relaxed">{candidate.bio}</p>
              )}

              {candidate.experience && candidate.experience.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                    Work Experience
                  </div>
                  {candidate.experience.map((exp, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                      <div className="font-bold text-slate-900">{exp.title}</div>
                      <div className="text-slate-500">
                        {exp.company} • {exp.period}
                      </div>
                      <p className="mt-1 text-slate-600 leading-relaxed">{exp.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Audit History Timeline & Recruiter Notes */}
        <div className="space-y-6">
          {/* Recruiter Notes Box */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Private Recruiter Notes</h3>
              {notesSuccess && (
                <span className="text-[11px] text-emerald-600 font-semibold">Saved!</span>
              )}
            </div>
            <textarea
              rows={4}
              value={recruiterNotes}
              onChange={(e) => setRecruiterNotes(e.target.value)}
              placeholder="Record interviewer remarks, salary expectations, interview feedback..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="w-full saas-btn-primary py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingNotes ? 'Saving Notes...' : 'Save Notes'}</span>
            </button>
          </div>

          {/* Application Status History / Audit Trail (Requirement 2.C) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                <span>Application Status Audit Trail</span>
              </h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {auditRecords.length}
              </span>
            </div>

            <div className="relative pl-5 space-y-5 border-l-2 border-slate-200">
              {auditRecords.map((item, idx) => {
                const itemStgColor =
                  STAGE_COLORS[item.newStatus] || STAGE_COLORS.Applied;

                return (
                  <div key={item.id || idx} className="relative">
                    <div
                      className={`absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white ${itemStgColor.dot} shadow-2xs`}
                    ></div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-800">
                          {item.newStatus}
                        </span>
                        {item.previousStatus && item.previousStatus !== 'None' && (
                          <span className="text-[11px] text-slate-400">
                            (from {item.previousStatus})
                          </span>
                        )}
                        {item.isAdminOverride && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            ADMIN OVERRIDE
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400">
                        {new Date(item.timestamp).toLocaleString()}
                      </div>

                      <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                        {item.reason || item.comments || 'Status updated.'}
                      </div>

                      <div className="text-[10px] text-slate-400 pt-0.5">
                        By: <span className="font-semibold text-slate-600">{item.changedByName || 'Recruiter'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Controlled Status Progression Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  {isAdminOverride ? 'Administrative Status Correction' : `Advance to ${targetStage}`}
                </h3>
              </div>
              <button
                onClick={() => setShowStatusModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStatusSubmit} className="p-6 space-y-4">
              {stageError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>{stageError}</span>
                </div>
              )}

              {isAdminOverride && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select New Status
                  </label>
                  <select
                    value={targetStage}
                    onChange={(e) => setTargetStage(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    {STAGES_ORDER.concat(['Rejected']).map((stg) => (
                      <option key={stg} value={stg}>
                        {stg}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {targetStage === 'Interview' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Round Type
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

              {targetStage === 'Rejected' && (
                <div>
                  <label className="block text-xs font-semibold text-rose-700 mb-1">
                    Rejection Reason <span className="text-rose-500">* (Mandatory)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Provide specific feedback or reason for candidate rejection..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-rose-300 bg-rose-50/20 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                    required
                  />
                </div>
              )}

              {isAdminOverride && (
                <div>
                  <label className="block text-xs font-semibold text-amber-800 mb-1">
                    Override Justification <span className="text-rose-500">* (Mandatory)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={adminOverrideReason}
                    onChange={(e) => setAdminOverrideReason(e.target.value)}
                    placeholder="State reason for manual out-of-flow correction..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-amber-300 bg-amber-50/20 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
              )}

              {targetStage !== 'Rejected' && !isAdminOverride && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Audit Notes / Comments
                  </label>
                  <textarea
                    rows={2}
                    value={stageComment}
                    onChange={(e) => setStageComment(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
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
                  {updatingStage ? 'Saving...' : 'Confirm Status Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
