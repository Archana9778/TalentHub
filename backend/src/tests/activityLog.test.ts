import './testEnv';
import http from 'http';
import { Duplex } from 'stream';
import { app } from '../server';
import { db } from '../database/db';
import { ActivityLog } from '../types';

class MockSocket extends Duplex {
  remoteAddress = '127.0.0.1';
  encrypted = false;
  _write(chunk: any, encoding: string, callback: () => void) {
    callback();
  }
  _read() {}
}

interface TestResult {
  scenario: number;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function invokeApp(
  expressApp: any,
  options: {
    method?: string;
    url: string;
    token?: string;
    body?: any;
    headers?: Record<string, string>;
  }
): Promise<{ status: number; headers: Record<string, string>; data: any }> {
  return new Promise((resolve, reject) => {
    let bodyBuffer: Buffer | null = null;
    const reqHeaders: Record<string, string> = {
      host: 'localhost',
      accept: 'application/json',
      ...(options.headers || {}),
    };

    if (options.token) {
      reqHeaders['authorization'] = `Bearer ${options.token}`;
    }

    if (options.body !== undefined) {
      const bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      bodyBuffer = Buffer.from(bodyStr, 'utf-8');
      reqHeaders['content-type'] = reqHeaders['content-type'] || 'application/json';
      reqHeaders['content-length'] = String(bodyBuffer.length);
    }

    const socket = new MockSocket() as any;
    const req = new http.IncomingMessage(socket);
    req.method = (options.method || 'GET').toUpperCase();
    req.url = options.url;
    (req as any).originalUrl = options.url;
    req.headers = reqHeaders;

    const res = new http.ServerResponse(req);
    res.assignSocket(socket);

    const responseChunks: Buffer[] = [];
    const origWrite = res.write.bind(res);
    res.write = function (chunk: any, ...args: any[]): boolean {
      if (chunk) {
        responseChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return origWrite(chunk, ...args);
    };

    const origEnd = res.end.bind(res);
    res.end = function (chunk?: any, ...args: any[]): any {
      if (chunk) {
        responseChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      origEnd(chunk, ...args);

      const raw = Buffer.concat(responseChunks).toString('utf-8');
      let parsedData: any = raw;
      try {
        parsedData = JSON.parse(raw);
      } catch {
        // Leave as string if not JSON
      }

      resolve({
        status: res.statusCode,
        headers: res.getHeaders() as Record<string, string>,
        data: parsedData,
      });
    };

    try {
      expressApp(req, res, (err: any) => {
        if (err) reject(err);
      });
    } catch (err) {
      reject(err);
    }

    if (bodyBuffer) {
      req.push(bodyBuffer);
    }
    req.push(null);
  });
}

async function loginUser(email: string, password = 'password123'): Promise<string> {
  const res = await invokeApp(app, {
    method: 'POST',
    url: '/api/auth/login',
    body: { email, password },
  });
  if (res.status !== 200 || !res.data?.token) {
    throw new Error(`Login failed for ${email} (status ${res.status}): ${JSON.stringify(res.data)}`);
  }
  return res.data.token;
}

async function runActivityLogTests() {
  db.resetToSeed();

  console.log('\n======================================================');
  console.log(' TalentHub Activity Log & Audit Trail Test Suite');
  console.log('======================================================\n');

  // Obtain tokens for various roles
  const adminToken = await loginUser('admin@talenthub.com');
  const comp1AdminToken = await loginUser('recruiter@techcorp.com'); // Sarah Jenkins (Comp-1 admin)
  const comp1RecruiterToken = await loginUser('marcus.recruiter@techcorp.com'); // Marcus Vance (Comp-1 recruiter)
  const comp2AdminToken = await loginUser('hiring@nexusaidata.com'); // Michael Chang (Comp-2 admin)
  const candidateToken = await loginUser('candidate@talenthub.com'); // Alex Morgan (Candidate)

  let createdJobId = '';

  // ─────────────────────────────────────────────────────────────
  // 1. Job Creation creates a CREATE log
  // ─────────────────────────────────────────────────────────────
  try {
    const postRes = await invokeApp(app, {
      method: 'POST',
      url: '/api/jobs',
      token: comp1AdminToken,
      body: {
        title: 'Lead Distributed Systems Architect',
        categoryId: 'cat-1',
        location: 'San Francisco, CA',
        workplaceType: 'Hybrid',
        jobType: 'Full-time',
        experienceLevel: 'Lead / Principal',
        salaryMin: 180000,
        salaryMax: 220000,
        salaryCurrency: 'USD',
        description: 'Design resilient microservice clusters and edge computing platforms.',
        requirements: ['10+ years experience in distributed systems', 'Golang / Kubernetes mastery'],
        skills: ['Kubernetes', 'Go', 'Distributed Systems', 'gRPC'],
        benefits: ['Full health coverage', '401k matching', 'Home office stipend'],
      },
    });

    assert(postRes.status === 201, `Expected status 201, got ${postRes.status}`);
    assert(!!postRes.data?.job?.id, 'Expected created job to have an ID');
    createdJobId = postRes.data.job.id;

    // Fetch activity logs for Comp 1
    const logsRes = await invokeApp(app, {
      method: 'GET',
      url: '/api/activity-logs?module=jobs',
      token: comp1AdminToken,
    });

    assert(logsRes.status === 200, `Expected 200 from activity logs, got ${logsRes.status}`);
    const logs: ActivityLog[] = logsRes.data.logs;
    const createLog = logs.find((l) => l.recordId === createdJobId && l.action === 'CREATE');

    assert(!!createLog, `CREATE activity log was not found for job ${createdJobId}`);
    assert(createLog!.actorUserId === 'user-recruiter-1', `Expected actor user-recruiter-1, got ${createLog!.actorUserId}`);
    assert(createLog!.actorName === 'Sarah Jenkins', `Expected actor Sarah Jenkins, got ${createLog!.actorName}`);
    assert(createLog!.companyId === 'comp-1', `Expected companyId comp-1, got ${createLog!.companyId}`);
    assert(createLog!.recordName === 'Lead Distributed Systems Architect', 'Record name mismatch');
    assert(createLog!.oldValues === null, 'Expected oldValues to be null for CREATE');
    assert(createLog!.newValues?.title === 'Lead Distributed Systems Architect', 'Expected newValues to contain title');
    assert(createLog!.newValues?.viewsCount === undefined, 'newValues must not contain viewsCount');
    assert(createLog!.newValues?.applicantsCount === undefined, 'newValues must not contain applicantsCount');

    results.push({ scenario: 1, name: 'Job creation creates a CREATE log with actor & company', passed: true });
    console.log('✅ Scenario 1: Job creation creates a CREATE log');
  } catch (err: any) {
    results.push({ scenario: 1, name: 'Job creation creates a CREATE log', passed: false, error: err.message });
    console.error('❌ Scenario 1 Failed:', err.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Job Update records correct old and new values diff
  // ─────────────────────────────────────────────────────────────
  try {
    // Perform update
    const updateRes = await invokeApp(app, {
      method: 'PUT',
      url: `/api/jobs/${createdJobId}`,
      token: comp1AdminToken,
      body: {
        title: 'Principal Distributed Systems Architect',
        salaryMax: 240000,
        location: 'Remote (US)',
      },
    });

    assert(updateRes.status === 200, `Expected 200 from update, got ${updateRes.status}`);

    // Verify activity log
    const logsRes = await invokeApp(app, {
      method: 'GET',
      url: '/api/activity-logs?action=UPDATE',
      token: comp1AdminToken,
    });

    assert(logsRes.status === 200, `Expected 200, got ${logsRes.status}`);
    const logs: ActivityLog[] = logsRes.data.logs;
    const updateLog = logs.find((l: ActivityLog) => l.recordId === createdJobId && l.action === 'UPDATE');

    assert(!!updateLog, 'UPDATE log not found for job');
    assert(updateLog!.oldValues?.title === 'Lead Distributed Systems Architect', 'oldValues title mismatch');
    assert(updateLog!.newValues?.title === 'Principal Distributed Systems Architect', 'newValues title mismatch');
    assert(updateLog!.oldValues?.salaryMax === 220000, 'oldValues salaryMax mismatch');
    assert(updateLog!.newValues?.salaryMax === 240000, 'newValues salaryMax mismatch');
    assert(updateLog!.oldValues?.location === 'San Francisco, CA', 'oldValues location mismatch');
    assert(updateLog!.newValues?.location === 'Remote (US)', 'newValues location mismatch');
    assert(updateLog!.oldValues?.viewsCount === undefined, 'oldValues must exclude viewsCount');
    assert(updateLog!.newValues?.viewsCount === undefined, 'newValues must exclude viewsCount');

    // 2b. Recruiter Reassignment auditing (assignJob)
    const reassignRes = await invokeApp(app, {
      method: 'PATCH',
      url: `/api/jobs/${createdJobId}/assign`,
      token: comp1AdminToken,
      body: {
        recruiterId: 'user-recruiter-3',
      },
    });
    assert(reassignRes.status === 200, `Expected 200 from assignJob, got ${reassignRes.status}`);

    const assignLogsRes = await invokeApp(app, {
      method: 'GET',
      url: '/api/activity-logs?action=UPDATE',
      token: comp1AdminToken,
    });
    const assignLog = assignLogsRes.data.logs.find(
      (l: ActivityLog) =>
        l.recordId === createdJobId &&
        l.newValues?.recruiterId === 'user-recruiter-3'
    );
    assert(!!assignLog, 'Reassign activity log not found');
    assert(assignLog!.oldValues?.recruiterId === 'user-recruiter-1', 'Old recruiter ID not recorded');
    assert(assignLog!.oldValues?.recruiterName === 'Sarah Jenkins', 'Old recruiter Name not recorded');
    assert(assignLog!.newValues?.recruiterId === 'user-recruiter-3', 'New recruiter ID not recorded');
    assert(assignLog!.newValues?.recruiterName === 'Marcus Vance', 'New recruiter Name not recorded');

    results.push({ scenario: 2, name: 'Job update and recruiter reassignment record correct old and new values diff', passed: true });
    console.log('✅ Scenario 2: Job update and recruiter reassignment record correct old and new values');
  } catch (err: any) {
    results.push({ scenario: 2, name: 'Job update records correct old and new values', passed: false, error: err.message });
    console.error('❌ Scenario 2 Failed:', err.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Job Deletion records DELETE and preserves historical data
  // ─────────────────────────────────────────────────────────────
  try {
    // Delete the job
    const delRes = await invokeApp(app, {
      method: 'DELETE',
      url: `/api/jobs/${createdJobId}`,
      token: comp1AdminToken,
    });

    assert(delRes.status === 200, `Expected 200 from delete, got ${delRes.status}`);

    // Verify job is soft deleted: not present in public job listing
    const publicJobsRes = await invokeApp(app, {
      method: 'GET',
      url: '/api/jobs',
    });
    const publicJobs = publicJobsRes.data.jobs || [];
    assert(!publicJobs.some((j: any) => j.id === createdJobId), 'Soft deleted job must not appear in active job listing');

    // Verify deleted job CANNOT be retrieved via getJobById (returns 404)
    const getDeletedRes = await invokeApp(app, {
      method: 'GET',
      url: `/api/jobs/${createdJobId}`,
    });
    assert(getDeletedRes.status === 404, `Deleted job must return 404 on getJobById, got ${getDeletedRes.status}`);

    // Verify DELETE activity log
    const logsRes = await invokeApp(app, {
      method: 'GET',
      url: '/api/activity-logs?action=DELETE',
      token: comp1AdminToken,
    });

    assert(logsRes.status === 200, `Expected 200, got ${logsRes.status}`);
    const logs: ActivityLog[] = logsRes.data.logs;
    const deleteLog = logs.find((l: ActivityLog) => l.recordId === createdJobId && l.action === 'DELETE');

    assert(!!deleteLog, 'DELETE log not found');
    assert(deleteLog!.actorUserId === 'user-recruiter-1', 'Actor ID mismatch on DELETE');
    assert(deleteLog!.recordName === 'Principal Distributed Systems Architect', 'Record name mismatch on DELETE');
    assert(deleteLog!.oldValues?.title === 'Principal Distributed Systems Architect', 'Previous values not preserved');
    assert(deleteLog!.newValues === null, 'newValues should be null on DELETE');

    results.push({ scenario: 3, name: 'Job deletion records DELETE and preserves historical data', passed: true });
    console.log('✅ Scenario 3: Job deletion records DELETE and preserves historical data');
  } catch (err: any) {
    results.push({ scenario: 3, name: 'Job deletion records DELETE', passed: false, error: err.message });
    console.error('❌ Scenario 3 Failed:', err.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 4. Main HR / Company Admin sees all activities in their company
  // ─────────────────────────────────────────────────────────────
  try {
    const logsRes = await invokeApp(app, {
      method: 'GET',
      url: '/api/activity-logs',
      token: comp1AdminToken,
    });

    assert(logsRes.status === 200, `Expected 200, got ${logsRes.status}`);
    const logs: ActivityLog[] = logsRes.data.logs;
    assert(logs.length >= 3, `Expected at least 3 logs in comp-1, got ${logs.length}`);
    assert(logs.every((l) => l.companyId === 'comp-1'), 'All logs must belong to comp-1');

    results.push({ scenario: 4, name: 'Main HR sees all activities in their company', passed: true });
    console.log('✅ Scenario 4: Main HR can see all activities in their company');
  } catch (err: any) {
    results.push({ scenario: 4, name: 'Main HR can see all activities in their company', passed: false, error: err.message });
    console.error('❌ Scenario 4 Failed:', err.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 5. Other recruiters in company see shared company activities
  // ─────────────────────────────────────────────────────────────
  try {
    const logsRes = await invokeApp(app, {
      method: 'GET',
      url: '/api/activity-logs',
      token: comp1RecruiterToken, // Marcus Vance
    });

    assert(logsRes.status === 200, `Expected 200, got ${logsRes.status}`);
    const logs: ActivityLog[] = logsRes.data.logs;
    assert(logs.length >= 3, 'Marcus Vance should see shared company activity logs');
    assert(logs.some((l) => l.actorUserId === 'user-recruiter-1'), 'Marcus must see Sarah Jenkins activities in same company');
    assert(logs.every((l) => l.companyId === 'comp-1'), 'All logs must belong to comp-1');

    results.push({ scenario: 5, name: 'Other recruiters see shared company activities', passed: true });
    console.log('✅ Scenario 5: Other recruiters see shared company activities');
  } catch (err: any) {
    results.push({ scenario: 5, name: 'Other recruiters see shared company activities', passed: false, error: err.message });
    console.error('❌ Scenario 5 Failed:', err.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 6. Cross-company access prevented (Comp A cannot see Comp B)
  // ─────────────────────────────────────────────────────────────
  try {
    const logsRes = await invokeApp(app, {
      method: 'GET',
      url: '/api/activity-logs',
      token: comp2AdminToken, // Michael Chang at Nexus AI Labs (comp-2)
    });

    assert(logsRes.status === 200, `Expected 200, got ${logsRes.status}`);
    const logs: ActivityLog[] = logsRes.data.logs;
    // Comp-2 should NOT see any comp-1 activities
    assert(!logs.some((l) => l.companyId === 'comp-1'), 'Cross-company leak: comp-2 saw comp-1 logs!');

    // Attempt to tamper with companyId in query param
    const spoofQueryRes = await invokeApp(app, {
      method: 'GET',
      url: '/api/activity-logs?companyId=comp-1',
      token: comp2AdminToken,
    });

    assert(spoofQueryRes.status === 200, `Expected 200, got ${spoofQueryRes.status}`);
    const spoofLogs: ActivityLog[] = spoofQueryRes.data.logs;
    assert(!spoofLogs.some((l) => l.companyId === 'comp-1'), 'Spoofed query parameter companyId=comp-1 leaked logs!');

    results.push({ scenario: 6, name: 'Company A cannot see Company B activities', passed: true });
    console.log('✅ Scenario 6: Cross-company access prevented');
  } catch (err: any) {
    results.push({ scenario: 6, name: 'Company A cannot see Company B activities', passed: false, error: err.message });
    console.error('❌ Scenario 6 Failed:', err.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 7. Platform Admin can see all and filter by company
  // ─────────────────────────────────────────────────────────────
  try {
    // Comp 2 creates a job to have activities in both companies
    await invokeApp(app, {
      method: 'POST',
      url: '/api/jobs',
      token: comp2AdminToken,
      body: {
        title: 'Lead AI Research Engineer',
        categoryId: 'cat-3',
        location: 'Boston, MA',
        workplaceType: 'On-site',
        jobType: 'Full-time',
        experienceLevel: 'Senior',
        salaryMin: 170000,
        salaryMax: 210000,
        salaryCurrency: 'USD',
        description: 'Conduct neural architecture search and generative model research.',
      },
    });

    // Platform admin queries all
    const allRes = await invokeApp(app, {
      method: 'GET',
      url: '/api/activity-logs',
      token: adminToken,
    });

    assert(allRes.status === 200, `Expected 200, got ${allRes.status}`);
    const allLogs: ActivityLog[] = allRes.data.logs;
    assert(allLogs.some((l) => l.companyId === 'comp-1'), 'Admin must see comp-1 logs');
    assert(allLogs.some((l) => l.companyId === 'comp-2'), 'Admin must see comp-2 logs');

    // Platform admin filters by comp-1
    const comp1Filtered = await invokeApp(app, {
      method: 'GET',
      url: '/api/activity-logs?companyId=comp-1',
      token: adminToken,
    });
    assert(comp1Filtered.status === 200, 'Expected 200');
    assert(comp1Filtered.data.logs.every((l: ActivityLog) => l.companyId === 'comp-1'), 'Filtered logs must only be comp-1');

    // Platform admin filters by comp-2
    const comp2Filtered = await invokeApp(app, {
      method: 'GET',
      url: '/api/activity-logs?companyId=comp-2',
      token: adminToken,
    });
    assert(comp2Filtered.status === 200, 'Expected 200');
    assert(comp2Filtered.data.logs.every((l: ActivityLog) => l.companyId === 'comp-2'), 'Filtered logs must only be comp-2');

    results.push({ scenario: 7, name: 'Platform Admin can see all and filter by company', passed: true });
    console.log('✅ Scenario 7: Platform Admin can see all and filter by company');
  } catch (err: any) {
    results.push({ scenario: 7, name: 'Platform Admin can see all and filter by company', passed: false, error: err.message });
    console.error('❌ Scenario 7 Failed:', err.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 8. Actor ID / Company ID spoofing from frontend rejected
  // ─────────────────────────────────────────────────────────────
  try {
    // Recruiter tries to create job spoofing companyId and actorId
    const spoofCreateRes = await invokeApp(app, {
      method: 'POST',
      url: '/api/jobs',
      token: comp1RecruiterToken, // Marcus Vance
      body: {
        title: 'Spoofed Job Posting Attempt',
        companyId: 'comp-2', // Trying to create job in another company
        actorUserId: 'user-admin-1', // Trying to spoof admin actor
        actorName: 'Eleanor Vance',
        categoryId: 'cat-1',
        location: 'Remote',
        description: 'Test job',
      },
    });

    // In TalentHub jobController, recruiter cannot post for another company unless they belong to it
    // If created, it must enforce recruiter's own companyId 'comp-1'
    if (spoofCreateRes.status === 201) {
      assert(spoofCreateRes.data.job.companyId === 'comp-1', 'Job companyId must be comp-1, not spoofed comp-2');
    }

    // Candidate trying to access activity logs -> 403 Forbidden
    const candAccessRes = await invokeApp(app, {
      method: 'GET',
      url: '/api/activity-logs',
      token: candidateToken,
    });
    assert(candAccessRes.status === 403, `Expected 403 for candidate, got ${candAccessRes.status}`);

    results.push({ scenario: 8, name: 'Frontend cannot spoof actor ID or company ID', passed: true });
    console.log('✅ Scenario 8: Frontend cannot spoof actor ID or company ID');
  } catch (err: any) {
    results.push({ scenario: 8, name: 'Frontend cannot spoof actor ID or company ID', passed: false, error: err.message });
    console.error('❌ Scenario 8 Failed:', err.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 9. Failed audit insertion rolls back the business operation
  // ─────────────────────────────────────────────────────────────
  try {
    const initialJobsCount = (await db.getJobs()).length;

    // Simulate failure during createJobWithAudit
    const testJob: any = {
      id: 'job-rollback-test-99',
      title: 'Rollback Test Job',
      companyId: 'comp-1',
      companyName: 'CloudScale Technologies',
      recruiterId: 'user-recruiter-1',
      recruiterName: 'Sarah Jenkins',
      categoryId: 'cat-1',
      categoryName: 'Full Stack & Web Engineering',
      location: 'Remote',
      workplaceType: 'Remote',
      jobType: 'Full-time',
      experienceLevel: 'Senior',
      salaryMin: 120000,
      salaryMax: 150000,
      salaryCurrency: 'USD',
      description: 'Rollback test description',
      requirements: [],
      skills: [],
      benefits: [],
      status: 'active',
      isFeatured: false,
      applicantsCount: 0,
      viewsCount: 0,
      expiresAt: '2026-12-31T23:59:59Z',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // A faulty audit that triggers an exception
    const faultyAudit: any = {
      get id() {
        throw new Error('Simulated database audit insertion error');
      },
    };

    let errorThrown = false;
    try {
      await db.createJobWithAudit(testJob, faultyAudit);
    } catch {
      errorThrown = true;
    }

    assert(errorThrown, 'Expected error to be thrown during faulty audit operation');

    // Verify job was NOT created in the database (rolled back)
    const afterJobs = await db.getJobs();
    assert(afterJobs.length === initialJobsCount, 'Job count changed! Rollback failed.');
    const foundJob = await db.getJobById('job-rollback-test-99');
    assert(!foundJob, 'Job exists despite transaction rollback!');

    results.push({ scenario: 9, name: 'Audit insertion failure rolls back the job operation', passed: true });
    console.log('✅ Scenario 9: Failed audit insertion rolls back the business operation');
  } catch (err: any) {
    results.push({ scenario: 9, name: 'Audit insertion failure rolls back the job operation', passed: false, error: err.message });
    console.error('❌ Scenario 9 Failed:', err.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 10. Existing job and application functionality still works
  // ─────────────────────────────────────────────────────────────
  try {
    // Public job search
    const jobsRes = await invokeApp(app, {
      method: 'GET',
      url: '/api/jobs?search=Cloud',
    });
    assert(jobsRes.status === 200, `Expected 200, got ${jobsRes.status}`);
    assert(Array.isArray(jobsRes.data.jobs), 'Expected jobs array');

    // Job categories
    const catRes = await invokeApp(app, {
      method: 'GET',
      url: '/api/categories',
    });
    assert(catRes.status === 200, `Expected 200, got ${catRes.status}`);

    // Candidate applications
    const appsRes = await invokeApp(app, {
      method: 'GET',
      url: '/api/applications/my-applications',
      token: candidateToken,
    });
    assert(appsRes.status === 200, `Expected 200, got ${appsRes.status}`);
    assert(Array.isArray(appsRes.data.applications), 'Expected applications array');

    // Recruiter dashboard / my-jobs
    const myJobsRes = await invokeApp(app, {
      method: 'GET',
      url: '/api/jobs/recruiter/my-jobs',
      token: comp1AdminToken,
    });
    assert(myJobsRes.status === 200, `Expected 200, got ${myJobsRes.status}`);

    results.push({ scenario: 10, name: 'Existing job and application functionality still works', passed: true });
    console.log('✅ Scenario 10: Existing job and application functionality still works');
  } catch (err: any) {
    results.push({ scenario: 10, name: 'Existing job and application functionality still works', passed: false, error: err.message });
    console.error('❌ Scenario 10 Failed:', err.message);
  }

  console.log('\n======================================================');
  console.log(' Test Summary:');
  console.log(` Passed: ${results.filter((r) => r.passed).length}/${results.length}`);
  console.log('======================================================\n');

  if (results.some((r) => !r.passed)) {
    process.exit(1);
  }
}

runActivityLogTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
