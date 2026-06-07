# AWS Labs - Implementation TODO

## Overview
This TODO tracks multiple improvements to the AWS Labs platform including WebSocket fixes and credential handling.

---

# AWS Credentials Fix - COMPLETED ✓

## Problem
Error: "Invalid AWS Access Key ID: The security token included in the request is invalid" when running AWS CLI commands in the terminal.

## Root Cause
The terminal was executing AWS commands without first validating that the credentials provided by the lab session are valid.

## Solution Implemented

### Changes Made:

1. **backend/src/terminal-server.ts**
   - Changed `validateCredentials()` from `private` to `public` method
   - Already had proper validation logic for "does not exist" errors

2. **backend/src/routes/websocket.routes.ts**
   - Added immediate credential validation when terminal is created
   - Returns specific `credential_error` type for frontend handling

3. **hooks/use-terminal-http.ts**
   - Added handling for `credential_error` response type
   - Throws named `CredentialError` for better error handling

### Error Messages Now Provided:
- "The AWS Access Key ID does not exist in our records" - when key is invalid
- "The AWS Secret Access Key is incorrect" - when signature doesn't match
- Clear instructions for users on how to resolve

---

# AWS CLI Role Assumption Setup - COMPLETED ✓

## Problem
User's AWS CLI returns IAM user identity instead of assumed role identity:
```
{
    "UserId": "AIDA3E3WMCQ6SUNKF7T32",
    "Account": "766363046973",
    "Arn": "arn:aws:iam::766363046973:user/aadhithya@iitm"
}
```

But the CyberRangeLab requires assuming `CyberRangeLabManagerRole`.

## Solution Created

Created `AWS_CLI_ROLE_ASSUMPTION_SETUP.md` with:

1. **Step 1**: Configure AWS Config File (`~/.aws/config`)
   - Add `cyberrange` and `cyberrange-assume` profiles
   - Configure role_arn to assume `CyberRangeLabManagerRole`

2. **Step 2**: Configure AWS Credentials File (`~/.aws/credentials`)
   - Add IAM user credentials to `cyberrange` profile

3. **Step 3**: Test Role Assumption
   - Verify with `aws sts get-caller-identity --profile cyberrange-assume`

4. **Step 4**: Use Profile in Commands
   - Add `--profile cyberrange-assume` to all AWS CLI commands

---

# WebSocket 1006 Fix - Implementation TODO

## Overview
Fix persistent WebSocket 1006 (abnormal closure) errors by implementing AWS API Gateway WebSocket architecture.

## Root Cause
AWS App Runner does NOT support long-lived WebSocket connections. The ~25s timeout and 1006 errors are caused by App Runner's underlying ALB/ECS infrastructure closing idle connections.

## Solution Architecture
```
Browser → API Gateway (WebSocket) → Lambda → App Runner (HTTP only)
```

---

## TODO Items

### Phase 1: AWS Infrastructure Setup

- [ ] 1.1 Create DynamoDB table `WebSocketConnections`
  - Partition key: `connectionId` (String)
  - Enable TTL on `expiresAt`

- [ ] 1.2 Create Lambda function `websocket-handler`
  - Runtime: Node.js 18.x
  - Use existing Lambda execution role (due to IAM restrictions)
  - Code: Use `lambda/websocket-handler.js`
  - Environment variables:
    - `TABLE_NAME`: WebSocketConnections
    - `APP_RUNNER_URL`: Your App Runner HTTPS URL
    - `JWT_SECRET`: Your JWT secret
    - `DOMAIN_NAME`: {api-id}.execute-api.{region}.amazonaws.com
    - `STAGE`: prod

- [ ] 1.3 Create API Gateway WebSocket API
  - API name: TerminalWebSocketAPI
  - Routes: $connect, $disconnect, $default
  - Integration: Lambda function
  - Deploy to stage: prod

- [ ] 1.4 Note the WebSocket URL
  - Format: wss://{api-id}.execute-api.{region}.amazonaws.com/prod

### Phase 2: Backend Updates (App Runner)

- [ ] 2.1 Add WebSocket message endpoint
  - POST /api/ws/message
  - Handle: ping, command, resize
  - Return: JSON responses

- [ ] 2.2 Add disconnect notification endpoint
  - POST /api/ws/disconnect
  - Cleanup terminal sessions

- [ ] 2.3 Test endpoints locally

### Phase 3: Frontend Updates

- [ ] 3.1 Update environment variables
  - NEXT_PUBLIC_WS_URL: wss://{api-id}.execute-api.{region}.amazonaws.com/prod
  - Remove any direct App Runner WebSocket URLs

- [ ] 3.2 Update terminal component to use useTerminalApiGateway hook
  - Or ensure existing hook passes correct URL

- [ ] 3.3 Test WebSocket connection

### Phase 4: Validation

- [ ] 4.1 Verify 1006 errors are gone
  - Check browser console
  - Should connect to API Gateway, not App Runner

- [ ] 4.2 Check CloudWatch logs
  - Lambda: Connection lifecycle
  - App Runner: Message handling

- [ ] 4.3 Test timeout behavior
  - Should maintain connection > 10 minutes (API Gateway limit)

---

## Current Status: Awaiting AWS IAM Permission Fix

---

# PDF Generator - COMPLETED ✓

Fixed GitHub Actions workflow syntax error and completed implementation:
- `.github/workflows/generate-pdf.yml`: Full bash logic, git detect/author, outputs, auto-commit
- `scripts/generate_pdfs.py`: MD→PDF (pandoc) + watermark
- `scripts/watermark.py`: Reportlab diagonal author watermark
- Triggers: push to `documentations/*.md` or manual dispatch
- `.gitignore`: Excludes `generated-pdfs/`

## Test (Windows PowerShell)
```powershell
# Local test: Install pandoc first (winget or choco)
winget install JohnMacFarlane.pandoc
pip install PyPDF2 reportlab

python scripts/generate_pdfs.py --files documentations/QUICKSTART.md --author "Test User"
ls generated-pdfs/

# Deploy (PowerShell-friendly)
git add .
git commit -m "test pdf gen"
git push

# Edit QUICKSTART.md + push → auto-trigger
# Or GitHub: Actions → Generate PDF → Run workflow → "all" or "specific"
```

Check: https://github.com/[your-username]/[your-repo]/actions/workflows/generate-pdf.yml

---



The user is blocked by IAM permission error:
```
User is not authorized to perform: iam:CreateRole 
with an explicit deny in identity-based policy
```

### Workaround Options:
1. **Use existing Lambda execution role** - Select existing role during Lambda creation
2. **Request admin assistance** - Ask AWS admin to create role manually
3. **Use pre-built solution** - Deploy from AWS Serverless Application Repository

---

## Files Reference

| File | Purpose |
|------|---------|
| `lambda/websocket-handler.js` | Lambda function code (ready to use) |
| `hooks/use-terminal-api-gateway.ts` | Frontend hook for API Gateway (ready to use) |
| `WEBSOCKET_1006_FIX_COMPLETE.md` | Complete implementation guide |
| `AWS_API_GATEWAY_WEBSOCKET_SETUP.md` | Original setup documentation |

---

## Notes

- App Runner should NOT handle WebSockets directly
- Lambda forwards messages to App Runner via HTTPS
- Frontend connects to API Gateway, not App Runner
- JWT token passed via query string parameters
