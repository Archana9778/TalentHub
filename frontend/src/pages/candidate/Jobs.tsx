import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, MapPin, Briefcase, X, SlidersHorizontal, DollarSign, Tag, Plus } from 'lucide-react';
import { api } from '../../services/api';
import { Job, JobCategory } from '../../types';
import { JobCard } from '../../components/JobCard';
import { Loading } from '../../components/Loading';
import { useAuth } from '../../context/AuthContext';

export const Jobs: React.FC = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [workplaceType, setWorkplaceType] = useState('all');
  const [jobType, setJobType] = useState('all');
  const [experienceLevel, setExperienceLevel] = useState('all');
  const [location, setLocation] = useState('');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Salary filter state
  const [minSalary, setMinSalary] = useState('');
  const [maxSalary, setMaxSalary] = useState('');
  const [salaryError, setSalaryError] = useState<string | null>(null);

  // Skills filter state
  const [skillInput, setSkillInput] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  // Quick Apply Modal state
  const [applyModalJob, setApplyModalJob] = useState<Job | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [applying, setApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    // --- Salary validation: block API call when values are invalid ---
    const minNum = minSalary !== '' ? Number(minSalary) : null;
    const maxNum = maxSalary !== '' ? Number(maxSalary) : null;

    if (minNum !== null && minNum < 0) {
      setSalaryError('Minimum salary cannot be negative.');
      return;
    }
    if (maxNum !== null && maxNum < 0) {
      setSalaryError('Maximum salary cannot be negative.');
      return;
    }
    if (minNum !== null && maxNum !== null && minNum > maxNum) {
      setSalaryError('Minimum salary cannot exceed maximum salary.');
      return;
    }
    setSalaryError(null);

    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (selectedCategory !== 'all') params.category = selectedCategory;
      if (workplaceType !== 'all') params.workplaceType = workplaceType;
      if (jobType !== 'all') params.jobType = jobType;
      if (experienceLevel !== 'all') params.experienceLevel = experienceLevel;
      if (location) params.location = location;
      // Salary: UI shows values in $k units, API expects full dollar amounts
      if (minNum !== null) params.minSalary = String(minNum * 1000);
      if (maxNum !== null) params.maxSalary = String(maxNum * 1000);
      // Skills: comma-separated list of skills (OR logic on backend)
      if (selectedSkills.length > 0) params.skills = selectedSkills.join(',');

      const [jobsRes, catsRes] = await Promise.all([
        api.getJobs(params),
        api.getCategories(),
      ]);
      setJobs(jobsRes.jobs);
      setCategories(catsRes.categories);
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, workplaceType, jobType, experienceLevel, location, minSalary, maxSalary, selectedSkills]);

  // useEffect depends only on the stable fetchJobs callback — avoids duplicated dep list
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchJobs();
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyModalJob) return;

    setApplying(true);
    setApplyError(null);
    try {
      await api.applyForJob(applyModalJob.id, coverLetter);
      setApplySuccess(`Application successfully submitted for ${applyModalJob.title}!`);
      setTimeout(() => {
        setApplyModalJob(null);
        setApplySuccess(null);
        setCoverLetter('');
      }, 2000);
    } catch (err: any) {
      setApplyError(err.message || 'Failed to submit application.');
    } finally {
      setApplying(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedCategory('all');
    setWorkplaceType('all');
    setJobType('all');
    setExperienceLevel('all');
    setLocation('');
    setMinSalary('');
    setMaxSalary('');
    setSalaryError(null);
    setSelectedSkills([]);
    setSkillInput('');
  };

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (
      trimmed &&
      // Case-insensitive duplicate prevention: 'Python' and 'python' are the same
      !selectedSkills.some((s) => s.toLowerCase() === trimmed.toLowerCase())
    ) {
      setSelectedSkills((prev) => [...prev, trimmed]);
    }
    setSkillInput('');
  };

  const removeSkill = (skill: string) => {
    setSelectedSkills((prev) => prev.filter((s) => s !== skill));
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill();
    } else if (e.key === 'Backspace' && skillInput === '' && selectedSkills.length > 0) {
      setSelectedSkills((prev) => prev.slice(0, -1));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Explore Job Openings
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Discover positions using transparent local match scoring based on skills and experience.
        </p>
      </div>

      {/* Search Bar */}
      <form
        onSubmit={handleSearchSubmit}
        className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center gap-3"
      >
        {/* Keyword search input with inline clear button */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by job title, keyword, or skill (e.g. Cloud Engineer, Docker, AWS)…"
            className="w-full pl-10 pr-9 py-2.5 bg-slate-50/60 border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
            aria-label="Search jobs by title or keyword"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="relative w-full md:w-64">
          <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City or 'Remote'..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/60 border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
          />
        </div>

        <button
          type="submit"
          className="w-full md:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-xs transition-colors shrink-0"
        >
          Find Jobs
        </button>

        <button
          type="button"
          onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
          className="md:hidden w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Filters</span>
        </button>
      </form>

      {/* Filter Row */}
      <div className={`bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 ${mobileFilterOpen ? 'block' : 'hidden md:block'}`}>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold uppercase tracking-wider mr-2">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          {/* Category */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Workplace Type */}
          <select
            value={workplaceType}
            onChange={(e) => setWorkplaceType(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Workplaces</option>
            <option value="Remote">Remote</option>
            <option value="Hybrid">Hybrid</option>
            <option value="On-site">On-site</option>
          </select>

          {/* Job Type */}
          <select
            value={jobType}
            onChange={(e) => setJobType(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Job Types</option>
            <option value="Full-time">Full-time</option>
            <option value="Part-time">Part-time</option>
            <option value="Contract">Contract</option>
            <option value="Internship">Internship</option>
          </select>

          {/* Experience Level */}
          <select
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Levels</option>
            <option value="Entry-level">Entry-level</option>
            <option value="Mid-level">Mid-level</option>
            <option value="Senior">Senior</option>
            <option value="Lead / Principal">Lead / Principal</option>
          </select>

          <button
            onClick={clearFilters}
            className="text-slate-500 hover:text-slate-800 underline ml-auto text-xs font-medium"
          >
            Reset Filters
          </button>
        </div>

        {/* Salary + Skills row */}
        <div className="flex flex-wrap items-start gap-3 text-xs pt-3 border-t border-slate-100">

          {/* Min Salary */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  value={minSalary}
                  onChange={(e) => setMinSalary(e.target.value)}
                  placeholder="Min $k"
                  className={`w-24 bg-slate-50 border rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-1 placeholder-slate-400 ${
                    salaryError ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-200 focus:ring-blue-500'
                  }`}
                />
                <span className="text-slate-400">–</span>
                <input
                  type="number"
                  min={0}
                  value={maxSalary}
                  onChange={(e) => setMaxSalary(e.target.value)}
                  placeholder="Max $k"
                  className={`w-24 bg-slate-50 border rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-1 placeholder-slate-400 ${
                    salaryError ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-200 focus:ring-blue-500'
                  }`}
                />
                <span className="text-slate-500 font-medium whitespace-nowrap">/ yr ($k)</span>
              </div>
            </div>
            {salaryError && (
              <p className="text-rose-600 text-[11px] pl-5 font-medium">{salaryError}</p>
            )}
          </div>

          {/* Skills multi-tag input */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-56">
            <div className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <div className="flex items-center gap-1 flex-1 flex-wrap bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 min-h-[32px] focus-within:ring-1 focus-within:ring-blue-500">
                {selectedSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-semibold text-[11px]"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="hover:text-blue-600 ml-0.5"
                      aria-label={`Remove skill ${skill}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={handleSkillKeyDown}
                  placeholder={selectedSkills.length === 0 ? 'Filter by skill (e.g. React, Python)…' : 'Add another…'}
                  className="flex-1 min-w-28 bg-transparent text-slate-700 outline-none placeholder-slate-400 text-[12px] py-0.5"
                />
              </div>
              <button
                type="button"
                onClick={addSkill}
                disabled={!skillInput.trim()}
                className="flex items-center gap-0.5 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg font-semibold transition-colors shrink-0"
                aria-label="Add skill filter"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
            {selectedSkills.length > 0 && (
              <p className="text-slate-400 text-[11px] pl-5">
                Showing jobs matching <strong>any</strong> selected skill.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Results List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {search
              ? <>Results for <span className="text-blue-700 font-bold not-italic">"{search}"</span> — <span className="text-slate-900 font-bold">{jobs.length}</span> {jobs.length === 1 ? 'job' : 'jobs'} found</>
              : <>Showing <span className="text-slate-900 font-bold">{jobs.length}</span> Opportunities</>
            }
          </p>
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-medium"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
              Clear search
            </button>
          )}
        </div>

        {loading ? (
          <Loading message={search ? `Searching for "${search}"…` : 'Filtering open postings...'} />
        ) : jobs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
            <Briefcase className="w-12 h-12 mx-auto text-slate-400 mb-3" />
            <h3 className="font-bold text-slate-800 text-base">
              {search ? `No jobs found for "${search}"` : 'No jobs matched your criteria'}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              No jobs found. Try different keywords or adjust your search.
            </p>
            <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700"
                >
                  Clear Search
                </button>
              )}
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200"
              >
                Reset All Filters
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                candidateSkills={user?.skills}
                onApplyClick={(j) => setApplyModalJob(j)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick Apply Modal */}
      {applyModalJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setApplyModalJob(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-slate-900">
              Apply for {applyModalJob.title}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {applyModalJob.companyName} • {applyModalJob.location}
            </p>

            {applySuccess ? (
              <div className="my-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold text-center">
                {applySuccess}
              </div>
            ) : (
              <form onSubmit={handleApplySubmit} className="space-y-4 mt-5">
                {applyError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                    {applyError}
                  </div>
                )}

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs">
                  <div className="font-semibold text-slate-700 mb-1">
                    Application Profile Details:
                  </div>
                  <div className="text-slate-600 space-y-0.5">
                    <div><span className="font-medium">Name:</span> {user?.name}</div>
                    <div><span className="font-medium">Email:</span> {user?.email}</div>
                    <div><span className="font-medium">Resume on file:</span> {user?.resumeOriginalName || 'Uploaded Profile Resume'}</div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Cover Note / Message to Recruiter
                  </label>
                  <textarea
                    rows={4}
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    placeholder="Describe why your experience and skills align with this position..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setApplyModalJob(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={applying}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
                  >
                    {applying ? 'Submitting Application...' : 'Submit Application'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


