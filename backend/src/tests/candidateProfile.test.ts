process.env.NODE_ENV = 'test';
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
  console.log(' TalentHub Candidate Personal Profile Test Suite');
  console.log('======================================================\n');

  await db.initialize();

  // Obtain candidate and recruiter authentication tokens
  const candLogin = await invokeApp(app, {
    method: 'POST',
    url: '/api/auth/login',
    body: { email: 'candidate@talenthub.com', password: 'password123' },
  });
  assert(candLogin.status === 200, 'Candidate login must succeed');
  const candToken = candLogin.data.token;
  const candUser = candLogin.data.user;

  const recLogin = await invokeApp(app, {
    method: 'POST',
    url: '/api/auth/login',
    body: { email: 'recruiter@techcorp.com', password: 'password123' },
  });
  assert(recLogin.status === 200, 'Recruiter login must succeed');
  const recToken = recLogin.data.token;

  // ────────────────────────────────────────────────────────────────────────────
  // TEST SUITE 1: View Existing Profile
  // ────────────────────────────────────────────────────────────────────────────
  console.log('--- TEST SUITE 1: View Existing Profile ---');

  await runTest('View Profile', 'Candidate can retrieve existing profile via GET /api/candidate/profile', async () => {
    const res = await invokeApp(app, {
      method: 'GET',
      url: '/api/candidate/profile',
      token: candToken,
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.profile !== undefined, 'Response must contain profile object');
    assert(res.data.profile.id === candUser.id, 'Profile id must match candidate user id');
    assert(res.data.profile.email === 'candidate@talenthub.com', 'Email must match candidate email');
    assert(res.data.profile.password === undefined, 'Password hash must never be returned');
    assert(res.data.profile.password_hash === undefined, 'Password hash must never be returned');
  });

  await runTest('View Profile', 'Refreshing / repeating profile request returns identical profile data', async () => {
    const res1 = await invokeApp(app, { method: 'GET', url: '/api/candidate/profile', token: candToken });
    const res2 = await invokeApp(app, { method: 'GET', url: '/api/candidate/profile', token: candToken });
    assert(res1.status === 200 && res2.status === 200, 'Both requests must return 200');
    assert(res1.data.profile.name === res2.data.profile.name, 'Name must be consistent');
    assert(res1.data.profile.email === res2.data.profile.email, 'Email must be consistent');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // TEST SUITE 2: Update Personal Details
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST SUITE 2: Update Personal Details ---');

  await runTest('Update Profile', 'Candidate updates personal information successfully', async () => {
    const updatePayload = {
      name: 'Jane Candidate Senior',
      email: 'candidate.senior@talenthub.com',
      phone: '+1 (555) 234-5678',
      dateOfBirth: '1993-05-18',
      gender: 'Female',
      title: 'Lead Full Stack TypeScript Architect',
      location: 'San Francisco, CA',
      bio: 'Seasoned full stack engineer with deep expertise in cloud architectures and TypeScript ecosystems.',
    };

    const putRes = await invokeApp(app, {
      method: 'PUT',
      url: '/api/candidate/profile',
      token: candToken,
      body: updatePayload,
    });

    assert(putRes.status === 200, `Expected 200, got ${putRes.status}: ${JSON.stringify(putRes.data)}`);
    assert(putRes.data.profile.name === updatePayload.name, 'Name must be updated');
    assert(putRes.data.profile.email === updatePayload.email, 'Email must be updated');
    assert(putRes.data.profile.phone === updatePayload.phone, 'Phone must be updated');
    assert(putRes.data.profile.dateOfBirth === updatePayload.dateOfBirth, 'DOB must be updated');
    assert(putRes.data.profile.gender === updatePayload.gender, 'Gender must be updated');
    assert(putRes.data.profile.title === updatePayload.title, 'Headline must be updated');
    assert(putRes.data.profile.location === updatePayload.location, 'Location must be updated');
    assert(putRes.data.profile.bio === updatePayload.bio, 'Bio must be updated');

    // Confirm that GET /api/candidate/profile returns the newly updated values
    const getRes = await invokeApp(app, {
      method: 'GET',
      url: '/api/candidate/profile',
      token: candToken,
    });
    assert(getRes.status === 200, 'GET after PUT must succeed');
    assert(getRes.data.profile.name === updatePayload.name, 'GET returned updated name');
    assert(getRes.data.profile.title === updatePayload.title, 'GET returned updated headline');
    assert(getRes.data.profile.location === updatePayload.location, 'GET returned updated location');
    assert(getRes.data.profile.bio === updatePayload.bio, 'GET returned updated bio');
    assert(getRes.data.profile.phone === updatePayload.phone, 'GET returned updated phone');
    assert(getRes.data.profile.dateOfBirth === updatePayload.dateOfBirth, 'GET returned updated DOB');
    assert(getRes.data.profile.gender === updatePayload.gender, 'GET returned updated gender');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // TEST SUITE 3: Persistence Verification
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST SUITE 3: Persistence Across Restart ---');

  await runTest('Persistence', 'Candidate updated profile persists in database and survives re-queries', async () => {
    // Query directly from database layer
    const storedUser = await db.getUserById(candUser.id);
    assert(storedUser !== undefined, 'User must exist in DB');
    if (!storedUser) return;
    assert(storedUser.name === 'Jane Candidate Senior', 'Stored name matches updated value');
    assert(storedUser.title === 'Lead Full Stack TypeScript Architect', 'Stored title matches updated value');
    assert(storedUser.location === 'San Francisco, CA', 'Stored location matches updated value');
    assert(storedUser.phone === '+1 (555) 234-5678', 'Stored phone matches updated value');
    assert(storedUser.gender === 'Female', 'Stored gender matches updated value');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // TEST SUITE 4: Validation
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST SUITE 4: Field Validation ---');

  await runTest('Validation', 'Missing full name returns 400 Bad Request', async () => {
    const res = await invokeApp(app, {
      method: 'PUT',
      url: '/api/candidate/profile',
      token: candToken,
      body: { name: '', email: 'valid@example.com' },
    });
    assert(res.status === 400, `Expected 400 for empty name, got ${res.status}`);
    assert(/name/i.test(res.data.message), `Expected name validation error, got: ${res.data.message}`);
  });

  await runTest('Validation', 'Missing email address returns 400 Bad Request', async () => {
    const res = await invokeApp(app, {
      method: 'PUT',
      url: '/api/candidate/profile',
      token: candToken,
      body: { name: 'Valid Name', email: '' },
    });
    assert(res.status === 400, `Expected 400 for empty email, got ${res.status}`);
    assert(/email/i.test(res.data.message), `Expected email validation error, got: ${res.data.message}`);
  });

  await runTest('Validation', 'Invalid email format returns 400 Bad Request', async () => {
    const res = await invokeApp(app, {
      method: 'PUT',
      url: '/api/candidate/profile',
      token: candToken,
      body: { name: 'Valid Name', email: 'not-a-valid-email' },
    });
    assert(res.status === 400, `Expected 400 for invalid email, got ${res.status}`);
    assert(/email/i.test(res.data.message), `Expected email validation message, got: ${res.data.message}`);
  });

  await runTest('Validation', 'Duplicate email already used by another account returns 400', async () => {
    const res = await invokeApp(app, {
      method: 'PUT',
      url: '/api/candidate/profile',
      token: candToken,
      body: { name: 'Valid Name', email: 'recruiter@techcorp.com' },
    });
    assert(res.status === 400, `Expected 400 for duplicate email, got ${res.status}`);
    assert(/already in use/i.test(res.data.message), `Expected duplicate error, got: ${res.data.message}`);
  });

  await runTest('Validation', 'Invalid phone number returns 400 Bad Request', async () => {
    const res = await invokeApp(app, {
      method: 'PUT',
      url: '/api/candidate/profile',
      token: candToken,
      body: { name: 'Valid Name', email: 'candidate.senior@talenthub.com', phone: '123' },
    });
    assert(res.status === 400, `Expected 400 for short phone, got ${res.status}`);
    assert(/phone/i.test(res.data.message), `Expected phone validation message, got: ${res.data.message}`);
  });

  await runTest('Validation', 'Future date of birth returns 400 Bad Request', async () => {
    const res = await invokeApp(app, {
      method: 'PUT',
      url: '/api/candidate/profile',
      token: candToken,
      body: { name: 'Valid Name', email: 'candidate.senior@talenthub.com', dateOfBirth: '2099-01-01' },
    });
    assert(res.status === 400, `Expected 400 for future DOB, got ${res.status}`);
    assert(/date of birth/i.test(res.data.message), `Expected DOB validation message, got: ${res.data.message}`);
  });

  await runTest('Validation', 'Invalid date of birth format returns 400 Bad Request', async () => {
    const res = await invokeApp(app, {
      method: 'PUT',
      url: '/api/candidate/profile',
      token: candToken,
      body: { name: 'Valid Name', email: 'candidate.senior@talenthub.com', dateOfBirth: 'invalid-date' },
    });
    assert(res.status === 400, `Expected 400 for invalid date, got ${res.status}`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // TEST SUITE 5: Security & Role Authorization
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST SUITE 5: Security & Role Authorization ---');

  await runTest('Security', 'Unauthenticated GET /api/candidate/profile returns 401', async () => {
    const res = await invokeApp(app, {
      method: 'GET',
      url: '/api/candidate/profile',
    });
    assert(res.status === 401, `Expected 401 Unauthorized, got ${res.status}`);
  });

  await runTest('Security', 'Unauthenticated PUT /api/candidate/profile returns 401', async () => {
    const res = await invokeApp(app, {
      method: 'PUT',
      url: '/api/candidate/profile',
      body: { name: 'Test', email: 'test@example.com' },
    });
    assert(res.status === 401, `Expected 401 Unauthorized, got ${res.status}`);
  });

  await runTest('Security', 'Recruiter role is forbidden from modifying candidate profile (403)', async () => {
    const res = await invokeApp(app, {
      method: 'PUT',
      url: '/api/candidate/profile',
      token: recToken,
      body: { name: 'Recruiter Hack', email: 'recruiter@techcorp.com' },
    });
    assert(res.status === 403, `Expected 403 Forbidden for recruiter PUT, got ${res.status}`);
    assert(/forbidden|recruiters cannot/i.test(res.data.message), `Expected forbidden message, got: ${res.data.message}`);
  });

  await runTest('Security', 'Candidate A cannot modify Candidate B profile (body ID mismatch)', async () => {
    const res = await invokeApp(app, {
      method: 'PUT',
      url: '/api/candidate/profile',
      token: candToken,
      body: {
        id: 'usr-different-candidate-id-999',
        name: 'Malicious Overwrite',
        email: 'malicious@example.com',
      },
    });
    assert(res.status === 403, `Expected 403 Forbidden for target ID mismatch, got ${res.status}`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // TEST SUITE 6: Recruiter Visibility & Regression
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST SUITE 6: Recruiter Visibility & Regression ---');

  await runTest('Recruiter Visibility', 'Recruiter can view applicant professional information in applications', async () => {
    // Fetch applications as recruiter
    const appsRes = await invokeApp(app, {
      method: 'GET',
      url: '/api/applications',
      token: recToken,
    });
    assert(appsRes.status === 200, `Expected 200, got ${appsRes.status}`);
    if (appsRes.data.applications && appsRes.data.applications.length > 0) {
      const firstAppId = appsRes.data.applications[0].id;
      const appDetail = await invokeApp(app, {
        method: 'GET',
        url: `/api/applications/${firstAppId}`,
        token: recToken,
      });
      assert(appDetail.status === 200, `Expected 200 for application details, got ${appDetail.status}`);
      if (appDetail.data.candidate) {
        assert(appDetail.data.candidate.email !== undefined, 'Candidate email is visible to recruiter');
        assert(appDetail.data.candidate.password === undefined, 'Candidate password is NOT visible to recruiter');
        assert(appDetail.data.candidate.password_hash === undefined, 'Password hash is NOT visible');
      }
    }
  });

  await runTest('Regression', 'Jobs discovery API remains fully functional', async () => {
    const res = await invokeApp(app, {
      method: 'GET',
      url: '/api/jobs?status=active',
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data.jobs), 'Jobs must be an array');
  });

  await runTest('Regression', 'Candidate dashboard analytics remains fully functional', async () => {
    const res = await invokeApp(app, {
      method: 'GET',
      url: '/api/analytics/dashboard',
      token: candToken,
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.analytics !== undefined, 'Analytics must be present');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Summary
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
