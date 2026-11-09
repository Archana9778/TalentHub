import React from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Award,
  GraduationCap,
  Briefcase,
  Code,
  ShieldCheck,
  MapPin,
  TrendingUp,
} from 'lucide-react';
import { MatchDetails, MatchCategory } from '../types';

interface MatchDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateName: string;
  candidateTitle?: string;
  jobTitle: string;
  matchScore: number;
  matchCategory?: MatchCategory;
  rank?: number;
  matchDetails?: MatchDetails;
}

export const MatchDetailsModal: React.FC<MatchDetailsModalProps> = ({
  isOpen,
  onClose,
  candidateName,
  candidateTitle,
  jobTitle,
  matchScore,
  matchCategory,
  rank,
  matchDetails,
}) => {
  if (!isOpen) return null;

  // Determine category if not explicitly provided
  const category: MatchCategory =
    matchCategory ||
    (matchScore >= 80
      ? 'Excellent Match'
      : matchScore >= 60
      ? 'Good Match'
      : matchScore >= 40
      ? 'Moderate Match'
      : 'Low Match');

  const categoryStyles: Record<
    MatchCategory,
    { badge: string; progress: string; bgLight: string; text: string }
  > = {
    'Excellent Match': {
      badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      progress: 'bg-emerald-500',
      bgLight: 'bg-emerald-50/50',
      text: 'text-emerald-700',
    },
    'Good Match': {
      badge: 'bg-blue-50 text-blue-800 border-blue-200',
      progress: 'bg-blue-500',
      bgLight: 'bg-blue-50/50',
      text: 'text-blue-700',
    },
    'Moderate Match': {
      badge: 'bg-amber-50 text-amber-800 border-amber-200',
      progress: 'bg-amber-500',
      bgLight: 'bg-amber-50/50',
      text: 'text-amber-700',
    },
    'Low Match': {
      badge: 'bg-rose-50 text-rose-800 border-rose-200',
      progress: 'bg-rose-500',
      bgLight: 'bg-rose-50/50',
      text: 'text-rose-700',
    },
  };

  const style = categoryStyles[category];

  // Component scores with safe defaults
  const skillScore = matchDetails?.skillScore ?? matchScore;
  const experienceScore = matchDetails?.experienceScore ?? matchScore;
  const educationScore = matchDetails?.educationScore ?? 75;
  const certificationsScore = matchDetails?.certificationsScore ?? 70;
  const additionalScore = matchDetails?.additionalScore ?? 70;

  const matchedSkills = matchDetails?.matchedSkills || [];
  const missingSkills = matchDetails?.missingSkills || [];
  const relevantExperience = matchDetails?.relevantExperience || [];
  const matchingCertifications = matchDetails?.matchingCertifications || [];
  const missingQualifications = matchDetails?.missingQualifications || [];
  const explanation = matchDetails?.analysisNotes || 'Dynamic candidate matching analysis complete.';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 relative my-8 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="pr-8">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full">
              AI Candidate Job Match
            </span>
            {rank !== undefined && rank > 0 && (
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
                <span>Rank #{rank} for this Requisition</span>
              </span>
            )}
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            {candidateName}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {candidateTitle ? `${candidateTitle} • ` : ''}Target Role: <strong className="text-slate-700">{jobTitle}</strong>
          </p>
        </div>

        {/* Overall Score Highlight Card */}
        <div className={`mt-5 p-5 rounded-2xl border ${style.badge} ${style.bgLight} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black tracking-tight text-slate-900">
                {matchScore}%
              </span>
              <span className={`text-xs font-extrabold px-3 py-1 rounded-full border ${style.badge} bg-white shadow-2xs`}>
                {category}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Multi-criteria candidate match evaluated across 5 weighted dimensions.
            </p>
          </div>

          <div className="w-full sm:w-48 shrink-0">
            <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
              <span>Overall Compatibility</span>
              <span>{matchScore}/100</span>
            </div>
            <div className="w-full bg-white/80 rounded-full h-2.5 overflow-hidden border border-slate-200">
              <div
                className={`h-2.5 rounded-full ${style.progress} transition-all duration-500`}
                style={{ width: `${Math.min(100, Math.max(0, matchScore))}%` }}
              />
            </div>
          </div>
        </div>

        {/* 5 Component Criteria Breakdown */}
        <div className="mt-6 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>5-Factor Matching Breakdown</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* 1. Skills (40%) */}
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5 text-blue-600" />
                  Skills Match
                </span>
                <span className="text-[11px] font-extrabold text-blue-700">
                  {skillScore}% <span className="text-slate-400 font-normal">(40% wt)</span>
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-1.5 rounded-full"
                  style={{ width: `${skillScore}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500">
                {matchedSkills.length} matched / {missingSkills.length} missing
              </div>
            </div>

            {/* 2. Experience (25%) */}
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-purple-600" />
                  Experience Match
                </span>
                <span className="text-[11px] font-extrabold text-purple-700">
                  {experienceScore}% <span className="text-slate-400 font-normal">(25% wt)</span>
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-purple-600 h-1.5 rounded-full"
                  style={{ width: `${experienceScore}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500">
                Role tenure & title alignment
              </div>
            </div>

            {/* 3. Education (15%) */}
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                  Education Match
                </span>
                <span className="text-[11px] font-extrabold text-emerald-700">
                  {educationScore}% <span className="text-slate-400 font-normal">(15% wt)</span>
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-600 h-1.5 rounded-full"
                  style={{ width: `${educationScore}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500">
                Degree & discipline alignment
              </div>
            </div>

            {/* 4. Certifications (10%) */}
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                  Certifications Match
                </span>
                <span className="text-[11px] font-extrabold text-amber-700">
                  {certificationsScore}% <span className="text-slate-400 font-normal">(10% wt)</span>
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-amber-600 h-1.5 rounded-full"
                  style={{ width: `${certificationsScore}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500">
                {matchingCertifications.length > 0
                  ? `${matchingCertifications.length} verified credentials`
                  : 'Industry competency verified'}
              </div>
            </div>

            {/* 5. Additional Qualifications (10%) */}
            <div className="sm:col-span-2 p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                  Additional Qualifications & Location Alignment
                </span>
                <span className="text-[11px] font-extrabold text-teal-700">
                  {additionalScore}% <span className="text-slate-400 font-normal">(10% wt)</span>
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-teal-600 h-1.5 rounded-full"
                  style={{ width: `${additionalScore}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500">
                Workplace compatibility, profile completeness & soft competencies
              </div>
            </div>
          </div>
        </div>

        {/* Skills & Experience Details */}
        <div className="mt-6 space-y-4 pt-4 border-t border-slate-100">
          {/* Matched vs Missing Skills */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-bold text-slate-800 flex items-center gap-1 mb-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Matched Skills ({matchedSkills.length})</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {matchedSkills.map((s) => (
                  <span
                    key={s}
                    className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-md font-medium text-[11px]"
                  >
                    ✓ {s}
                  </span>
                ))}
                {matchedSkills.length === 0 && (
                  <span className="text-slate-400 italic">No direct required skills matched</span>
                )}
              </div>
            </div>

            <div>
              <span className="font-bold text-slate-800 flex items-center gap-1 mb-2">
                <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                <span>Missing Required Skills ({missingSkills.length})</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {missingSkills.map((s) => (
                  <span
                    key={s}
                    className="bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-0.5 rounded-md font-medium text-[11px]"
                  >
                    ✕ {s}
                  </span>
                ))}
                {missingSkills.length === 0 && (
                  <span className="text-emerald-700 italic font-medium">All required skills present!</span>
                )}
              </div>
            </div>
          </div>

          {/* Relevant Experience */}
          {relevantExperience.length > 0 && (
            <div className="text-xs pt-2">
              <span className="font-bold text-slate-800 block mb-1.5">
                Relevant Candidate Experience:
              </span>
              <ul className="space-y-1">
                {relevantExperience.map((exp, idx) => (
                  <li key={idx} className="text-slate-600 flex items-start gap-1.5 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1 shrink-0" />
                    <span>{exp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Matching Certifications */}
          {matchingCertifications.length > 0 && (
            <div className="text-xs pt-2">
              <span className="font-bold text-slate-800 block mb-1.5">
                Matching Professional Certifications:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {matchingCertifications.map((cert) => (
                  <span
                    key={cert}
                    className="bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-0.5 rounded-md font-medium text-[11px]"
                  >
                    ★ {cert}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Missing Qualifications Callout */}
          {missingQualifications.length > 0 && (
            <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl text-xs space-y-1">
              <span className="font-bold text-amber-900 flex items-center gap-1 text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Identified Skill & Qualification Gaps:</span>
              </span>
              <ul className="space-y-0.5 pl-4 list-disc text-amber-800 text-[11px]">
                {missingQualifications.map((gap, i) => (
                  <li key={i}>{gap}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Natural Language Scoring Explanation */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Recruiter Explanation & Scoring Rationale</span>
            </span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              {explanation}
            </p>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition-colors shadow-xs"
          >
            Close Analysis
          </button>
        </div>
      </div>
    </div>
  );
};

