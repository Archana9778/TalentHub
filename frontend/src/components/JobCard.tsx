import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, DollarSign, Clock, Building2, Sparkles, ArrowRight } from 'lucide-react';
import { Job } from '../types';

interface JobCardProps {
  job: Job;
  candidateSkills?: string[];
  onApplyClick?: (job: Job) => void;
}

export const JobCard: React.FC<JobCardProps> = ({ job, candidateSkills = [], onApplyClick }) => {
  // Quick candidate match indicator if candidateSkills provided
  const candidateSkillsNorm = new Set(candidateSkills.map((s) => s.toLowerCase()));
  const skillsList = Array.isArray(job.skills) ? job.skills : [];
  const matchedCount = skillsList.filter((s) => candidateSkillsNorm.has(s.toLowerCase())).length;
  const matchPct = skillsList.length > 0 ? Math.round((matchedCount / skillsList.length) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 p-5 flex flex-col justify-between group">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <img
              src={job.companyLogo || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120'}
              alt={job.companyName}
              className="w-12 h-12 rounded-lg object-cover border border-slate-100 p-0.5 shadow-xs shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120';
              }}
            />
            <div>
              <Link
                to={`/candidate/jobs/${job.id}`}
                className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors text-base line-clamp-1"
              >
                {job.title}
              </Link>
              <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>{job.companyName}</span>
                <span className="text-slate-300">•</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                  {job.categoryName}
                </span>
              </div>
            </div>
          </div>

          {candidateSkills.length > 0 && matchPct > 0 && (
            <div
              className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                matchPct >= 80
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : matchPct >= 50
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
              title={`Based on ${matchedCount} / ${job.skills.length} matching skills on your profile`}
            >
              <Sparkles className="w-3 h-3" />
              <span>{matchPct}% Match</span>
            </div>
          )}
        </div>

        <p className="text-slate-600 text-xs mt-3 line-clamp-2 leading-relaxed">
          {job.description}
        </p>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2 mt-4 text-xs">
          <div className="flex items-center gap-1 text-slate-600 bg-slate-100/80 px-2 py-1 rounded-md">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span>{job.location}</span>
          </div>

          <span className="bg-blue-50 text-blue-700 font-medium px-2 py-1 rounded-md">
            {job.workplaceType}
          </span>

          <span className="bg-slate-100 text-slate-700 font-medium px-2 py-1 rounded-md">
            {job.jobType}
          </span>

          {job.salaryMin !== undefined && job.salaryMax !== undefined && (
            <div className="flex items-center gap-1 text-slate-700 font-medium bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-md ml-auto">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                ${(job.salaryMin / 1000).toFixed(0)}k - ${(job.salaryMax / 1000).toFixed(0)}k
              </span>
            </div>
          )}
        </div>

        {/* Skills tags */}
        {skillsList.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
            {skillsList.slice(0, 4).map((skill) => {
              const isMatch = candidateSkillsNorm.has(skill.toLowerCase());
              return (
                <span
                  key={skill}
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                    isMatch
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {skill} {isMatch && '✓'}
                </span>
              );
            })}
            {skillsList.length > 4 && (
              <span className="text-[11px] text-slate-400 px-1 py-0.5">
                +{skillsList.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {job.createdAt && !isNaN(new Date(job.createdAt).getTime())
                ? new Date(job.createdAt).toLocaleDateString()
                : 'Recently'}
            </span>
          </span>
          <span>{job.applicantsCount ?? 0} applicants</span>
        </div>

        <div className="flex items-center gap-2">
          {onApplyClick && (
            <button
              onClick={() => onApplyClick(job)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-xs transition-colors shadow-xs"
            >
              Apply
            </button>
          )}
          <Link
            to={`/candidate/jobs/${job.id}`}
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium group-hover:translate-x-0.5 transition-transform"
          >
            <span>Details</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};

