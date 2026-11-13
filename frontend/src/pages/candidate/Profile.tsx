import React, { useState, useEffect, useRef } from 'react';
import {
  User as UserIcon,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Briefcase,
  FileText,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  HardDrive,
  Edit3,
  X,
  Save,
  Upload,
  Download,
  Award,
  GraduationCap,
  Building,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { CandidateProfile, UserEducation, UserExperience } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResumeDocument {
  id: string;
  originalFilename: string;
  fileExtension: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadStatus: 'uploaded' | 'failed' | 'deleted';
  isCurrent: boolean;
  uploadedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDobDisplay(dob?: string): string {
  if (!dob) return 'Not provided';
  try {
    const parts = dob.substring(0, 10).split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    }
  } catch {
    // fallback to string
  }
  return dob;
}

// ─── ResumeCard component ─────────────────────────────────────────────────────

const ResumeCard: React.FC<{
  doc: ResumeDocument;
  onDownload: (id: string, filename: string) => void;
  downloading: string | null;
}> = ({ doc, onDownload, downloading }) => (
  <div
    className={`flex items-center justify-between p-3 rounded-xl border ${
      doc.isCurrent
        ? 'bg-blue-50 border-blue-200'
        : 'bg-slate-50 border-slate-200 opacity-70'
    }`}
  >
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4 text-blue-600" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-800 truncate">{doc.originalFilename}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">
          {formatBytes(doc.fileSizeBytes)} &bull; {doc.fileExtension.toUpperCase()} &bull; {formatDate(doc.uploadedAt)}
          {doc.isCurrent && (
            <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-bold uppercase tracking-wide">
              Current
            </span>
          )}
        </p>
      </div>
    </div>
    <button
      onClick={() => onDownload(doc.id, doc.originalFilename)}
      disabled={downloading === doc.id}
      title="Download resume"
      className="shrink-0 ml-3 px-3 py-1.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
    >
      {downloading === doc.id ? (
        <RefreshCw className="w-3 h-3 animate-spin" />
      ) : (
        <Download className="w-3 h-3" />
      )}
      <span>{downloading === doc.id ? 'Getting link…' : 'Download'}</span>
    </button>
  </div>
);

// ─── Main Profile component ───────────────────────────────────────────────────

export const Profile: React.FC = () => {
  const { user, updateCurrentUser } = useAuth();

  // Navigation tab state: 'personal' | 'resume' | 'skills'
  const [activeTab, setActiveTab] = useState<'personal' | 'resume' | 'skills'>('personal');

  // Candidate Profile state fetched from backend
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Edit Mode state for Personal Information
  const [isEditing, setIsEditing] = useState(false);

  // Editable Form fields for personal details
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    title: '',
    location: '',
    bio: '',
  });

  // Validation errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Skills state
  const [skills, setSkills] = useState<string[]>(user?.skills || []);
  const [newSkill, setNewSkill] = useState('');
  const [savingSkills, setSavingSkills] = useState(false);
  const [skillError, setSkillError] = useState<string | null>(null);
  const [skillSuccess, setSkillSuccess] = useState<string | null>(null);

  // Education state & modal
  const [education, setEducation] = useState<UserEducation[]>(user?.education || []);
  const [isEduModalOpen, setIsEduModalOpen] = useState(false);
  const [editingEduId, setEditingEduId] = useState<string | null>(null);
  const [eduFormData, setEduFormData] = useState({
    degree: '',
    school: '',
    fieldOfStudy: '',
    startDate: '',
    endDate: '',
    grade: '',
    description: '',
  });
  const [eduErrors, setEduErrors] = useState<Record<string, string>>({});
  const [savingEdu, setSavingEdu] = useState(false);
  const [eduFeedback, setEduFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Experience state & modal
  const [experience, setExperience] = useState<UserExperience[]>(user?.experience || []);
  const [isExpModalOpen, setIsExpModalOpen] = useState(false);
  const [editingExpId, setEditingExpId] = useState<string | null>(null);
  const [expFormData, setExpFormData] = useState({
    title: '',
    company: '',
    employmentType: 'Full-time',
    location: '',
    startDate: '',
    endDate: '',
    currentlyWorking: false,
    description: '',
  });
  const [expErrors, setExpErrors] = useState<Record<string, string>>({});
  const [savingExp, setSavingExp] = useState(false);
  const [expFeedback, setExpFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Resume state & history
  const [resumeHistory, setResumeHistory] = useState<ResumeDocument[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [downloadingResume, setDownloadingResume] = useState(false);
  const [resumeSuccess, setResumeSuccess] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load Profile from Backend on Mount ───────────────────────────────────────
  const fetchProfile = async () => {
    try {
      setLoadingProfile(true);
      const res = await api.getCandidateProfile();
      if (res?.profile) {
        setProfile(res.profile);
        setFormData({
          name: res.profile.name || '',
          email: res.profile.email || '',
          phone: res.profile.phone || '',
          dateOfBirth: res.profile.dateOfBirth ? res.profile.dateOfBirth.substring(0, 10) : '',
          gender: res.profile.gender || '',
          title: res.profile.title || '',
          location: res.profile.location || '',
          bio: res.profile.bio || '',
        });
        if (res.profile.skills) {
          setSkills(res.profile.skills);
        }
        if (res.profile.education) {
          setEducation(res.profile.education);
        }
        if (res.profile.experience) {
          setExperience(res.profile.experience);
        }
      }
    } catch {
      // Fallback to auth context user
      if (user) {
        setFormData({
          name: user.name || '',
          email: user.email || '',
          phone: user.phone || '',
          dateOfBirth: user.dateOfBirth ? user.dateOfBirth.substring(0, 10) : '',
          gender: user.gender || '',
          title: user.title || '',
          location: user.location || '',
          bio: user.bio || '',
        });
        if (user.skills) setSkills(user.skills);
        if (user.education) setEducation(user.education);
        if (user.experience) setExperience(user.experience);
      }
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Load resume history on mount
  useEffect(() => {
    if (user?.role !== 'candidate') return;
    setHistoryLoading(true);
    api.getResumeHistory()
      .then((data) => setResumeHistory(data.history || []))
      .catch(() => { /* non-fatal */ })
      .finally(() => setHistoryLoading(false));
  }, [user?.role]);

  // ── Validation logic ────────────────────────────────────────────────────────

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Name required
    if (!formData.name.trim()) {
      errors.name = 'Full name is required.';
    } else if (formData.name.trim().length > 150) {
      errors.name = 'Full name cannot exceed 150 characters.';
    }

    // Email required and format
    if (!formData.email.trim()) {
      errors.email = 'Email address is required.';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        errors.email = 'Please provide a valid email address.';
      }
    }

    // Phone format (if provided)
    if (formData.phone.trim()) {
      const phoneDigits = formData.phone.replace(/\D/g, '');
      const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{5,20}$/;
      if (phoneDigits.length < 7 || phoneDigits.length > 20 || !phoneRegex.test(formData.phone.trim())) {
        errors.phone = 'Please provide a valid phone number (at least 7 digits).';
      }
    }

    // Date of birth (must be in past if provided)
    if (formData.dateOfBirth.trim()) {
      const dob = new Date(formData.dateOfBirth);
      if (isNaN(dob.getTime())) {
        errors.dateOfBirth = 'Please provide a valid date of birth (YYYY-MM-DD).';
      } else if (dob >= new Date()) {
        errors.dateOfBirth = 'Date of birth must be in the past.';
      }
    }

    // Max lengths
    if (formData.title.trim().length > 150) {
      errors.title = 'Professional headline cannot exceed 150 characters.';
    }
    if (formData.location.trim().length > 150) {
      errors.location = 'Location cannot exceed 150 characters.';
    }
    if (formData.bio.trim().length > 3000) {
      errors.bio = 'Summary cannot exceed 3000 characters.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Handle Save Personal Information ────────────────────────────────────────

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSuccessMessage(null);

    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      const res = await api.updateCandidateProfile({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        dateOfBirth: formData.dateOfBirth.trim() || undefined,
        gender: formData.gender || undefined,
        title: formData.title.trim() || undefined,
        location: formData.location.trim() || undefined,
        bio: formData.bio.trim() || undefined,
      });

      // Update local profile and sync with AuthContext
      if (res.profile) {
        setProfile(res.profile);
        updateCurrentUser({
          name: res.profile.name,
          email: res.profile.email,
          phone: res.profile.phone,
          title: res.profile.title,
          location: res.profile.location,
          bio: res.profile.bio,
          dateOfBirth: res.profile.dateOfBirth,
          gender: res.profile.gender,
        });
      }

      setSuccessMessage('Candidate profile successfully updated and saved in MySQL!');
      setIsEditing(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update candidate profile.');
    } finally {
      setSaving(false);
    }
  };

  // ── Handle Cancel Edit ──────────────────────────────────────────────────────

  const handleCancelEdit = () => {
    // Reset formData to last known profile values
    const currentSource = profile || user;
    setFormData({
      name: currentSource?.name || '',
      email: currentSource?.email || '',
      phone: currentSource?.phone || '',
      dateOfBirth: currentSource?.dateOfBirth ? currentSource.dateOfBirth.substring(0, 10) : '',
      gender: currentSource?.gender || '',
      title: currentSource?.title || '',
      location: currentSource?.location || '',
      bio: currentSource?.bio || '',
    });
    setFormErrors({});
    setSaveError(null);
    setIsEditing(false);
  };

  // ── Skill handlers ──────────────────────────────────────────────────────────

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    setSkillError(null);
    setSkillSuccess(null);

    const trimmed = newSkill.trim();
    if (!trimmed) {
      setSkillError('Please enter a technical skill name.');
      return;
    }

    if (skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSkillError(`"${trimmed}" is already added to your skills.`);
      return;
    }

    try {
      setSavingSkills(true);
      const res = await api.addCandidateSkill(trimmed);
      const updated = res.skills || [...skills, trimmed];
      setSkills(updated);
      setNewSkill('');
      setSkillSuccess(`"${trimmed}" successfully added to your profile.`);
      updateCurrentUser({ skills: updated });
      setTimeout(() => setSkillSuccess(null), 3000);
    } catch (err: any) {
      setSkillError(err.response?.data?.message || err.message || 'Failed to add skill.');
    } finally {
      setSavingSkills(false);
    }
  };

  const handleRemoveSkill = async (s: string) => {
    setSkillError(null);
    setSkillSuccess(null);
    try {
      setSavingSkills(true);
      const res = await api.removeCandidateSkill(s);
      const updated = res.skills || skills.filter((x) => x !== s);
      setSkills(updated);
      setSkillSuccess(`Skill "${s}" removed.`);
      updateCurrentUser({ skills: updated });
      setTimeout(() => setSkillSuccess(null), 3000);
    } catch (err: any) {
      setSkillError(err.response?.data?.message || err.message || 'Failed to remove skill.');
    } finally {
      setSavingSkills(false);
    }
  };

  // ── Education handlers ──────────────────────────────────────────────────────

  const openAddEduModal = () => {
    setEditingEduId(null);
    setEduFormData({
      degree: '',
      school: '',
      fieldOfStudy: '',
      startDate: '',
      endDate: '',
      grade: '',
      description: '',
    });
    setEduErrors({});
    setIsEduModalOpen(true);
  };

  const openEditEduModal = (edu: UserEducation) => {
    setEditingEduId(edu.id || null);
    setEduFormData({
      degree: edu.degree || '',
      school: edu.school || '',
      fieldOfStudy: edu.fieldOfStudy || '',
      startDate: edu.startDate || '',
      endDate: edu.endDate || (edu.year && edu.year !== 'N/A' ? edu.year : ''),
      grade: edu.grade || '',
      description: edu.description || '',
    });
    setEduErrors({});
    setIsEduModalOpen(true);
  };

  const handleSaveEdu = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!eduFormData.degree.trim()) errors.degree = 'Degree or qualification is required.';
    if (!eduFormData.school.trim()) errors.school = 'School or university name is required.';
    setEduErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingEdu(true);
    setEduFeedback(null);
    try {
      if (editingEduId) {
        const res = await api.updateCandidateEducation(editingEduId, eduFormData);
        setEducation(res.education);
        updateCurrentUser({ education: res.education });
        setEduFeedback({ type: 'success', message: 'Educational qualification updated successfully.' });
      } else {
        const res = await api.addCandidateEducation(eduFormData);
        setEducation(res.education);
        updateCurrentUser({ education: res.education });
        setEduFeedback({ type: 'success', message: 'Educational qualification added successfully.' });
      }
      setIsEduModalOpen(false);
      setTimeout(() => setEduFeedback(null), 4000);
    } catch (err: any) {
      setEduFeedback({ type: 'error', message: err.response?.data?.message || err.message || 'Failed to save education.' });
    } finally {
      setSavingEdu(false);
    }
  };

  const handleDeleteEdu = async (id?: string) => {
    if (!id) return;
    if (!window.confirm('Are you sure you want to remove this education entry?')) return;
    try {
      const res = await api.deleteCandidateEducation(id);
      setEducation(res.education);
      updateCurrentUser({ education: res.education });
      setEduFeedback({ type: 'success', message: 'Educational qualification removed.' });
      setTimeout(() => setEduFeedback(null), 4000);
    } catch (err: any) {
      setEduFeedback({ type: 'error', message: err.response?.data?.message || err.message || 'Failed to delete education.' });
    }
  };

  // ── Work Experience handlers ────────────────────────────────────────────────

  const openAddExpModal = () => {
    setEditingExpId(null);
    setExpFormData({
      title: '',
      company: '',
      employmentType: 'Full-time',
      location: '',
      startDate: '',
      endDate: '',
      currentlyWorking: false,
      description: '',
    });
    setExpErrors({});
    setIsExpModalOpen(true);
  };

  const openEditExpModal = (exp: UserExperience) => {
    setEditingExpId(exp.id || null);
    setExpFormData({
      title: exp.title || '',
      company: exp.company || '',
      employmentType: exp.employmentType || 'Full-time',
      location: exp.location || '',
      startDate: exp.startDate || '',
      endDate: exp.endDate || '',
      currentlyWorking: Boolean(exp.currentlyWorking),
      description: exp.description || '',
    });
    setExpErrors({});
    setIsExpModalOpen(true);
  };

  const handleSaveExp = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!expFormData.title.trim()) errors.title = 'Job title is required.';
    if (!expFormData.company.trim()) errors.company = 'Company name is required.';
    if (expFormData.startDate && expFormData.endDate && !expFormData.currentlyWorking) {
      if (new Date(expFormData.endDate) < new Date(expFormData.startDate)) {
        errors.endDate = 'End date cannot be earlier than start date.';
      }
    }
    setExpErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingExp(true);
    setExpFeedback(null);
    try {
      if (editingExpId) {
        const res = await api.updateCandidateExperience(editingExpId, expFormData);
        setExperience(res.experience);
        updateCurrentUser({ experience: res.experience });
        setExpFeedback({ type: 'success', message: 'Work experience updated successfully.' });
      } else {
        const res = await api.addCandidateExperience(expFormData);
        setExperience(res.experience);
        updateCurrentUser({ experience: res.experience });
        setExpFeedback({ type: 'success', message: 'Work experience added successfully.' });
      }
      setIsExpModalOpen(false);
      setTimeout(() => setExpFeedback(null), 4000);
    } catch (err: any) {
      setExpFeedback({ type: 'error', message: err.response?.data?.message || err.message || 'Failed to save experience.' });
    } finally {
      setSavingExp(false);
    }
  };

  const handleDeleteExp = async (id?: string) => {
    if (!id) return;
    if (!window.confirm('Are you sure you want to remove this work experience entry?')) return;
    try {
      const res = await api.deleteCandidateExperience(id);
      setExperience(res.experience);
      updateCurrentUser({ experience: res.experience });
      setExpFeedback({ type: 'success', message: 'Work experience removed.' });
      setTimeout(() => setExpFeedback(null), 4000);
    } catch (err: any) {
      setExpFeedback({ type: 'error', message: err.response?.data?.message || err.message || 'Failed to delete experience.' });
    }
  };

  // ── File selection & Resume handlers ────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setResumeError(null);
    setResumeSuccess(null);
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'pdf' && ext !== 'docx') {
        setResumeError('Only PDF and DOCX files are accepted.');
        setSelectedFile(null);
        return;
      }
      const maxMb = 10;
      if (file.size > maxMb * 1024 * 1024) {
        setResumeError(`File exceeds the ${maxMb} MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).`);
        setSelectedFile(null);
        return;
      }
    }
  };

  const handleResumeUpload = async () => {
    if (!selectedFile) return;

    setUploadingResume(true);
    setUploadProgress(0);
    setResumeError(null);
    setResumeSuccess(null);

    try {
      const res = await api.uploadResume(selectedFile, (pct) => setUploadProgress(pct));

      if (res.resume) {
        setResumeHistory((prev) =>
          [res.resume, ...prev.map((d) => ({ ...d, isCurrent: false }))]
        );
      }

      if (res.user) {
        updateCurrentUser(res.user);
        if (res.user.skills) setSkills(res.user.skills);
      }

      const skillCount = res.parsedData?.extractedSkills?.length ?? 0;
      setResumeSuccess(
        `Resume uploaded to Azure Blob Storage. ${skillCount > 0 ? `${skillCount} skills extracted by AI.` : ''}`
      );
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setResumeError(err.message || 'Resume upload failed. Please try again.');
    } finally {
      setUploadingResume(false);
      setUploadProgress(0);
    }
  };

  const handleDownload = async (id: string, filename: string) => {
    setDownloading(id);
    try {
      const { downloadUrl } = await api.getResumeDownloadUrl(id);
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      alert(`Could not generate download link: ${err.message}`);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadResume = async () => {
    try {
      setDownloadingResume(true);
      setResumeError(null);
      const res = await api.getResumeDownloadUrl();
      if (res.downloadUrl) {
        window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      setResumeError(err.message || 'Failed to download resume.');
    } finally {
      setDownloadingResume(false);
    }
  };

  const currentResume = resumeHistory.find((d) => d.isCurrent) ?? null;
  const displayProfile = profile || {
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    dateOfBirth: user?.dateOfBirth || '',
    gender: user?.gender || '',
    title: user?.title || '',
    location: user?.location || '',
    bio: user?.bio || '',
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 w-full max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Candidate Profile &amp; Career Hub
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage your personal details, professional resume, and technical qualifications for recruiter visibility.
        </p>
      </div>

      {/* Global Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs transition-all">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs transition-all">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-3 sm:space-x-4">
          <button
            type="button"
            onClick={() => setActiveTab('personal')}
            className={`flex items-center gap-2 py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-colors ${
              activeTab === 'personal'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            <span>Personal Information</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('resume')}
            className={`flex items-center gap-2 py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-colors ${
              activeTab === 'resume'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Resume &amp; Documents</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('skills')}
            className={`flex items-center gap-2 py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-colors ${
              activeTab === 'skills'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Skills &amp; Qualifications</span>
          </button>
        </nav>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: PERSONAL INFORMATION                                              */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'personal' && (
        <div className="space-y-6">
          {loadingProfile ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              <RefreshCw className="w-5 h-5 text-blue-600 animate-spin mx-auto mb-2" />
              <span>Loading existing candidate profile from database…</span>
            </div>
          ) : !isEditing ? (
            /* ── VIEW MODE ───────────────────────────────────────────────────────── */
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <UserIcon className="w-5 h-5 text-blue-600" />
                    <span>Personal Details</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Your verified personal identity and contact information stored in MySQL.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Personal Details</span>
                </button>
              </div>

              {/* Information Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* 1. Full Name */}
                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                    <span>Full Name</span>
                  </div>
                  <p className="text-sm font-bold text-slate-800">
                    {displayProfile.name || 'Not provided'}
                  </p>
                </div>

                {/* 2. Email Address */}
                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span>Email Address</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {displayProfile.email || 'Not provided'}
                  </p>
                </div>

                {/* 3. Phone Number */}
                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>Phone Number</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    {displayProfile.phone || <span className="text-slate-400 italic font-normal">Not provided</span>}
                  </p>
                </div>

                {/* 4. Date of Birth */}
                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Date of Birth</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    {displayProfile.dateOfBirth ? (
                      formatDobDisplay(displayProfile.dateOfBirth)
                    ) : (
                      <span className="text-slate-400 italic font-normal">Not provided</span>
                    )}
                  </p>
                </div>

                {/* 5. Gender */}
                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                    <span>Gender</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    {displayProfile.gender || <span className="text-slate-400 italic font-normal">Not provided</span>}
                  </p>
                </div>

                {/* 6. Professional Headline */}
                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                    <span>Professional Headline</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    {displayProfile.title || <span className="text-slate-400 italic font-normal">Not provided</span>}
                  </p>
                </div>

                {/* 7. Current Location */}
                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70 sm:col-span-2">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span>Current Location</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    {displayProfile.location || <span className="text-slate-400 italic font-normal">Not provided</span>}
                  </p>
                </div>

                {/* 8. Professional Summary / About Me */}
                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70 sm:col-span-2">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>Professional Summary / About Me</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                    {displayProfile.bio || (
                      <span className="text-slate-400 italic">
                        No professional summary provided yet. Click "Edit Personal Details" to add a bio.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* ── EDIT MODE ───────────────────────────────────────────────────────── */
            <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Edit3 className="w-5 h-5 text-blue-600" />
                    <span>Edit Personal Details</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Update your information below. Required fields are marked with an asterisk (*).
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    {saving ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>{saving ? 'Saving…' : 'Save Changes'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* 1. Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Jane Doe"
                    className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 ${
                      formErrors.name
                        ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/30'
                        : 'border-slate-200 focus:ring-blue-500'
                    }`}
                  />
                  {formErrors.name && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1">{formErrors.name}</p>
                  )}
                </div>

                {/* 2. Email Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="name@example.com"
                    className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 ${
                      formErrors.email
                        ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/30'
                        : 'border-slate-200 focus:ring-blue-500'
                    }`}
                  />
                  {formErrors.email && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1">{formErrors.email}</p>
                  )}
                </div>

                {/* 3. Phone Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 ${
                      formErrors.phone
                        ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/30'
                        : 'border-slate-200 focus:ring-blue-500'
                    }`}
                  />
                  {formErrors.phone && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1">{formErrors.phone}</p>
                  )}
                </div>

                {/* 4. Date of Birth */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    max={new Date().toISOString().split('T')[0]}
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 ${
                      formErrors.dateOfBirth
                        ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/30'
                        : 'border-slate-200 focus:ring-blue-500'
                    }`}
                  />
                  {formErrors.dateOfBirth && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1">{formErrors.dateOfBirth}</p>
                  )}
                </div>

                {/* 5. Gender */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Gender
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Gender (Optional)</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-Binary">Non-Binary</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* 6. Professional Headline */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Professional Headline / Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Senior Full Stack Engineer"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {formErrors.title && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1">{formErrors.title}</p>
                  )}
                </div>

                {/* 7. Current Location */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Current Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. San Francisco, CA or London, UK"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {formErrors.location && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1">{formErrors.location}</p>
                  )}
                </div>

                {/* 8. Professional Summary / About Me */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Professional Summary / About Me
                  </label>
                  <textarea
                    rows={4}
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Highlight your technical accomplishments, engineering background, and key strengths..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                  />
                  {formErrors.bio && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1">{formErrors.bio}</p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving to MySQL…</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Profile Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: RESUME & DOCUMENTS (Azure Blob Storage)                          */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'resume' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Resume Management &amp; Azure Blob Storage</span>
              </h2>
              <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-semibold">
                Secure Cloud Storage
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Upload a PDF or DOCX resume (max 10 MB). Your file is validated, checksummed and stored in Azure Blob Storage.
              A short-lived secure link is generated for downloads — no public URLs are created.
            </p>

            {resumeSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{resumeSuccess}</span>
              </div>
            )}
            {resumeError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{resumeError}</span>
              </div>
            )}

            {/* Current resume status */}
            {currentResume || user?.resumeOriginalName ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3 text-xs">
                <HardDrive className="w-4 h-4 text-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">
                    Current Resume: {currentResume ? currentResume.originalFilename : user?.resumeOriginalName}
                  </p>
                  <p className="text-slate-400">
                    {currentResume ? `${formatBytes(currentResume.fileSizeBytes)} • Uploaded ${formatDate(currentResume.uploadedAt)}` : 'Stored securely in private cloud storage'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                No resume uploaded yet.
              </div>
            )}

            {/* Drop zone / file picker */}
            <div className="p-5 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50/60 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>

              {selectedFile ? (
                <div className="text-xs text-slate-700">
                  <p className="font-semibold">{selectedFile.name}</p>
                  <p className="text-slate-400">{formatBytes(selectedFile.size)}</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {currentResume || user?.resumeOriginalName ? 'Replace current resume' : 'Upload your resume'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">PDF or DOCX &bull; Max 10 MB</p>
                </div>
              )}

              <div className="flex items-center gap-3">
                {(currentResume || user?.resumeUrl) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (currentResume) {
                        handleDownload(currentResume.id, currentResume.originalFilename);
                      } else {
                        handleDownloadResume();
                      }
                    }}
                    disabled={downloadingResume || downloading !== null}
                    className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600" />
                    <span>Download Current</span>
                  </button>
                )}

                <label className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-slate-600" />
                  <span>{selectedFile ? 'Change file' : 'Choose file'}</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx"
                    disabled={uploadingResume}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {uploadingResume && (
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Uploading to Azure Blob Storage…</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleResumeUpload}
              disabled={!selectedFile || uploadingResume}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl text-sm shadow-sm transition-colors disabled:cursor-not-allowed"
            >
              {uploadingResume ? `Uploading… (${uploadProgress}%)` : (currentResume || user?.resumeOriginalName) ? 'Replace Resume' : 'Upload Resume'}
            </button>
          </div>

          {/* Resume Version History */}
          {(resumeHistory.length > 0 || historyLoading) && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                Resume Version History
              </h2>

              {historyLoading ? (
                <p className="text-xs text-slate-400">Loading history…</p>
              ) : (
                <div className="space-y-2">
                  {resumeHistory.map((doc) => (
                    <ResumeCard
                      key={doc.id}
                      doc={doc}
                      onDownload={handleDownload}
                      downloading={downloading}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: SKILLS & QUALIFICATIONS                                          */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'skills' && (
        <div className="space-y-6">
          {/* SECTION 1: Technical Skills Management */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>Technical Skills Management</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Add skills to power algorithmic job matches and improve your ranking on candidate search boards.
                </p>
              </div>
            </div>

            {skillSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{skillSuccess}</span>
                </div>
                <button onClick={() => setSkillSuccess(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold">✕</button>
              </div>
            )}

            {skillError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{skillError}</span>
                </div>
                <button onClick={() => setSkillError(null)} className="text-rose-700 hover:text-rose-900 text-xs font-bold">✕</button>
              </div>
            )}

            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold"
                  >
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      disabled={savingSkills}
                      className="hover:text-rose-600 focus:outline-none transition-colors cursor-pointer"
                      title={`Remove ${skill}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {skills.length === 0 && (
                  <span className="text-xs text-slate-400 italic">No technical skills added yet. Add your key languages, frameworks, and tools below.</span>
                )}
              </div>

              <form onSubmit={handleAddSkill} className="flex items-center gap-2 max-w-md">
                <input
                  type="text"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  placeholder="Add skill (e.g. Node.js, React, Docker, SQL)..."
                  className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={!newSkill.trim() || savingSkills}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{savingSkills ? 'Adding…' : 'Add Skill'}</span>
                </button>
              </form>
            </div>
          </div>

          {/* SECTION 2: Work Experience Management */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  <span>Work Experience</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Document your career timeline, company positions, and project accomplishments.
                </p>
              </div>

              <button
                type="button"
                onClick={openAddExpModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Work Experience</span>
              </button>
            </div>

            {expFeedback && (
              <div
                className={`p-3 text-xs rounded-xl flex items-center justify-between ${
                  expFeedback.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {expFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{expFeedback.message}</span>
                </div>
                <button onClick={() => setExpFeedback(null)} className="font-bold text-xs">✕</button>
              </div>
            )}

            {experience.length > 0 ? (
              <div className="space-y-4">
                {experience.map((exp, idx) => (
                  <div
                    key={exp.id || idx}
                    className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 hover:border-blue-200 transition-colors space-y-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">{exp.title}</h3>
                          {exp.currentlyWorking && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold uppercase tracking-wider">
                              Currently Working
                            </span>
                          )}
                          {exp.employmentType && (
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md text-[10px] font-medium">
                              {exp.employmentType}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                          <span className="flex items-center gap-1 font-semibold text-slate-800">
                            <Building className="w-3.5 h-3.5 text-slate-500" />
                            {exp.company}
                          </span>
                          {exp.location && (
                            <span className="flex items-center gap-1 text-slate-500">
                              <MapPin className="w-3 h-3" />
                              {exp.location}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-slate-500">
                            <Calendar className="w-3 h-3" />
                            {exp.period || (exp.startDate ? `${exp.startDate} - ${exp.currentlyWorking ? 'Present' : (exp.endDate || '')}` : 'N/A')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-start">
                        <button
                          type="button"
                          onClick={() => openEditExpModal(exp)}
                          className="px-2.5 py-1.5 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-slate-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          title="Edit work experience"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExp(exp.id)}
                          className="px-2.5 py-1.5 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-slate-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          title="Delete work experience"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>

                    {exp.description && (
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line border-t border-slate-200/60 pt-2">
                        {exp.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">No work experience entries recorded yet.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Click "Add Work Experience" above to build your career history.</p>
              </div>
            )}
          </div>

          {/* SECTION 3: Educational Qualifications Management */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-blue-600" />
                  <span>Educational Qualifications</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Add your academic degrees, colleges, certifications, and specializations.
                </p>
              </div>

              <button
                type="button"
                onClick={openAddEduModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Education</span>
              </button>
            </div>

            {eduFeedback && (
              <div
                className={`p-3 text-xs rounded-xl flex items-center justify-between ${
                  eduFeedback.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {eduFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{eduFeedback.message}</span>
                </div>
                <button onClick={() => setEduFeedback(null)} className="font-bold text-xs">✕</button>
              </div>
            )}

            {education.length > 0 ? (
              <div className="space-y-4">
                {education.map((edu, idx) => (
                  <div
                    key={edu.id || idx}
                    className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 hover:border-blue-200 transition-colors space-y-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">{edu.degree}</h3>
                          {edu.fieldOfStudy && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md text-[10px] font-semibold">
                              {edu.fieldOfStudy}
                            </span>
                          )}
                          {edu.grade && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px] font-semibold">
                              Grade: {edu.grade}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                          <span className="flex items-center gap-1 font-semibold text-slate-800">
                            <Building className="w-3.5 h-3.5 text-slate-500" />
                            {edu.school}
                          </span>
                          <span className="flex items-center gap-1 text-slate-500">
                            <Calendar className="w-3 h-3" />
                            {edu.year || (edu.startDate ? `${edu.startDate} - ${edu.endDate || ''}` : 'N/A')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-start">
                        <button
                          type="button"
                          onClick={() => openEditEduModal(edu)}
                          className="px-2.5 py-1.5 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-slate-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          title="Edit educational qualification"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEdu(edu.id)}
                          className="px-2.5 py-1.5 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-slate-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          title="Delete educational qualification"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>

                    {edu.description && (
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line border-t border-slate-200/60 pt-2">
                        {edu.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <GraduationCap className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">No educational qualifications added yet.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Click "Add Education" above to list your academic credentials.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 1: WORK EXPERIENCE                                                 */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {isExpModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-600" />
                <span>{editingExpId ? 'Edit Work Experience' : 'Add Work Experience'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsExpModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveExp} className="space-y-4">
              {/* Job Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Job Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={expFormData.title}
                  onChange={(e) => setExpFormData({ ...expFormData, title: e.target.value })}
                  placeholder="e.g. Senior Software Engineer, Product Manager"
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border ${
                    expErrors.title ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                {expErrors.title && <p className="text-[11px] text-rose-600 mt-1">{expErrors.title}</p>}
              </div>

              {/* Company & Employment Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Company Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={expFormData.company}
                    onChange={(e) => setExpFormData({ ...expFormData, company: e.target.value })}
                    placeholder="e.g. Microsoft, Google"
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border ${
                      expErrors.company ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                  {expErrors.company && <p className="text-[11px] text-rose-600 mt-1">{expErrors.company}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Employment Type
                  </label>
                  <select
                    value={expFormData.employmentType}
                    onChange={(e) => setExpFormData({ ...expFormData, employmentType: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                    <option value="Freelance">Freelance</option>
                  </select>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={expFormData.location}
                  onChange={(e) => setExpFormData({ ...expFormData, location: e.target.value })}
                  placeholder="e.g. Bangalore, India (or Remote)"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Dates & Currently Working */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="currentlyWorking"
                    checked={expFormData.currentlyWorking}
                    onChange={(e) => setExpFormData({ ...expFormData, currentlyWorking: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500"
                  />
                  <label htmlFor="currentlyWorking" className="text-xs font-medium text-slate-700 cursor-pointer">
                    I am currently working in this role
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="text"
                      value={expFormData.startDate}
                      onChange={(e) => setExpFormData({ ...expFormData, startDate: e.target.value })}
                      placeholder="e.g. Jan 2021 or 2021-01"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="text"
                      disabled={expFormData.currentlyWorking}
                      value={expFormData.currentlyWorking ? 'Present' : expFormData.endDate}
                      onChange={(e) => setExpFormData({ ...expFormData, endDate: e.target.value })}
                      placeholder="e.g. Present, Dec 2023 or 2023-12"
                      className={`w-full px-3.5 py-2 text-xs rounded-xl border ${
                        expErrors.endDate ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50'
                      } disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                    {expErrors.endDate && <p className="text-[11px] text-rose-600 mt-1">{expErrors.endDate}</p>}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Job Description &amp; Accomplishments
                </label>
                <textarea
                  rows={3}
                  value={expFormData.description}
                  onChange={(e) => setExpFormData({ ...expFormData, description: e.target.value })}
                  placeholder="Outline key responsibilities, leadership experience, and quantifiable achievements..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsExpModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingExp}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {savingExp ? 'Saving…' : editingExpId ? 'Save Changes' : 'Add Experience'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 2: EDUCATIONAL QUALIFICATIONS                                      */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {isEduModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-blue-600" />
                <span>{editingEduId ? 'Edit Educational Qualification' : 'Add Educational Qualification'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEduModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdu} className="space-y-4">
              {/* Degree */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Degree / Qualification <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={eduFormData.degree}
                  onChange={(e) => setEduFormData({ ...eduFormData, degree: e.target.value })}
                  placeholder="e.g. Bachelor of Technology, Master of Science, High School"
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border ${
                    eduErrors.degree ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                {eduErrors.degree && <p className="text-[11px] text-rose-600 mt-1">{eduErrors.degree}</p>}
              </div>

              {/* School / Institution */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Institution / University / School <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={eduFormData.school}
                  onChange={(e) => setEduFormData({ ...eduFormData, school: e.target.value })}
                  placeholder="e.g. Indian Institute of Technology, Stanford University"
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border ${
                    eduErrors.school ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                {eduErrors.school && <p className="text-[11px] text-rose-600 mt-1">{eduErrors.school}</p>}
              </div>

              {/* Field of Study & Grade */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Field of Study / Major
                  </label>
                  <input
                    type="text"
                    value={eduFormData.fieldOfStudy}
                    onChange={(e) => setEduFormData({ ...eduFormData, fieldOfStudy: e.target.value })}
                    placeholder="e.g. Computer Science, Mechanical Eng."
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Grade / CGPA / Percentage
                  </label>
                  <input
                    type="text"
                    value={eduFormData.grade}
                    onChange={(e) => setEduFormData({ ...eduFormData, grade: e.target.value })}
                    placeholder="e.g. 3.8 / 4.0 GPA, 85%"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Start & End Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Start Year / Date
                  </label>
                  <input
                    type="text"
                    value={eduFormData.startDate}
                    onChange={(e) => setEduFormData({ ...eduFormData, startDate: e.target.value })}
                    placeholder="e.g. 2018 or 2018-08"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Graduation Year / End Date
                  </label>
                  <input
                    type="text"
                    value={eduFormData.endDate}
                    onChange={(e) => setEduFormData({ ...eduFormData, endDate: e.target.value })}
                    placeholder="e.g. 2022 or 2022-05"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Academic Activities / Honors / Description
                </label>
                <textarea
                  rows={2}
                  value={eduFormData.description}
                  onChange={(e) => setEduFormData({ ...eduFormData, description: e.target.value })}
                  placeholder="e.g. Dean's Honour List, relevant coursework, thesis topic..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEduModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdu}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {savingEdu ? 'Saving…' : editingEduId ? 'Save Changes' : 'Add Qualification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
