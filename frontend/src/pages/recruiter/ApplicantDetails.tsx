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
} from 'lucide-react';
import { api } from '../../services/api';
import { Application, User as UserType, Job, ApplicationStage } from '../../types';
import { Loading } from '../../components/Loading';

export const ApplicantDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [application, setApplication] = useState<Application | null>(null);
  const [candidate, setCandidate] = useState<UserType | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  // Recruiter notes
  const [recruiterNotes, setRecruiterNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSuccess, setNotesSuccess] = useState(false);

  // Quick stage transition
  const [selectedStage, setSelectedStage] = useState<ApplicationStage>('Interview');
  const [stageComment, setStageComment] = useState('');
  const [interviewDate, setInterviewDate] = useState('');
  const [updatingStage, setUpdatingStage] = useState(false);
  const [stageSuccess, setStageSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const data = await api.getApplicationById(id);
        setApplication(data.application);
        setCandidate(data.candidate);
        setJob(data.job);
        setRecruiterNotes(data.application.recruiterNotes || '');
        setSelectedStage(data.application.stage);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleSaveNotes = async () => {
    if (!application) return;
    setSavingNotes(true);
    try {
      const res = await api.updateApplicationStage(application.id, {
        stage: application.stage,
        recruiterNotes,
      });
      setApplication(res.application);
      setNotesSuccess(true);
      setTimeout(() => setNotesSuccess(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleStageChange = async (newStage: ApplicationStage) => {
    if (!application) return;
    setUpdatingStage(true);
    try {
      const res = await api.updateApplicationStage(application.id, {
        stage: newStage,
        comment: stageComment || `Moved to ${newStage}`,
        interviewDate: newStage === 'Interview' ? interviewDate : undefined,
      });
      setApplication(res.application);
      setSelectedStage(newStage);
      setStageSuccess(`Candidate moved to ${newStage}!`);
      setTimeout(() => setStageSuccess(null), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingStage(false);
    }
  };

  if (loading) return <Loading message="Loading candidate application details..." />;
  if (!application) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
        <p className="text-slate-600 font-semibold">Application record not found</p>
        <Link to="/recruiter/applicants" className="mt-4 text-xs text-purple-600 font-bold">
          ← Back to ATS Board
        </Link>
      </div>
    );
  }

  const stages: ApplicationStage[] = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link
        to="/recruiter/applicants"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to ATS Candidates Board</span>
      </Link>

      {/* Main Candidate Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <img
              src={
                candidate?.avatarUrl ||
                application.candidateAvatar ||
                `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                  application.candidateName
                )}`
              }
              alt={application.candidateName}
              className="w-16 h-16 rounded-2xl object-cover border border-slate-200"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  {application.candidateName}
                </h1>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700">
                  {application.candidateTitle || 'Candidate'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2">
                <div className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{application.candidateEmail}</span>
                </div>
                {application.candidatePhone && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{application.candidatePhone}</span>
                  </div>
                )}
                {candidate?.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{candidate.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center shrink-0">
              <div className="flex items-center gap-1 text-emerald-800 font-extrabold text-lg justify-center">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>{application.matchScore}%</span>
              </div>
              <div className="text-[10px] text-emerald-600 font-semibold uppercase">
                AI Match Score
              </div>
            </div>

            <a
              href={application.resumeUrl}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>View Resume File</span>
            </a>
          </div>
        </div>
      </div>

      {/* Stage Progression Stepper Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Move Candidate Through Stages
          </h2>
          {stageSuccess && (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>{stageSuccess}</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {stages.map((stg) => {
            const isCurrent = application.stage === stg;
            return (
              <button
                key={stg}
                disabled={updatingStage}
                onClick={() => handleStageChange(stg)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  isCurrent
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-2 ring-purple-200'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {stg} {isCurrent && '✓'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid: AI Analysis, Cover Letter, Recruiter Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Match Score Details */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Azure AI Document Intelligence Match Breakdown</span>
            </h2>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 italic">
              "{application.matchDetails.analysisNotes}"
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
              <div>
                <span className="font-bold text-slate-700">Matched Skills ({application.matchDetails.matchedSkills.length}):</span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {application.matchDetails.matchedSkills.map((s) => (
                    <span
                      key={s}
                      className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg font-medium text-[11px]"
                    >
                      ✓ {s}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-700">Missing Required Skills:</span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {application.matchDetails.missingSkills.map((s) => (
                    <span
                      key={s}
                      className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg font-medium text-[11px]"
                    >
                      {s}
                    </span>
                  ))}
                  {application.matchDetails.missingSkills.length === 0 && (
                    <span className="text-emerald-700 italic">No missing skills detected!</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Candidate Cover Letter */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-2">
            <h2 className="text-base font-bold text-slate-900">Cover Letter / Note</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-200/60">
              {application.coverLetter || 'No cover letter provided with this application.'}
            </p>
          </div>

          {/* Audit History Timeline */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-3">
            <h2 className="text-base font-bold text-slate-900">Application Audit Trail</h2>
            <div className="space-y-2.5">
              {application.timeline.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs flex items-start justify-between gap-3"
                >
                  <div>
                    <span className="font-bold text-slate-800">{item.stage}</span>
                    <p className="text-slate-600 text-[11px] mt-0.5">{item.comment}</p>
                    <span className="text-[10px] text-slate-400">Changed by {item.changedByName}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">
                    {new Date(item.changedAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Recruiter Private Notes */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Recruiter Notes</h3>
              {notesSuccess && (
                <span className="text-[10px] font-bold text-emerald-600">Saved!</span>
              )}
            </div>
            <textarea
              rows={6}
              value={recruiterNotes}
              onChange={(e) => setRecruiterNotes(e.target.value)}
              placeholder="Private assessment notes, salary expectations, interview impressions..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingNotes ? 'Saving...' : 'Save Notes'}</span>
            </button>
          </div>

          {/* Job Details Card */}
          {job && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs text-xs space-y-2">
              <h3 className="font-bold text-slate-900 text-sm">Target Requisition</h3>
              <div className="font-semibold text-slate-800">{job.title}</div>
              <div className="text-slate-500">{job.location} • {job.workplaceType}</div>
              <div className="text-emerald-700 font-semibold">
                ${(job.salaryMin / 1000).toFixed(0)}k - ${(job.salaryMax / 1000).toFixed(0)}k
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

