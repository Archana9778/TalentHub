import './testEnv';
import http from 'http';
import { Duplex } from 'stream';
import { app } from '../server';
import { db } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';

class MockSocket extends Duplex {
  remoteAddress = '127.0.0.1';
  encrypted = false;
  _write(chunk: any, encoding: string, callback: () => void) {
    callback();
  }
  _read() {}
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
      } catch {}

      const headersOut: Record<string, string> = {};
      const rawHeaderNames = res.getHeaderNames();
      for (const h of rawHeaderNames) {
        const val = res.getHeader(h);
        if (val !== undefined) headersOut[h.toLowerCase()] = String(val);
      }

      resolve({
        status: res.statusCode,
        headers: headersOut,
        data: parsedData,
      });
    };

    expressApp(req, res, (err: any) => {
      if (err) reject(err);
    });

    if (bodyBuffer) {
      req.push(bodyBuffer);
    }
    req.push(null);
  });
}

const generateToken = (user: { id: string; email: string; role: string; companyId?: string; companyRole?: string; tokenVersion?: number }) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      companyRole: user.companyRole,
      tokenVersion: user.tokenVersion ?? 1,
      jti: uuidv4(),
    },
    config.jwtSecret,
    { expiresIn: '1h' }
  );
};

async function runTests() {
  console.log('\n======================================================');
  console.log(' Recruiter Registration & Company Roles Verification Suite');
  console.log('======================================================\n');

  await db.initialize();

  let passed = 0;
  let total = 0;

  async function test(name: string, fn: () => Promise<void>) {
    total++;
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${name}`);
      console.error('   ', err.message);
    }
  }

  // Test 1: Public recruiter registration for a new company creates company and assigns Company Admin
  await test('1. Public recruiter registration creates new company and assigns Company Admin (Rule 1 & Rule 6)', async () => {
    const uniqueEmail = `admin-${uuidv4().substring(0, 6)}@example.com`;
    const companyName = `Apex Labs ${uuidv4().substring(0, 6)}`;

    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/auth/register',
      body: {
        name: 'Alex Mercer',
        email: uniqueEmail,
        password: 'Tr0ub4dor&39!XyZ',
        confirmPassword: 'Tr0ub4dor&39!XyZ',
        role: 'recruiter',
        companyName,
      },
    });

    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
    if (res.data.user.role !== 'recruiter') throw new Error(`Expected role recruiter, got ${res.data.user.role}`);
    if (res.data.user.companyRole !== 'admin') throw new Error(`Expected companyRole admin, got ${res.data.user.companyRole}`);
    if (!res.data.user.companyId) throw new Error('Expected companyId to be defined');

    const company = await db.getCompanyById(res.data.user.companyId);
    if (!company) throw new Error('Company was not created in database');
    if (company.name !== companyName) throw new Error(`Expected company name ${companyName}, got ${company.name}`);
  });

  // Test 2: Existing company names checked with trimmed, case-insensitive comparison
  await test('2. Trimmed, case-insensitive duplicate company blocks public registration with required message (Rule 2 & Rule 3)', async () => {
    const baseName = `Globex Corp ${uuidv4().substring(0, 5)}`;
    // Register first
    await invokeApp(app, {
      method: 'POST',
      url: '/api/auth/register',
      body: {
        name: 'Original Admin',
        email: `orig-${uuidv4().substring(0, 6)}@example.com`,
        password: 'Tr0ub4dor&39!XyZ',
        confirmPassword: 'Tr0ub4dor&39!XyZ',
        role: 'recruiter',
        companyName: baseName,
      },
    });

    // Attempt second registration with differing case and leading/trailing spaces
    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/auth/register',
      body: {
        name: 'Sneaky Recruiter',
        email: `second-${uuidv4().substring(0, 6)}@example.com`,
        password: 'Tr0ub4dor&39!XyZ',
        confirmPassword: 'Tr0ub4dor&39!XyZ',
        role: 'recruiter',
        companyName: `   ${baseName.toUpperCase()}   `,
      },
    });

    if (res.status !== 409) throw new Error(`Expected 409 Conflict, got ${res.status}`);
    const expectedMsg =
      'A company with this name already exists. To join an existing organization, please have your Company Administrator add your account from Recruiter Management.';
    if (res.data.message !== expectedMsg) throw new Error(`Message mismatch. Got: "${res.data.message}"`);
  });

  // Test 3: Public recruiter registration never allows self-assigning company_role = admin or role = admin
  await test('3. Public recruiter registration forbids choosing or self-assigning role=admin (Rule 4)', async () => {
    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/auth/register',
      body: {
        name: 'Attacker',
        email: `attacker-${uuidv4().substring(0, 6)}@example.com`,
        password: 'Tr0ub4dor&39!XyZ',
        confirmPassword: 'Tr0ub4dor&39!XyZ',
        role: 'admin',
        companyName: 'Evil Corp',
      },
    });

    if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
  });

  // Test 4: Company Admin adding a new recruiter forces company_role = 'recruiter' (Regular HR)
  await test('4. Newly added recruiters by Company Admin always default to Regular HR (Rule 3 & Rule 5)', async () => {
    const adminCompany = await db.createCompany({
      id: `comp-test-${uuidv4().substring(0, 6)}`,
      name: `Test Org ${uuidv4().substring(0, 6)}`,
      description: 'Test Org',
      logo: 'https://example.com/logo.png',
      website: 'https://example.com',
      industry: 'Technology',
      size: '50-100',
      location: 'Remote',
      verified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const adminUser = await db.createUser({
      id: `user-admin-${uuidv4().substring(0, 6)}`,
      email: `companyadmin-${uuidv4().substring(0, 6)}@test.com`,
      password: await bcrypt.hash('Password123!', 10),
      name: 'Lead HR',
      role: 'recruiter',
      companyRole: 'admin',
      companyId: adminCompany.id,
      companyName: adminCompany.name,
      status: 'active',
      tokenVersion: 1,
      createdAt: new Date().toISOString(),
    });

    const adminToken = generateToken(adminUser);

    const newRecruiterEmail = `regularhr-${uuidv4().substring(0, 6)}@test.com`;
    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/recruiters',
      token: adminToken,
      body: {
        name: 'Bob Staff',
        email: newRecruiterEmail,
        password: 'Password123!',
        designation: 'Recruiter',
        companyRole: 'admin', // Attempting to set admin at creation
      },
    });

    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
    if (res.data.recruiter.companyRole !== 'recruiter') {
      throw new Error(`Expected companyRole to default to recruiter, got: ${res.data.recruiter.companyRole}`);
    }
  });

  // Test 5: Only Company Admin or Platform Admin can promote to Company Admin
  await test('5. Only Company Admin / Platform Admin can promote recruiter to Company Admin (Rule 5)', async () => {
    const comp = await db.createCompany({
      id: `comp-promote-${uuidv4().substring(0, 6)}`,
      name: `Promo Org ${uuidv4().substring(0, 6)}`,
      description: 'Test Org',
      logo: 'https://example.com/logo.png',
      website: 'https://example.com',
      industry: 'Technology',
      size: '50-100',
      location: 'Remote',
      verified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const adminUser = await db.createUser({
      id: `user-adm-${uuidv4().substring(0, 6)}`,
      email: `admin-${uuidv4().substring(0, 6)}@promo.com`,
      password: await bcrypt.hash('Password123!', 10),
      name: 'Admin HR',
      role: 'recruiter',
      companyRole: 'admin',
      companyId: comp.id,
      companyName: comp.name,
      status: 'active',
      tokenVersion: 1,
      createdAt: new Date().toISOString(),
    });

    const regularRecruiter = await db.createUser({
      id: `user-reg-${uuidv4().substring(0, 6)}`,
      email: `reg-${uuidv4().substring(0, 6)}@promo.com`,
      password: await bcrypt.hash('Password123!', 10),
      name: 'Regular HR',
      role: 'recruiter',
      companyRole: 'recruiter',
      companyId: comp.id,
      companyName: comp.name,
      status: 'active',
      tokenVersion: 1,
      createdAt: new Date().toISOString(),
    });

    const regToken = generateToken(regularRecruiter);
    const adminToken = generateToken(adminUser);

    // Regular recruiter tries to promote themselves to admin
    const unauthorizedRes = await invokeApp(app, {
      method: 'PUT',
      url: `/api/recruiters/${regularRecruiter.id}`,
      token: regToken,
      body: { companyRole: 'admin' },
    });

    if (unauthorizedRes.status !== 200) throw new Error(`Expected 200, got ${unauthorizedRes.status}`);
    const checkUser = await db.getUserById(regularRecruiter.id);
    if (checkUser?.companyRole === 'admin') throw new Error('Regular recruiter was able to self-promote to admin!');

    // Company Admin promotes regular recruiter to admin
    const promoteRes = await invokeApp(app, {
      method: 'PUT',
      url: `/api/recruiters/${regularRecruiter.id}`,
      token: adminToken,
      body: { companyRole: 'admin' },
    });

    if (promoteRes.status !== 200) throw new Error(`Expected 200, got ${promoteRes.status}`);
    const promotedUser = await db.getUserById(regularRecruiter.id);
    if (promotedUser?.companyRole !== 'admin') throw new Error('Company admin failed to promote recruiter to admin');
  });

  // Test 6: Prevent existing recruiter from creating another company and changing company association
  await test('6. Existing recruiter cannot create another company or switch association (Rule 7)', async () => {
    const existingRecruiter = await db.createUser({
      id: `user-bound-${uuidv4().substring(0, 6)}`,
      email: `bound-${uuidv4().substring(0, 6)}@bound.com`,
      password: await bcrypt.hash('Password123!', 10),
      name: 'Bound Recruiter',
      role: 'recruiter',
      companyRole: 'recruiter',
      companyId: 'comp-1',
      companyName: 'CloudScale Technologies',
      status: 'active',
      tokenVersion: 1,
      createdAt: new Date().toISOString(),
    });

    const token = generateToken(existingRecruiter);

    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/companies',
      token,
      body: {
        name: `Hijack Corp ${uuidv4().substring(0, 6)}`,
        description: 'Attempting to detach from existing company',
      },
    });

    if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}: ${JSON.stringify(res.data)}`);
    const afterUser = await db.getUserById(existingRecruiter.id);
    if (afterUser?.companyId !== 'comp-1') throw new Error('Recruiter companyId was mutated!');
  });

  // Test 7: Only Company Admin can update company details
  await test('7. Regular recruiter cannot update company details, only Company Admin can (Rule 8)', async () => {
    const comp = await db.createCompany({
      id: `comp-upd-${uuidv4().substring(0, 6)}`,
      name: `Update Test ${uuidv4().substring(0, 6)}`,
      description: 'Before update',
      logo: 'https://example.com/logo.png',
      website: 'https://example.com',
      industry: 'Technology',
      size: '50-100',
      location: 'Remote',
      verified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const regularRecruiter = await db.createUser({
      id: `user-upd-reg-${uuidv4().substring(0, 6)}`,
      email: `reg-${uuidv4().substring(0, 6)}@upd.com`,
      password: await bcrypt.hash('Password123!', 10),
      name: 'Regular HR',
      role: 'recruiter',
      companyRole: 'recruiter',
      companyId: comp.id,
      companyName: comp.name,
      status: 'active',
      tokenVersion: 1,
      createdAt: new Date().toISOString(),
    });

    const adminRecruiter = await db.createUser({
      id: `user-upd-adm-${uuidv4().substring(0, 6)}`,
      email: `adm-${uuidv4().substring(0, 6)}@upd.com`,
      password: await bcrypt.hash('Password123!', 10),
      name: 'Admin HR',
      role: 'recruiter',
      companyRole: 'admin',
      companyId: comp.id,
      companyName: comp.name,
      status: 'active',
      tokenVersion: 1,
      createdAt: new Date().toISOString(),
    });

    const regToken = generateToken(regularRecruiter);
    const admToken = generateToken(adminRecruiter);

    // Regular recruiter attempt
    const regRes = await invokeApp(app, {
      method: 'PUT',
      url: `/api/companies/${comp.id}`,
      token: regToken,
      body: { description: 'Unauthorized change' },
    });

    if (regRes.status !== 403) throw new Error(`Expected 403 for regular recruiter, got ${regRes.status}`);

    // Company Admin attempt
    const admRes = await invokeApp(app, {
      method: 'PUT',
      url: `/api/companies/${comp.id}`,
      token: admToken,
      body: { description: 'Authorized change by company admin' },
    });

    if (admRes.status !== 200) throw new Error(`Expected 200 for company admin, got ${admRes.status}`);
  });

  // Test 8: Activity Log entries are recorded for company & recruiter management
  await test('8. Activity Log entries recorded for company and recruiter management without passwords (Rule 9)', async () => {
    const adminCompany = await db.createCompany({
      id: `comp-audit-${uuidv4().substring(0, 6)}`,
      name: `Audit Org ${uuidv4().substring(0, 6)}`,
      description: 'Audit Test',
      logo: 'https://example.com/logo.png',
      website: 'https://example.com',
      industry: 'Technology',
      size: '50-100',
      location: 'Remote',
      verified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const adminUser = await db.createUser({
      id: `user-aud-${uuidv4().substring(0, 6)}`,
      email: `admin-${uuidv4().substring(0, 6)}@audit.com`,
      password: await bcrypt.hash('Password123!', 10),
      name: 'Audit Admin',
      role: 'recruiter',
      companyRole: 'admin',
      companyId: adminCompany.id,
      companyName: adminCompany.name,
      status: 'active',
      tokenVersion: 1,
      createdAt: new Date().toISOString(),
    });

    const adminToken = generateToken(adminUser);

    // Add recruiter
    const addRes = await invokeApp(app, {
      method: 'POST',
      url: '/api/recruiters',
      token: adminToken,
      body: {
        name: 'Audit Recruiter',
        email: `rec-${uuidv4().substring(0, 6)}@audit.com`,
        password: 'Password123!',
        designation: 'Talent Sourcer',
      },
    });

    if (addRes.status !== 201) throw new Error(`Add recruiter failed: ${addRes.status}`);
    const recId = addRes.data.recruiter.id;

    // Check activity log
    const { logs } = await db.getActivityLogs({ companyId: adminCompany.id, module: 'RECRUITERS' });
    const createLog = logs.find((l) => l.recordId === recId && l.action === 'CREATE');
    if (!createLog) throw new Error('CREATE Activity Log for recruiter was not found!');

    // Verify passwords or hashes are never present
    const logStr = JSON.stringify(createLog);
    if (logStr.includes('Password123!') || logStr.includes('$2b$10$')) {
      throw new Error('Password or password hash leaked in Activity Log!');
    }
  });

  console.log('\n======================================================');
  console.log(` Test Summary: Passed ${passed}/${total}`);
  console.log('======================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
