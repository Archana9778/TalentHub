import './testEnv';
import http from 'http';
import { Duplex } from 'stream';
import { app } from '../server';
import { db } from '../database/db';

class MockSocket extends Duplex {
  remoteAddress = '127.0.0.1';
  encrypted = false;
  _write(chunk: any, encoding: string, callback: () => void) {
    callback();
  }
  _read() {}
}

interface TestResult {
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

// In-Memory Express HTTP Request Dispatcher (zero TCP sockets, zero sandbox restrictions)
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
        // Keep as string if not JSON
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

async function runTestSuite() {
  db.resetToSeed();

  console.log(`\n======================================================`);
  console.log(` TalentHub Integration Test Suite (In-Memory Sandbox)`);
  console.log(`======================================================\n`);

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      results.push({ name, passed: true });
      console.log(`  ✓ PASS: ${name}`);
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message });
      console.error(`  ✗ FAIL: ${name}\n    Error: ${err.message}`);
    }
  }

  console.log(`[0] Authenticating test accounts...`);

  const adminLogin = await invokeApp(app, {
    method: 'POST',
    url: '/api/auth/login',
    body: { email: 'admin@talenthub.com', password: 'password123' },
  });
  assert(adminLogin.status === 200, `Admin login failed: ${JSON.stringify(adminLogin.data)}`);
  const adminToken = adminLogin.data.token;

  const rec1Login = await invokeApp(app, {
    method: 'POST',
    url: '/api/auth/login',
    body: { email: 'recruiter@techcorp.com', password: 'password123' },
  });
  assert(rec1Login.status === 200, `Recruiter 1 login failed: ${JSON.stringify(rec1Login.data)}`);
  const rec1Token = rec1Login.data.token;
  const rec1User = rec1Login.data.user;

  const rec2Login = await invokeApp(app, {
    method: 'POST',
    url: '/api/auth/login',
    body: { email: 'hiring@nexusaidata.com', password: 'password123' },
  });
  assert(rec2Login.status === 200, `Recruiter 2 login failed: ${JSON.stringify(rec2Login.data)}`);
  const rec2Token = rec2Login.data.token;

  const rec3Login = await invokeApp(app, {
    method: 'POST',
    url: '/api/auth/login',
    body: { email: 'marcus.recruiter@techcorp.com', password: 'password123' },
  });
  assert(rec3Login.status === 200, `Recruiter 3 login failed: ${JSON.stringify(rec3Login.data)}`);
  const rec3Token = rec3Login.data.token;

  const cand1Login = await invokeApp(app, {
    method: 'POST',
    url: '/api/auth/login',
    body: { email: 'candidate@talenthub.com', password: 'password123' },
  });
  assert(cand1Login.status === 200, `Candidate 1 login failed: ${JSON.stringify(cand1Login.data)}`);
  const cand1Token = cand1Login.data.token;

  console.log(`\n--- PART 1: Recruiter & Company Management Tests ---`);

  let createdCompanyId = '';
  let addedRecruiterId = '';

  await test('1. Create a company profile successfully', async () => {
    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/companies',
      token: adminToken,
      body: {
        name: 'Apex Quantum Cloud',
        description: 'Next generation quantum computing algorithms and cloud infrastructure.',
        industry: 'Quantum Computing',
        website: 'https://apexquantum.example.com',
        email: 'hiring@apexquantum.example.com',
        contactNumber: '+1 (555) 999-8877',
        address: '700 Silicon Ave, Floor 12',
        location: 'San Jose, CA',
        size: '50-200 employees',
      },
    });

    assert(res.status === 201, `Expected status 201, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert(res.data.company.name === 'Apex Quantum Cloud', 'Company name mismatch');
    assert(res.data.company.email === 'hiring@apexquantum.example.com', 'Company email mismatch');
    assert(res.data.company.contactNumber === '+1 (555) 999-8877', 'Company contactNumber mismatch');
    assert(res.data.company.address === '700 Silicon Ave, Floor 12', 'Company address mismatch');
    createdCompanyId = res.data.company.id;
  });

  await test('2. Update company information', async () => {
    const res = await invokeApp(app, {
      method: 'PUT',
      url: `/api/companies/${createdCompanyId}`,
      token: adminToken,
      body: {
        description: 'Updated description for Apex Quantum Cloud enterprise platforms.',
        size: '200-500 employees',
        location: 'San Jose, CA & Remote',
      },
    });

    assert(res.status === 200, `Expected status 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert(res.data.company.size === '200-500 employees', 'Company size not updated');
    assert(res.data.company.location === 'San Jose, CA & Remote', 'Company location not updated');
  });

  await test('3. Add a recruiter to a company', async () => {
    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/recruiters',
      token: rec1Token,
      body: {
        name: 'Elena Rostova',
        email: 'elena.rostova@techcorp.com',
        password: 'password123',
        contactNumber: '+1 (555) 444-3322',
        designation: 'Senior Cloud Talent Partner',
        companyRole: 'recruiter',
        status: 'active',
      },
    });

    assert(res.status === 201, `Expected status 201, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert(res.data.recruiter.name === 'Elena Rostova', 'Recruiter name mismatch');
    assert(res.data.recruiter.companyId === 'comp-1', 'Recruiter companyId mismatch');
    assert(res.data.recruiter.password === undefined, 'Security violation: Password exposed in API response');
    addedRecruiterId = res.data.recruiter.id;
  });

  await test('4. Update recruiter details', async () => {
    const res = await invokeApp(app, {
      method: 'PUT',
      url: `/api/recruiters/${addedRecruiterId}`,
      token: rec1Token,
      body: {
        designation: 'Lead Global Sourcing Partner',
        contactNumber: '+1 (555) 444-9999',
      },
    });

    assert(res.status === 200, `Expected status 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert(res.data.recruiter.designation === 'Lead Global Sourcing Partner', 'Designation not updated');
    assert(res.data.recruiter.contactNumber === '+1 (555) 444-9999', 'Contact number not updated');
  });

  await test('5. Activate and deactivate recruiter accounts', async () => {
    const deact = await invokeApp(app, {
      method: 'PATCH',
      url: `/api/recruiters/${addedRecruiterId}/status`,
      token: rec1Token,
      body: { status: 'inactive' },
    });
    assert(deact.status === 200, `Expected status 200, got ${deact.status}`);
    assert(deact.data.recruiter.status === 'inactive', 'Recruiter should be inactive');

    const react = await invokeApp(app, {
      method: 'PATCH',
      url: `/api/recruiters/${addedRecruiterId}/status`,
      token: rec1Token,
      body: { status: 'active' },
    });
    assert(react.status === 200, `Expected status 200, got ${react.status}`);
    assert(react.data.recruiter.status === 'active', 'Recruiter should be active');
  });

  const assignedJobId = 'job-1';
  await test('6. Assign a job to a recruiter', async () => {
    const res = await invokeApp(app, {
      method: 'PATCH',
      url: `/api/jobs/${assignedJobId}/assign`,
      token: rec1Token,
      body: { recruiterId: 'user-recruiter-3' },
    });

    assert(res.status === 200, `Expected status 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert(res.data.job.recruiterId === 'user-recruiter-3', 'Job recruiterId not updated');
    assert(res.data.job.recruiterName === 'Marcus Vance', 'Job recruiterName not updated');
  });

  await test('7. Reassign a job within the same company', async () => {
    const res = await invokeApp(app, {
      method: 'PATCH',
      url: `/api/jobs/${assignedJobId}/assign`,
      token: rec1Token,
      body: { recruiterId: 'user-recruiter-1' },
    });

    assert(res.status === 200, `Expected status 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert(res.data.job.recruiterId === 'user-recruiter-1', 'Job recruiterId not updated');
    assert(res.data.job.recruiterName === 'Sarah Jenkins', 'Job recruiterName not updated');
  });

  await test('8. Verify recruiters cannot access another company\'s resources', async () => {
    const res1 = await invokeApp(app, {
      method: 'PUT',
      url: '/api/companies/comp-2',
      token: rec1Token,
      body: { name: 'Malicious Hijack Name' },
    });
    assert(res1.status === 403, `Expected status 403 Forbidden for cross-company update, got ${res1.status}`);

    const res2 = await invokeApp(app, {
      method: 'PATCH',
      url: `/api/jobs/${assignedJobId}/assign`,
      token: rec1Token,
      body: { recruiterId: 'user-recruiter-2' },
    });
    assert(res2.status === 400 || res2.status === 403, `Expected 400/403 for cross-company assignment, got ${res2.status}`);
  });

  await test('9. Verify unauthorized users cannot manage recruiter accounts', async () => {
    const resCand = await invokeApp(app, {
      method: 'POST',
      url: '/api/recruiters',
      token: cand1Token,
      body: {
        name: 'Fake Recruiter',
        email: 'fake@candidate.com',
        password: 'password123',
        companyId: 'comp-1',
      },
    });
    assert(resCand.status === 403, `Expected 403 Forbidden for candidate, got ${resCand.status}`);

    const resRec3 = await invokeApp(app, {
      method: 'POST',
      url: '/api/recruiters',
      token: rec3Token,
      body: {
        name: 'Unauthorized Recruiter',
        email: 'unauth@techcorp.com',
        password: 'password123',
      },
    });
    assert(resRec3.status === 403, `Expected 403 Forbidden for non-admin recruiter, got ${resRec3.status}`);
  });

  console.log(`\n--- PART 2: Application Lifecycle Management Tests ---`);

  const targetAppId = 'app-4';

  await test('1. Create or retrieve an application with Applied status', async () => {
    const res = await invokeApp(app, {
      method: 'GET',
      url: `/api/applications/${targetAppId}`,
      token: rec1Token,
    });

    assert(res.status === 200, `Expected status 200, got ${res.status}`);
    assert(res.data.application.stage === 'Applied', `Expected Applied stage, got ${res.data.application.stage}`);
  });

  await test('2. Move an application from Applied to Screening', async () => {
    const res = await invokeApp(app, {
      method: 'PATCH',
      url: `/api/applications/${targetAppId}/status`,
      token: rec1Token,
      body: {
        status: 'Screening',
        comment: 'Candidate background checked. Moving to initial screening.',
      },
    });

    assert(res.status === 200, `Expected status 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert(res.data.application.stage === 'Screening', `Expected stage Screening, got ${res.data.application.stage}`);
    assert(res.data.historyEntry.previousStatus === 'Applied', 'Previous status should be Applied');
    assert(res.data.historyEntry.newStatus === 'Screening', 'New status should be Screening');
  });

  await test('3. Move an application from Screening to Interview', async () => {
    const res = await invokeApp(app, {
      method: 'PATCH',
      url: `/api/applications/${targetAppId}/status`,
      token: rec1Token,
      body: {
        status: 'Interview',
        comment: 'Screening passed. Scheduling technical round.',
        interviewType: 'Technical Round',
        interviewDate: '2026-03-01T14:00:00Z',
      },
    });

    assert(res.status === 200, `Expected status 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert(res.data.application.stage === 'Interview', `Expected stage Interview, got ${res.data.application.stage}`);
    assert(res.data.historyEntry.previousStatus === 'Screening', 'Previous status should be Screening');
    assert(res.data.historyEntry.newStatus === 'Interview', 'New status should be Interview');
  });

  await test('4. Move an application from Interview to Offer', async () => {
    const res = await invokeApp(app, {
      method: 'PATCH',
      url: `/api/applications/${targetAppId}/status`,
      token: rec1Token,
      body: {
        status: 'Offer',
        comment: 'Candidate aced all rounds. Formal offer extended.',
      },
    });

    assert(res.status === 200, `Expected status 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert(res.data.application.stage === 'Offer', `Expected stage Offer, got ${res.data.application.stage}`);
    assert(res.data.historyEntry.previousStatus === 'Interview', 'Previous status should be Interview');
    assert(res.data.historyEntry.newStatus === 'Offer', 'New status should be Offer');
  });

  await test('5. Move an application from Offer to Hired', async () => {
    const res = await invokeApp(app, {
      method: 'PATCH',
      url: `/api/applications/${targetAppId}/status`,
      token: rec1Token,
      body: {
        status: 'Hired',
        comment: 'Offer accepted! Candidate signed contract.',
      },
    });

    assert(res.status === 200, `Expected status 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert(res.data.application.stage === 'Hired', `Expected stage Hired, got ${res.data.application.stage}`);
    assert(res.data.historyEntry.previousStatus === 'Offer', 'Previous status should be Offer');
    assert(res.data.historyEntry.newStatus === 'Hired', 'New status should be Hired');
  });

  await test('6. Reject an application with a rejection reason', async () => {
    const res = await invokeApp(app, {
      method: 'PATCH',
      url: '/api/applications/app-3/status',
      token: rec1Token,
      body: {
        status: 'Rejected',
        rejectionReason: 'Position closed due to team budget restructuring.',
      },
    });

    assert(res.status === 200, `Expected status 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert(res.data.application.stage === 'Rejected', 'Application stage should be Rejected');
    assert(res.data.historyEntry.reason.includes('budget restructuring'), 'Rejection reason not stored');
  });

  await test('7. Attempt an invalid status transition and verify that it is rejected', async () => {
    db.createApplication({
      id: 'app-test-invalid',
      jobId: 'job-1',
      jobTitle: 'Senior Full Stack Engineer',
      companyId: 'comp-1',
      companyName: 'CloudScale Technologies',
      candidateId: 'user-candidate-1',
      candidateName: 'Alex Morgan',
      candidateEmail: 'candidate@talenthub.com',
      resumeUrl: '/uploads/resumes/sample.pdf',
      stage: 'Applied',
      matchScore: 85,
      matchDetails: {} as any,
      recruiterNotes: '',
      timeline: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const resInvalid = await invokeApp(app, {
      method: 'PATCH',
      url: '/api/applications/app-test-invalid/status',
      token: rec1Token,
      body: {
        status: 'Hired',
        comment: 'Skipping steps directly to hired',
      },
    });

    assert(resInvalid.status === 400, `Expected status 400 Bad Request for invalid transition, got ${resInvalid.status}`);
    assert(resInvalid.data.message.includes('Invalid status transition'), 'Missing expected error message');

    await invokeApp(app, {
      method: 'PATCH',
      url: '/api/applications/app-test-invalid/status',
      token: rec1Token,
      body: { status: 'Screening', comment: 'Valid move' },
    });

    const resNoReason = await invokeApp(app, {
      method: 'PATCH',
      url: '/api/applications/app-test-invalid/status',
      token: rec1Token,
      body: {
        status: 'Rejected',
        rejectionReason: '',
      },
    });

    assert(resNoReason.status === 400, `Expected status 400 Bad Request when rejection reason is missing, got ${resNoReason.status}`);
    assert(resNoReason.data.message.includes('rejection reason is required'), 'Missing expected rejection reason error');
  });

  await test('8. Verify every status update creates an audit history entry', async () => {
    const res = await invokeApp(app, {
      method: 'GET',
      url: `/api/applications/${targetAppId}/history`,
      token: rec1Token,
    });

    assert(res.status === 200, `Expected status 200, got ${res.status}`);
    assert(res.data.total >= 4, `Expected at least 4 audit records for full progression, got ${res.data.total}`);

    const historyStages = res.data.history.map((h: any) => h.newStatus);
    assert(historyStages.includes('Screening'), 'History missing Screening');
    assert(historyStages.includes('Interview'), 'History missing Interview');
    assert(historyStages.includes('Offer'), 'History missing Offer');
    assert(historyStages.includes('Hired'), 'History missing Hired');
  });

  await test('9. Verify audit history displays the correct recruiter and timestamp', async () => {
    const res = await invokeApp(app, {
      method: 'GET',
      url: `/api/applications/${targetAppId}/history`,
      token: rec1Token,
    });

    assert(res.status === 200, 'Failed to fetch audit history');
    const latest = res.data.history[res.data.history.length - 1];

    assert(latest.changedBy === rec1User.id, `Expected changedBy ${rec1User.id}, got ${latest.changedBy}`);
    assert(latest.changedByName === rec1User.name, `Expected changedByName ${rec1User.name}, got ${latest.changedByName}`);
    assert(Boolean(latest.timestamp), 'Timestamp is missing from audit entry');
    assert(!isNaN(new Date(latest.timestamp).getTime()), 'Timestamp is not a valid date');
  });

  await test('10. Verify candidates can view only their own application information', async () => {
    const resOther = await invokeApp(app, {
      method: 'GET',
      url: '/api/applications/app-2',
      token: cand1Token,
    });

    assert(resOther.status === 403, `Expected status 403 Forbidden for cross-candidate access, got ${resOther.status}`);

    const resOwn = await invokeApp(app, {
      method: 'GET',
      url: '/api/applications/app-1',
      token: cand1Token,
    });

    assert(resOwn.status === 200, `Expected status 200 for own application, got ${resOwn.status}`);
    assert(resOwn.data.application.candidateId === 'user-candidate-1', 'Candidate ID mismatch');
  });

  await test('11. Verify recruiters cannot update unauthorized applications', async () => {
    const res = await invokeApp(app, {
      method: 'PATCH',
      url: '/api/applications/app-1/status',
      token: rec2Token,
      body: {
        status: 'Offer',
        comment: 'Unauthorized status hijack attempt',
      },
    });

    assert(res.status === 403, `Expected status 403 Forbidden for unauthorized recruiter update, got ${res.status}`);
  });

  // Summary
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log(`\n======================================================`);
  console.log(` Test Execution Summary`);
  console.log(` Total Scenarios Tested: ${results.length}`);
  console.log(` Passed: ${passedCount}`);
  console.log(` Failed: ${failedCount}`);
  console.log(`======================================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
