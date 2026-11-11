const http = require('http');

function post(path, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch (e) { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'GET',
      headers,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch (e) { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('=== 1. Unauthenticated Request ===');
  const unauth = await get('/api/admin/recruiters');
  console.log('GET /api/admin/recruiters ->', unauth.status, unauth.data);

  console.log('\n=== 2. Candidate (Non-Admin) Request ===');
  const candLogin = await post('/api/auth/login', { email: 'candidate@talenthub.com', password: 'password123' });
  console.log('Candidate login ->', candLogin.status, 'role:', candLogin.data?.user?.role);
  const candToken = candLogin.data?.token;
  const candAccess = await get('/api/admin/recruiters', candToken);
  console.log('Candidate GET /api/admin/recruiters ->', candAccess.status, candAccess.data);

  console.log('\n=== 3. Admin Request ===');
  const adminLogin = await post('/api/auth/login', { email: 'admin@talenthub.com', password: 'password123' });
  console.log('Admin login ->', adminLogin.status, 'role:', adminLogin.data?.user?.role);
  const adminToken = adminLogin.data?.token;
  const adminAccess = await get('/api/admin/recruiters', adminToken);
  console.log('Admin GET /api/admin/recruiters ->', adminAccess.status);
  console.log('Total recruiters:', adminAccess.data?.total);
  console.log('Recruiter records:', JSON.stringify(adminAccess.data?.recruiters, null, 2));

  console.log('\n=== 4. Search Filter ===');
  const searchAccess = await get('/api/admin/recruiters?search=Sarah', adminToken);
  console.log('Admin GET /api/admin/recruiters?search=Sarah ->', searchAccess.status, 'found:', searchAccess.data?.total);
  console.log('Search result:', JSON.stringify(searchAccess.data?.recruiters?.map(r => ({ name: r.name, email: r.email, companyName: r.companyName })), null, 2));
}

run().catch(console.error);
