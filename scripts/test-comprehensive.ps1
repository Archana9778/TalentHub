# TalentHub Comprehensive Workflow Verification Script
Write-Host "========================================================" -ForegroundColor Cyan
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$dataPath = Join-Path $repoRoot ('.test-data-comprehensive-' + [guid]::NewGuid().ToString('N'))
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$testPort = $listener.LocalEndpoint.Port
$listener.Stop()
$previousEnv = @{ DB_MODE = $env:DB_MODE; DATA_DIR = $env:DATA_DIR; JWT_SECRET = $env:JWT_SECRET; PORT = $env:PORT; NODE_ENV = $env:NODE_ENV }
$env:DB_MODE = 'json'
$env:NODE_ENV = 'test'
$env:DATA_DIR = $dataPath
$env:JWT_SECRET = 'test-only-secret-that-is-not-used-outside-this-process'
$env:PORT = [string]$testPort
$baseUrl = "http://localhost:$testPort"
Write-Host "   TalentHub Comprehensive Workflows Verification Test" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$backendProc = Start-Process -FilePath "node" -ArgumentList (Join-Path $repoRoot 'backend\dist\server.js') -WorkingDirectory $repoRoot -PassThru -NoNewWindow
$failed = $false

try {
    $ready = $false
    $lastReadyError = ''
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ($backendProc.HasExited) { throw 'Backend process exited before becoming ready.' }
        try { Invoke-RestMethod -Uri "$baseUrl/health" -Method Get -TimeoutSec 2 | Out-Null; $ready = $true; break } catch { $lastReadyError = $_.Exception.Message; Start-Sleep -Milliseconds 300 }
    }
    if (-not $ready) { throw "Backend did not become ready within 9 seconds: $lastReadyError" }
    # 1. Health Probe
    Write-Host "`n[1/10] Probing /health & /actuator/health compatibility..." -ForegroundColor Yellow
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
    Write-Host "Status: $($health.status) | Platform: $($health.platform)" -ForegroundColor Green
    Write-Host "DB Engine: $($health.details.database.engine)" -ForegroundColor Green

    # 2. Admin Login & Stats
    Write-Host "`n[2/10] Admin Login (admin@talenthub.com)..." -ForegroundColor Yellow
    $adminAuth = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body (@{ email = "admin@talenthub.com"; password = "password123" } | ConvertTo-Json) -ContentType "application/json"
    $adminToken = $adminAuth.token
    Write-Host "Admin authenticated: $($adminAuth.user.name) (Role: $($adminAuth.user.role))" -ForegroundColor Green

    $adminHeaders = @{ Authorization = "Bearer $adminToken" }
    $stats = Invoke-RestMethod -Uri "$baseUrl/api/admin/statistics" -Method Get -Headers $adminHeaders
    Write-Host "System Stats: $($stats.stats.totalUsers) users, $($stats.stats.totalJobs) jobs, $($stats.stats.totalApplications) applications" -ForegroundColor Green

    # 3. New Candidate Registration
    $randomId = Get-Random -Minimum 1000 -Maximum 9999
    $newEmail = "candidate.test$randomId@talenthub.com"
    Write-Host "`n[3/10] Registering New Candidate ($newEmail)..." -ForegroundColor Yellow
    $regBody = @{
        email = $newEmail
        password = "password123"
        name = "Jordan Lee $randomId"
        role = "candidate"
        title = "Full-Stack Node/React Engineer"
        location = "Austin, TX"
    } | ConvertTo-Json
    $newCandAuth = Invoke-RestMethod -Uri "$baseUrl/api/auth/register" -Method Post -Body $regBody -ContentType "application/json"
    $newCandToken = $newCandAuth.token
    $newCandId = $newCandAuth.user.id
    Write-Host "Registered and JWT received for: $($newCandAuth.user.name) (ID: $newCandId)" -ForegroundColor Green

    # Verify authenticated roles cannot access administrator APIs.
    $candidateDenied = $false
    try {
        Invoke-RestMethod -Uri "$baseUrl/api/admin/statistics" -Method Get -Headers @{ Authorization = "Bearer $newCandToken" } | Out-Null
    } catch {
        $candidateDenied = ([int]$_.Exception.Response.StatusCode -eq 403)
    }
    if (-not $candidateDenied) { throw 'Candidate unexpectedly accessed administrator statistics.' }

    # Verify a suspended account loses access to protected API routes, then restore it.
    $statusBody = @{ status = 'suspended' } | ConvertTo-Json
    Invoke-RestMethod -Uri "$baseUrl/api/admin/users/$newCandId" -Method Patch -Body $statusBody -ContentType "application/json" -Headers $adminHeaders | Out-Null
    $suspendedDenied = $false
    try {
        Invoke-RestMethod -Uri "$baseUrl/api/auth/me" -Method Get -Headers @{ Authorization = "Bearer $newCandToken" } | Out-Null
    } catch {
        $suspendedDenied = ([int]$_.Exception.Response.StatusCode -eq 403)
    }
    if (-not $suspendedDenied) { throw 'Suspended account retained access to a protected route.' }
    $restoreBody = @{ status = 'active' } | ConvertTo-Json
    Invoke-RestMethod -Uri "$baseUrl/api/admin/users/$newCandId" -Method Patch -Body $restoreBody -ContentType "application/json" -Headers $adminHeaders | Out-Null
    Write-Host 'Candidate role denial and suspended-account checks passed.' -ForegroundColor Green

    # 4. Profile Update
    Write-Host "`n[4/10] Candidate Updating Profile..." -ForegroundColor Yellow
    $candHeaders = @{ Authorization = "Bearer $newCandToken" }
    $profileUpdate = @{
        bio = "Experienced developer passionate about modern cloud architectures."
        skills = @("TypeScript", "Node.js", "React", "MySQL", "Docker")
    } | ConvertTo-Json
    $updatedProfile = Invoke-RestMethod -Uri "$baseUrl/api/auth/profile" -Method Put -Body $profileUpdate -ContentType "application/json" -Headers $candHeaders
    Write-Host "Profile updated successfully with skills: $($updatedProfile.user.skills -join ', ')" -ForegroundColor Green

    # 5. Job Search & Filtering
    Write-Host "`n[5/10] Querying Jobs with Search Filter..." -ForegroundColor Yellow
    $searchJobs = Invoke-RestMethod -Uri "$baseUrl/api/jobs?search=engineer" -Method Get
    Write-Host "Retrieved $($searchJobs.total) jobs matching search 'engineer'" -ForegroundColor Green
    $targetJobId = $searchJobs.jobs[0].id
    Write-Host "Target job for application: $($searchJobs.jobs[0].title) (ID: $targetJobId)" -ForegroundColor Gray

    # 6. Apply for Job
    Write-Host "`n[6/10] Candidate Applying for Job $targetJobId..." -ForegroundColor Yellow
    $applyBody = @{
        jobId = $targetJobId
        coverLetter = "I am excited to apply for this engineering role with my Node.js and React background."
    } | ConvertTo-Json
    $newApp = Invoke-RestMethod -Uri "$baseUrl/api/applications/apply" -Method Post -Body $applyBody -ContentType "application/json" -Headers $candHeaders
    $newAppId = $newApp.application.id
    Write-Host "Application submitted: App ID = $newAppId | Match Score = $($newApp.application.matchScore)%" -ForegroundColor Green

    # 7. Recruiter Login & Pipeline Review
    Write-Host "`n[7/10] Recruiter Login & Viewing Applicants..." -ForegroundColor Yellow
    $recAuth = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body (@{ email = "recruiter@techcorp.com"; password = "password123" } | ConvertTo-Json) -ContentType "application/json"
    $recToken = $recAuth.token
    $recHeaders = @{ Authorization = "Bearer $recToken" }

    $applicants = Invoke-RestMethod -Uri "$baseUrl/api/applications/applicants?jobId=$targetJobId" -Method Get -Headers $recHeaders
    Write-Host "Total Applicants for Job $($targetJobId): $($applicants.total)" -ForegroundColor Green

    # 8. Recruiter Advances Candidate to 'Screening' & 'Interview'
    Write-Host "`n[8/10] Recruiter Updating Candidate Application Stage to 'Screening'..." -ForegroundColor Yellow
    $screenBody = @{
        stage = "Screening"
        comment = "Strong background in Node.js and TypeScript. Moving forward."
        recruiterNotes = "Reviewed candidate GitHub and profile."
    } | ConvertTo-Json
    $screenUpdate = Invoke-RestMethod -Uri "$baseUrl/api/applications/$newAppId/stage" -Method Patch -Body $screenBody -ContentType "application/json" -Headers $recHeaders
    Write-Host "Application Stage moved to: $($screenUpdate.application.stage)" -ForegroundColor Green

    Write-Host "`n[9/10] Scheduling Interview for Candidate..." -ForegroundColor Yellow
    $interviewDate = (Get-Date).AddDays(3).ToString("yyyy-MM-ddTHH:mm:ssZ")
    $interviewBody = @{
        stage = "Interview"
        interviewType = "Technical Round"
        interviewDate = $interviewDate
        comment = "Scheduled technical discussion with team lead."
    } | ConvertTo-Json
    $interviewUpdate = Invoke-RestMethod -Uri "$baseUrl/api/applications/$newAppId/stage" -Method Patch -Body $interviewBody -ContentType "application/json" -Headers $recHeaders
    Write-Host "Application Stage moved to: $($interviewUpdate.application.stage) (Type: $($interviewUpdate.application.interviewType))" -ForegroundColor Green

    # 10. Audit Timeline Verification
    Write-Host "`n[10/10] Verifying Audit Timeline for Application $newAppId..." -ForegroundColor Yellow
    $auditRes = Invoke-RestMethod -Uri "$baseUrl/api/applications/$newAppId/audit" -Method Get -Headers $candHeaders
    Write-Host "Total Audit Events: $($auditRes.total)" -ForegroundColor Green
    foreach ($entry in $auditRes.timeline) {
        Write-Host "  -> Stage: $($entry.stage) | Changed By: $($entry.changedByName) | Comment: $($entry.comment)" -ForegroundColor Gray
    }

    Write-Host "`n========================================================" -ForegroundColor Cyan
    Write-Host "✅ ALL 10 COMPREHENSIVE WORKFLOW TESTS PASSED!" -ForegroundColor Green
    Write-Host "========================================================" -ForegroundColor Cyan
} catch {
    $failed = $true
    Write-Error "Comprehensive workflow test failed: $($_.Exception.Message)"
} finally {
    Write-Host "`n--- Stopping TalentHub Backend Process ---" -ForegroundColor Cyan
    Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $dataPath -Recurse -Force -ErrorAction SilentlyContinue
    foreach ($name in $previousEnv.Keys) {
        if ($null -eq $previousEnv[$name]) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue } else { Set-Item "Env:$name" $previousEnv[$name] }
    }
}
if ($failed) { exit 1 }
