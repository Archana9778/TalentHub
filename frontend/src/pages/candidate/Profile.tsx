import React, { useState } from 'react';
import {
  User,
  Upload,
  FileText,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  GraduationCap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

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

  // Resume upload
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeSuccess, setResumeSuccess] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);

  // Profile save feedback
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      const updated = [...skills, newSkill.trim()];
      setSkills(updated);
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage(null);

    try {
      const res = await api.updateProfile({
        name,
        title,
        location,
        phone,
        bio,
        skills,
      });
      updateCurrentUser(res.user);
      setProfileMessage('Candidate profile successfully updated!');
      setTimeout(() => setProfileMessage(null), 3000);
    } catch (err: any) {
      setProfileMessage(err.message || 'Error updating profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];
    setUploadingResume(true);
    setResumeError(null);
    setResumeSuccess(null);

    try {
      const res = await api.uploadResume(file);
      updateCurrentUser(res.user);
      if (res.user.skills) setSkills(res.user.skills);
      setResumeSuccess(
        `Resume processed with the local heuristic parser. ${res.parsedData.extractedSkills.length} skills found.`
      );
    } catch (err: any) {
      setResumeError(err.message || 'Resume upload failed');
    } finally {
      setUploadingResume(false);
    }
  };

  return (
    <div className="space-y-8 w-full max-w-5xl">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Candidate Profile & Resume Management
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Keep your skills and resume current to improve local job match estimates.
        </p>
      </div>

      {profileMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{profileMessage}</span>
        </div>
      )}

      {/* Resume Upload & Parsing Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>Resume Parsing</span>
          </h2>
          <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-semibold">
            Local Heuristic Parser
          </span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Upload a PDF or Word resume. TalentHub uses local heuristics to suggest skills, experience, and a summary; results may be approximate.
        </p>

        {resumeSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium">
            {resumeSuccess}
          </div>
        )}
        {resumeError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
            {resumeError}
          </div>
        )}

        <div className="p-6 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50/60 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
            <FileText className="w-6 h-6" />
          </div>

          <div className="text-sm font-bold text-slate-800">
            {user?.resumeOriginalName ? (
              <span>Current Resume: {user.resumeOriginalName}</span>
            ) : (
              <span>No resume uploaded yet</span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Supports PDF, DOC, DOCX up to 10MB
          </p>

          <label className="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition-colors">
            <span>{uploadingResume ? 'Processing Resume...' : 'Upload New Resume'}</span>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              disabled={uploadingResume}
              onChange={handleResumeUpload}
              className="hidden"
            />
          </label>
        </div>

        {user?.parsedResumeData && (
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 text-xs">
            <div className="font-semibold text-slate-700 flex items-center justify-between">
              <span>Parser Summary:</span>
              <span className="text-[10px] text-slate-400">
                Parsed: {new Date(user.parsedResumeData.extractedAt).toLocaleString()}
              </span>
            </div>
            <p className="text-slate-600 italic">
              "{user.parsedResumeData.summary}"
            </p>
            <div className="text-slate-500">
              <span className="font-medium">Estimated Experience:</span> {user.parsedResumeData.experienceYears} Years •{' '}
              <span className="font-medium">Education Level:</span> {user.parsedResumeData.educationLevel}
            </div>
          </div>
        )}
      </div>

      {/* Basic Profile Details */}
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
            Bio & Professional Summary
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


