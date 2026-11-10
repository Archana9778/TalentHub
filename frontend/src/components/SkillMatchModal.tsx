import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Layers,
  Sparkles,
  AlertCircle,
  Briefcase,
  User,
} from 'lucide-react';
import { api } from '../services/api';
import { SkillComparisonResult } from '../types';

interface SkillMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId?: string;
  candidateId?: string;
  candidateName?: string;
  jobTitle?: string;
  initialData?: SkillComparisonResult | null;
}

export const SkillMatchModal: React.FC<SkillMatchModalProps> = ({
  isOpen,
  onClose,
  jobId,
  candidateId,
  candidateName: propCandidateName,
  jobTitle: propJobTitle,
  initialData,
}) => {
  const [data, setData] = useState<SkillComparisonResult | null>(initialData || null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setData(initialData);
      return;
    }

    if (jobId && candidateId) {
      // Prevent duplicate API request if comparison data is already loaded for this candidate & job
      if (data && data.jobId === jobId && data.candidateId === candidateId) {
        return;
      }

      setLoading(true);
      setError(null);
      api.getCandidateSkillMatch(jobId, candidateId)
        .then((res) => {
          setData(res);
        })
        .catch((err) => {
          console.error('[SkillMatchModal] Failed to load skill comparison:', err);
          setError(
            err.response?.data?.message ||
              'Could not load candidate skills comparison for this job.'
          );
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, jobId, candidateId, initialData, data]);

  if (!isOpen) return null;

  const candidateName = data?.candidateName || propCandidateName || 'Candidate';
  const jobTitle = data?.jobTitle || propJobTitle || 'Job Requisition';
  const percentage = data?.matchingPercentage ?? 0;

  // Determine progress bar / badge color
  const getBadgeColor = (pct: number) => {
    if (pct >= 80) return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', bar: 'bg-emerald-500' };
    if (pct >= 60) return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300', bar: 'bg-blue-500' };
    if (pct >= 40) return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300', bar: 'bg-amber-500' };
    return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300', bar: 'bg-rose-500' };
  };

  const badgeTheme = getBadgeColor(percentage);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4 bg-linear-to-r from-slate-50 via-white to-purple-50/30">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                <Layers className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-extrabold text-slate-900">Candidate Skills vs Job Requirements</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Candidate: <span className="text-slate-900 font-bold">{candidateName}</span>
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-medium text-slate-600 flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                Position: <span className="text-slate-800">{jobTitle}</span>
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            title="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
          {loading && (
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-500">Comparing candidate profile skills against position requirements...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Error loading skills comparison</p>
                <p className="mt-0.5 text-rose-700">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* Skill Match Gauge Card */}
              <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Skill Matching Score</span>
                    <div className="text-xs text-slate-600 mt-0.5">
                      Based on <span className="font-bold text-slate-900">{data.totalRequiredSkills}</span> required job skills
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-3xl font-black ${badgeTheme.text}`}>
                      {data.matchingPercentage}%
                    </span>
                    <span className="text-xs text-slate-400 font-medium block">Match Ratio</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${badgeTheme.bar} rounded-full transition-all duration-500`}
                    style={{ width: `${data.matchingPercentage}%` }}
                  />
                </div>

                {/* Summary Stat Pills */}
                <div className="grid grid-cols-3 gap-2.5 pt-1 text-center">
                  <div className="bg-emerald-50/80 border border-emerald-200/80 p-2.5 rounded-xl">
                    <div className="text-base font-extrabold text-emerald-700">{data.matchedCount}</div>
                    <div className="text-[11px] font-semibold text-emerald-800">Matching Skills</div>
                  </div>
                  <div className="bg-rose-50/80 border border-rose-200/80 p-2.5 rounded-xl">
                    <div className="text-base font-extrabold text-rose-700">{data.missingCount}</div>
                    <div className="text-[11px] font-semibold text-rose-800">Missing Skills</div>
                  </div>
                  <div className="bg-blue-50/80 border border-blue-200/80 p-2.5 rounded-xl">
                    <div className="text-base font-extrabold text-blue-700">{data.additionalCount}</div>
                    <div className="text-[11px] font-semibold text-blue-800">Additional Skills</div>
                  </div>
                </div>
              </div>

              {/* 3 Color-Coded Skill Categories */}
              <div className="space-y-4">
                {/* 1. MATCHING SKILLS (GREEN) */}
                <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-emerald-100 text-emerald-700 rounded-md">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                        Matching Skills ({data.matchedSkills.length})
                      </h3>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      In candidate profile & job requirements
                    </span>
                  </div>

                  {data.matchedSkills.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {data.matchedSkills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs"
                        >
                          <span className="text-emerald-600 font-extrabold">✓</span>
                          <span>{skill}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic py-1">
                      No matching required skills identified on this candidate's profile.
                    </p>
                  )}
                </div>

                {/* 2. MISSING SKILLS (RED) */}
                <div className="bg-white border border-rose-200 rounded-2xl p-4 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-rose-100 text-rose-700 rounded-md">
                        <XCircle className="w-4 h-4" />
                      </div>
                      <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                        Missing Skills ({data.missingSkills.length})
                      </h3>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                      Required by job, missing from profile
                    </span>
                  </div>

                  {data.missingSkills.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {data.missingSkills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300 shadow-2xs"
                        >
                          <span className="text-rose-600 font-extrabold">✗</span>
                          <span>{skill}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-emerald-700 font-semibold italic py-1 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      Candidate possesses all required skills for this position!
                    </p>
                  )}
                </div>

                {/* 3. ADDITIONAL SKILLS (BLUE) */}
                <div className="bg-white border border-blue-200 rounded-2xl p-4 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-blue-100 text-blue-700 rounded-md">
                        <PlusCircle className="w-4 h-4" />
                      </div>
                      <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                        Additional Skills ({data.additionalSkills.length})
                      </h3>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      Available candidate skills not required by job
                    </span>
                  </div>

                  {data.additionalSkills.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {data.additionalSkills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-800 border border-blue-300 shadow-2xs"
                        >
                          <span className="text-blue-600 font-extrabold">+</span>
                          <span>{skill}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic py-1">
                      No additional technical skills found on profile.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            TalentHub Smart Skill Matching Engine
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

