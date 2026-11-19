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

    assert(
      result.status === 'completed' || result.status === 'COMPLETED',
      `Expected status completed but got ${result.status}`
    );
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

    assert(result.status === 'completed' || result.status === 'COMPLETED', 'Expected status completed');
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

    assert(
      result.status === 'failed' || result.status === 'FAILED',
      `Expected failed status, got ${result.status}`
    );
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

    assert(
      result.status === 'completed' || result.status === 'COMPLETED',
      'Fallback extraction must succeed'
    );
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

  // Test 9: Extraction Status and Retry Endpoints
  await runTest('Scenario 9: Candidate extraction status check and retry re-processing work end-to-end', async () => {
    const recruiterUser = await db.getUserByEmail('recruiter@techcorp.com');
    assert(Boolean(recruiterUser), 'Test recruiter must exist');
    const token = generateToken(recruiterUser);
    const candidateId = 'user-candidate-1';

    // 1. Check status endpoint
    const statusRes = await invokeApp(app, {
      method: 'GET',
      url: `/api/resume/candidate/${candidateId}/status`,
      token,
    });

    assert(statusRes.status === 200, `Expected 200 for extraction status, got ${statusRes.status}`);
    assert(statusRes.data.candidateId === candidateId, 'Status response matches candidateId');
    assert(Boolean(statusRes.data.status), 'Status field is populated');

    // 2. Retry endpoint
    const retryRes = await invokeApp(app, {
      method: 'POST',
      url: `/api/resume/candidate/${candidateId}/retry`,
      token,
    });

    assert(retryRes.status === 200, `Expected 200 for retry, got ${retryRes.status}`);
    assert(Boolean(retryRes.data.status), 'Retry returns new extraction status');
    assert(Boolean(retryRes.data.extractedData), 'Retry returns extractedData payload');
  });

  // Test 10: Skills Categorization and Deduplication
  await runTest('Scenario 10: Skills extraction identifies technical, tools & soft skills with deduplication', async () => {
    const resumeText = `Johnathan Doe
Email: johnathan@example.com
Phone: 555-123-4567

Skills:
TypeScript, python, Python, React, REACT, Docker, docker, Kubernetes, AWS, PostgreSQL, MongoDB,
Git, VS Code, Postman, Jira, Agile, Communication, Problem Solving, Leadership, Teamwork.
`;
    const buffer = Buffer.from(resumeText, 'utf-8');
    const res = AzureDocumentIntelligenceService.extractWithHeuristics(buffer, 'john_doe.pdf');

    // 1. Deduplication: Python and react should appear only once
    const pythonOccurrences = res.skills.filter((s) => s.toLowerCase() === 'python');
    const reactOccurrences = res.skills.filter((s) => s.toLowerCase() === 'react');
    const dockerOccurrences = res.skills.filter((s) => s.toLowerCase() === 'docker');

    assert(pythonOccurrences.length === 1, `Expected Python once, got ${pythonOccurrences.length}`);
    assert(reactOccurrences.length === 1, `Expected React once, got ${reactOccurrences.length}`);
    assert(dockerOccurrences.length === 1, `Expected Docker once, got ${dockerOccurrences.length}`);

    // 2. Soft skills extraction
    assert(Array.isArray(res.softSkills) && res.softSkills.length > 0, 'Expected soft skills extracted');
    const lowerSoft = (res.softSkills || []).map((s) => s.toLowerCase());
    assert(lowerSoft.includes('communication'), 'Expected Communication in soft skills');
    assert(lowerSoft.includes('leadership'), 'Expected Leadership in soft skills');
    assert(lowerSoft.includes('problem solving'), 'Expected Problem Solving in soft skills');

    // 3. Categorized skills breakdown
    const cat = res.categorizedSkills || res.skillsCategorized;
    assert(cat !== undefined, 'Expected categorizedSkills defined');
    assert(cat!.programmingLanguages.some((s) => /python|typescript/i.test(s)), 'Expected programming languages categorized');
    assert(cat!.frameworks.some((s) => /react/i.test(s)), 'Expected React in frameworks');
    assert(cat!.cloudPlatforms.some((s) => /aws/i.test(s)), 'Expected AWS in cloud platforms');
    assert(cat!.databases.some((s) => /postgresql|mongodb/i.test(s)), 'Expected databases categorized');
    assert(cat!.tools && cat!.tools.some((s) => /git|vs code|postman|jira/i.test(s)), 'Expected tools categorized');
  });

  // Test 11: Multi-Entry Education & Work Experience with Details
  await runTest('Scenario 11: Multi-entry education and experience extracts degrees, status, responsibilities & tech', async () => {
    const resumeText = `Jane Techlead
Email: jane.techlead@example.com

Work Experience:
Principal Architect at FinTech Innovations (2021 - Present)
- Led architecture and migration of payment processing platform to Azure Kubernetes Service.
- Mentored 12 senior engineers across 3 distributed squads.
- Technologies: React, TypeScript, Go, Kafka, Docker, Kubernetes, Azure
- Key Achievements: Reduced checkout checkout latency by 45% and improved uptime to 99.99%.

Senior Software Engineer at Alpha Cloud Corp (2018 - 2021)
- Built microservices in Node.js and Python with PostgreSQL.
- Implemented CI/CD pipelines in GitHub Actions.
- Technologies: Node.js, Python, PostgreSQL, Redis, Docker

Education:
Master of Science in Software Engineering, Carnegie Mellon University (2022 - Present, Pursuing)
Bachelor of Technology in Computer Science, MIT (2014 - 2018, Completed)
`;
    const buffer = Buffer.from(resumeText, 'utf-8');
    const res = AzureDocumentIntelligenceService.extractWithHeuristics(buffer, 'jane_techlead.pdf');

    // Experience checks
    assert(res.experience.length >= 2, `Expected at least 2 experience entries, got ${res.experience.length}`);
    const exp1 = res.experience[0];
    assert(exp1.company.includes('FinTech Innovations'), `Company mismatch: ${exp1.company}`);
    assert(exp1.title.includes('Principal Architect'), `Title mismatch: ${exp1.title}`);
    assert(exp1.isCurrent === true, 'Expected isCurrent=true for Present role');
    assert(Array.isArray(exp1.responsibilities) && exp1.responsibilities.length >= 1, 'Expected responsibilities list');
    assert(Array.isArray(exp1.technologies) && exp1.technologies.length >= 2, 'Expected technologies identified');

    // Education checks
    assert(res.education.length >= 2, `Expected at least 2 education entries, got ${res.education.length}`);
    const eduPursuing = res.education.find((e) => e.status === 'Pursuing' || /cmu|carnegie/i.test(e.institution));
    assert(Boolean(eduPursuing), 'Expected pursuing master degree found');
    assert(eduPursuing?.degree.toLowerCase().includes('master'), 'Degree matches master');
    assert(eduPursuing?.status === 'Pursuing', `Expected status Pursuing, got ${eduPursuing?.status}`);

    const eduCompleted = res.education.find((e) => e.status === 'Completed' || /bachelor/i.test(e.degree));
    assert(Boolean(eduCompleted), 'Expected completed bachelor degree found');
    assert(eduCompleted?.status === 'Completed', `Expected status Completed, got ${eduCompleted?.status}`);
  });

  // Test 12: Strict Experience Calculation Rule (Null on Insufficient Dates)
  await runTest('Scenario 12: Total experience is calculated strictly from dates, returning null when dates are missing', async () => {
    // 1. Resume with clear date boundaries (2018 to Present -> >= 6 years)
    const resumeWithDates = `David ValidDates
Email: david@example.com
Experience:
Senior Developer at Acme Corp (2020 - Present)
Software Developer at Beta LLC (2018 - 2020)
Education: BS in Computer Science, 2018
`;
    const resWithDates = AzureDocumentIntelligenceService.extractWithHeuristics(Buffer.from(resumeWithDates, 'utf-8'), 'david.pdf');
    assert(resWithDates.totalYearsExperience !== null, 'Expected calculated years for valid dates');
    assert(resWithDates.totalYearsExperience! >= 5, `Expected >= 5 years, got ${resWithDates.totalYearsExperience}`);

    // 2. Resume with no date boundaries (only company names without years)
    const resumeNoDates = `Charlie Undated
Email: charlie@example.com
Experience:
Software Engineer at Acme Corp
Junior Developer at Beta LLC
Education: BS in CS
`;
    const resNoDates = AzureDocumentIntelligenceService.extractWithHeuristics(Buffer.from(resumeNoDates, 'utf-8'), 'charlie.pdf');
    assert(
      resNoDates.totalYearsExperience === null,
      `Expected null totalYearsExperience when dates are missing, got: ${resNoDates.totalYearsExperience}`
    );
  });

  // Test 13: Recruiter Validation and Audit Trail
  await runTest('Scenario 13: Recruiter update validates data shapes and preserves originalExtractedData audit trail', async () => {
    const recruiterUser = await db.getUserByEmail('recruiter@techcorp.com');
    const token = generateToken(recruiterUser);
    const candidateId = 'user-candidate-1';

    // 1. Validation check: invalid skills format (not an array of strings) should return 400
    const invalidSkillsRes = await invokeApp(app, {
      method: 'PUT',
      url: `/api/resume/candidate/${candidateId}/extracted`,
      token,
      body: {
        skills: 'Invalid string instead of array',
      },
    });
    assert(invalidSkillsRes.status === 400, `Expected 400 for invalid skills, got ${invalidSkillsRes.status}`);

    // 2. Validation check: invalid education item (missing degree) should return 400
    const invalidEduRes = await invokeApp(app, {
      method: 'PUT',
      url: `/api/resume/candidate/${candidateId}/extracted`,
      token,
      body: {
        education: [{ institution: 'Stanford University' }], // missing degree
      },
    });
    assert(invalidEduRes.status === 400, `Expected 400 for invalid education, got ${invalidEduRes.status}`);

    // 3. Validation check: invalid experience item (missing company) should return 400
    const invalidExpRes = await invokeApp(app, {
      method: 'PUT',
      url: `/api/resume/candidate/${candidateId}/extracted`,
      token,
      body: {
        experience: [{ title: 'Engineer' }], // missing company
      },
    });
    assert(invalidExpRes.status === 400, `Expected 400 for invalid experience, got ${invalidExpRes.status}`);

    // 4. Valid recruiter correction with added skill and education
    const validCorrection = {
      fullName: 'Sarah Connor (Audited)',
      skills: ['React', 'TypeScript', 'Docker', 'GraphQL', 'Leadership'],
      softSkills: ['Leadership'],
      education: [
        {
          degree: 'Bachelor of Science in Computer Science',
          institution: 'Stanford University',
          fieldOfStudy: 'Computer Science',
          year: '2018',
          status: 'Completed',
        },
      ],
      experience: [
        {
          title: 'Lead Software Engineer',
          company: 'Cyberdyne Systems',
          duration: '2021 - Present',
          startDate: '2021',
          endDate: 'Present',
          isCurrent: true,
          responsibilities: ['Architected microservices'],
          technologies: ['TypeScript', 'Azure'],
        },
      ],
    };

    const updateRes = await invokeApp(app, {
      method: 'PUT',
      url: `/api/resume/candidate/${candidateId}/extracted`,
      token,
      body: validCorrection,
    });

    assert(updateRes.status === 200, `Expected 200 for valid correction, got ${updateRes.status}`);
    assert(updateRes.data.reviewStatus === 'Reviewed', `Expected reviewStatus Reviewed, got ${updateRes.data.reviewStatus}`);
    assert(updateRes.data.isCorrected === true, 'Expected isCorrected=true');
    assert(Boolean(updateRes.data.originalExtractedData), 'Expected originalExtractedData preserved for audit');
    assert(updateRes.data.extractedData.skills.includes('GraphQL'), 'Expected newly added skill in saved profile');
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
