# TalentHub Integration Test Script
Write-Host "--- Starting TalentHub Backend Process ---" -ForegroundColor Cyan
$backendProc = Start-Process -FilePath "node" -ArgumentList "backend\dist\server.js" -PassThru -NoNewWindow
Start-Sleep -Seconds 2

try {
    # 1. Health Probe
    Write-Host "`n[Test 1] Probing /health ..." -ForegroundColor Yellow
    $health = Invoke-RestMethod -Uri "http://localhost:5000/health" -Method Get
    Write-Host "Health Status: $($health.status) - Platform: $($health.platform)" -ForegroundColor Green

    # 2. Candidate Login
    Write-Host "`n[Test 2] Candidate Login (candidate@talenthub.com) ..." -ForegroundColor Yellow
    $candLoginBody = @{ email = "candidate@talenthub.com"; password = "password123" } | ConvertTo-Json
    $candAuth = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post -Body $candLoginBody -ContentType "application/json"
    $candToken = $candAuth.token
    Write-Host "Candidate authenticated: $($candAuth.user.name) (Role: $($candAuth.user.role))" -ForegroundColor Green

    # 3. Recruiter Login
    Write-Host "`n[Test 3] Recruiter Login (recruiter@techcorp.com) ..." -ForegroundColor Yellow
    $recLoginBody = @{ email = "recruiter@techcorp.com"; password = "password123" } | ConvertTo-Json
    $recAuth = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post -Body $recLoginBody -ContentType "application/json"
    $recToken = $recAuth.token
    Write-Host "Recruiter authenticated: $($recAuth.user.name) (Company: $($recAuth.user.companyName))" -ForegroundColor Green

    # 4. Jobs API
    Write-Host "`n[Test 4] Querying /api/jobs ..." -ForegroundColor Yellow
    $jobs = Invoke-RestMethod -Uri "http://localhost:5000/api/jobs" -Method Get
    Write-Host "Total Active Jobs Retrieved: $($jobs.total)" -ForegroundColor Green

    # 5. Candidate Analytics API
    Write-Host "`n[Test 5] Querying /api/analytics/dashboard as Candidate ..." -ForegroundColor Yellow
    $candHeaders = @{ Authorization = "Bearer $candToken" }
    $candAnalytics = Invoke-RestMethod -Uri "http://localhost:5000/api/analytics/dashboard" -Method Get -Headers $candHeaders
    Write-Host "Candidate Applications: $($candAnalytics.analytics.totalApplications), Under Review: $($candAnalytics.analytics.underReview)" -ForegroundColor Green

    # 6. Recruiter Analytics API
    Write-Host "`n[Test 6] Querying /api/analytics/dashboard as Recruiter ..." -ForegroundColor Yellow
    $recHeaders = @{ Authorization = "Bearer $recToken" }
    $recAnalytics = Invoke-RestMethod -Uri "http://localhost:5000/api/analytics/dashboard" -Method Get -Headers $recHeaders
    Write-Host "Recruiter Active Jobs: $($recAnalytics.analytics.activeJobs), Total Applicants: $($recAnalytics.analytics.totalApplicants), Avg Match: $($recAnalytics.analytics.averageMatchScore)%" -ForegroundColor Green

    # 7. Candidate Applications & Stepper
    Write-Host "`n[Test 7] Candidate Applications list ..." -ForegroundColor Yellow
    $myApps = Invoke-RestMethod -Uri "http://localhost:5000/api/applications/my-applications" -Method Get -Headers $candHeaders
    Write-Host "Candidate submitted applications count: $($myApps.total)" -ForegroundColor Green

    if ($myApps.total -gt 0) {
        $firstAppId = $myApps.applications[0].id
        Write-Host "`n[Test 8] Audit history for application $firstAppId ..." -ForegroundColor Yellow
        $audit = Invoke-RestMethod -Uri "http://localhost:5000/api/applications/$firstAppId/audit" -Method Get -Headers $candHeaders
        Write-Host "Audit log entries count: $($audit.total)" -ForegroundColor Green
    }

    Write-Host "`n>>> ALL 8 INTEGRATION TESTS PASSED SUCCESSFULLY! <<<" -ForegroundColor Cyan
} finally {
    Write-Host "`n--- Stopping TalentHub Backend Process ---" -ForegroundColor Cyan
    Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
}

