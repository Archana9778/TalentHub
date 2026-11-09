import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  FileText,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Download,
  Clock,
  RefreshCw,
  HardDrive,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

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

  // Basic Info Form
  const [name, setName] = useState(user?.name || '');
  const [title, setTitle] = useState(user?.title || '');
  const [location, setLocation] = useState(user?.location || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [bio, setBio] = useState(user?.bio || '');

  // Skills
  const [skills, setSkills] = useState<string[]>(user?.skills || []);
  const [newSkill, setNewSkill] = useState('');

  // Resume state
  const [resumeHistory, setResumeHistory] = useState<ResumeDocument[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeSuccess, setResumeSuccess] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile save feedback
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  // Load resume history on mount
  useEffect(() => {
    if (user?.role !== 'candidate') return;
    setHistoryLoading(true);
    api.getResumeHistory()
      .then((data) => setResumeHistory(data.history || []))
      .catch(() => { /* non-fatal */ })
      .finally(() => setHistoryLoading(false));
  }, [user?.role]);

  // ── Skill handlers ──────────────────────────────────────────────────────────

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (s: string) => setSkills(skills.filter((x) => x !== s));

  // ── Profile save ────────────────────────────────────────────────────────────

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage(null);
    try {
      const res = await api.updateProfile({ name, title, location, phone, bio, skills });
      updateCurrentUser(res.user);
      setProfileMessage('Candidate profile successfully updated!');
      setTimeout(() => setProfileMessage(null), 3000);
    } catch (err: any) {
      setProfileMessage(err.message || 'Error updating profile');
    } finally {
      setSavingProfile(false);
    }
  };

  // ── File selection ──────────────────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setResumeError(null);
    setResumeSuccess(null);
    // Client-side pre-validation for immediate feedback
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'pdf' && ext !== 'docx') {
        setResumeError('Only PDF and DOCX files are accepted.');
        setSelectedFile(null);
        return;
      }
      const maxMb = 5;
      if (file.size > maxMb * 1024 * 1024) {
        setResumeError(`File exceeds the ${maxMb} MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).`);
        setSelectedFile(null);
        return;
      }
    }
  };

  // ── Upload ──────────────────────────────────────────────────────────────────

  const handleResumeUpload = async () => {
    if (!selectedFile) return;

    setUploadingResume(true);
    setUploadProgress(0);
    setResumeError(null);
    setResumeSuccess(null);

    try {
      const res = await api.uploadResume(selectedFile, (pct) => setUploadProgress(pct));

      // Update history list
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

  // ── Download (SAS URL) ──────────────────────────────────────────────────────

  const handleDownload = async (id: string, filename: string) => {
    setDownloading(id);
    try {
      const { downloadUrl } = await api.getResumeDownloadUrl(id);
      // Open SAS URL in new tab — the browser will download the file
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      alert(`Could not generate download link: ${err.message}`);
    } finally {
      setDownloading(null);
    }
  };

  const currentResume = resumeHistory.find((d) => d.isCurrent) ?? null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 w-full max-w-5xl">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Candidate Profile &amp; Resume Management
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Keep your skills and resume current so Azure Document Intelligence can rank you higher on relevant job postings.
        </p>
      </div>

      {profileMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{profileMessage}</span>
        </div>
      )}

      {/* ── Resume Upload Card ────────────────────────────────────────────────── */}
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
          Upload a PDF or DOCX resume (max 5 MB). Your file is validated, checksummed and stored in Azure Blob Storage.
          A short-lived secure link is generated for downloads — no public URLs are created.
        </p>

        {/* Success / Error banners */}
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
        {currentResume ? (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3 text-xs">
            <HardDrive className="w-4 h-4 text-blue-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 truncate">{currentResume.originalFilename}</p>
              <p className="text-slate-400">
                {formatBytes(currentResume.fileSizeBytes)} &bull; Uploaded {formatDate(currentResume.uploadedAt)}
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
                {currentResume ? 'Replace current resume' : 'Upload your resume'}
              </p>
              <p className="text-xs text-slate-400 mt-1">PDF or DOCX &bull; Max 5 MB</p>
            </div>
          )}

          <label className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors">
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

        {/* Progress bar — shown during upload */}
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

        {/* Upload button */}
        <button
          onClick={handleResumeUpload}
          disabled={!selectedFile || uploadingResume}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl text-sm shadow-sm transition-colors disabled:cursor-not-allowed"
        >
          {uploadingResume ? `Uploading… (${uploadProgress}%)` : currentResume ? 'Replace Resume' : 'Upload Resume'}
        </button>
      </div>

      {/* ── Resume Version History ──────────────────────────────────────────── */}
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

      {/* ── Basic Profile Details ───────────────────────────────────────────── */}
      <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
        <h2 className="text-base font-bold text-slate-900">Personal Information</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Professional Headline / Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Full Stack Engineer"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Seattle, WA"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Phone Number
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Bio &amp; Professional Summary
          </label>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Summarize your technical background and career objectives..."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Skills Tag Manager */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Technical Skills ({skills.length})
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium"
              >
                <span>{skill}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(skill)}
                  className="hover:text-rose-600 focus:outline-none"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSkill(e)}
              placeholder="Add skill (e.g. Terraform, Kubernetes, Docker)..."
              className="w-64 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleAddSkill}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={savingProfile}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md disabled:opacity-50 transition-all"
          >
            {savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};
