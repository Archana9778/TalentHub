import './testEnv';
import http from 'http';
import { Duplex } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import { app } from '../server';
import { db } from '../database/db';
import { User, ResumeDocument } from '../types';

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

    expressApp(req, res);

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

async function runMandatoryResumeTests() {
  db.resetToSeed();

  console.log('\n======================================================');
  console.log(' TalentHub - Mandatory Resume Upload Verification');
  console.log('======================================================\n');

  // Candidate A: starts without any resume
  const candidateAId = `user-cand-${uuidv4().substring(0, 8)}`;
  const candidateA: User = {
    id: candidateAId,
    email: `cand.no.resume-${Date.now()}@test.com`,
    password: '$2a$10$j1bWn6bHTthgB1tDjwhlMusU6voxf7iEzcxk4fMSE3BtgzyLa3aq2', // password123
    name: 'Candidate NoResume',
    role: 'candidate',
    status: 'active',
    skills: ['React', 'TypeScript'],
    createdAt: new Date().toISOString(),
  };
  await db.createUser(candidateA);
  const tokenCandidateA = await loginUser(candidateA.email);

  // Candidate B: another candidate who will own a resume
  const candidateBId = `user-cand-${uuidv4().substring(0, 8)}`;
  const candidateB: User = {
    id: candidateBId,
    email: `cand.with.resume-${Date.now()}@test.com`,
    password: '$2a$10$j1bWn6bHTthgB1tDjwhlMusU6voxf7iEzcxk4fMSE3BtgzyLa3aq2',
    name: 'Candidate WithResume',
    role: 'candidate',
    status: 'active',
    skills: ['Node.js', 'MySQL'],
    createdAt: new Date().toISOString(),
  };
  await db.createUser(candidateB);
  const tokenCandidateB = await loginUser(candidateB.email);

  // Target job: active job job-1
  const targetJobId = 'job-1';
  const targetJob2Id = 'job-2';

  // ─────────────────────────────────────────────────────────────
  // Scenario 1: Candidate without a resume applies -> Rejected HTTP 400
  // ─────────────────────────────────────────────────────────────
  try {
    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/applications/apply',
      token: tokenCandidateA,
      body: { jobId: targetJobId, coverLetter: 'Applying without a resume.' },
    });

    assert(res.status === 400, `Expected status 400, got ${res.status}`);
    assert(res.data.success === false, `Expected success: false, got ${res.data.success}`);
    assert(
      res.data.message === 'Please upload your resume to your profile before applying for a job.',
      `Unexpected message: "${res.data.message}"`
    );

    results.push({ scenario: 1, name: 'Candidate without a resume applies -> Application rejected (400)', passed: true });
    console.log('✅ Scenario 1: Candidate without a resume applies -> Application rejected (400)');
  } catch (err: any) {
    results.push({ scenario: 1, name: 'Candidate without a resume applies', passed: false, error: err.message });
    console.error('❌ Scenario 1 failed:', err.message);
  }

  // ─────────────────────────────────────────────────────────────
  // Scenario 2: Direct API request without resume (bypassing frontend) -> Backend rejects
  // ─────────────────────────────────────────────────────────────
  try {
    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/applications',
      token: tokenCandidateA,
      body: { jobId: targetJob2Id, coverLetter: 'Attempting API bypass without resume' },
    });

    assert(res.status === 400, `Expected status 400, got ${res.status}`);
    assert(res.data.success === false, `Expected success: false, got ${res.data.success}`);
    assert(
      res.data.message === 'Please upload your resume to your profile before applying for a job.',
      `Unexpected message: "${res.data.message}"`
    );

    results.push({ scenario: 2, name: 'Candidate tries to bypass frontend validation -> Backend rejects (400)', passed: true });
    console.log('✅ Scenario 2: Candidate tries to bypass frontend validation -> Backend rejects (400)');
  } catch (err: any) {
    results.push({ scenario: 2, name: 'Candidate tries to bypass frontend validation', passed: false, error: err.message });
    console.error('❌ Scenario 2 failed:', err.message);
  }

  // ─────────────────────────────────────────────────────────────
  // Scenario 3: Candidate tries using another candidate's resume ID -> Rejected
  // ─────────────────────────────────────────────────────────────
  let resumeDocBId = '';
  try {
    // Give Candidate B a valid resume document
    resumeDocBId = `rdoc-${uuidv4().substring(0, 8)}`;
    const docB: ResumeDocument = {
      id: resumeDocBId,
      candidateId: candidateBId,
      originalFilename: 'CandidateB_Resume.pdf',
      blobName: `resumes/${candidateBId}/1790000000-docB.pdf`,
      containerName: 'talenthub-resumes',
      fileExtension: 'pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 2048,
      checksumSha256: 'abc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      uploadStatus: 'uploaded',
      isCurrent: true,
      uploadedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    await db.createResumeDocument(docB);

    // Candidate A attempts to apply using Candidate B's resume ID
    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/applications/apply',
      token: tokenCandidateA,
      body: {
        jobId: targetJobId,
        resumeId: resumeDocBId,
        coverLetter: 'Attempting to spoof resumeId.',
      },
    });

    assert(res.status === 403 || res.status === 400, `Expected status 403 or 400, got ${res.status}`);
    assert(res.data.success === false, `Expected success: false, got ${res.data.success}`);

    results.push({ scenario: 3, name: 'Candidate tries using another candidate\'s resume ID -> Request rejected', passed: true });
    console.log('✅ Scenario 3: Candidate tries using another candidate\'s resume ID -> Request rejected');
  } catch (err: any) {
    results.push({ scenario: 3, name: 'Candidate tries using another candidate\'s resume ID', passed: false, error: err.message });
    console.error('❌ Scenario 3 failed:', err.message);
  }

  // ─────────────────────────────────────────────────────────────
  // Scenario 4: Failed resume upload -> Application rejected
  // ─────────────────────────────────────────────────────────────
  try {
    const failedDocId = `rdoc-failed-${uuidv4().substring(0, 8)}`;
    const failedDoc: ResumeDocument = {
      id: failedDocId,
      candidateId: candidateAId,
      originalFilename: 'Corrupted.pdf',
      blobName: `resumes/${candidateAId}/corrupted.pdf`,
      containerName: 'talenthub-resumes',
      fileExtension: 'pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 1024,
      checksumSha256: '0000000000000000000000000000000000000000000000000000000000000000',
      uploadStatus: 'failed',
      isCurrent: true,
      uploadedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    await db.createResumeDocument(failedDoc);

    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/applications/apply',
      token: tokenCandidateA,
      body: { jobId: targetJobId, coverLetter: 'Applying with failed upload status.' },
    });

    assert(res.status === 400, `Expected status 400, got ${res.status}`);
    assert(res.data.success === false, `Expected success: false, got ${res.data.success}`);
    assert(
      res.data.message === 'Please upload your resume to your profile before applying for a job.',
      `Unexpected message: "${res.data.message}"`
    );

    results.push({ scenario: 4, name: 'Resume upload fails -> Application rejected (400)', passed: true });
    console.log('✅ Scenario 4: Resume upload fails -> Application rejected (400)');
  } catch (err: any) {
    results.push({ scenario: 4, name: 'Resume upload fails', passed: false, error: err.message });
    console.error('❌ Scenario 4 failed:', err.message);
  }

  // ─────────────────────────────────────────────────────────────
  // Scenario 5: Candidate uploads valid resume and applies -> Application succeeds (201)
  // ─────────────────────────────────────────────────────────────
  let validDocAId = '';
  try {
    validDocAId = `rdoc-${uuidv4().substring(0, 8)}`;
    const docA: ResumeDocument = {
      id: validDocAId,
      candidateId: candidateAId,
      originalFilename: 'CandidateA_Engineering_Resume.pdf',
      blobName: `resumes/${candidateAId}/1791000000-CandidateA_Engineering_Resume.pdf`,
      containerName: 'talenthub-resumes',
      fileExtension: 'pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 4096,
      checksumSha256: '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
      uploadStatus: 'uploaded',
      isCurrent: true,
      uploadedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    await db.createResumeDocument(docA);

    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/applications/apply',
      token: tokenCandidateA,
      body: { jobId: targetJobId, coverLetter: 'Successfully uploaded resume.' },
    });

    assert(res.status === 201, `Expected status 201, got ${res.status}`);
    assert(res.data.application, 'Expected application object in response');
    assert(res.data.application.resumeUrl === docA.blobName, `Expected application resumeUrl to be ${docA.blobName}`);
    assert(res.data.application.stage === 'Applied', 'Expected initial stage Applied');

    results.push({ scenario: 5, name: 'Candidate uploads a resume and applies -> Application succeeds (201)', passed: true });
    console.log('✅ Scenario 5: Candidate uploads a resume and applies -> Application succeeds (201)');
  } catch (err: any) {
    results.push({ scenario: 5, name: 'Candidate uploads a resume and applies', passed: false, error: err.message });
    console.error('❌ Scenario 5 failed:', err.message);
  }

  // ─────────────────────────────────────────────────────────────
  // Scenario 6: Candidate with existing valid resume applies to another job -> Succeeds
  // ─────────────────────────────────────────────────────────────
  try {
    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/applications/apply',
      token: tokenCandidateA,
      body: { jobId: targetJob2Id, coverLetter: 'Applying to second job with saved profile resume.' },
    });

    assert(res.status === 201, `Expected status 201, got ${res.status}`);
    assert(res.data.application.jobId === targetJob2Id, 'Expected job 2');

    results.push({ scenario: 6, name: 'Candidate with a valid uploaded resume applies -> Application succeeds (201)', passed: true });
    console.log('✅ Scenario 6: Candidate with a valid uploaded resume applies -> Application succeeds (201)');
  } catch (err: any) {
    results.push({ scenario: 6, name: 'Candidate with a valid uploaded resume applies', passed: false, error: err.message });
    console.error('❌ Scenario 6 failed:', err.message);
  }

  // ─────────────────────────────────────────────────────────────
  // Scenario 7: Candidate deletes resume and applies -> Application rejected
  // ─────────────────────────────────────────────────────────────
  try {
    // Delete candidate A's resume
    await db.markResumeDeleted(validDocAId, candidateAId);
    await db.updateUser(candidateAId, {
      resumeUrl: undefined,
      resumeOriginalName: undefined,
      parsedResumeData: undefined,
    });

    // Attempt to apply to job-3
    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/applications/apply',
      token: tokenCandidateA,
      body: { jobId: 'job-3', coverLetter: 'Applying after resume deletion.' },
    });

    assert(res.status === 400, `Expected status 400, got ${res.status}`);
    assert(res.data.success === false, `Expected success: false, got ${res.data.success}`);
    assert(
      res.data.message === 'Please upload your resume to your profile before applying for a job.',
      `Unexpected message: "${res.data.message}"`
    );

    results.push({ scenario: 7, name: 'Candidate deletes their resume and applies -> Application rejected (400)', passed: true });
    console.log('✅ Scenario 7: Candidate deletes their resume and applies -> Application rejected (400)');
  } catch (err: any) {
    results.push({ scenario: 7, name: 'Candidate deletes their resume and applies', passed: false, error: err.message });
    console.error('❌ Scenario 7 failed:', err.message);
  }

  // ─────────────────────────────────────────────────────────────
  // Scenario 8: Existing application functionality continues working
  // ─────────────────────────────────────────────────────────────
  try {
    // Duplicate application check: Candidate B applies to targetJobId twice
    const firstRes = await invokeApp(app, {
      method: 'POST',
      url: '/api/applications/apply',
      token: tokenCandidateB,
      body: { jobId: targetJobId, coverLetter: 'Candidate B first application' },
    });
    assert(firstRes.status === 201, `Expected status 201 for first application, got ${firstRes.status}`);

    const duplicateRes = await invokeApp(app, {
      method: 'POST',
      url: '/api/applications/apply',
      token: tokenCandidateB,
      body: { jobId: targetJobId, coverLetter: 'Candidate B duplicate attempt' },
    });
    assert(duplicateRes.status === 409, `Expected status 409 for duplicate, got ${duplicateRes.status}`);

    // Inactive job check: apply to a non-existent job
    const notFoundRes = await invokeApp(app, {
      method: 'POST',
      url: '/api/applications/apply',
      token: tokenCandidateB,
      body: { jobId: 'non-existent-job-xyz', coverLetter: 'Invalid job' },
    });
    assert(notFoundRes.status === 404, `Expected status 404, got ${notFoundRes.status}`);

    results.push({ scenario: 8, name: 'Existing application functionality continues working (duplicate checks, 404s, etc.)', passed: true });
    console.log('✅ Scenario 8: Existing application functionality continues working');
  } catch (err: any) {
    results.push({ scenario: 8, name: 'Existing application functionality continues working', passed: false, error: err.message });
    console.error('❌ Scenario 8 failed:', err.message);
  }

  // ─────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────
  console.log('\n======================================================');
  console.log(' Test Summary:');
  const passedCount = results.filter((r) => r.passed).length;
  console.log(` Passed: ${passedCount}/${results.length}`);
  console.log('======================================================\n');

  if (passedCount < results.length) {
    process.exit(1);
  }
}

runMandatoryResumeTests().catch((err) => {
  console.error('Fatal error running mandatory resume tests:', err);
  process.exit(1);
});
