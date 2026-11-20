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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { CandidateProfile, CandidateEducation, CandidateExperience } from '../../types';

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

  // Navigation tab state: 'personal' | 'education' | 'experience' | 'resume' | 'skills'
  const [activeTab, setActiveTab] = useState<'personal' | 'education' | 'experience' | 'resume' | 'skills'>('personal');

  // Candidate Profile state fetched from backend
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Education state
  const [educationList, setEducationList] = useState<CandidateEducation[]>([]);
  const [loadingEducation, setLoadingEducation] = useState(false);
  const [educationModalOpen, setEducationModalOpen] = useState(false);
  const [editingEducationId, setEditingEducationId] = useState<string | null>(null);
  const [educationForm, setEducationForm] = useState({
    institution: '',
    degree: '',
    fieldOfStudy: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    grade: '',
    description: '',
  });
  const [educationErrors, setEducationErrors] = useState<Record<string, string>>({});
  const [savingEducation, setSavingEducation] = useState(false);
  const [confirmDeleteEduId, setConfirmDeleteEduId] = useState<string | null>(null);
  const [deletingEdu, setDeletingEdu] = useState(false);

  // Experience state
  const [experienceList, setExperienceList] = useState<CandidateExperience[]>([]);
  const [loadingExperience, setLoadingExperience] = useState(false);
  const [experienceModalOpen, setExperienceModalOpen] = useState(false);
  const [editingExperienceId, setEditingExperienceId] = useState<string | null>(null);
  const [experienceForm, setExperienceForm] = useState({
    company: '',
    title: '',
    employmentType: 'Full-time',
    location: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    description: '',
  });
  const [experienceErrors, setExperienceErrors] = useState<Record<string, string>>({});
  const [savingExperience, setSavingExperience] = useState(false);
  const [confirmDeleteExpId, setConfirmDeleteExpId] = useState<string | null>(null);
  const [deletingExp, setDeletingExp] = useState(false);

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
      }
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchEducation = async () => {
    try {
      setLoadingEducation(true);
      const res = await api.getEducation();
      if (res?.education) {
        setEducationList(res.education);
      }
    } catch (err: any) {
      console.error('Failed to load education records:', err);
    } finally {
      setLoadingEducation(false);
    }
  };

  const fetchExperience = async () => {
    try {
      setLoadingExperience(true);
      const res = await api.getExperience();
      if (res?.experience) {
        setExperienceList(res.experience);
      }
    } catch (err: any) {
      console.error('Failed to load experience records:', err);
    } finally {
      setLoadingExperience(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchEducation();
    fetchExperience();
  }, []);

  // ── Education Handlers ──────────────────────────────────────────────────────
  const openAddEducation = () => {
    setEditingEducationId(null);
    setEducationForm({
      institution: '',
      degree: '',
      fieldOfStudy: '',
      startDate: '',
      endDate: '',
      isCurrent: false,
      grade: '',
      description: '',
    });
    setEducationErrors({});
    setEducationModalOpen(true);
  };

  const openEditEducation = (edu: CandidateEducation) => {
    setEditingEducationId(edu.id);
    setEducationForm({
      institution: edu.institution || '',
      degree: edu.degree || '',
      fieldOfStudy: edu.fieldOfStudy || '',
      startDate: edu.startDate || '',
      endDate: edu.endDate || '',
      isCurrent: Boolean(edu.isCurrent),
      grade: edu.grade || '',
      description: edu.description || '',
    });
    setEducationErrors({});
    setEducationModalOpen(true);
  };

  const validateEducationForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!educationForm.institution.trim()) {
      errs.institution = 'Institution / School name is required.';
    } else if (educationForm.institution.trim().length > 200) {
      errs.institution = 'Institution name cannot exceed 200 characters.';
    }
    if (!educationForm.degree.trim()) {
      errs.degree = 'Degree or qualification is required.';
    } else if (educationForm.degree.trim().length > 150) {
      errs.degree = 'Degree cannot exceed 150 characters.';
    }
    setEducationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveEducation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEducationForm()) return;

    try {
      setSavingEducation(true);
      setSaveError(null);
      const payload = {
        institution: educationForm.institution.trim(),
        degree: educationForm.degree.trim(),
        fieldOfStudy: educationForm.fieldOfStudy.trim() || undefined,
        startDate: educationForm.startDate.trim() || undefined,
        endDate: educationForm.isCurrent ? undefined : (educationForm.endDate.trim() || undefined),
        isCurrent: educationForm.isCurrent,
        grade: educationForm.grade.trim() || undefined,
        description: educationForm.description.trim() || undefined,
      };

      if (editingEducationId) {
        const res = await api.updateEducation(editingEducationId, payload);
        if (res?.education) {
          setEducationList((prev) =>
            prev.map((item) => (item.id === editingEducationId ? res.education : item))
          );
        }
        setSuccessMessage('Educational qualification updated successfully.');
      } else {
        const res = await api.addEducation(payload);
        if (res?.education) {
          setEducationList((prev) => [...prev, res.education]);
        }
        setSuccessMessage('Educational qualification added successfully.');
      }

      setEducationModalOpen(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save educational qualification.');
    } finally {
      setSavingEducation(false);
    }
  };

  const handleDeleteEducation = async (id: string) => {
    try {
      setDeletingEdu(true);
      setSaveError(null);
      await api.deleteEducation(id);
      setEducationList((prev) => prev.filter((item) => item.id !== id));
      setConfirmDeleteEduId(null);
      setSuccessMessage('Educational qualification deleted successfully.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to delete educational qualification.');
    } finally {
      setDeletingEdu(false);
    }
  };

  // ── Work Experience Handlers ────────────────────────────────────────────────
  const openAddExperience = () => {
    setEditingExperienceId(null);
    setExperienceForm({
      company: '',
      title: '',
      employmentType: 'Full-time',
      location: '',
      startDate: '',
      endDate: '',
      isCurrent: false,
      description: '',
    });
    setExperienceErrors({});
    setExperienceModalOpen(true);
  };

  const openEditExperience = (exp: CandidateExperience) => {
    setEditingExperienceId(exp.id);
    setExperienceForm({
      company: exp.company || '',
      title: exp.title || '',
      employmentType: exp.employmentType || 'Full-time',
      location: exp.location || '',
      startDate: exp.startDate || '',
      endDate: exp.endDate || '',
      isCurrent: Boolean(exp.isCurrent),
      description: exp.description || '',
    });
    setExperienceErrors({});
    setExperienceModalOpen(true);
  };

  const validateExperienceForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!experienceForm.company.trim()) {
      errs.company = 'Company name is required.';
    } else if (experienceForm.company.trim().length > 200) {
      errs.company = 'Company name cannot exceed 200 characters.';
    }
    if (!experienceForm.title.trim()) {
      errs.title = 'Job title / Designation is required.';
    } else if (experienceForm.title.trim().length > 150) {
      errs.title = 'Job title cannot exceed 150 characters.';
    }
    setExperienceErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveExperience = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateExperienceForm()) return;

    try {
      setSavingExperience(true);
      setSaveError(null);
      const payload = {
        company: experienceForm.company.trim(),
        title: experienceForm.title.trim(),
        employmentType: experienceForm.employmentType.trim() || undefined,
        location: experienceForm.location.trim() || undefined,
        startDate: experienceForm.startDate.trim() || undefined,
        endDate: experienceForm.isCurrent ? undefined : (experienceForm.endDate.trim() || undefined),
        isCurrent: experienceForm.isCurrent,
        description: experienceForm.description.trim() || '',
      };

      if (editingExperienceId) {
        const res = await api.updateExperience(editingExperienceId, payload);
        if (res?.experience) {
          setExperienceList((prev) =>
            prev.map((item) => (item.id === editingExperienceId ? res.experience : item))
          );
        }
        setSuccessMessage('Work experience record updated successfully.');
      } else {
        const res = await api.addExperience(payload);
        if (res?.experience) {
          setExperienceList((prev) => [...prev, res.experience]);
        }
        setSuccessMessage('Work experience record added successfully.');
      }

      setExperienceModalOpen(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save work experience record.');
    } finally {
      setSavingExperience(false);
    }
  };

  const handleDeleteExperience = async (id: string) => {
    try {
      setDeletingExp(true);
      setSaveError(null);
      await api.deleteExperience(id);
      setExperienceList((prev) => prev.filter((item) => item.id !== id));
      setConfirmDeleteExpId(null);
      setSuccessMessage('Work experience record deleted successfully.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to delete work experience record.');
    } finally {
      setDeletingExp(false);
    }
  };

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
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      const updatedSkills = [...skills, newSkill.trim()];
      setSkills(updatedSkills);
      setNewSkill('');
      try {
        setSavingSkills(true);
        await api.updateCandidateProfile({
          name: formData.name || profile?.name || user?.name || '',
          email: formData.email || profile?.email || user?.email || '',
          skills: updatedSkills,
        });
        updateCurrentUser({ skills: updatedSkills });
      } catch {
        // non-fatal
      } finally {
        setSavingSkills(false);
      }
    }
  };

  const handleRemoveSkill = async (s: string) => {
    const updatedSkills = skills.filter((x) => x !== s);
    setSkills(updatedSkills);
    try {
      setSavingSkills(true);
      await api.updateCandidateProfile({
        name: formData.name || profile?.name || user?.name || '',
        email: formData.email || profile?.email || user?.email || '',
        skills: updatedSkills,
      });
      updateCurrentUser({ skills: updatedSkills });
    } catch {
      // non-fatal
    } finally {
      setSavingSkills(false);
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
        <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('personal')}
            className={`flex items-center gap-2 py-3 px-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
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
            onClick={() => setActiveTab('education')}
            className={`flex items-center gap-2 py-3 px-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'education'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Education</span>
            {educationList.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold">
                {educationList.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('experience')}
            className={`flex items-center gap-2 py-3 px-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'experience'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Work Experience</span>
            {experienceList.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold">
                {experienceList.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('skills')}
            className={`flex items-center gap-2 py-3 px-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'skills'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Skills</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('resume')}
            className={`flex items-center gap-2 py-3 px-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'resume'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Resume &amp; Documents</span>
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
      {/* TAB 2: EDUCATIONAL QUALIFICATIONS                                        */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'education' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-blue-600" />
                  <span>Educational Qualifications</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Add and manage your academic degrees, diplomas, fields of study, and qualifications.
                </p>
              </div>

              <button
                type="button"
                onClick={openAddEducation}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Education</span>
              </button>
            </div>

            {loadingEducation ? (
              <div className="py-12 text-center text-xs text-slate-500">
                <RefreshCw className="w-5 h-5 text-blue-600 animate-spin mx-auto mb-2" />
                <span>Loading educational qualifications from database…</span>
              </div>
            ) : educationList.length === 0 ? (
              <div className="py-12 px-4 border-2 border-dashed border-slate-200 rounded-2xl text-center space-y-3 bg-slate-50/50">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div className="max-w-sm mx-auto">
                  <p className="text-sm font-bold text-slate-800">No educational qualifications added yet</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Showcase your academic background to recruiters by adding your degrees, coursework, or certifications.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openAddEducation}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Your First Qualification</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {educationList.map((edu) => (
                  <div
                    key={edu.id}
                    className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-xs flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                          {edu.degree}
                        </h3>
                        {edu.fieldOfStudy && (
                          <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[11px] font-semibold">
                            {edu.fieldOfStudy}
                          </span>
                        )}
                        {edu.isCurrent && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold uppercase tracking-wider">
                            Currently Studying
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{edu.institution}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500">
                        {(edu.startDate || edu.endDate || edu.isCurrent) && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>
                              {edu.startDate || 'Start'} &ndash;{' '}
                              {edu.isCurrent ? 'Present' : (edu.endDate || 'End')}
                            </span>
                          </div>
                        )}
                        {edu.grade && (
                          <div className="flex items-center gap-1 font-medium text-slate-600">
                            <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>Grade / CGPA: {edu.grade}</span>
                          </div>
                        )}
                      </div>

                      {edu.description && (
                        <p className="text-xs text-slate-600 leading-relaxed pt-1 whitespace-pre-line">
                          {edu.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <button
                        type="button"
                        onClick={() => openEditEducation(edu)}
                        className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        title="Edit Qualification"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfirmDeleteEduId(edu.id)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        title="Delete Qualification"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: WORK EXPERIENCE                                                   */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'experience' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                  <span>Work Experience</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Add and manage your professional career history, job responsibilities, and achievements.
                </p>
              </div>

              <button
                type="button"
                onClick={openAddExperience}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Experience</span>
              </button>
            </div>

            {loadingExperience ? (
              <div className="py-12 text-center text-xs text-slate-500">
                <RefreshCw className="w-5 h-5 text-blue-600 animate-spin mx-auto mb-2" />
                <span>Loading work experience records from database…</span>
              </div>
            ) : experienceList.length === 0 ? (
              <div className="py-12 px-4 border-2 border-dashed border-slate-200 rounded-2xl text-center space-y-3 bg-slate-50/50">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div className="max-w-sm mx-auto">
                  <p className="text-sm font-bold text-slate-800">No work experience added yet</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Highlight your career accomplishments, designations, and responsibilities to stand out to hiring managers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openAddExperience}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Your First Experience</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {experienceList.map((exp) => (
                  <div
                    key={exp.id}
                    className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-xs flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                          {exp.title}
                        </h3>
                        {exp.employmentType && (
                          <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-[11px] font-semibold">
                            {exp.employmentType}
                          </span>
                        )}
                        {exp.isCurrent && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold uppercase tracking-wider">
                            Currently Working
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-semibold text-slate-700 flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{exp.company}</span>
                        </span>
                        {exp.location && (
                          <span className="flex items-center gap-1 text-slate-500">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{exp.location}</span>
                          </span>
                        )}
                      </div>

                      {(exp.startDate || exp.endDate || exp.isCurrent) && (
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            {exp.startDate || 'Start'} &ndash;{' '}
                            {exp.isCurrent ? 'Present' : (exp.endDate || 'Present')}
                          </span>
                        </div>
                      )}

                      {exp.description && (
                        <p className="text-xs text-slate-600 leading-relaxed pt-1 whitespace-pre-line">
                          {exp.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <button
                        type="button"
                        onClick={() => openEditExperience(exp)}
                        className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        title="Edit Experience"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfirmDeleteExpId(exp.id)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        title="Delete Experience"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Technical Skills Management</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Add skills to power algorithmic job matches and improve your ranking on candidate search boards.
              </p>
            </div>

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
                      className="hover:text-rose-600 focus:outline-none transition-colors"
                      title="Remove skill"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {skills.length === 0 && (
                  <span className="text-xs text-slate-400 italic">No technical skills added yet.</span>
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
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Skill</span>
                </button>
              </form>
            </div>

            {/* Experience & Education Preview */}
            <div className="pt-6 border-t border-slate-100 space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-slate-500" />
                <span>Professional Experience &amp; Education Summary</span>
              </h3>

              {user?.experience && user.experience.length > 0 ? (
                <div className="space-y-3">
                  {user.experience.map((exp, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                      <p className="font-bold text-slate-800">{exp.title} &bull; {exp.company}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{exp.period}</p>
                      <p className="text-slate-600 mt-1 leading-relaxed">{exp.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  Upload your resume in the "Resume &amp; Documents" tab to automatically extract your work history.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 1: ADD / EDIT EDUCATION                                            */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {educationModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingEducationId ? 'Edit Educational Qualification' : 'Add Educational Qualification'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEducationModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEducation} className="space-y-4">
              {/* Institution / University */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Institution / School / University <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={educationForm.institution}
                  onChange={(e) => setEducationForm({ ...educationForm, institution: e.target.value })}
                  placeholder="e.g. Stanford University or MIT"
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 ${
                    educationErrors.institution
                      ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/30'
                      : 'border-slate-200 focus:ring-blue-500'
                  }`}
                />
                {educationErrors.institution && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">{educationErrors.institution}</p>
                )}
              </div>

              {/* Degree & Field of Study */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Degree / Qualification <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={educationForm.degree}
                    onChange={(e) => setEducationForm({ ...educationForm, degree: e.target.value })}
                    placeholder="e.g. Bachelor of Science"
                    className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 ${
                      educationErrors.degree
                        ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/30'
                        : 'border-slate-200 focus:ring-blue-500'
                    }`}
                  />
                  {educationErrors.degree && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1">{educationErrors.degree}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Field of Study
                  </label>
                  <input
                    type="text"
                    value={educationForm.fieldOfStudy}
                    onChange={(e) => setEducationForm({ ...educationForm, fieldOfStudy: e.target.value })}
                    placeholder="e.g. Computer Science"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Start Date, End Date, Currently Studying */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Start Date
                    </label>
                    <input
                      type="text"
                      value={educationForm.startDate}
                      onChange={(e) => setEducationForm({ ...educationForm, startDate: e.target.value })}
                      placeholder="e.g. 2018 or Sep 2018"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      End Date
                    </label>
                    <input
                      type="text"
                      disabled={educationForm.isCurrent}
                      value={educationForm.isCurrent ? 'Present' : educationForm.endDate}
                      onChange={(e) => setEducationForm({ ...educationForm, endDate: e.target.value })}
                      placeholder="e.g. 2022 or May 2022"
                      className={`w-full px-3.5 py-2.5 border rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        educationForm.isCurrent ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={educationForm.isCurrent}
                    onChange={(e) => setEducationForm({ ...educationForm, isCurrent: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span>I am currently studying here</span>
                </label>
              </div>

              {/* Grade / Percentage / CGPA */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Grade / CGPA / Percentage
                </label>
                <input
                  type="text"
                  value={educationForm.grade}
                  onChange={(e) => setEducationForm({ ...educationForm, grade: e.target.value })}
                  placeholder="e.g. 3.8 / 4.0 or 85% or First Class with Distinction"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Activities / Description
                </label>
                <textarea
                  rows={3}
                  value={educationForm.description}
                  onChange={(e) => setEducationForm({ ...educationForm, description: e.target.value })}
                  placeholder="Relevant courses, academic projects, honors, or extracurricular activities..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEducationModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingEducation}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors"
                >
                  {savingEducation ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>{editingEducationId ? 'Update Qualification' : 'Save Qualification'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 2: DELETE EDUCATION CONFIRMATION                                   */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {confirmDeleteEduId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Educational Qualification</h3>
                <p className="text-xs text-slate-500 mt-0.5">Are you sure you want to remove this qualification?</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This entry will be permanently removed from your profile and database. You can add it back later if needed.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteEduId(null)}
                disabled={deletingEdu}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleDeleteEducation(confirmDeleteEduId)}
                disabled={deletingEdu}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                {deletingEdu ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting…</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 3: ADD / EDIT WORK EXPERIENCE                                      */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {experienceModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Briefcase className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingExperienceId ? 'Edit Work Experience' : 'Add Work Experience'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setExperienceModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExperience} className="space-y-4">
              {/* Job Title & Company */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Job Title / Designation <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={experienceForm.title}
                    onChange={(e) => setExperienceForm({ ...experienceForm, title: e.target.value })}
                    placeholder="e.g. Senior Software Engineer"
                    className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 ${
                      experienceErrors.title
                        ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/30'
                        : 'border-slate-200 focus:ring-blue-500'
                    }`}
                  />
                  {experienceErrors.title && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1">{experienceErrors.title}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Company Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={experienceForm.company}
                    onChange={(e) => setExperienceForm({ ...experienceForm, company: e.target.value })}
                    placeholder="e.g. TechCorp Solutions"
                    className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 ${
                      experienceErrors.company
                        ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/30'
                        : 'border-slate-200 focus:ring-blue-500'
                    }`}
                  />
                  {experienceErrors.company && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1">{experienceErrors.company}</p>
                  )}
                </div>
              </div>

              {/* Employment Type & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Employment Type
                  </label>
                  <select
                    value={experienceForm.employmentType}
                    onChange={(e) => setExperienceForm({ ...experienceForm, employmentType: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                    <option value="Freelance">Freelance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={experienceForm.location}
                    onChange={(e) => setExperienceForm({ ...experienceForm, location: e.target.value })}
                    placeholder="e.g. San Francisco, CA or Remote"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Start Date, End Date, Currently Working */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Start Date
                    </label>
                    <input
                      type="text"
                      value={experienceForm.startDate}
                      onChange={(e) => setExperienceForm({ ...experienceForm, startDate: e.target.value })}
                      placeholder="e.g. 2021 or Jan 2021"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      End Date
                    </label>
                    <input
                      type="text"
                      disabled={experienceForm.isCurrent}
                      value={experienceForm.isCurrent ? 'Present' : experienceForm.endDate}
                      onChange={(e) => setExperienceForm({ ...experienceForm, endDate: e.target.value })}
                      placeholder="e.g. 2024 or Oct 2024"
                      className={`w-full px-3.5 py-2.5 border rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        experienceForm.isCurrent ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={experienceForm.isCurrent}
                    onChange={(e) => setExperienceForm({ ...experienceForm, isCurrent: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span>I currently work here</span>
                </label>
              </div>

              {/* Job Responsibilities / Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Job Responsibilities &amp; Achievements
                </label>
                <textarea
                  rows={4}
                  value={experienceForm.description}
                  onChange={(e) => setExperienceForm({ ...experienceForm, description: e.target.value })}
                  placeholder="Describe key responsibilities, leadership, technologies used, and business impacts achieved..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setExperienceModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingExperience}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors"
                >
                  {savingExperience ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>{editingExperienceId ? 'Update Experience' : 'Save Experience'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 4: DELETE EXPERIENCE CONFIRMATION                                  */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {confirmDeleteExpId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Work Experience</h3>
                <p className="text-xs text-slate-500 mt-0.5">Are you sure you want to remove this experience record?</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This record will be permanently deleted from your candidate profile and database. You can add it back later if needed.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteExpId(null)}
                disabled={deletingExp}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleDeleteExperience(confirmDeleteExpId)}
                disabled={deletingExp}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                {deletingExp ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting…</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
