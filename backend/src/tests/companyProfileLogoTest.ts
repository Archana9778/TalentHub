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

function invokeApp(
  expressApp: any,
  options: {
    method?: string;
    url: string;
    token?: string;
    body?: any;
    rawBody?: Buffer;
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

    if (options.rawBody) {
      bodyBuffer = options.rawBody;
      reqHeaders['content-length'] = String(bodyBuffer.length);
    } else if (options.body !== undefined) {
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
      const rawResBody = Buffer.concat(responseChunks).toString('utf-8');
      let parsedData: any = rawResBody;
      try {
        parsedData = JSON.parse(rawResBody);
      } catch {}

      const headerNames = res.getHeaderNames ? res.getHeaderNames() : Object.keys((res as any)._headers || {});
      const outHeaders: Record<string, string> = {};
      for (const h of headerNames) {
        const val = res.getHeader(h);
        if (val !== undefined) outHeaders[h.toLowerCase()] = String(val);
      }

      resolve({
        status: res.statusCode,
        headers: outHeaders,
        data: parsedData,
      });
      return origEnd(chunk, ...args);
    };

    try {
      expressApp(req, res);
      if (bodyBuffer && bodyBuffer.length > 0) {
        req.push(bodyBuffer);
      }
      req.push(null);
    } catch (dispatchErr) {
      reject(dispatchErr);
    }
  });
}

function buildMultipartFormData(
  fieldName: string,
  fileName: string,
  fileContent: Buffer,
  mimeType: string
): { boundary: string; buffer: Buffer } {
  const boundary = `----WebKitFormBoundary${Date.now()}`;
  const crlf = '\r\n';
  const head =
    `--${boundary}${crlf}` +
    `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"${crlf}` +
    `Content-Type: ${mimeType}${crlf}${crlf}`;
  const tail = `${crlf}--${boundary}--${crlf}`;

  const buffer = Buffer.concat([
    Buffer.from(head, 'utf-8'),
    fileContent,
    Buffer.from(tail, 'utf-8'),
  ]);

  return { boundary, buffer };
}

async function runTests() {
  console.log('\n======================================================');
  console.log(' TalentHub Company Profile & Logo Integration Tests');
  console.log('======================================================\n');

  await db.initialize();

  // 1. Authenticate recruiter
  console.log('[1] Logging in recruiter...');
  const loginRes = await invokeApp(app, {
    method: 'POST',
    url: '/api/auth/login',
    body: { email: 'recruiter@techcorp.com', password: 'password123' },
  });
  if (loginRes.status !== 200) {
    throw new Error(`Recruiter login failed: ${JSON.stringify(loginRes.data)}`);
  }
  const recruiterToken = loginRes.data.token;
  const user = loginRes.data.user;
  console.log(`✓ Recruiter logged in: ${user.email}, company: ${user.companyName} (${user.companyId || 'comp-1'})`);

  const companyId = user.companyId || 'comp-1';

  // 2. Test: Update existing company profile without duplicate name error
  console.log('[2] Testing company profile update (same name, changed location & overview)...');
  const updateRes = await invokeApp(app, {
    method: 'PUT',
    url: `/api/companies/${companyId}`,
    token: recruiterToken,
    body: {
      name: 'CloudScale Technologies',
      description: 'Next-generation cloud infrastructure and engineering solutions.',
      location: 'San Francisco, CA & Remote',
      industry: 'Cloud Infrastructure & Enterprise Software',
      website: 'https://cloudscale.example.com',
      email: 'contact@cloudscale.example.com',
      contactNumber: '+1-415-555-0199',
      address: '100 Market St, San Francisco, CA',
    },
  });

  if (updateRes.status !== 200) {
    throw new Error(`Company update failed with HTTP ${updateRes.status}: ${JSON.stringify(updateRes.data)}`);
  }
  console.log('✓ PASS: Company profile updated successfully without duplicate company error');

  // 3. Test: Attempting to rename company to another existing company should return 409
  console.log('[3] Testing conflict when renaming company to another existing company name...');
  // First ensure a second company exists
  const secondComp = await db.getCompanyByName('InnovateNow Labs');
  if (!secondComp) {
    await db.createCompany({
      id: 'comp-other-test',
      name: 'InnovateNow Labs',
      description: 'AI & Data research',
      logo: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120',
      website: 'https://innovatenow.test',
      location: 'New York, NY',
      industry: 'Artificial Intelligence',
      size: '50-200 employees',
      verified: true,
      createdAt: new Date().toISOString(),
    });
  }

  const conflictRes = await invokeApp(app, {
    method: 'PUT',
    url: `/api/companies/${companyId}`,
    token: recruiterToken,
    body: {
      name: 'InnovateNow Labs',
      description: 'Attempting to steal name',
    },
  });

  if (conflictRes.status !== 409) {
    throw new Error(`Expected 409 Conflict, received HTTP ${conflictRes.status}: ${JSON.stringify(conflictRes.data)}`);
  }
  console.log('✓ PASS: Duplicate company name correctly returns 409 Conflict');

  // 4. Test: Logo Upload Validation (Reject non-image files)
  console.log('[4] Testing logo upload rejection for non-image file (.txt/.exe)...');
  const textFile = Buffer.from('this is not an image');
  const invalidMultipart = buildMultipartFormData('logo', 'bad.txt', textFile, 'text/plain');
  const badUploadRes = await invokeApp(app, {
    method: 'POST',
    url: `/api/companies/${companyId}/logo`,
    token: recruiterToken,
    headers: { 'content-type': `multipart/form-data; boundary=${invalidMultipart.boundary}` },
    rawBody: invalidMultipart.buffer,
  });

  if (badUploadRes.status !== 400) {
    throw new Error(`Expected 400 Bad Request for text file logo, received ${badUploadRes.status}`);
  }
  console.log('✓ PASS: Invalid logo mime-type correctly rejected with 400 Bad Request');

  // 5. Test: Valid Logo Upload (1x1 valid PNG)
  console.log('[5] Testing valid PNG logo upload...');
  // Minimal valid 1x1 PNG bytes
  const png1x1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  const validMultipart = buildMultipartFormData('logo', 'company_logo.png', png1x1, 'image/png');
  const uploadRes = await invokeApp(app, {
    method: 'POST',
    url: `/api/companies/${companyId}/logo`,
    token: recruiterToken,
    headers: { 'content-type': `multipart/form-data; boundary=${validMultipart.boundary}` },
    rawBody: validMultipart.buffer,
  });

  if (uploadRes.status !== 200) {
    throw new Error(`Valid logo upload failed with HTTP ${uploadRes.status}: ${JSON.stringify(uploadRes.data)}`);
  }
  console.log(`✓ PASS: Logo uploaded successfully. URL: ${uploadRes.data.logoUrl}`);

  // 6. Test: Retrieve company logo endpoint
  console.log('[6] Testing GET /api/companies/:id/logo...');
  const logoGetRes = await invokeApp(app, {
    method: 'GET',
    url: `/api/companies/${companyId}/logo`,
  });

  if (logoGetRes.status !== 200 && logoGetRes.status !== 302) {
    throw new Error(`Expected 200 or 302 for logo retrieval, got ${logoGetRes.status}`);
  }
  console.log(`✓ PASS: GET /api/companies/:id/logo returned status ${logoGetRes.status}`);

  console.log('\n======================================================');
  console.log(' ALL COMPANY PROFILE & LOGO TESTS PASSED!');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
