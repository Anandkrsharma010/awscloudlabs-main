# AWS CLI Profile Setup Script for CyberRange

$configFile = "$env:USERPROFILE\.aws\config"

$configContent = @"

[profile cyberrange]
region = ap-south-1
output = json

[profile cyberrange-assume]
region = ap-south-1
output = json
source_profile = cyberrange3
role_arn = arn:aws:iam::766363046973:role/CyberRangeLabManagerRole
role_session_name = cyberrange-session
duration_seconds = 3600
"@

Add-Content -Path $configFile -Value $configContent -Encoding utf8

Write-Host "AWS config updated successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Now run: aws sts get-caller-identity --profile cyberrange-assume" -ForegroundColor Yellow
