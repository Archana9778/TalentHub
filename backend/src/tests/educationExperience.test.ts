process.env.NODE_ENV = 'test';
process.env.TEST_IN_PROCESS = 'true';
import { Duplex } from 'stream';
import { app } from '../server';
import { db } from '../database/db';

class MockSocket extends Duplex {
  remoteAddress = '127.0.0.1';
  encrypted = false;
  _write(_chunk: any, _encoding: string, callback: () => void) {
    callback();
  }
  _read() {}
}

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
}

const testResults: TestResult[] = [];

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
    const req = new (require('http').IncomingMessage)(socket);
    req.method = (options.method || 'GET').toUpperCase();
    req.url = options.url;
    req.headers = reqHeaders;

    const res = new (require('http').ServerResponse)(req);
    res.assignSocket(socket);

    const responseHeaders: Record<string, string> = {};
    const chunks: Buffer[] = [];

    const origSetHeader = res.setHeader.bind(res);
    res.setHeader = (name: string, value: any) => {
      responseHeaders[name.toLowerCase()] = String(value);
      return origSetHeader(name, value);
    };

    res.write = (chunk: any) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    };

    res.end = (chunk: any) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const rawBody = Buffer.concat(chunks).toString('utf-8');
      let parsedData: any = rawBody;
      try {
        parsedData = JSON.parse(rawBody);
      } catch {}
      resolve({
        status: res.statusCode,
        headers: responseHeaders,
        data: parsedData,
      });
      return res;
    };

    try {
      expressApp(req, res);
      if (bodyBuffer) {
        req.push(bodyBuffer);
      }
      req.push(null);
    } catch (err) {
      reject(err);
    }
  });
}

async function runTest(suite: string, name: string, fn: () => Promise<void>) {
  try {
    await fn();
    testResults.push({ suite, name, passed: true });
    console.log(`  ✓ PASS: [${suite}] ${name}`);
  } catch (err: any) {
    testResults.push({ suite, name, passed: false, error: err.message });
    console.error(`  ✗ FAIL: [${suite}] ${name} -> ${err.message}`);
  }
}

async function main() {
  console.log('======================================================');
  console.log(' TalentHub Education & Work Experience Test Suite');
  console.log('======================================================\n');

  await db.initialize();

  // 1. Authenticate candidate
  const candLogin = await invokeApp(app, {
    method: 'POST',
    url: '/api/auth/login',
    body: { email: 'candidate@talenthub.com', password: 'password123' },
  });
  assert(candLogin.status === 200, 'Candidate login must succeed');
  const candToken = candLogin.data.token;
  const candUser = candLogin.data.user;

  // 2. Authenticate recruiter
  const recLogin = await invokeApp(app, {
    method: 'POST',
    url: '/api/auth/login',
    body: { email: 'recruiter@techcorp.com', password: 'password123' },
  });
  assert(recLogin.status === 200, 'Recruiter login must succeed');
  const recToken = recLogin.data.token;

  // 3. Authenticate a second candidate (Candidate B) for cross-tenant testing
  const cand2Login = await invokeApp(app, {
    method: 'POST',
    url: '/api/auth/login',
    body: { email: 'david.chen@example.com', password: 'password123' },
  });
  assert(cand2Login.status === 200, 'Candidate 2 login must succeed');
  const cand2Token = cand2Login.data.token;

  let createdEducationId: string = '';
  let createdExperienceId: string = '';

  // ────────────────────────────────────────────────────────────────────────────
  // TEST SUITE 1: Candidate Education CRUD
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST SUITE 1: Candidate Education CRUD ---');

  await runTest('Education', 'GET /api/candidate/education retrieves candidate qualifications', async () => {
    const res = await invokeApp(app, {
      method: 'GET',
      url: '/api/candidate/education',
      token: candToken,
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data.education), 'Expected education to be an array');
  });

  await runTest('Education', 'POST /api/candidate/education adds a new qualification', async () => {
    const payload = {
      institution: 'Stanford University',
      degree: 'Master of Science',
      fieldOfStudy: 'Computer Science & AI',
      startDate: '2020-09',
      endDate: '2022-06',
      isCurrent: false,
      grade: '3.9 / 4.0',
      description: 'Specialized in Distributed Systems and Deep Learning coursework.',
    };

    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/candidate/education',
      token: candToken,
      body: payload,
    });

    assert(res.status === 201, `Expected 201 Created, got ${res.status}`);
    assert(res.data.education !== undefined, 'Expected created education in response');
    assert(res.data.education.institution === 'Stanford University', 'Institution must match');
    assert(res.data.education.degree === 'Master of Science', 'Degree must match');
    assert(res.data.education.fieldOfStudy === 'Computer Science & AI', 'Field of study must match');
    assert(res.data.education.isCurrent === false, 'isCurrent must be false');
    assert(res.data.education.id !== undefined, 'Education ID must be generated');

    createdEducationId = res.data.education.id;
  });

  await runTest('Education', 'GET /api/candidate/education includes the newly added qualification', async () => {
    const res = await invokeApp(app, {
      method: 'GET',
      url: '/api/candidate/education',
      token: candToken,
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const found = res.data.education.find((e: any) => e.id === createdEducationId);
    assert(found !== undefined, `Created education ID ${createdEducationId} must be in the list`);
    assert(found.institution === 'Stanford University', 'Institution must match Stanford University');
  });

  await runTest('Education', 'PUT /api/candidate/education/:id updates qualification details', async () => {
    const updatePayload = {
      institution: 'Stanford University - School of Engineering',
      degree: 'Master of Science with Distinction',
      fieldOfStudy: 'Artificial Intelligence & Systems',
      isCurrent: true,
      grade: '4.0 / 4.0',
    };

    const res = await invokeApp(app, {
      method: 'PUT',
      url: `/api/candidate/education/${createdEducationId}`,
      token: candToken,
      body: updatePayload,
    });

    assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
    assert(res.data.education.institution === 'Stanford University - School of Engineering', 'Updated institution must match');
    assert(res.data.education.degree === 'Master of Science with Distinction', 'Updated degree must match');
    assert(res.data.education.isCurrent === true, 'isCurrent must be updated to true');
  });

  await runTest('Education', 'PATCH /api/candidate/education/:id also updates qualification', async () => {
    const patchPayload = {
      grade: 'Top 5% Class Rank',
    };

    const res = await invokeApp(app, {
      method: 'PATCH',
      url: `/api/candidate/education/${createdEducationId}`,
      token: candToken,
      body: patchPayload,
    });

    assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
    assert(res.data.education.grade === 'Top 5% Class Rank', 'Grade must be updated via PATCH');
  });

  await runTest('Education', 'DELETE /api/candidate/education/:id deletes the qualification', async () => {
    const res = await invokeApp(app, {
      method: 'DELETE',
      url: `/api/candidate/education/${createdEducationId}`,
      token: candToken,
    });

    assert(res.status === 200, `Expected 200 OK, got ${res.status}`);

    // Verify it is no longer returned
    const listRes = await invokeApp(app, {
      method: 'GET',
      url: '/api/candidate/education',
      token: candToken,
    });
    const found = listRes.data.education.find((e: any) => e.id === createdEducationId);
    assert(found === undefined, 'Deleted education must not be present in list');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // TEST SUITE 2: Candidate Work Experience CRUD
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST SUITE 2: Candidate Work Experience CRUD ---');

  await runTest('Experience', 'GET /api/candidate/experience retrieves candidate experiences', async () => {
    const res = await invokeApp(app, {
      method: 'GET',
      url: '/api/candidate/experience',
      token: candToken,
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data.experience), 'Expected experience to be an array');
  });

  await runTest('Experience', 'POST /api/candidate/experience adds a new work experience', async () => {
    const payload = {
      company: 'Stripe',
      title: 'Senior Infrastructure Engineer',
      employmentType: 'Full-time',
      location: 'Seattle, WA',
      startDate: '2022-03',
      endDate: '2024-05',
      isCurrent: false,
      description: 'Built high-throughput payment gateways and cloud infrastructure.',
    };

    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/candidate/experience',
      token: candToken,
      body: payload,
    });

    assert(res.status === 201, `Expected 201 Created, got ${res.status}`);
    assert(res.data.experience !== undefined, 'Expected created experience in response');
    assert(res.data.experience.company === 'Stripe', 'Company must match Stripe');
    assert(res.data.experience.title === 'Senior Infrastructure Engineer', 'Title must match');
    assert(res.data.experience.employmentType === 'Full-time', 'Employment type must match');
    assert(res.data.experience.isCurrent === false, 'isCurrent must be false');
    assert(res.data.experience.id !== undefined, 'Experience ID must be generated');

    createdExperienceId = res.data.experience.id;
  });

  await runTest('Experience', 'GET /api/candidate/experience includes the added record', async () => {
    const res = await invokeApp(app, {
      method: 'GET',
      url: '/api/candidate/experience',
      token: candToken,
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const found = res.data.experience.find((e: any) => e.id === createdExperienceId);
    assert(found !== undefined, `Created experience ID ${createdExperienceId} must be in the list`);
    assert(found.company === 'Stripe', 'Company must match');
  });

  await runTest('Experience', 'PUT /api/candidate/experience/:id updates work experience details', async () => {
    const updatePayload = {
      company: 'Stripe Payments Inc.',
      title: 'Staff Infrastructure Architect',
      employmentType: 'Full-time',
      location: 'Remote, US',
      isCurrent: true,
      description: 'Promoted to Staff Architect leading global payment reliability.',
    };

    const res = await invokeApp(app, {
      method: 'PUT',
      url: `/api/candidate/experience/${createdExperienceId}`,
      token: candToken,
      body: updatePayload,
    });

    assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
    assert(res.data.experience.company === 'Stripe Payments Inc.', 'Updated company must match');
    assert(res.data.experience.title === 'Staff Infrastructure Architect', 'Updated title must match');
    assert(res.data.experience.isCurrent === true, 'isCurrent must be updated to true');
  });

  await runTest('Experience', 'DELETE /api/candidate/experience/:id deletes work experience', async () => {
    const res = await invokeApp(app, {
      method: 'DELETE',
      url: `/api/candidate/experience/${createdExperienceId}`,
      token: candToken,
    });

    assert(res.status === 200, `Expected 200 OK, got ${res.status}`);

    const listRes = await invokeApp(app, {
      method: 'GET',
      url: '/api/candidate/experience',
      token: candToken,
    });
    const found = listRes.data.experience.find((e: any) => e.id === createdExperienceId);
    assert(found === undefined, 'Deleted experience must not be in list');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // TEST SUITE 3: Validation & Error Handling
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST SUITE 3: Validation & Error Handling ---');

  await runTest('Validation', 'Missing institution returns 400 Bad Request', async () => {
    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/candidate/education',
      token: candToken,
      body: { degree: 'Bachelor of Science' },
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    assert(/institution/i.test(res.data.message), 'Error message must mention institution');
  });

  await runTest('Validation', 'Missing degree returns 400 Bad Request', async () => {
    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/candidate/education',
      token: candToken,
      body: { institution: 'MIT' },
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    assert(/degree/i.test(res.data.message), 'Error message must mention degree');
  });

  await runTest('Validation', 'Missing company name returns 400 Bad Request', async () => {
    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/candidate/experience',
      token: candToken,
      body: { title: 'Software Engineer' },
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    assert(/company/i.test(res.data.message), 'Error message must mention company');
  });

  await runTest('Validation', 'Missing job title returns 400 Bad Request', async () => {
    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/candidate/experience',
      token: candToken,
      body: { company: 'Google' },
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    assert(/title/i.test(res.data.message), 'Error message must mention title');
  });

  await runTest('Validation', 'Updating non-existent education returns 404 Not Found', async () => {
    const res = await invokeApp(app, {
      method: 'PUT',
      url: '/api/candidate/education/edu-nonexistent-1234',
      token: candToken,
      body: { degree: 'Master' },
    });
    assert(res.status === 404, `Expected 404, got ${res.status}`);
  });

  await runTest('Validation', 'Deleting non-existent education returns 404 Not Found', async () => {
    const res = await invokeApp(app, {
      method: 'DELETE',
      url: '/api/candidate/education/edu-nonexistent-1234',
      token: candToken,
    });
    assert(res.status === 404, `Expected 404, got ${res.status}`);
  });

  await runTest('Validation', 'Updating non-existent experience returns 404 Not Found', async () => {
    const res = await invokeApp(app, {
      method: 'PUT',
      url: '/api/candidate/experience/exp-nonexistent-1234',
      token: candToken,
      body: { title: 'Lead' },
    });
    assert(res.status === 404, `Expected 404, got ${res.status}`);
  });

  await runTest('Validation', 'Deleting non-existent experience returns 404 Not Found', async () => {
    const res = await invokeApp(app, {
      method: 'DELETE',
      url: '/api/candidate/experience/exp-nonexistent-1234',
      token: candToken,
    });
    assert(res.status === 404, `Expected 404, got ${res.status}`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // TEST SUITE 4: Security & Cross-Candidate Isolation
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST SUITE 4: Security & Cross-Candidate Isolation ---');

  await runTest('Security', 'Unauthenticated request to /api/candidate/education returns 401', async () => {
    const res = await invokeApp(app, { method: 'GET', url: '/api/candidate/education' });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  await runTest('Security', 'Unauthenticated request to /api/candidate/experience returns 401', async () => {
    const res = await invokeApp(app, { method: 'GET', url: '/api/candidate/experience' });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  await runTest('Security', 'Recruiter is forbidden from adding candidate education (403)', async () => {
    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/candidate/education',
      token: recToken,
      body: { institution: 'Hacker School', degree: 'Certificate' },
    });
    assert(res.status === 403, `Expected 403 Forbidden, got ${res.status}`);
  });

  await runTest('Security', 'Recruiter is forbidden from adding candidate experience (403)', async () => {
    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/candidate/experience',
      token: recToken,
      body: { company: 'Unauthorized Inc.', title: 'Recruiter Attempt' },
    });
    assert(res.status === 403, `Expected 403 Forbidden, got ${res.status}`);
  });

  // Cross-candidate isolation test
  let cand2EduId = '';
  let cand2ExpId = '';

  await runTest('Security', 'Candidate 2 can create their own education record', async () => {
    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/candidate/education',
      token: cand2Token,
      body: { institution: 'University of Washington', degree: 'B.S. Informatics' },
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    cand2EduId = res.data.education.id;
  });

  await runTest('Security', 'Candidate 2 can create their own experience record', async () => {
    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/candidate/experience',
      token: cand2Token,
      body: { company: 'Amazon', title: 'Software Development Engineer' },
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    cand2ExpId = res.data.experience.id;
  });

  await runTest('Security', 'Candidate A cannot update Candidate B education record (returns 404)', async () => {
    const res = await invokeApp(app, {
      method: 'PUT',
      url: `/api/candidate/education/${cand2EduId}`,
      token: candToken, // Candidate 1 trying to edit Candidate 2's record
      body: { degree: 'Hacked Degree' },
    });
    assert(res.status === 404, `Expected 404 Not Found for cross-candidate update, got ${res.status}`);
  });

  await runTest('Security', 'Candidate A cannot delete Candidate B education record (returns 404)', async () => {
    const res = await invokeApp(app, {
      method: 'DELETE',
      url: `/api/candidate/education/${cand2EduId}`,
      token: candToken, // Candidate 1 trying to delete Candidate 2's record
    });
    assert(res.status === 404, `Expected 404 Not Found for cross-candidate delete, got ${res.status}`);
  });

  await runTest('Security', 'Candidate A cannot update Candidate B experience record (returns 404)', async () => {
    const res = await invokeApp(app, {
      method: 'PUT',
      url: `/api/candidate/experience/${cand2ExpId}`,
      token: candToken,
      body: { title: 'Hacked Role' },
    });
    assert(res.status === 404, `Expected 404 Not Found for cross-candidate update, got ${res.status}`);
  });

  await runTest('Security', 'Candidate A cannot delete Candidate B experience record (returns 404)', async () => {
    const res = await invokeApp(app, {
      method: 'DELETE',
      url: `/api/candidate/experience/${cand2ExpId}`,
      token: candToken,
    });
    assert(res.status === 404, `Expected 404 Not Found for cross-candidate delete, got ${res.status}`);
  });

  // Clean up Candidate 2 test records
  await invokeApp(app, { method: 'DELETE', url: `/api/candidate/education/${cand2EduId}`, token: cand2Token });
  await invokeApp(app, { method: 'DELETE', url: `/api/candidate/experience/${cand2ExpId}`, token: cand2Token });

  // ────────────────────────────────────────────────────────────────────────────
  // TEST SUITE 5: Persistence & Dual-Column Sync Roundtrip
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST SUITE 5: Persistence & Profile Sync Roundtrip ---');

  let persistentEduId = '';
  let persistentExpId = '';

  await runTest('Persistence', 'Add education and experience for persistence verification', async () => {
    const eduRes = await invokeApp(app, {
      method: 'POST',
      url: '/api/candidate/education',
      token: candToken,
      body: {
        institution: 'UC Berkeley',
        degree: 'B.S. Electrical Engineering & Computer Science',
        fieldOfStudy: 'EECS',
        startDate: '2016',
        endDate: '2020',
        isCurrent: false,
        grade: '3.88',
      },
    });
    assert(eduRes.status === 201, `Expected 201, got ${eduRes.status}`);
    persistentEduId = eduRes.data.education.id;

    const expRes = await invokeApp(app, {
      method: 'POST',
      url: '/api/candidate/experience',
      token: candToken,
      body: {
        company: 'CloudScale Technologies',
        title: 'Senior Distributed Systems Architect',
        employmentType: 'Full-time',
        location: 'San Francisco, CA',
        startDate: '2020',
        isCurrent: true,
        description: 'Leading Kubernetes platform and microservices development.',
      },
    });
    assert(expRes.status === 201, `Expected 201, got ${expRes.status}`);
    persistentExpId = expRes.data.experience.id;
  });

  await runTest('Persistence', 'GET /api/candidate/profile reflects newly synced education & experience', async () => {
    const profRes = await invokeApp(app, {
      method: 'GET',
      url: '/api/candidate/profile',
      token: candToken,
    });
    assert(profRes.status === 200, `Expected 200, got ${profRes.status}`);
    const edus = profRes.data.profile.education || [];
    const exps = profRes.data.profile.experience || [];
    const foundEdu = edus.find((e: any) => e.id === persistentEduId || e.institution === 'UC Berkeley' || e.school === 'UC Berkeley');
    const foundExp = exps.find((e: any) => e.id === persistentExpId || e.company === 'CloudScale Technologies');
    assert(foundEdu !== undefined, 'Profile education list must contain the persistent record');
    assert(foundExp !== undefined, 'Profile experience list must contain the persistent record');
  });

  await runTest('Persistence', 'Clean up test persistence records', async () => {
    if (persistentEduId) {
      await invokeApp(app, { method: 'DELETE', url: `/api/candidate/education/${persistentEduId}`, token: candToken });
    }
    if (persistentExpId) {
      await invokeApp(app, { method: 'DELETE', url: `/api/candidate/experience/${persistentExpId}`, token: candToken });
    }
    // Verify cleanup
    const cleanList = await invokeApp(app, { method: 'GET', url: '/api/candidate/education', token: candToken });
    const found = cleanList.data.education.find((e: any) => e.id === persistentEduId);
    assert(found === undefined, 'Cleaned up education record must not exist');
  });

  // Restore candidate email just in case
  await db.updateUser(candUser.id, { email: 'candidate@talenthub.com' });

  // ────────────────────────────────────────────────────────────────────────────
  // Test Summary
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n======================================================');
  console.log(' Test Execution Summary');
  const total = testResults.length;
  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;
  console.log(` Total Scenarios: ${total}`);
  console.log(` Passed:          ${passed}`);
  console.log(` Failed:          ${failed}`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
