/**
 * TalentHub Advanced Authentication & Role Management Automated Test Suite
 * Covers US 146 (Login/Logout), US 147 (RBAC), US 148 (Password Reset), Registration & Security Policies
 */

const path = require('path');
const fs = require('fs');
const http = require('http');

process.env.NODE_ENV = 'test';
process.env.DB_MODE = 'json';
process.env.DATA_DIR = path.resolve(__dirname, '../.test-data-auth-' + Date.now());
process.env.JWT_SECRET = 'talenthub-super-secret-azure-enterprise-key-2026-very-secure-hmac-sha256';
process.env.PASSWORD_RESET_EXPIRES_MINUTES = '15';
process.env.FRONTEND_URL = 'http://localhost:5173';

const { app } = require('../backend/dist/server');
const { db } = require('../backend/dist/database/db');
const { emailService } = require('../backend/dist/services/emailService');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`  ✅ PASSED: ${message}`);
}

function makeRequest({ method = 'GET', url = '/', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const req = new http.IncomingMessage(null);
    req.method = method;
    req.url = url;
    req.headers = { host: 'localhost', ...headers };

    let payload = null;
    if (body) {
      req.headers['content-type'] = 'application/json';
      payload = Buffer.from(JSON.stringify(body));
      req.headers['content-length'] = payload.length.toString();
    }

    const res = new http.ServerResponse(req);
    const resHeaders = {};
    let resBody = '';

    res.setHeader = (k, v) => {
      const key = k.toLowerCase();
      if (key === 'set-cookie') {
        const existing = resHeaders['set-cookie'] || [];
        resHeaders['set-cookie'] = existing.concat(v);
      } else {
        resHeaders[key] = v;
      }
    };
    res.getHeader = (k) => resHeaders[k.toLowerCase()];
    res.writeHead = (status, hdrs) => {
      res.statusCode = status;
      if (hdrs) Object.assign(resHeaders, hdrs);
      return res;
    };

    res.write = (chunk) => {
      resBody += chunk ? chunk.toString() : '';
      return true;
    };

    res.end = (chunk) => {
      if (chunk) resBody += chunk.toString();
      let parsed = resBody;
      try {
        parsed = JSON.parse(resBody);
      } catch {}
      resolve({
        status: res.statusCode || 200,
        headers: resHeaders,
        body: parsed,
      });
    };

    app.handle(req, res);

    if (payload) {
      req.emit('data', payload);
    }
    req.emit('end');
  });
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log(' TalentHub Advanced Authentication & Role Management Test Suite');
  console.log('========================================================================\n');

  await db.initialize();
  emailService.clearSentEmailsForTesting();

  // ============================================================================
  // 1. REGISTRATION TESTS
  // ============================================================================
  console.log('--- 1. User Registration & Security Policies ---');

  const strongPass = 'SecurePass2026!#';
  const candEmail = `cand.auth.${Date.now()}@talenthub.com`;
  const recEmail = `rec.auth.${Date.now()}@techcorp.com`;

  // 1.1 Valid Candidate Registration
  const candReg = await makeRequest({
    method: 'POST',
    url: '/api/auth/register',
    body: {
      email: candEmail,
      password: strongPass,
      confirmPassword: strongPass,
      name: 'Elena Rostova',
      role: 'candidate',
      title: 'Distributed Systems Engineer',
      location: 'Denver, CO',
    },
  });
  assert(candReg.status === 201, 'Valid candidate registration returns HTTP 201 Created');
  assert(candReg.body.token && candReg.body.user.id, 'Candidate registration returns JWT and sanitized user');
  assert(!candReg.body.user.password, 'Password hash is excluded from user registration response');
  assert(candReg.headers['set-cookie'] && candReg.headers['set-cookie'].some((c) => c.includes('talenthub_token')), 'HttpOnly auth cookie is set on registration');

  const candToken = candReg.body.token;
  const candId = candReg.body.user.id;

  // 1.2 Valid Recruiter Registration
  const recReg = await makeRequest({
    method: 'POST',
    url: '/api/auth/register',
    body: {
      email: recEmail,
      password: strongPass,
      confirmPassword: strongPass,
      name: 'Marcus Vance',
      role: 'recruiter',
      companyName: 'Apex Cloud Systems',
      title: 'Director of Talent',
    },
  });
  assert(recReg.status === 201, 'Valid recruiter registration returns HTTP 201 Created');
  assert(recReg.body.user.role === 'recruiter' && recReg.body.user.companyName === 'Apex Cloud Systems', 'Recruiter is registered with assigned company name');

  const recToken = recReg.body.token;
  const recId = recReg.body.user.id;

  // 1.3 Missing Required Fields
  const missingNameReg = await makeRequest({
    method: 'POST',
    url: '/api/auth/register',
    body: { email: 'noname@test.com', password: strongPass, role: 'candidate' },
  });
  assert(missingNameReg.status === 400, 'Registration with missing name rejected with HTTP 400');

  // 1.4 Recruiter Missing Company Name
  const missingCompReg = await makeRequest({
    method: 'POST',
    url: '/api/auth/register',
    body: { email: 'nocomp@test.com', password: strongPass, name: 'John Rec', role: 'recruiter' },
  });
  assert(missingCompReg.status === 400, 'Recruiter registration without company name rejected with HTTP 400');

  // 1.5 Invalid Email Format
  const badEmailReg = await makeRequest({
    method: 'POST',
    url: '/api/auth/register',
    body: { email: 'not-an-email', password: strongPass, name: 'Test User', role: 'candidate' },
  });
  assert(badEmailReg.status === 400, 'Registration with invalid email syntax rejected with HTTP 400');

  // 1.6 Duplicate Email Registration
  const dupEmailReg = await makeRequest({
    method: 'POST',
    url: '/api/auth/register',
    body: { email: candEmail, password: strongPass, name: 'Duplicate User', role: 'candidate' },
  });
  assert(dupEmailReg.status === 409, 'Duplicate account registration rejected with HTTP 409 Conflict');

  // 1.7 Weak Password - Under 12 characters
  const shortPassReg = await makeRequest({
    method: 'POST',
    url: '/api/auth/register',
    body: { email: 'short@test.com', password: 'Short1!', name: 'Short Pass', role: 'candidate' },
  });
  assert(shortPassReg.status === 400 && shortPassReg.body.errors.some((e) => e.includes('12 characters')), 'Password under 12 characters rejected with HTTP 400');

  // 1.8 Weak Password - Missing special character
  const noSpecialReg = await makeRequest({
    method: 'POST',
    url: '/api/auth/register',
    body: { email: 'nospecial@test.com', password: 'NoSpecialCharacter123', name: 'No Special', role: 'candidate' },
  });
  assert(noSpecialReg.status === 400 && noSpecialReg.body.errors.some((e) => e.includes('special character')), 'Password without special character rejected with HTTP 400');

  // 1.9 Commonly Used Compromised Password
  const commonPassReg = await makeRequest({
    method: 'POST',
    url: '/api/auth/register',
    body: { email: 'common@test.com', password: 'password1234!', name: 'Common Pass', role: 'candidate' },
  });
  assert(commonPassReg.status === 400, 'Commonly compromised password rejected with HTTP 400');

  // 1.10 Reject Public Administrator Registration
  const adminRegAttempt = await makeRequest({
    method: 'POST',
    url: '/api/auth/register',
    body: { email: 'hacker.admin@test.com', password: strongPass, name: 'Fake Admin', role: 'admin' },
  });
  assert(adminRegAttempt.status === 403, 'Public registration as administrator is rejected with HTTP 403');

  // ============================================================================
  // 2. LOGIN & LOGOUT (US 146)
  // ============================================================================
  console.log('\n--- 2. Secure Login, Session Management & Logout (US 146) ---');

  // 2.1 Valid Credentials Login
  const validLogin = await makeRequest({
    method: 'POST',
    url: '/api/auth/login',
    body: { email: candEmail, password: strongPass },
  });
  assert(validLogin.status === 200, 'Valid credentials authenticate successfully with HTTP 200');
  assert(validLogin.body.token && validLogin.body.user.email === candEmail, 'Login returns valid token and user profile');
  assert(validLogin.headers['set-cookie'] && validLogin.headers['set-cookie'].some((c) => c.includes('talenthub_token')), 'Login sets HttpOnly session cookie');

  const sessionToken = validLogin.body.token;

  // 2.2 Invalid Password
  const badPassLogin = await makeRequest({
    method: 'POST',
    url: '/api/auth/login',
    body: { email: candEmail, password: 'WrongPassword123!' },
  });
  assert(badPassLogin.status === 401 && badPassLogin.body.message === 'Invalid email or password.', 'Invalid password returns consistent 401 error message');

  // 2.3 Non-existent Email (Timing attack / enumeration mitigation)
  const nonExistentLogin = await makeRequest({
    method: 'POST',
    url: '/api/auth/login',
    body: { email: 'does-not-exist@talenthub.com', password: 'WrongPassword123!' },
  });
  assert(nonExistentLogin.status === 401 && nonExistentLogin.body.message === 'Invalid email or password.', 'Non-existent email returns identical 401 message (no account enumeration)');

  // 2.4 Suspended Account Login Rejection
  await db.updateUser(candId, { status: 'suspended' });
  const suspendedLogin = await makeRequest({
    method: 'POST',
    url: '/api/auth/login',
    body: { email: candEmail, password: strongPass },
  });
  assert(suspendedLogin.status === 403 && suspendedLogin.body.message.includes('suspended'), 'Suspended account is rejected with HTTP 403');

  // Restore candidate account
  await db.updateUser(candId, { status: 'active' });

  // 2.5 Unauthenticated Access Rejected
  const unauthMe = await makeRequest({
    method: 'GET',
    url: '/api/auth/me',
  });
  assert(unauthMe.status === 401, 'Unauthenticated request to protected endpoint returns HTTP 401');

  // 2.6 Authenticated Me Request via Bearer Token
  const authMeBearer = await makeRequest({
    method: 'GET',
    url: '/api/auth/me',
    headers: { authorization: `Bearer ${sessionToken}` },
  });
  assert(authMeBearer.status === 200 && authMeBearer.body.user.id === candId, 'Protected route accessible with valid Bearer token');

  // 2.7 Authenticated Me Request via HttpOnly Cookie
  const authMeCookie = await makeRequest({
    method: 'GET',
    url: '/api/auth/me',
    headers: { cookie: `talenthub_token=${sessionToken}` },
  });
  assert(authMeCookie.status === 200 && authMeCookie.body.user.id === candId, 'Protected route accessible with HttpOnly session cookie');

  // 2.8 Server-Side Logout & Token Revocation
  const logoutRes = await makeRequest({
    method: 'POST',
    url: '/api/auth/logout',
    headers: { authorization: `Bearer ${sessionToken}` },
  });
  assert(logoutRes.status === 200, 'Server-side logout returns HTTP 200');
  assert(logoutRes.headers['set-cookie'] && logoutRes.headers['set-cookie'].some((c) => c.toLowerCase().includes('expires') || c.includes('Max-Age=0')), 'Logout clears session cookie');

  // 2.9 Revoked Token Cannot Access Protected Route
  const postLogoutMe = await makeRequest({
    method: 'GET',
    url: '/api/auth/me',
    headers: { authorization: `Bearer ${sessionToken}` },
  });
  assert(postLogoutMe.status === 401 && postLogoutMe.body.message.includes('revoked'), 'Revoked token rejected with HTTP 401 after server logout');

  // ============================================================================
  // 3. ROLE-BASED ACCESS CONTROL (RBAC) (US 147)
  // ============================================================================
  console.log('\n--- 3. Role-Based Access Control (RBAC) (US 147) ---');

  // Obtain fresh tokens
  const candLoginFresh = await makeRequest({
    method: 'POST',
    url: '/api/auth/login',
    body: { email: candEmail, password: strongPass },
  });
  const activeCandToken = candLoginFresh.body.token;

  const recLoginFresh = await makeRequest({
    method: 'POST',
    url: '/api/auth/login',
    body: { email: recEmail, password: strongPass },
  });
  const activeRecToken = recLoginFresh.body.token;

  const adminLogin = await makeRequest({
    method: 'POST',
    url: '/api/auth/login',
    body: { email: 'admin@talenthub.com', password: 'password123' },
  });
  assert(adminLogin.status === 200, 'Seeded administrator credentials authenticate successfully');
  const adminToken = adminLogin.body.token;

  // 3.1 Candidate cannot access Admin statistics
  const candAdminDenied = await makeRequest({
    method: 'GET',
    url: '/api/admin/statistics',
    headers: { authorization: `Bearer ${activeCandToken}` },
  });
  assert(candAdminDenied.status === 403, 'Candidate access to /api/admin/statistics denied with HTTP 403');

  // 3.2 Candidate cannot access Recruiter applicants
  const candRecDenied = await makeRequest({
    method: 'GET',
    url: '/api/applications/applicants',
    headers: { authorization: `Bearer ${activeCandToken}` },
  });
  assert(candRecDenied.status === 403, 'Candidate access to /api/applications/applicants denied with HTTP 403');

  // 3.3 Recruiter cannot access Admin routes
  const recAdminDenied = await makeRequest({
    method: 'GET',
    url: '/api/admin/users',
    headers: { authorization: `Bearer ${activeRecToken}` },
  });
  assert(recAdminDenied.status === 403, 'Recruiter access to /api/admin/users denied with HTTP 403');

  // 3.4 Admin can access Admin statistics
  const adminStats = await makeRequest({
    method: 'GET',
    url: '/api/admin/statistics',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert(adminStats.status === 200 && adminStats.body.stats.totalUsers > 0, 'Administrator can access /api/admin/statistics');

  // 3.5 Horizontal Privilege Escalation Prevention: User cannot change own role via profile update
  const candProfileHack = await makeRequest({
    method: 'PUT',
    url: '/api/auth/profile',
    headers: { authorization: `Bearer ${activeCandToken}` },
    body: { role: 'admin', bio: 'Trying to escalate to administrator' },
  });
  assert(candProfileHack.status === 200, 'Profile update responds with HTTP 200');
  const verifyMe = await makeRequest({
    method: 'GET',
    url: '/api/auth/me',
    headers: { authorization: `Bearer ${activeCandToken}` },
  });
  assert(verifyMe.body.user.role === 'candidate', 'Role remains unchanged (candidate) after manipulated profile update');

  // 3.6 Horizontal Resource Access: Candidate cannot view another candidate\'s applications
  const candOtherApp = await makeRequest({
    method: 'GET',
    url: '/api/applications/candidate/user-candidate-1',
    headers: { authorization: `Bearer ${activeCandToken}` },
  });
  assert(candOtherApp.status === 403, 'Candidate cannot access another candidate\'s applications (HTTP 403)');

  // ============================================================================
  // 4. PASSWORD RESET WORKFLOW (US 148)
  // ============================================================================
  console.log('\n--- 4. Password Recovery Workflow (US 148) ---');

  // 4.1 Forgot Password Request with Valid Email
  const forgotRes = await makeRequest({
    method: 'POST',
    url: '/api/auth/forgot-password',
    body: { email: candEmail },
  });
  assert(forgotRes.status === 200, 'Forgot password request returns HTTP 200');

  const sentEmail = emailService.getLastSentEmailForTesting();
  assert(sentEmail && sentEmail.to === candEmail, 'Password reset email was generated and dispatched to candidate');
  assert(sentEmail.text.includes('/reset-password?token='), 'Reset email contains secure reset link');

  // Extract raw token from reset URL
  const tokenMatch = sentEmail.text.match(/token=([a-f0-9]+)/);
  assert(tokenMatch && tokenMatch[1], 'Reset token extracted successfully from email');
  const rawResetToken = tokenMatch[1];

  // 4.2 Forgot Password Request with Non-existent Email
  const fakeForgot = await makeRequest({
    method: 'POST',
    url: '/api/auth/forgot-password',
    body: { email: 'ghost.user.nonexistent@talenthub.com' },
  });
  assert(fakeForgot.status === 200 && fakeForgot.body.message === forgotRes.body.message, 'Forgot password with unknown email returns identical 200 response (anti-enumeration)');

  // 4.3 Reset Password with Invalid/Tampered Token
  const tamperedReset = await makeRequest({
    method: 'POST',
    url: '/api/auth/reset-password',
    body: {
      token: 'tampered-invalid-hex-token-1234567890',
      newPassword: 'BrandNewPass2026!#',
      confirmPassword: 'BrandNewPass2026!#',
    },
  });
  assert(tamperedReset.status === 400 && tamperedReset.body.message.includes('Invalid or expired'), 'Tampered reset token rejected with HTTP 400');

  // 4.4 Reset Password with Weak Password
  const weakReset = await makeRequest({
    method: 'POST',
    url: '/api/auth/reset-password',
    body: {
      token: rawResetToken,
      newPassword: 'weak',
      confirmPassword: 'weak',
    },
  });
  assert(weakReset.status === 400, 'Weak new password rejected on reset with HTTP 400');

  // 4.5 Reset Password with Mismatched Confirmation
  const mismatchReset = await makeRequest({
    method: 'POST',
    url: '/api/auth/reset-password',
    body: {
      token: rawResetToken,
      newPassword: 'BrandNewPass2026!#',
      confirmPassword: 'DifferentPass2026!#',
    },
  });
  assert(mismatchReset.status === 400, 'Mismatched confirm password rejected with HTTP 400');

  // 4.6 Successful Password Reset
  const newPass = 'BrandNewPass2026!#';
  const successReset = await makeRequest({
    method: 'POST',
    url: '/api/auth/reset-password',
    body: {
      token: rawResetToken,
      newPassword: newPass,
      confirmPassword: newPass,
    },
  });
  assert(successReset.status === 200, 'Successful password reset returns HTTP 200');

  // 4.7 Old Password No Longer Works
  const oldLoginFail = await makeRequest({
    method: 'POST',
    url: '/api/auth/login',
    body: { email: candEmail, password: strongPass },
  });
  assert(oldLoginFail.status === 401, 'Old password rejected after reset (HTTP 401)');

  // 4.8 New Password Authenticates Successfully
  const newLoginSuccess = await makeRequest({
    method: 'POST',
    url: '/api/auth/login',
    body: { email: candEmail, password: newPass },
  });
  assert(newLoginSuccess.status === 200 && newLoginSuccess.body.token, 'New password authenticates successfully (HTTP 200)');

  // 4.9 Reused Reset Token Rejected
  const reusedReset = await makeRequest({
    method: 'POST',
    url: '/api/auth/reset-password',
    body: {
      token: rawResetToken,
      newPassword: 'AnotherPass2026!#',
      confirmPassword: 'AnotherPass2026!#',
    },
  });
  assert(reusedReset.status === 400 && reusedReset.body.message.includes('already been used'), 'Already-used reset token rejected with HTTP 400');

  // 4.10 Session Invalidation: Active token issued before password reset is now invalidated
  const preResetSessionDenied = await makeRequest({
    method: 'GET',
    url: '/api/auth/me',
    headers: { authorization: `Bearer ${activeCandToken}` },
  });
  assert(preResetSessionDenied.status === 401 && preResetSessionDenied.body.message.includes('invalidated'), 'Previous session token invalidated after password reset (HTTP 401)');

  // ============================================================================
  // --- 5. Production Security & Hardening Validations ---
  // ============================================================================
  console.log('\n--- 5. Production Security & Hardening Validations ---');

  // 5.1 Credentialed CORS Wildcard Rejection Check
  const corsPreflight = await makeRequest({
    method: 'OPTIONS',
    url: '/api/auth/login',
    headers: {
      origin: 'https://malicious-site.example.com',
      'access-control-request-method': 'POST',
    },
  });
  const allowOrigin = corsPreflight.headers['access-control-allow-origin'];
  assert(
    allowOrigin !== '*' && allowOrigin !== 'https://malicious-site.example.com',
    'CORS rejects arbitrary untrusted origins with credentials'
  );

  // 5.2 Recruiter Cannot Access Another Recruiter's Applicant Data
  const recruiter2Pass = 'GalaxyVortex987!#';
  const recruiter2Email = `alex.vance.${Date.now()}@acme-corp.com`;
  const rec2Reg = await makeRequest({
    method: 'POST',
    url: '/api/auth/register',
    body: {
      name: 'Elena Rostova',
      email: recruiter2Email,
      password: recruiter2Pass,
      confirmPassword: recruiter2Pass,
      role: 'recruiter',
      companyName: 'Acme Global Corp',
    },
  });
  const rec2Token = rec2Reg.body.token;

  // Recruiter 2 tries to view applicants for recruiter 1's job
  const rec2AccessRec1Job = await makeRequest({
    method: 'GET',
    url: '/api/applications/job/job-1',
    headers: { authorization: `Bearer ${rec2Token}` },
  });
  // Recruiter 2 should only see applicants for their own jobs; for other jobs, total should be 0
  assert(
    rec2AccessRec1Job.status === 200 && rec2AccessRec1Job.body.total === 0,
    'Recruiter isolated from accessing applicants of jobs owned by other recruiters'
  );

  // 5.3 Candidate Cannot Modify Arbitrary Job Postings (HTTP 403)
  const candidateActiveToken = newLoginSuccess.body.token;
  const candidateEditJob = await makeRequest({
    method: 'PUT',
    url: '/api/jobs/job-1',
    headers: { authorization: `Bearer ${candidateActiveToken}` },
    body: { title: 'Hacked Job Title' },
  });
  assert(candidateEditJob.status === 403, 'Candidate forbidden from editing job postings (HTTP 403)');

  // 5.4 Candidate Cannot Access Administrative Users List (HTTP 403)
  const candidateAccessUsers = await makeRequest({
    method: 'GET',
    url: '/api/admin/users',
    headers: { authorization: `Bearer ${candidateActiveToken}` },
  });
  assert(candidateAccessUsers.status === 403, 'Candidate forbidden from accessing admin user list (HTTP 403)');

  // 5.5 Sensitive User Fields Excluded From /api/auth/me
  const meCheck = await makeRequest({
    method: 'GET',
    url: '/api/auth/me',
    headers: { authorization: `Bearer ${candidateActiveToken}` },
  });
  assert(
    meCheck.status === 200 && meCheck.body.user && !meCheck.body.user.password && !meCheck.body.user.password_hash,
    'Sensitive password hashes are completely absent from user profile responses'
  );

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n========================================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================================================\n');

  // Cleanup test database directory
  try {
    fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
  } catch {}
}

runTestSuite().catch((err) => {
  console.error('\n❌ Test execution encountered an unhandled error:', err);
  process.exit(1);
});
