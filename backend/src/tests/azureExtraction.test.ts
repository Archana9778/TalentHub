process.env.NODE_ENV = 'test';
process.env.DB_MODE = 'json';
process.env.JWT_SECRET = 'talenthub-super-secret-azure-enterprise-key-2026-minimum-32-chars';

import { AzureDocumentIntelligenceService } from '../services/azureDocumentIntelligenceService';
import http from 'http';
import { Duplex } from 'stream';
import jwt from 'jsonwebtoken';
import { config } from '../config';

config.dbMode = 'json';

class MockSocket extends Duplex {
  remoteAddress = '127.0.0.1';
  encrypted = false;
  _write(_chunk: any, _encoding: string, callback: () => void) {
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
      if (Buffer.isBuffer(options.body)) {
        bodyBuffer = options.body;
      } else {
        const jsonStr = JSON.stringify(options.body);
        bodyBuffer = Buffer.from(jsonStr, 'utf-8');
        reqHeaders['content-type'] = 'application/json';
        reqHeaders['content-length'] = String(bodyBuffer.length);
      }
    }

    const socket = new MockSocket();
    const req = new http.IncomingMessage(socket as any);
    req.method = options.method || 'GET';
    req.url = options.url;
    Object.assign(req.headers, reqHeaders);

    const res = new http.ServerResponse(req);
    const chunks: Buffer[] = [];

    res.write = function (chunk: any) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    } as any;

    res.end = function (chunk?: any) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const resBuffer = Buffer.concat(chunks);
      const resText = resBuffer.toString('utf-8');
      let data: any = resText;
      try {
        data = JSON.parse(resText);
      } catch {}

      const headers: Record<string, string> = {};
      const raw = res.getHeaders ? res.getHeaders() : {};
      for (const [k, v] of Object.entries(raw)) {
        headers[k] = Array.isArray(v) ? v.join(', ') : String(v);
      }

      resolve({
        status: res.statusCode,
        headers,
        data,
      });
      return res;
    } as any;

    expressApp.handle(req, res, (err: any) => {
      if (err) reject(err);
    });

    if (bodyBuffer) {
      req.push(bodyBuffer);
    }
    req.push(null);
  });
}

function generateToken(user: any): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    config.jwtSecret,
    { expiresIn: '1h' }
  );
}

let passedCount = 0;
let failedCount = 0;

function runTest(name: string, fn: () => Promise<void> | void) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      console.log(`  [PASS] ${name}`);
      passedCount++;
    })
    .catch((err) => {
      console.error(`  [FAIL] ${name}: ${err.message}`);
      failedCount++;
    });
}

function assert(cond: any, msg: string) {
  if (!cond) throw new Error(msg);
}

async function runAllTests() {
  const { db } = await import('../database/db');
  await db.initialize();
  if (typeof (db as any).initJson === 'function' && !(db as any).data?.users?.length) {
    (db as any).initJson();
  }
  const { app } = await import('../server');

  console.log('\n======================================================');
  console.log('TalentHub - Azure AI Document Intelligence Test Suite');
  console.log('======================================================\n');

  // Test 1: Full Candidate Profile Extraction (9 Supported Fields)
  await runTest('Scenario 1: Extract all 9 candidate fields from resume document', async () => {
    const resumeText = `%PDF-1.4
Sarah Connor
Email: sarah.connor@skyline.org
Phone: +1 (555) 345-6789
Location: Los Angeles, CA

Professional Summary:
Versatile full-stack engineer and cloud architect with 7+ years building enterprise web applications, resilient REST APIs, and microservices in Azure and AWS.

Technical Skills:
React, TypeScript, Node.js, Python, Azure, Docker, Kubernetes, SQL, REST API, Git, CI/CD

Work Experience:
Lead Software Engineer at Cyberdyne Systems (2021 - Present)
Architected distributed microservices handling 2M requests/day, cutting latency by 35%.

Full Stack Developer at Tech Defense LLC (2018 - 2021)
Built responsive candidate portals and automated testing pipelines.

Education:
Bachelor of Science in Computer Science, Stanford University, 2018

Certifications:
Microsoft Certified: Azure Solutions Architect Expert, AWS Certified Developer
%%EOF`;

    const buffer = Buffer.from(resumeText, 'utf-8');
    const result = await AzureDocumentIntelligenceService.extractCandidateDetails(
      buffer,
      'Sarah_Connor_Senior_Engineer_Resume.pdf',
      'application/pdf'
    );

    assert(result.status === 'completed', `Expected status completed but got ${result.status}`);
    assert(result.data !== undefined, 'Expected extracted data to be populated');
    const data = result.data!;

    assert(data.fullName.includes('Sarah Connor'), `Name mismatch: ${data.fullName}`);
    assert(data.email === 'sarah.connor@skyline.org', `Email mismatch: ${data.email}`);
    assert(data.phone.includes('345-6789'), `Phone mismatch: ${data.phone}`);
    assert(data.location.includes('Los Angeles'), `Location mismatch: ${data.location}`);
    assert(data.summary.includes('full-stack engineer'), `Summary missing expected content: ${data.summary}`);
    assert(data.skills.includes('React'), `Expected React in skills: ${data.skills.join(', ')}`);
    assert(data.skills.includes('TypeScript'), `Expected TypeScript in skills`);
    assert(data.skills.includes('Azure'), `Expected Azure in skills`);
    assert(data.experience.length >= 1, `Expected experience items, got ${data.experience.length}`);
    assert(data.education.length >= 1, `Expected education items, got ${data.education.length}`);
    assert(data.certifications.length >= 1, `Expected certifications, got ${data.certifications.length}`);
  });

  // Test 2: Heuristic Text & Fallback Extraction for Raw Buffers
  await runTest('Scenario 2: Intelligent heuristic layout extraction on text/plain documents', async () => {
    const docText = `Alex Mercer
alex.mercer@prototype.io
Phone: 555-888-9999
Location: New York, NY
Summary: Experienced software developer specialized in systems programming and distributed caching.
Skills: Go, Rust, Docker, Kubernetes, Linux
Experience:
Senior Systems Developer at Gentek Labs (2020 - Present)
Education:
Master of Science in Software Engineering, Columbia University, 2019
Certifications:
Certified Kubernetes Administrator (CKA)`;

    const buffer = Buffer.from(docText, 'utf-8');
    const res = AzureDocumentIntelligenceService.extractWithHeuristics(buffer, 'Alex_Mercer_CV.txt');

    assert(res.fullName.includes('Alex Mercer'), `Full name was: ${res.fullName}`);
    assert(res.email === 'alex.mercer@prototype.io', `Email was: ${res.email}`);
    assert(res.skills.includes('Docker'), `Skills missing Docker: ${res.skills.join(', ')}`);
    assert(res.experience.length > 0, 'Expected extracted experience');
    assert(res.education.length > 0, 'Expected extracted education');
  });

  // Test 3: Resume with Missing Contact Information
  await runTest('Scenario 3: Resume with missing contact info is handled gracefully without crashing', async () => {
    const textWithoutContact = `%PDF-1.4
John Confidential
Summary: Skilled front-end architect with expertise in design systems and accessibility.
Skills: React, Next.js, CSS3, HTML5
%%EOF`;

    const buffer = Buffer.from(textWithoutContact, 'utf-8');
    const result = await AzureDocumentIntelligenceService.extractCandidateDetails(
      buffer,
      'John_Confidential.pdf',
      'application/pdf'
    );

    assert(result.status === 'completed', 'Expected status completed');
    assert(result.data !== undefined, 'Expected data present');
    assert(result.data?.skills.includes('React'), 'Expected skills to still be extracted');
    // Name should be captured from line or filename
    assert(Boolean(result.data?.fullName), 'Expected full name extracted or synthesized');
  });

  // Test 4: Invalid / Empty File Handling
  await runTest('Scenario 4: Empty or invalid file triggers status="failed" with clean error', async () => {
    const emptyBuffer = Buffer.alloc(0);
    const result = await AzureDocumentIntelligenceService.extractCandidateDetails(
      emptyBuffer,
      'empty.pdf',
      'application/pdf'
    );

    assert(result.status === 'failed', `Expected failed status, got ${result.status}`);
    assert(Boolean(result.error), 'Expected error explanation');
  });

  // Test 5: Azure Endpoint Failure / Offline Fallback
  await runTest('Scenario 5: Degraded or unreachable Azure API falls back to safe extraction without leaking keys', async () => {
    // When Azure credentials are not set or network fails, service guarantees graceful fallback
    const mockBuffer = Buffer.from(`Emily Blunt\nemily@hollywood.com\nSkills: Python, Machine Learning\n`, 'utf-8');
    const result = await AzureDocumentIntelligenceService.extractCandidateDetails(
      mockBuffer,
      'Emily_Blunt.pdf',
      'application/pdf'
    );

    assert(result.status === 'completed', 'Fallback extraction must succeed');
    assert(result.data?.email === 'emily@hollywood.com', 'Email must be captured in fallback');
    // Ensure no credentials or keys are exposed
    assert(!JSON.stringify(result).includes('AccountKey='), 'Sensitive keys must not be exposed');
  });

  // Test 6: Database Persistence of Extraction Records
  await runTest('Scenario 6: Database accurately persists extraction status and structured JSON', async () => {
    const candidateId = 'user-candidate-1';
    const testDocId = `rdoc-test-${Date.now()}`;

    const doc: any = {
      id: testDocId,
      candidateId,
      originalFilename: 'test_resume.pdf',
      blobName: 'resumes/test/test_resume.pdf',
      containerName: 'talenthub-resumes',
      fileExtension: 'pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 1024,
      checksumSha256: 'abc123sha',
      uploadStatus: 'uploaded',
      extractionStatus: 'processing',
      isCurrent: true,
      uploadedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    const created = await (db as any).createResumeDocument(doc);
    assert(created.id === testDocId, 'Created document record matches');

    // Update with completed extraction
    const mockProfile: any = {
      fullName: 'Bruce Wayne',
      email: 'bruce@wayne.corp',
      phone: '+1 555-BAT-TECH',
      location: 'Gotham City',
      summary: 'CEO and advanced technology investor.',
      skills: ['Cryptanalysis', 'Cloud Security', 'Python'],
      experience: [{ title: 'CEO', company: 'Wayne Enterprises', duration: '2010 - Present' }],
      education: [{ degree: 'BS', institution: 'Gotham University', year: '2005' }],
      certifications: ['CISSP'],
      extractedAt: new Date().toISOString(),
    };

    await (db as any).updateResumeExtraction(testDocId, 'completed', mockProfile);
    const fetched = await (db as any).getResumeDocById(testDocId);

    assert(fetched?.extractionStatus === 'completed', `Expected completed status, got ${fetched?.extractionStatus}`);
    assert(fetched?.extractedData?.fullName === 'Bruce Wayne', 'Extracted name matches');
    assert(fetched?.extractedData?.skills.includes('Cryptanalysis'), 'Extracted skills match');
  });

  // Test 7: Recruiter Extraction Endpoints (GET, PUT edit, POST verify)
  await runTest('Scenario 7: Recruiter can view, edit, and verify candidate extraction via REST API', async () => {
    const recruiterUser = await db.getUserByEmail('recruiter@techcorp.com');
    assert(Boolean(recruiterUser), 'Test recruiter must exist');
    const token = generateToken(recruiterUser);

    const candidateId = 'user-candidate-1';

    // 1. GET extraction
    const getRes = await invokeApp(app, {
      method: 'GET',
      url: `/api/resume/candidate/${candidateId}/extracted`,
      token,
    });

    assert(getRes.status === 200, `Expected 200 for get extraction, got ${getRes.status}`);
    assert(getRes.data.candidateId === candidateId, 'Candidate ID matches');
    assert(getRes.data.extractedData !== undefined, 'Extracted data is returned');

    // 2. PUT edit extraction
    const updatedData = {
      ...getRes.data.extractedData,
      fullName: 'Updated Candidate Name',
      location: 'Austin, TX',
      skills: ['React', 'TypeScript', 'Docker', 'Kubernetes', 'Go'],
    };

    const putRes = await invokeApp(app, {
      method: 'PUT',
      url: `/api/resume/candidate/${candidateId}/extracted`,
      token,
      body: updatedData,
    });

    assert(putRes.status === 200, `Expected 200 for update extraction, got ${putRes.status}`);
    assert(putRes.data.extractedData.location === 'Austin, TX', 'Location was updated');

    // 3. POST verify
    const verifyRes = await invokeApp(app, {
      method: 'POST',
      url: `/api/resume/candidate/${candidateId}/verify`,
      token,
      body: {
        data: updatedData,
        overwriteProfile: true,
        confirmOverwrite: true,
      },
    });

    assert(verifyRes.status === 200, `Expected 200 for verify, got ${verifyRes.status}`);
    assert(verifyRes.data.isVerified === true, 'Profile verified flag set');

    // 4. Overwrite confirmation test: verify without confirmOverwrite should request confirmation
    const reVerifyRes = await invokeApp(app, {
      method: 'POST',
      url: `/api/resume/candidate/${candidateId}/verify`,
      token,
      body: {
        data: updatedData,
        overwriteProfile: true,
        confirmOverwrite: false, // Omit confirmation
      },
    });

    assert(
      reVerifyRes.status === 409,
      `Expected 409 conflict requiring confirmation for already-verified profile, got ${reVerifyRes.status}`
    );
    assert(
      reVerifyRes.data.requiresConfirmation === true,
      'Expected requiresConfirmation flag in 409 response'
    );
  });

  // Test 8: Backward Compatibility with Existing Resumes
  await runTest('Scenario 8: Legacy candidate records without modern extraction metadata remain fully functional', async () => {
    const candidate = await db.getUserById('user-candidate-2');
    assert(Boolean(candidate), 'Candidate 2 exists');

    const adminUser = await db.getUserByEmail('admin@talenthub.com');
    const token = generateToken(adminUser);

    const res = await invokeApp(app, {
      method: 'GET',
      url: `/api/resume/candidate/${candidate?.id}/extracted`,
      token,
    });

    assert(res.status === 200, `Expected 200 for legacy candidate, got ${res.status}`);
    assert(Boolean(res.data.extractedData), 'Synthesized extraction profile provided for legacy candidate');
    assert(res.data.isVerified !== undefined, 'isVerified field is boolean');
  });

  console.log('\n------------------------------------------------------');
  console.log(`Results: ${passedCount} passed, ${failedCount} failed.`);
  console.log('------------------------------------------------------\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
