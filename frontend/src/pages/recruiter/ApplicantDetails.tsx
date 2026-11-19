import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
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
  ShieldCheck,
  UserCheck,
  X,
  Layers,
  Edit3,
  Award,
  GraduationCap,
  Briefcase,
  Check,
  Loader2,
  Download,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { MatchDetailsModal } from '../../components/MatchDetailsModal';
import { SkillMatchModal } from '../../components/SkillMatchModal';
import {
  Application,
  User as UserType,
  Job,
  ApplicationStage,
  ApplicationStatusHistory,
  CandidateExtractionResponse,
  ExtractedCandidateProfile,
} from '../../types';
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

  // Modals & Resume
  const [loadingResume, setLoadingResume] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [skillModalOpen, setSkillModalOpen] = useState(false);

  // Azure AI Document Intelligence Extraction State
  const [extraction, setExtraction] = useState<CandidateExtractionResponse | null>(null);
  const [loadingExtraction, setLoadingExtraction] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<ExtractedCandidateProfile | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [showConfirmOverwriteModal, setShowConfirmOverwriteModal] = useState(false);

  const handleAccessResume = async (action: 'view' | 'download' = 'view') => {
    if (!application?.candidateId) return;
    setResumeError(null);
    try {
      setLoadingResume(true);
      // Generate a fresh short-lived SAS URL on demand
      const res = await api.getResumeDownloadUrl(application.candidateId);
      if (res.downloadUrl) {
        if (action === 'download') {
          const link = document.createElement('a');
          link.href = res.downloadUrl;
          link.download = res.filename || res.originalName || 'Candidate_Resume.pdf';
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
        }
      } else {
        setResumeError('No download URL returned by server.');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || 'Unable to load candidate resume.';
      setResumeError(msg);
    } finally {
      setLoadingResume(false);
    }
  };

  const isCompanyAdmin =
    user?.role === 'admin' ||
    user?.companyRole === 'admin' ||
    !user?.companyRole;

  const fetchExtraction = async (cId: string) => {
    try {
      setLoadingExtraction(true);
      setExtractionError(null);
      const ext = await api.getCandidateExtractedResume(cId);
      setExtraction(ext);
    } catch (err: any) {
      console.warn('Could not fetch candidate extraction:', err);
      setExtractionError(err.message || 'Failed to retrieve Azure AI resume extraction.');
    } finally {
      setLoadingExtraction(false);
    }
  };

  const fetchData = async () => {
    if (!id) return;
    try {
      const data = await api.getApplicationById(id);
      setApplication(data.application);
      setCandidate(data.candidate);
      setJob(data.job);
      setRecruiterNotes(data.application.recruiterNotes || '');
      if (data.application.candidateId) {
        fetchExtraction(data.application.candidateId);
      }
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

  const handleOpenEditModal = () => {
    if (!extraction?.extractedData) return;
    setEditForm(JSON.parse(JSON.stringify(extraction.extractedData)));
    setShowEditModal(true);
  };

  const handleSaveExtractedEdit = async () => {
    if (!application?.candidateId || !editForm) return;
    try {
      setSavingEdit(true);
      await api.updateCandidateExtractedResume(application.candidateId, editForm);
      setExtraction((prev) => (prev ? { ...prev, extractedData: editForm } : null));
      setShowEditModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save updated candidate details.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleVerifyExtraction = async (confirmOverwrite: boolean = false) => {
    if (!application?.candidateId || !extraction?.extractedData) return;
    try {
      setVerifying(true);
      setVerifyError(null);
      const res = await api.verifyCandidateResumeData(
        application.candidateId,
        extraction.extractedData,
        true,
        confirmOverwrite
      );
      setExtraction((prev) =>
        prev
          ? {
              ...prev,
              isVerified: true,
              verifiedByName: res.verifiedByName || user?.name || 'Recruiter',
              verifiedAt: res.verifiedAt,
            }
          : null
      );
      setVerifySuccess('Candidate information successfully verified and applied to profile.');
      setShowConfirmOverwriteModal(false);
      setTimeout(() => setVerifySuccess(null), 5000);
      fetchData();
    } catch (err: any) {
      if (err.response?.status === 409 || err.message?.includes('confirm')) {
        setShowConfirmOverwriteModal(true);
      } else {
        setVerifyError(err.message || 'Verification failed.');
      }
    } finally {
      setVerifying(false);
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

  const getCategoryStyle = (score: number) => {
    if (score >= 80) return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', bar: 'bg-emerald-500', label: 'Excellent Match' };
    if (score >= 60) return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', bar: 'bg-blue-500', label: 'Good Match' };
    if (score >= 40) return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', bar: 'bg-amber-500', label: 'Moderate Match' };
    return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', bar: 'bg-rose-500', label: 'Low Match' };
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
  const catStyle = getCategoryStyle(application.matchScore || application.matchDetails?.score || 0);

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
              {(candidate?.title || application.candidateTitle) && (
                <p className="text-xs font-semibold text-indigo-700">
                  {candidate?.title || application.candidateTitle}
                  {candidate?.location && <span className="text-slate-400 font-normal"> &bull; {candidate.location}</span>}
                </p>
              )}
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

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setMatchModalOpen(true)}
              className={`p-3.5 ${catStyle.bg} border ${catStyle.border} rounded-2xl text-center shrink-0 hover:shadow-md transition-all group cursor-pointer text-left`}
              title="Click to view detailed scoring breakdown"
            >
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-black ${catStyle.text}`}>{application.matchScore}%</span>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${catStyle.bg} ${catStyle.text} border ${catStyle.border}`}>
                  {application.matchDetails?.category || catStyle.label}
                </span>
              </div>
              <div className="w-full bg-slate-200/70 h-1.5 rounded-full overflow-hidden mt-1.5">
                <div
                  className={`h-full ${catStyle.bar} rounded-full transition-all`}
                  style={{ width: `${application.matchScore}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500 font-medium mt-1 flex items-center justify-between gap-2">
                <span>Azure AI Match</span>
                <span className="text-purple-600 font-bold group-hover:underline">Details →</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSkillModalOpen(true)}
              className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
              title="Compare skills with job requisition"
            >
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Skill Matrix</span>
            </button>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAccessResume('view')}
                  disabled={loadingResume}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                  title="Generate a temporary secure link to preview this resume"
                >
                  {loadingResume ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  <span>{loadingResume ? 'Securing Link...' : 'View Resume'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAccessResume('download')}
                  disabled={loadingResume}
                  className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-200 transition-colors cursor-pointer"
                  title="Download resume using a temporary read-only link"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </button>
              </div>
              <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Temporary read-only link
              </span>
            </div>
          </div>
        </div>

        {resumeError && (
          <div className="mt-4 bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{resumeError}</span>
            </div>
            <button
              onClick={() => setResumeError(null)}
              className="text-rose-600 hover:text-rose-800 font-bold text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

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
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSkillModalOpen(true)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>View Matrix Details</span>
                  </button>
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                    {application.matchScore ?? application.matchDetails.score ?? 0}% Overall Fit
                  </span>
                </div>
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

          {/* Azure AI Document Intelligence Extraction Section */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-600">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-900">Azure AI Resume Extraction</h3>
                    {/* Extraction Status Badge */}
                    {loadingExtraction ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Processing...
                      </span>
                    ) : extraction?.status === 'completed' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Check className="w-3 h-3 text-emerald-600" />
                        Extraction Completed
                      </span>
                    ) : extraction?.status === 'processing' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        AI Parsing Active
                      </span>
                    ) : extraction?.status === 'failed' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        Extraction Failed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        Pending Extraction
                      </span>
                    )}

                    {/* Verification Badge */}
                    {extraction?.isVerified ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Recruiter Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                        AI Extracted • Unverified
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Extracted via Azure AI Document Intelligence (<code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded">prebuilt-layout</code>)
                    {extraction?.verifiedByName && (
                      <span className="ml-1 text-slate-600 font-medium">
                        • Verified by {extraction.verifiedByName} on {new Date(extraction.verifiedAt || '').toLocaleDateString()}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenEditModal}
                  disabled={!extraction?.extractedData}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 shadow-2xs transition-colors disabled:opacity-50"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Edit Extracted Info</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleVerifyExtraction(false)}
                  disabled={verifying || !extraction?.extractedData}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                >
                  {verifying ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>{extraction?.isVerified ? 'Re-Verify Profile' : 'Verify & Apply'}</span>
                </button>
              </div>
            </div>

            {/* Verification Success / Error Messages */}
            {verifySuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{verifySuccess}</span>
              </div>
            )}
            {verifyError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{verifyError}</span>
              </div>
            )}

            {/* Extraction Failure Alert */}
            {extraction?.status === 'failed' && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Azure AI Document Intelligence Extraction Could Not Complete</span>
                </div>
                <p className="text-xs text-rose-700 leading-relaxed pl-6">
                  {extraction.error || 'The document layout analysis service encountered an error processing this resume file.'}
                </p>
                <p className="text-[11px] text-rose-600 pl-6 mt-1">
                  Tip: You can use "Edit Extracted Info" above to manually enter details, or ask the candidate to re-upload an uncorrupted PDF or DOCX file.
                </p>
              </div>
            )}

            {/* Extracted Details Display */}
            {extraction?.extractedData ? (
              <div className="space-y-4 pt-1">
                {/* Contact & Location Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Candidate Name</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{extraction.extractedData.fullName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Email Address</span>
                    <p className="font-semibold text-slate-900 mt-0.5 truncate">{extraction.extractedData.email || '—'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Phone Number</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{extraction.extractedData.phone || '—'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Location</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{extraction.extractedData.location || '—'}</p>
                  </div>
                </div>

                {/* Professional Summary */}
                {extraction.extractedData.summary && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-700">Professional Summary</span>
                    <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/60 p-3 rounded-lg border border-slate-200">
                      {extraction.extractedData.summary}
                    </p>
                  </div>
                )}

                {/* Technical & Professional Skills */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Extracted Skills ({extraction.extractedData.skills?.length || 0})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(extraction.extractedData.skills || []).map((sk, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200"
                      >
                        {sk}
                      </span>
                    ))}
                    {(!extraction.extractedData.skills || extraction.extractedData.skills.length === 0) && (
                      <span className="text-slate-400 italic text-xs">No skills identified in document layout.</span>
                    )}
                  </div>
                </div>

                {/* Work Experience */}
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                    <span>Work Experience ({extraction.extractedData.experience?.length || 0})</span>
                  </span>
                  <div className="space-y-2.5">
                    {(extraction.extractedData.experience || []).map((exp, idx) => (
                      <div key={idx} className="p-3 bg-slate-50/80 rounded-lg border border-slate-200 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{exp.title}</span>
                          <span className="text-slate-500 text-[11px] font-medium">{exp.duration}</span>
                        </div>
                        <div className="text-slate-600 font-medium text-[11px]">{exp.company}</div>
                        {exp.description && (
                          <p className="text-slate-600 text-xs leading-relaxed pt-0.5">{exp.description}</p>
                        )}
                      </div>
                    ))}
                    {(!extraction.extractedData.experience || extraction.extractedData.experience.length === 0) && (
                      <p className="text-slate-400 italic text-xs">No experience items detected.</p>
                    )}
                  </div>
                </div>

                {/* Education & Certifications Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Education */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                      <span>Education ({extraction.extractedData.education?.length || 0})</span>
                    </span>
                    <div className="space-y-2">
                      {(extraction.extractedData.education || []).map((edu, idx) => (
                        <div key={idx} className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-200 text-xs space-y-0.5">
                          <div className="font-bold text-slate-900">{edu.degree}</div>
                          <div className="text-slate-500 text-[11px] flex justify-between">
                            <span>{edu.institution}</span>
                            <span>{edu.year}</span>
                          </div>
                        </div>
                      ))}
                      {(!extraction.extractedData.education || extraction.extractedData.education.length === 0) && (
                        <p className="text-slate-400 italic text-xs">No education records found.</p>
                      )}
                    </div>
                  </div>

                  {/* Certifications */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-slate-500" />
                      <span>Certifications ({extraction.extractedData.certifications?.length || 0})</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(extraction.extractedData.certifications || []).map((cert, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1"
                        >
                          <Award className="w-3 h-3 text-amber-600" />
                          <span>{cert}</span>
                        </span>
                      ))}
                      {(!extraction.extractedData.certifications || extraction.extractedData.certifications.length === 0) && (
                        <p className="text-slate-400 italic text-xs">No certifications listed.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs">
                {loadingExtraction ? 'Analyzing candidate resume with Azure AI Document Intelligence...' : 'No extraction records available for this candidate.'}
              </div>
            )}
          </div>

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

          {/* Candidate Profile & Personal Information */}
          {candidate && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-600" />
                  <span>Candidate Personal &amp; Professional Details</span>
                </h3>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">
                  Read Only
                </span>
              </div>

              {/* Personal Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Full Name
                  </div>
                  <div className="font-semibold text-slate-800">{candidate.name || application.candidateName}</div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Email Address
                  </div>
                  <div className="font-semibold text-slate-800 truncate">{candidate.email || application.candidateEmail}</div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Phone Number
                  </div>
                  <div className="font-semibold text-slate-800">{candidate.phone || application.candidatePhone || 'Not provided'}</div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Date of Birth
                  </div>
                  <div className="font-semibold text-slate-800">{candidate.dateOfBirth || 'Not provided'}</div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Gender
                  </div>
                  <div className="font-semibold text-slate-800">{candidate.gender || 'Not provided'}</div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Professional Headline
                  </div>
                  <div className="font-semibold text-slate-800">{candidate.title || application.candidateTitle || 'Not provided'}</div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 sm:col-span-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Current Location
                  </div>
                  <div className="font-semibold text-slate-800">{candidate.location || 'Not provided'}</div>
                </div>
              </div>

              {candidate.bio && (
                <div className="pt-2">
                  <div className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-1">
                    Professional Summary / About Me
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200 whitespace-pre-line">
                    {candidate.bio}
                  </p>
                </div>
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
                        {exp.company} &bull; {exp.period}
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

      {/* Match Details Modal */}
      {application && application.matchDetails && (
        <MatchDetailsModal
          isOpen={matchModalOpen}
          onClose={() => setMatchModalOpen(false)}
          candidateName={application.candidateName}
          candidateTitle={application.candidateTitle}
          jobTitle={application.jobTitle}
          matchScore={application.matchScore}
          matchCategory={application.matchDetails.category}
          matchDetails={application.matchDetails}
        />
      )}

      {/* Candidate Skills vs Job Requirements Comparison Modal */}
      {application && (
        <SkillMatchModal
          isOpen={skillModalOpen}
          onClose={() => setSkillModalOpen(false)}
          jobId={application.jobId}
          candidateId={application.candidateId}
          candidateName={application.candidateName}
          jobTitle={application.jobTitle}
        />
      )}

      {/* Recruiter Edit Extracted Resume Modal */}
      {showEditModal && editForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Edit Extracted Candidate Information</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveExtractedEdit();
              }}
              className="space-y-4 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={editForm.fullName}
                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Professional Summary</label>
                <textarea
                  rows={3}
                  value={editForm.summary}
                  onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Skills (comma-separated)</label>
                <input
                  type="text"
                  value={editForm.skills?.join(', ') || ''}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      skills: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  placeholder="React, TypeScript, Node.js..."
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Certifications (comma-separated)</label>
                <input
                  type="text"
                  value={editForm.certifications?.join(', ') || ''}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      certifications: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  placeholder="AWS Solutions Architect, PMP..."
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs flex items-center gap-1.5"
                >
                  {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{savingEdit ? 'Saving Changes...' : 'Save Extracted Details'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal to Prevent Overwriting Verified Profiles */}
      {showConfirmOverwriteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">Confirm Overwrite of Verified Profile</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  This candidate’s profile information has already been manually reviewed and verified by a recruiter. Are you sure you want to overwrite their verified profile details with these extracted fields?
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmOverwriteModal(false)}
                className="px-4 py-2 text-xs rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleVerifyExtraction(true)}
                className="px-4 py-2 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-xs"
              >
                Confirm & Overwrite Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};