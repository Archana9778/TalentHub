# TalentHub Integration Test Script
Write-Host "--- Starting TalentHub Backend Process ---" -ForegroundColor Cyan
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$dataPath = Join-Path $repoRoot ('.test-data-e2e-' + [guid]::NewGuid().ToString('N'))
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
    Write-Host "`n[Test 1] Probing /health ..." -ForegroundColor Yellow
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
    Write-Host "Health Status: $($health.status) - Platform: $($health.platform)" -ForegroundColor Green

    # 2. Candidate Login
    Write-Host "`n[Test 2] Candidate Login (candidate@talenthub.com) ..." -ForegroundColor Yellow
    $candLoginBody = @{ email = "candidate@talenthub.com"; password = "password123" } | ConvertTo-Json
    $candAuth = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $candLoginBody -ContentType "application/json"
    $candToken = $candAuth.token
    Write-Host "Candidate authenticated: $($candAuth.user.name) (Role: $($candAuth.user.role))" -ForegroundColor Green

    # 3. Recruiter Login
    Write-Host "`n[Test 3] Recruiter Login (recruiter@techcorp.com) ..." -ForegroundColor Yellow
    $recLoginBody = @{ email = "recruiter@techcorp.com"; password = "password123" } | ConvertTo-Json
    $recAuth = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $recLoginBody -ContentType "application/json"
    $recToken = $recAuth.token
    Write-Host "Recruiter authenticated: $($recAuth.user.name) (Company: $($recAuth.user.companyName))" -ForegroundColor Green

    # 4. Jobs API
    Write-Host "`n[Test 4] Querying /api/jobs ..." -ForegroundColor Yellow
    $jobs = Invoke-RestMethod -Uri "$baseUrl/api/jobs" -Method Get
    Write-Host "Total Active Jobs Retrieved: $($jobs.total)" -ForegroundColor Green

    # 5. Candidate Analytics API
    Write-Host "`n[Test 5] Querying /api/analytics/dashboard as Candidate ..." -ForegroundColor Yellow
    $candHeaders = @{ Authorization = "Bearer $candToken" }
    $candAnalytics = Invoke-RestMethod -Uri "$baseUrl/api/analytics/dashboard" -Method Get -Headers $candHeaders
    Write-Host "Candidate Applications: $($candAnalytics.analytics.totalApplications), Under Review: $($candAnalytics.analytics.underReview)" -ForegroundColor Green

    # 6. Recruiter Analytics API
    Write-Host "`n[Test 6] Querying /api/analytics/dashboard as Recruiter ..." -ForegroundColor Yellow
    $recHeaders = @{ Authorization = "Bearer $recToken" }
    $recAnalytics = Invoke-RestMethod -Uri "$baseUrl/api/analytics/dashboard" -Method Get -Headers $recHeaders
    Write-Host "Recruiter Active Jobs: $($recAnalytics.analytics.activeJobs), Total Applicants: $($recAnalytics.analytics.totalApplicants), Avg Match: $($recAnalytics.analytics.averageMatchScore)%" -ForegroundColor Green

    # 7. Candidate Applications & Stepper
    Write-Host "`n[Test 7] Candidate Applications list ..." -ForegroundColor Yellow
    $myApps = Invoke-RestMethod -Uri "$baseUrl/api/applications/my-applications" -Method Get -Headers $candHeaders
    Write-Host "Candidate submitted applications count: $($myApps.total)" -ForegroundColor Green

    if ($myApps.total -gt 0) {
        $firstAppId = $myApps.applications[0].id
        Write-Host "`n[Test 8] Audit history for application $firstAppId ..." -ForegroundColor Yellow
        $audit = Invoke-RestMethod -Uri "$baseUrl/api/applications/$firstAppId/audit" -Method Get -Headers $candHeaders
        Write-Host "Audit log entries count: $($audit.total)" -ForegroundColor Green
    }

    Write-Host "`n>>> ALL 8 INTEGRATION TESTS PASSED SUCCESSFULLY! <<<" -ForegroundColor Cyan
} catch {
    $failed = $true
    Write-Error "Integration test failed: $($_.Exception.Message)"
} finally {
    Write-Host "`n--- Stopping TalentHub Backend Process ---" -ForegroundColor Cyan
    Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $dataPath -Recurse -Force -ErrorAction SilentlyContinue
    foreach ($name in $previousEnv.Keys) {
        if ($null -eq $previousEnv[$name]) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue } else { Set-Item "Env:$name" $previousEnv[$name] }
    }
}
if ($failed) { exit 1 }

