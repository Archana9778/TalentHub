import React, { useState, useEffect } from 'react';
import { Search, Filter, MapPin, Briefcase, X, SlidersHorizontal } from 'lucide-react';
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

  // Quick Apply Modal state
  const [applyModalJob, setApplyModalJob] = useState<Job | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [applying, setApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (selectedCategory !== 'all') params.category = selectedCategory;
      if (workplaceType !== 'all') params.workplaceType = workplaceType;
      if (jobType !== 'all') params.jobType = jobType;
      if (experienceLevel !== 'all') params.experienceLevel = experienceLevel;
      if (location) params.location = location;

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
  };

  useEffect(() => {
    fetchJobs();
  }, [selectedCategory, workplaceType, jobType, experienceLevel]);

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
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by job title, skill (e.g. React, Spring Boot, Azure)..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/60 border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
          />
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
      </div>

      {/* Results List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Showing <span className="text-slate-900 font-bold">{jobs.length}</span> Opportunities
          </p>
        </div>

        {loading ? (
          <Loading message="Filtering open postings..." />
        ) : jobs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
            <Briefcase className="w-12 h-12 mx-auto text-slate-400 mb-3" />
            <h3 className="font-bold text-slate-800 text-base">No jobs matched your criteria</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Try adjusting your keyword search, removing workplace filters, or resetting category selections.
            </p>
            <button
              onClick={clearFilters}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700"
            >
              Clear All Filters
            </button>
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


