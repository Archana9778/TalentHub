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
  ExternalLink,
  Globe,
  Github,
  Linkedin,
  RefreshCw,
  FolderGit2,
  Plus,
  Trash2,
  Eye,
  BookOpen,
  Wrench,
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
  ExtractedEducationItem,
  ExtractedExperienceItem,
  CategorizedSkills,
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
  const [retryingExtraction, setRetryingExtraction] = useState(false);
  const [showRawText, setShowRawText] = useState(false);

  // ─── AI Extracted Resume Information: Enhanced Tabs & State ───
  const [extractedTab, setExtractedTab] = useState<'skills' | 'education' | 'experience'>('skills');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [newSkillInput, setNewSkillInput] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState<'technical' | 'softSkills'>('technical');

  // Education Modal State
  const [showEduModal, setShowEduModal] = useState(false);
  const [editingEduIndex, setEditingEduIndex] = useState<number | null>(null);
  const [eduFormData, setEduFormData] = useState<ExtractedEducationItem>({
    degree: '',
    institution: '',
    fieldOfStudy: '',
    year: '',
    status: 'Completed',
  });

  // Experience Modal State
  const [showExpModal, setShowExpModal] = useState(false);
  const [editingExpIndex, setEditingExpIndex] = useState<number | null>(null);
  const [expFormData, setExpFormData] = useState<ExtractedExperienceItem>({
    company: '',
    title: '',
    duration: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    description: '',
    responsibilities: [],
    technologies: [],
    achievements: [],
  });

  // Resume Side-by-Side Reviewer State
  const [showResumeViewer, setShowResumeViewer] = useState(false);
  const [resumeViewerUrl, setResumeViewerUrl] = useState<string | null>(null);
  const [loadingResumeViewer, setLoadingResumeViewer] = useState(false);
  const [showAuditComparison, setShowAuditComparison] = useState(false);

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

  const handleRetryExtraction = async () => {
    if (!application?.candidateId) return;
    try {
      setRetryingExtraction(true);
      setExtractionError(null);
      const res = await api.retryResumeExtraction(application.candidateId);
      setExtraction((prev) =>
        prev
          ? {
              ...prev,
              status: res.status,
              extractedData: res.extractedData || prev.extractedData,
              error: res.error,
            }
          : {
              candidateId: application.candidateId,
              resumeId: '',
              filename: '',
              status: res.status,
              isVerified: false,
              extractedData: (res.extractedData || {}) as ExtractedCandidateProfile,
              error: res.error,
            }
      );
      setVerifySuccess('Resume re-extraction initiated successfully.');
      setTimeout(() => setVerifySuccess(null), 4000);
    } catch (err: any) {
      setExtractionError(err?.response?.data?.message || err.message || 'Retry failed.');
    } finally {
      setRetryingExtraction(false);
    }
  };

  const handleToggleResumeViewer = async () => {
    if (showResumeViewer) {
      setShowResumeViewer(false);
      return;
    }
    if (!application?.candidateId) return;
    try {
      setLoadingResumeViewer(true);
      const res = await api.getResumeDownloadUrl(application.candidateId);
      if (res.downloadUrl) {
        setResumeViewerUrl(res.downloadUrl);
        setShowResumeViewer(true);
      } else {
        alert('Could not generate document preview URL.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to load resume for review.');
    } finally {
      setLoadingResumeViewer(false);
    }
  };

  const handleAddSkill = () => {
    if (!extraction?.extractedData || !newSkillInput.trim()) return;
    const trimmed = newSkillInput.trim();
    const updated = { ...extraction.extractedData };
    const currentSkills = updated.skills || [];

    // Avoid duplicate skills case-insensitively
    if (currentSkills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setNewSkillInput('');
      return;
    }

    updated.skills = [...currentSkills, trimmed];

    if (!updated.categorizedSkills) {
      updated.categorizedSkills = {
        programmingLanguages: [],
        frameworks: [],
        cloudPlatforms: [],
        devOpsTools: [],
        databases: [],
        networking: [],
        tools: [],
        softSkills: [],
        other: [],
      };
    }

    if (newSkillCategory === 'softSkills') {
      updated.softSkills = [...(updated.softSkills || []), trimmed];
      if (!updated.categorizedSkills.softSkills) updated.categorizedSkills.softSkills = [];
      updated.categorizedSkills.softSkills.push(trimmed);
    } else {
      updated.categorizedSkills.other = [...(updated.categorizedSkills.other || []), trimmed];
    }

    setExtraction({ ...extraction, extractedData: updated });
    setNewSkillInput('');
    setHasUnsavedChanges(true);
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    if (!extraction?.extractedData) return;
    const updated = { ...extraction.extractedData };
    const lower = skillToRemove.toLowerCase();
    updated.skills = (updated.skills || []).filter((s) => s.toLowerCase() !== lower);
    if (updated.softSkills) {
      updated.softSkills = updated.softSkills.filter((s) => s.toLowerCase() !== lower);
    }
    if (updated.categorizedSkills) {
      const cats: Record<string, any> = { ...updated.categorizedSkills };
      for (const k of Object.keys(cats)) {
        if (Array.isArray(cats[k])) {
          cats[k] = cats[k].filter((s: string) => s.toLowerCase() !== lower);
        }
      }
      updated.categorizedSkills = cats as CategorizedSkills;
    }
    setExtraction({ ...extraction, extractedData: updated });
    setHasUnsavedChanges(true);
  };

  // Education handlers
  const handleOpenAddEdu = () => {
    setEditingEduIndex(null);
    setEduFormData({
      degree: '',
      institution: '',
      fieldOfStudy: '',
      year: '',
      status: 'Completed',
    });
    setShowEduModal(true);
  };

  const handleOpenEditEdu = (index: number) => {
    if (!extraction?.extractedData?.education?.[index]) return;
    const edu = extraction.extractedData.education[index];
    setEditingEduIndex(index);
    setEduFormData({
      degree: edu.degree || '',
      institution: edu.institution || '',
      fieldOfStudy: edu.fieldOfStudy || '',
      year: edu.year || '',
      startDate: edu.startDate || '',
      endDate: edu.endDate || '',
      status: edu.status || 'Completed',
    });
    setShowEduModal(true);
  };

  const handleSaveEduForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraction?.extractedData || !eduFormData.degree || !eduFormData.institution) return;
    const updated = { ...extraction.extractedData };
    const list = [...(updated.education || [])];
    if (editingEduIndex !== null && editingEduIndex >= 0) {
      list[editingEduIndex] = { ...eduFormData };
    } else {
      list.push({ ...eduFormData });
    }
    updated.education = list;
    setExtraction({ ...extraction, extractedData: updated });
    setHasUnsavedChanges(true);
    setShowEduModal(false);
    setEditingEduIndex(null);
  };

  const handleDeleteEdu = (index: number) => {
    if (!extraction?.extractedData?.education) return;
    const updated = { ...extraction.extractedData };
    updated.education = updated.education.filter((_, idx) => idx !== index);
    setExtraction({ ...extraction, extractedData: updated });
    setHasUnsavedChanges(true);
  };

  // Experience handlers
  const handleOpenAddExp = () => {
    setEditingExpIndex(null);
    setExpFormData({
      company: '',
      title: '',
      duration: '',
      startDate: '',
      endDate: '',
      isCurrent: false,
      description: '',
      responsibilities: [],
      technologies: [],
      achievements: [],
    });
    setShowExpModal(true);
  };

  const handleOpenEditExp = (index: number) => {
    if (!extraction?.extractedData?.experience?.[index]) return;
    const exp = extraction.extractedData.experience[index];
    setEditingExpIndex(index);
    setExpFormData({
      company: exp.company || '',
      title: exp.title || '',
      duration: exp.duration || '',
      startDate: exp.startDate || '',
      endDate: exp.endDate || '',
      isCurrent: Boolean(exp.isCurrent || (exp.duration && /present|current/i.test(exp.duration))),
      description: exp.description || '',
      responsibilities: exp.responsibilities ? [...exp.responsibilities] : [],
      technologies: exp.technologies ? [...exp.technologies] : [],
      achievements: exp.achievements ? [...exp.achievements] : [],
    });
    setShowExpModal(true);
  };

  const handleSaveExpForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraction?.extractedData || !expFormData.company || !expFormData.title) return;
    const updated = { ...extraction.extractedData };
    const list = [...(updated.experience || [])];
    const itemToSave = {
      ...expFormData,
      duration: expFormData.duration || (expFormData.startDate && expFormData.endDate ? `${expFormData.startDate} - ${expFormData.endDate}` : '2021 - Present'),
    };
    if (editingExpIndex !== null && editingExpIndex >= 0) {
      list[editingExpIndex] = itemToSave;
    } else {
      list.push(itemToSave);
    }
    updated.experience = list;
    setExtraction({ ...extraction, extractedData: updated });
    setHasUnsavedChanges(true);
    setShowExpModal(false);
    setEditingExpIndex(null);
  };

  const handleDeleteExp = (index: number) => {
    if (!extraction?.extractedData?.experience) return;
    const updated = { ...extraction.extractedData };
    updated.experience = updated.experience.filter((_, idx) => idx !== index);
    setExtraction({ ...extraction, extractedData: updated });
    setHasUnsavedChanges(true);
  };

  // Save All Corrections
  const handleSaveAllCorrections = async () => {
    if (!application?.candidateId || !extraction?.extractedData) return;
    try {
      setSavingEdit(true);
      const res = await api.updateCandidateExtractedResume(application.candidateId, extraction.extractedData);
      setExtraction((prev) => prev ? {
        ...prev,
        reviewStatus: 'Reviewed',
        isCorrected: true,
        extractedData: res.extractedData || extraction.extractedData,
        originalExtractedData: res.originalExtractedData || prev.originalExtractedData,
      } : null);
      setHasUnsavedChanges(false);
      setVerifySuccess('Resume corrections saved successfully. Status updated to Reviewed.');
      setTimeout(() => setVerifySuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to save resume corrections.');
    } finally {
      setSavingEdit(false);
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
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-600">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-900">AI Extracted Resume Information</h3>

                    {/* Extraction Status Badge (Pending / Extracted / Reviewed) */}
                    {loadingExtraction ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Processing...
                      </span>
                    ) : extraction?.reviewStatus === 'Reviewed' || extraction?.isVerified ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                        <Check className="w-3 h-3 text-emerald-600" />
                        Status: Reviewed
                      </span>
                    ) : extraction?.status === 'completed' || extraction?.extractedData ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <Sparkles className="w-3 h-3 text-indigo-600" />
                        Status: Extracted
                      </span>
                    ) : extraction?.status === 'processing' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Status: Processing
                      </span>
                    ) : extraction?.status === 'failed' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        Status: Failed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        Status: Pending
                      </span>
                    )}

                    {/* Source / Correction Badge */}
                    {extraction?.isCorrected ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                        <Edit3 className="w-3 h-3 text-amber-600" />
                        Recruiter Corrected
                      </span>
                    ) : extraction?.extractedData ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                        AI Extracted
                      </span>
                    ) : null}

                    {/* Unsaved changes indicator */}
                    {hasUnsavedChanges && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-bounce">
                        Unsaved Changes
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Powered by Azure AI Document Intelligence (<code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded">prebuilt-layout</code>)
                    {extraction?.correctedByName && (
                      <span className="ml-1 text-slate-600 font-medium">
                        • Corrected by {extraction.correctedByName} on {new Date(extraction.correctedAt || '').toLocaleDateString()}
                      </span>
                    )}
                    {extraction?.verifiedByName && !extraction?.correctedByName && (
                      <span className="ml-1 text-slate-600 font-medium">
                        • Verified by {extraction.verifiedByName} on {new Date(extraction.verifiedAt || '').toLocaleDateString()}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Toggle Resume Viewer */}
                <button
                  type="button"
                  onClick={handleToggleResumeViewer}
                  disabled={loadingResumeViewer}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 shadow-2xs transition-colors ${
                    showResumeViewer
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                      : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-700'
                  }`}
                  title="View original uploaded resume alongside extracted details"
                >
                  {loadingResumeViewer ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Eye className="w-3.5 h-3.5 text-indigo-600" />
                  )}
                  <span>{showResumeViewer ? 'Hide Original Resume' : 'Review Original Resume'}</span>
                </button>

                {/* Save Corrections Button */}
                <button
                  type="button"
                  onClick={handleSaveAllCorrections}
                  disabled={savingEdit || !extraction?.extractedData}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 shadow-2xs transition-colors ${
                    hasUnsavedChanges
                      ? 'bg-amber-500 hover:bg-amber-600 border-amber-600 text-white'
                      : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-700 disabled:opacity-50'
                  }`}
                >
                  {savingEdit ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>{savingEdit ? 'Saving...' : 'Save Corrections'}</span>
                </button>

                {/* Edit All Fields */}
                <button
                  type="button"
                  onClick={handleOpenEditModal}
                  disabled={!extraction?.extractedData}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 shadow-2xs transition-colors disabled:opacity-50"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Edit All Fields</span>
                </button>

                {/* Verify & Apply Button */}
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

            {/* Split View: Embedded Original Resume Viewer */}
            {showResumeViewer && resumeViewerUrl && (
              <div className="border border-indigo-200 rounded-xl overflow-hidden bg-slate-900 text-white shadow-md">
                <div className="p-3 bg-slate-800 flex items-center justify-between border-b border-slate-700">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    <span>Original Uploaded Resume Document</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={resumeViewerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded text-slate-200 flex items-center gap-1"
                    >
                      <span>Open in New Tab</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setShowResumeViewer(false)}
                      className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="h-96 w-full bg-slate-100">
                  <iframe
                    src={resumeViewerUrl}
                    title="Original Resume Preview"
                    className="w-full h-full border-0"
                  />
                </div>
              </div>
            )}

            {/* Extraction Failure Alert */}
            {(extraction?.status === 'failed' || extraction?.status === 'FAILED') && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Azure AI Document Intelligence Extraction Could Not Complete</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRetryExtraction}
                    disabled={retryingExtraction}
                    className="px-2.5 py-1 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold flex items-center gap-1 shadow-2xs disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${retryingExtraction ? 'animate-spin' : ''}`} />
                    <span>{retryingExtraction ? 'Retrying...' : 'Retry Azure AI Extraction'}</span>
                  </button>
                </div>
                <p className="text-xs text-rose-700 leading-relaxed pl-6">
                  {extraction.error || 'The document layout analysis service encountered an error processing this resume file.'}
                </p>
              </div>
            )}

            {/* Extracted Details Display */}
            {extraction?.extractedData ? (
              <div className="space-y-4 pt-1">
                {/* 1. Candidate Overview & Contact Strip */}
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Candidate Name</span>
                      <p className="font-semibold text-slate-900 mt-0.5">{extraction.extractedData.fullName || <span className="text-slate-400 italic font-normal">Not detected</span>}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Email Address</span>
                      <p className="font-semibold text-slate-900 mt-0.5 truncate">{extraction.extractedData.email || <span className="text-slate-400 italic font-normal">Not detected</span>}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Phone Number</span>
                      <p className="font-semibold text-slate-900 mt-0.5">{extraction.extractedData.phone || <span className="text-slate-400 italic font-normal">Not detected</span>}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Current Location</span>
                      <p className="font-semibold text-slate-900 mt-0.5">{extraction.extractedData.location || <span className="text-slate-400 italic font-normal">Not detected</span>}</p>
                    </div>
                  </div>

                  {/* Online Profiles Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50/70 p-3 rounded-xl border border-slate-200/70">
                    <div className="flex items-center gap-2 min-w-0">
                      <Linkedin className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">LinkedIn</span>
                        {extraction.extractedData.linkedInUrl ? (
                          <a
                            href={extraction.extractedData.linkedInUrl.startsWith('http') ? extraction.extractedData.linkedInUrl : `https://${extraction.extractedData.linkedInUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-600 hover:underline truncate block"
                          >
                            {extraction.extractedData.linkedInUrl.replace(/^https?:\/\/(www\.)?/, '')}
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">Not provided</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                      <Github className="w-4 h-4 text-slate-800 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">GitHub</span>
                        {extraction.extractedData.githubUrl ? (
                          <a
                            href={extraction.extractedData.githubUrl.startsWith('http') ? extraction.extractedData.githubUrl : `https://${extraction.extractedData.githubUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-slate-800 hover:underline truncate block"
                          >
                            {extraction.extractedData.githubUrl.replace(/^https?:\/\/(www\.)?/, '')}
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">Not provided</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                      <Globe className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Portfolio / Website</span>
                        {extraction.extractedData.portfolioUrl ? (
                          <a
                            href={extraction.extractedData.portfolioUrl.startsWith('http') ? extraction.extractedData.portfolioUrl : `https://${extraction.extractedData.portfolioUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-indigo-600 hover:underline truncate block"
                          >
                            {extraction.extractedData.portfolioUrl.replace(/^https?:\/\/(www\.)?/, '')}
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">Not provided</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Professional Summary & Experience Header */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Professional Summary</span>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                      {extraction.extractedData.currentJobTitle && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                          Role: {extraction.extractedData.currentJobTitle}
                        </span>
                      )}
                      {extraction.extractedData.totalYearsExperience !== undefined && extraction.extractedData.totalYearsExperience !== null ? (
                        <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold">
                          {extraction.extractedData.totalYearsExperience} Years Total Exp
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-500 text-[10px]" title="Dates could not be reliably determined from resume">
                          Total Exp: Not specified by dates
                        </span>
                      )}
                    </div>
                  </div>
                  {extraction.extractedData.summary ? (
                    <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/60 p-3 rounded-lg border border-slate-200">
                      {extraction.extractedData.summary}
                    </p>
                  ) : (
                    <p className="text-slate-400 italic text-xs bg-slate-50/40 p-2.5 rounded-lg border border-dashed border-slate-200">
                      No professional summary section identified in document.
                    </p>
                  )}
                </div>

                {/* 3 Dedicated Tabs Navigation: Skills, Education, Work Experience */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex border-b border-slate-200 gap-1">
                    <button
                      type="button"
                      onClick={() => setExtractedTab('skills')}
                      className={`pb-2.5 px-4 text-xs font-bold transition-colors border-b-2 flex items-center gap-2 ${
                        extractedTab === 'skills'
                          ? 'border-indigo-600 text-indigo-600'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Skills</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-800">
                        {extraction.extractedData.skills?.length || 0}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExtractedTab('education')}
                      className={`pb-2.5 px-4 text-xs font-bold transition-colors border-b-2 flex items-center gap-2 ${
                        extractedTab === 'education'
                          ? 'border-indigo-600 text-indigo-600'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      <span>Education</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700">
                        {extraction.extractedData.education?.length || 0}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExtractedTab('experience')}
                      className={`pb-2.5 px-4 text-xs font-bold transition-colors border-b-2 flex items-center gap-2 ${
                        extractedTab === 'experience'
                          ? 'border-indigo-600 text-indigo-600'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Briefcase className="w-3.5 h-3.5" />
                      <span>Work Experience</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700">
                        {extraction.extractedData.experience?.length || 0}
                      </span>
                    </button>
                  </div>

                  {/* TAB 1: SKILLS */}
                  {extractedTab === 'skills' && (
                    <div className="pt-4 space-y-4">
                      {/* Recruiter Add Skill Action Bar */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            value={newSkillInput}
                            onChange={(e) => setNewSkillInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddSkill();
                              }
                            }}
                            placeholder="Add missing skill (e.g. Python, Docker, Communication)..."
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <select
                          value={newSkillCategory}
                          onChange={(e) => setNewSkillCategory(e.target.value as any)}
                          className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-700"
                        >
                          <option value="technical">Technical Skill / Tool</option>
                          <option value="softSkills">Soft Skill</option>
                        </select>
                        <button
                          type="button"
                          onClick={handleAddSkill}
                          disabled={!newSkillInput.trim()}
                          className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md flex items-center justify-center gap-1 shadow-2xs disabled:opacity-50"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Skill</span>
                        </button>
                      </div>

                      {/* Categorized Skills View */}
                      {extraction.extractedData.categorizedSkills && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {/* Programming Languages */}
                          {(extraction.extractedData.categorizedSkills.programmingLanguages?.length || 0) > 0 && (
                            <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200 space-y-1.5">
                              <span className="text-[10px] font-bold uppercase text-slate-500">Programming Languages</span>
                              <div className="flex flex-wrap gap-1.5">
                                {extraction.extractedData.categorizedSkills.programmingLanguages?.map((s, idx) => (
                                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-xs font-medium">
                                    <span>{s}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSkill(s)}
                                      className="text-blue-500 hover:text-blue-800"
                                      title={`Remove ${s}`}
                                    >
                                      &times;
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Frameworks & Libraries */}
                          {(extraction.extractedData.categorizedSkills.frameworks?.length || 0) > 0 && (
                            <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200 space-y-1.5">
                              <span className="text-[10px] font-bold uppercase text-slate-500">Frameworks & Libraries</span>
                              <div className="flex flex-wrap gap-1.5">
                                {extraction.extractedData.categorizedSkills.frameworks?.map((s, idx) => (
                                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-xs font-medium">
                                    <span>{s}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSkill(s)}
                                      className="text-indigo-500 hover:text-indigo-800"
                                      title={`Remove ${s}`}
                                    >
                                      &times;
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Cloud Platforms */}
                          {(extraction.extractedData.categorizedSkills.cloudPlatforms?.length || 0) > 0 && (
                            <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200 space-y-1.5">
                              <span className="text-[10px] font-bold uppercase text-slate-500">Cloud Platforms</span>
                              <div className="flex flex-wrap gap-1.5">
                                {extraction.extractedData.categorizedSkills.cloudPlatforms?.map((s, idx) => (
                                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-xs font-medium">
                                    <span>{s}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSkill(s)}
                                      className="text-sky-500 hover:text-sky-800"
                                      title={`Remove ${s}`}
                                    >
                                      &times;
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Databases */}
                          {(extraction.extractedData.categorizedSkills.databases?.length || 0) > 0 && (
                            <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200 space-y-1.5">
                              <span className="text-[10px] font-bold uppercase text-slate-500">Databases & Storage</span>
                              <div className="flex flex-wrap gap-1.5">
                                {extraction.extractedData.categorizedSkills.databases?.map((s, idx) => (
                                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-xs font-medium">
                                    <span>{s}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSkill(s)}
                                      className="text-purple-500 hover:text-purple-800"
                                      title={`Remove ${s}`}
                                    >
                                      &times;
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* DevOps & Tools */}
                          {(extraction.extractedData.categorizedSkills.devOpsTools?.length || 0) > 0 && (
                            <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200 space-y-1.5">
                              <span className="text-[10px] font-bold uppercase text-slate-500">DevOps & Tooling</span>
                              <div className="flex flex-wrap gap-1.5">
                                {extraction.extractedData.categorizedSkills.devOpsTools?.map((s, idx) => (
                                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-medium">
                                    <span>{s}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSkill(s)}
                                      className="text-emerald-500 hover:text-emerald-800"
                                      title={`Remove ${s}`}
                                    >
                                      &times;
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Developer Tools */}
                          {(extraction.extractedData.categorizedSkills.tools?.length || 0) > 0 && (
                            <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200 space-y-1.5">
                              <span className="text-[10px] font-bold uppercase text-slate-500">Developer Tools</span>
                              <div className="flex flex-wrap gap-1.5">
                                {extraction.extractedData.categorizedSkills.tools?.map((s, idx) => (
                                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 text-xs font-medium">
                                    <span>{s}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSkill(s)}
                                      className="text-teal-500 hover:text-teal-800"
                                      title={`Remove ${s}`}
                                    >
                                      &times;
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Soft Skills */}
                          {((extraction.extractedData.softSkills?.length || 0) > 0 || (extraction.extractedData.categorizedSkills.softSkills?.length || 0) > 0) && (
                            <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200 space-y-1.5">
                              <span className="text-[10px] font-bold uppercase text-slate-500">Soft Skills & Communication</span>
                              <div className="flex flex-wrap gap-1.5">
                                {(extraction.extractedData.softSkills || extraction.extractedData.categorizedSkills.softSkills || []).map((s, idx) => (
                                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-medium">
                                    <span>{s}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSkill(s)}
                                      className="text-amber-500 hover:text-amber-800"
                                      title={`Remove ${s}`}
                                    >
                                      &times;
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* All Skills List with Quick Delete Buttons */}
                      <div className="pt-2">
                        <span className="text-xs font-bold text-slate-700 block mb-2">
                          All Extracted Skills (Click &times; to remove incorrect skills)
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {(extraction.extractedData.skills || []).map((sk, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200 transition-colors"
                            >
                              <span>{sk}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveSkill(sk)}
                                className="text-slate-400 hover:text-rose-600 font-bold ml-0.5"
                                title={`Remove ${sk}`}
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                          {(!extraction.extractedData.skills || extraction.extractedData.skills.length === 0) && (
                            <span className="text-slate-400 italic text-xs">No skills identified. Add one above!</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: EDUCATION */}
                  {extractedTab === 'education' && (
                    <div className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">Educational Qualifications</span>
                        <button
                          type="button"
                          onClick={handleOpenAddEdu}
                          className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1 shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Education</span>
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {(extraction.extractedData.education || []).map((edu, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-slate-300 transition-colors"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-900 text-sm">{edu.degree}</span>
                                {edu.status && (
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    edu.status === 'Completed'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {edu.status}
                                  </span>
                                )}
                              </div>
                              <div className="text-slate-600 font-medium">{edu.institution}</div>
                              {edu.fieldOfStudy && (
                                <div className="text-slate-500 text-[11px]">
                                  Specialization / Major: <span className="text-slate-700 font-medium">{edu.fieldOfStudy}</span>
                                </div>
                              )}
                              <div className="text-slate-400 text-[11px]">
                                Duration / Graduation: {edu.year || (edu.startDate && edu.endDate ? `${edu.startDate} - ${edu.endDate}` : 'Not specified')}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 self-end sm:self-center">
                              <button
                                type="button"
                                onClick={() => handleOpenEditEdu(idx)}
                                className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded border border-slate-200"
                                title="Edit education"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteEdu(idx)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded border border-slate-200"
                                title="Delete education"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}

                        {(!extraction.extractedData.education || extraction.extractedData.education.length === 0) && (
                          <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg">
                            No educational details detected in resume. Click "Add Education" to add one manually.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: WORK EXPERIENCE */}
                  {extractedTab === 'experience' && (
                    <div className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-700">Work Experience & Employment History</span>
                          {extraction.extractedData.totalYearsExperience !== undefined && extraction.extractedData.totalYearsExperience !== null && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Total: {extraction.extractedData.totalYearsExperience} Years
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenAddExp}
                          className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1 shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Experience</span>
                        </button>
                      </div>

                      <div className="space-y-3">
                        {(extraction.extractedData.experience || []).map((exp, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2 hover:border-slate-300 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-900 text-sm">{exp.title}</span>
                                  {(exp.isCurrent || (exp.duration && /present|current/i.test(exp.duration))) && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                      Current Role
                                    </span>
                                  )}
                                </div>
                                <div className="text-slate-600 font-semibold mt-0.5">{exp.company}</div>
                                <div className="text-slate-400 text-[11px] mt-0.5">
                                  Duration: {exp.duration || (exp.startDate && exp.endDate ? `${exp.startDate} - ${exp.endDate}` : 'Not specified')}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditExp(idx)}
                                  className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded border border-slate-200"
                                  title="Edit work experience"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteExp(idx)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded border border-slate-200"
                                  title="Delete work experience"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Job Responsibilities */}
                            {exp.responsibilities && exp.responsibilities.length > 0 && (
                              <div className="space-y-1 pt-1">
                                <span className="text-[10px] uppercase font-bold text-slate-500">Responsibilities:</span>
                                <ul className="list-disc pl-4 space-y-0.5 text-slate-600 text-xs">
                                  {exp.responsibilities.map((r, ridx) => (
                                    <li key={ridx}>{r}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Description fallback if no bullet list */}
                            {exp.description && (!exp.responsibilities || exp.responsibilities.length === 0) && (
                              <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-line">{exp.description}</p>
                            )}

                            {/* Technologies & Tools */}
                            {exp.technologies && exp.technologies.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1 pt-1">
                                <span className="text-[10px] uppercase font-bold text-slate-500 mr-1">Tech Used:</span>
                                {exp.technologies.map((t, tidx) => (
                                  <span key={tidx} className="px-1.5 py-0.5 bg-slate-200/80 text-slate-700 text-[10px] rounded font-medium">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Key Achievements */}
                            {exp.achievements && exp.achievements.length > 0 && (
                              <div className="space-y-1 pt-1">
                                <span className="text-[10px] uppercase font-bold text-amber-700">Key Achievements:</span>
                                <ul className="list-disc pl-4 space-y-0.5 text-slate-600 text-xs">
                                  {exp.achievements.map((ach, aidx) => (
                                    <li key={aidx}>{ach}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}

                        {(!extraction.extractedData.experience || extraction.extractedData.experience.length === 0) && (
                          <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg">
                            No work experience items detected. Click "Add Experience" to add one manually.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Certifications & Key Projects */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
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

                  {/* Languages */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-700">Languages</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(extraction.extractedData.languages || []).map((lang, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs border border-slate-200 font-medium">
                          {lang}
                        </span>
                      ))}
                      {(!extraction.extractedData.languages || extraction.extractedData.languages.length === 0) && (
                        <span className="text-slate-400 italic text-xs">Not specified</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Collapsible Extracted Raw Text Viewer */}
                {extraction.extractedData.extractedText && (
                  <div className="pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setShowRawText(!showRawText)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                    >
                      <span>{showRawText ? 'Hide Document Layout Extracted Text' : 'View Document Layout Extracted Text (Azure Read/Layout Output)'}</span>
                      <ArrowRight className={`w-3 h-3 transform transition-transform ${showRawText ? 'rotate-90' : ''}`} />
                    </button>
                    {showRawText && (
                      <div className="mt-2 p-3 bg-slate-900 text-slate-200 rounded-lg text-[11px] font-mono whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed border border-slate-800">
                        {extraction.extractedData.extractedText}
                      </div>
                    )}
                  </div>
                )}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Current Job Title</label>
                  <input
                    type="text"
                    value={editForm.currentJobTitle || ''}
                    onChange={(e) => setEditForm({ ...editForm, currentJobTitle: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    placeholder="e.g. Senior Software Engineer"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Total Years Experience</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={editForm.totalYearsExperience ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, totalYearsExperience: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    placeholder="e.g. 5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">LinkedIn Profile</label>
                  <input
                    type="text"
                    value={editForm.linkedInUrl || ''}
                    onChange={(e) => setEditForm({ ...editForm, linkedInUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">GitHub Profile</label>
                  <input
                    type="text"
                    value={editForm.githubUrl || ''}
                    onChange={(e) => setEditForm({ ...editForm, githubUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    placeholder="https://github.com/..."
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Portfolio / Website</label>
                  <input
                    type="text"
                    value={editForm.portfolioUrl || ''}
                    onChange={(e) => setEditForm({ ...editForm, portfolioUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    placeholder="https://portfolio.dev"
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

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Languages (comma-separated)</label>
                <input
                  type="text"
                  value={editForm.languages?.join(', ') || ''}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      languages: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  placeholder="English, Spanish, German..."
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

      {/* Recruiter Add/Edit Education Modal */}
      {showEduModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  {editingEduIndex !== null ? 'Edit Educational Qualification' : 'Add Educational Qualification'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEduModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEduForm} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Degree / Qualification <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={eduFormData.degree}
                  onChange={(e) => setEduFormData({ ...eduFormData, degree: e.target.value })}
                  placeholder="e.g. Bachelor of Science in Computer Science"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Institution / University <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={eduFormData.institution}
                  onChange={(e) => setEduFormData({ ...eduFormData, institution: e.target.value })}
                  placeholder="e.g. Stanford University"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Field of Study / Major
                </label>
                <input
                  type="text"
                  value={eduFormData.fieldOfStudy || ''}
                  onChange={(e) => setEduFormData({ ...eduFormData, fieldOfStudy: e.target.value })}
                  placeholder="e.g. Software Engineering / Artificial Intelligence"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Graduation Year / Duration
                  </label>
                  <input
                    type="text"
                    value={eduFormData.year || ''}
                    onChange={(e) => setEduFormData({ ...eduFormData, year: e.target.value })}
                    placeholder="e.g. 2018 - 2022"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Education Status
                  </label>
                  <select
                    value={eduFormData.status || 'Completed'}
                    onChange={(e) => setEduFormData({ ...eduFormData, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Completed">Completed</option>
                    <option value="Pursuing">Pursuing / In Progress</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEduModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs"
                >
                  {editingEduIndex !== null ? 'Save Changes' : 'Add Education'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recruiter Add/Edit Work Experience Modal */}
      {showExpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  {editingExpIndex !== null ? 'Edit Work Experience' : 'Add Work Experience'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowExpModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExpForm} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Job Title / Designation <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={expFormData.title}
                    onChange={(e) => setExpFormData({ ...expFormData, title: e.target.value })}
                    placeholder="e.g. Senior Software Engineer"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Company / Organization <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={expFormData.company}
                    onChange={(e) => setExpFormData({ ...expFormData, company: e.target.value })}
                    placeholder="e.g. Google LLC"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Duration String
                </label>
                <input
                  type="text"
                  value={expFormData.duration || ''}
                  onChange={(e) => setExpFormData({ ...expFormData, duration: e.target.value })}
                  placeholder="e.g. Jan 2021 - Present"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="text"
                    value={expFormData.startDate || ''}
                    onChange={(e) => setExpFormData({ ...expFormData, startDate: e.target.value })}
                    placeholder="e.g. 2021 or Jan 2021"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">End Date</label>
                  <input
                    type="text"
                    value={expFormData.endDate || ''}
                    onChange={(e) => setExpFormData({ ...expFormData, endDate: e.target.value })}
                    placeholder="e.g. Present or 2023"
                    disabled={expFormData.isCurrent}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isCurrentRole"
                  checked={Boolean(expFormData.isCurrent)}
                  onChange={(e) =>
                    setExpFormData({
                      ...expFormData,
                      isCurrent: e.target.checked,
                      endDate: e.target.checked ? 'Present' : expFormData.endDate,
                    })
                  }
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="isCurrentRole" className="font-semibold text-slate-700">
                  This is the candidate's current employment role
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Responsibilities (one per line)
                </label>
                <textarea
                  rows={3}
                  value={expFormData.responsibilities?.join('\n') || ''}
                  onChange={(e) =>
                    setExpFormData({
                      ...expFormData,
                      responsibilities: e.target.value.split('\n').filter((l) => l.trim()),
                    })
                  }
                  placeholder="Designed and maintained scalable microservices...&#10;Mentored junior developers..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Technologies Used (comma-separated)
                </label>
                <input
                  type="text"
                  value={expFormData.technologies?.join(', ') || ''}
                  onChange={(e) =>
                    setExpFormData({
                      ...expFormData,
                      technologies: e.target.value
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="React, TypeScript, Docker, PostgreSQL"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Key Achievements (one per line)
                </label>
                <textarea
                  rows={2}
                  value={expFormData.achievements?.join('\n') || ''}
                  onChange={(e) =>
                    setExpFormData({
                      ...expFormData,
                      achievements: e.target.value.split('\n').filter((l) => l.trim()),
                    })
                  }
                  placeholder="Reduced system latency by 40%...&#10;Awarded Top Performer of Q3..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowExpModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs"
                >
                  {editingExpIndex !== null ? 'Save Changes' : 'Add Experience'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};