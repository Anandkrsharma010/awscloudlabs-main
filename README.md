# AWS Security Labs Platform

A real-world AWS sandbox learning environment integrated with Cyberange platform. Users can practice real AWS CLI commands in isolated sandbox accounts created on-demand.

## Features

✅ **Real AWS Sandbox Accounts** - Each lab session creates a temporary AWS account with lab-specific IAM permissions

✅ **Live Terminal Access** - Web-based terminal connected to AWS CLI with real credentials

✅ **7 Security Labs**:
- S3 bucket exploitation
- IAM privilege escalation
- EC2 security group bypass
- Lambda data extraction
- DynamoDB table scanning
- CloudTrail investigation
- SSM Session Manager exploitation

✅ **Cyberange Integration** - Seamless authentication with JWT tokens and purchase verification

✅ **Auto Cleanup** - Sandbox accounts automatically destroyed after session expiry

✅ **Step-by-Step Guides** - Each lab includes detailed instructions with copyable commands
✅ **Auto PDF Generation** - Markdown docs auto-converted to PDF with watermark via GitHub Actions

## PDF Documentation Generator


```
┌──────────��──────┐
│ Cyberange Auth  │──JWT Token──┐
└─────────────────┘             │
                                │
                          ┌─────▼─────────┐
                          │ Next.js Frontend
                          │ (Terminal UI)
                          └─────┬──────────┘
                                │ WebSocket
                          ┌─────▼──────────┐
                          │ Express Backend
                          │ (Session mgmt)
                          └─────┬──────────┘
                                │
                    ┌───────────┬──────────┐
                    │           │          │
              ┌─────▼──┐  ┌────▼────┐ ┌──▼────┐
              │ Sandbox │  │ Sandbox │ │...    │
              │ Acct 1  │  │ Acct 2  │ │Acct N │
              └─────────┘  └─────────┘ └───────┘
                    │           │
           AWS CLI Commands Via Terminal
```

## Quick Start

### Local Demo (5 minutes)

```bash
# Frontend
npm install
npm run dev

# Backend (in another terminal)
cd backend
npm install
npm run dev
```

Visit http://localhost:3000 and login with any email/password.

See [QUICKSTART.md](./QUICKSTART.md) for detailed instructions.

### With Real AWS (30 minutes)

1. Setup AWS Control Tower: [AWS_SETUP_GUIDE.md](./AWS_SETUP_GUIDE.md)
2. Configure environment variables in `backend/.env`
3. Start both frontend and backend
4. Set up Cyberange integration

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production setup.

## Project Structure

```
aws-labs-platform/
├── app/                           # Next.js 16 frontend
│   ├── page.tsx                   # Landing page
│   ├── labs/
│   │   ├── page.tsx              # Labs dashboard
│   │   └── [labId]/
│   │       └── page.tsx          # Lab terminal interface
│   └── layout.tsx
│
├── backend/                       # Node.js Express server
│   ├── src/
│   │   ├── server.ts             # Main server + REST APIs
│   │   ├── terminal-server.ts    # Terminal execution
│   │   └── services/
│   │       ├── cyberange.service.ts      # Cyberange API client
│   │       ├── aws-control-tower.service.ts  # AWS account mgmt
│   │       └── lab-session.service.ts        # Session lifecycle
│   ├── package.json
│   └── Dockerfile
│
├── lib/
│   ├── api-client.ts              # Backend API client
│   └── lab-data.ts               # Lab content
│
├── hooks/
│   └── use-terminal.ts            # WebSocket hook
│
├── components/ui/                 # shadcn/ui components
│
├── docker-compose.yml             # Container orchestration
├── Dockerfile                     # Frontend image
│
└── Documentation/
    ├── QUICKSTART.md              # 5-minute setup
    ├── DEPLOYMENT.md              # Production deployment
    ├── AWS_SETUP_GUIDE.md         # AWS Control Tower setup
    └── ARCHITECTURE.md            # System design

```

## Tech Stack

**Frontend:**
- Next.js 16 with TypeScript
- React 19
- Tailwind CSS
- shadcn/ui components
- WebSocket for real-time terminal

**Backend:**
- Node.js 18+
- Express.js
- express-ws for WebSocket
- AWS SDK v2
- TypeScript

**Infrastructure:**
- AWS Control Tower for sandbox accounts
- AWS Organizations for account management
- IAM for permission management
- CloudTrail for audit logging

**Deployment:**
- Docker & Docker Compose
- AWS ECS (recommended for production)
- Vercel (for frontend)

## Configuration

### Environment Variables

**Frontend (.env.local)**
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

**Backend (.env)**
```env
PORT=3001
TERMINAL_PORT=3002
NODE_ENV=development

# Cyberange
CYBERANGE_API_URL=https://api.cyberange.com
CYBERANGE_API_KEY=your_api_key
JWT_SECRET=your_jwt_secret

# AWS
AWS_REGION=us-east-1
AWS_CONTROL_TOWER_ENABLED=false  # Set to true after setup
AWS_MANAGEMENT_ACCOUNT_ID=123456789012
AWS_MANAGEMENT_ACCOUNT_ROLE_ARN=arn:aws:iam::123456789012:role/OrganizationAccountAccessRole
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Lab Config
LAB_TIMEOUT_MINUTES=120
LAB_IDLE_TIMEOUT_MINUTES=30
```

## API Reference

### REST Endpoints

```
POST   /api/labs/start                 - Start lab session
GET    /api/labs/session/:sessionId    - Get session details
POST   /api/labs/session/:sessionId/extend  - Extend session
POST   /api/labs/session/:sessionId/end    - End session
GET    /health                         - Health check
```

### WebSocket

```
ws://localhost:3002/terminal/:sessionId

Message Format:
  Command: {"type": "command", "command": "aws s3 ls"}
  Resize:  {"type": "resize", "cols": 80, "rows": 24}

Response:
  {"type": "connected", "message": "..."}
  {"type": "output", "data": "..."}
  {"type": "error", "message": "..."}
```

## Security

- **Isolation**: Each user gets isolated AWS account with minimal permissions
- **Authentication**: JWT tokens validated with Cyberange
- **Credentials**: Temporary AWS credentials, auto-revoked on session end
- **Encryption**: HTTPS in production, WebSocket Secure (wss://)
- **Audit**: CloudTrail logs all API calls
- **Cost Control**: AWS Budgets prevent overspending

## Usage Example

### As an End User

1. Start on Cyberange platform
2. Select "AWS Labs" and choose a lab
3. Get redirected with JWT token
4. Platform creates temporary AWS account
5. Terminal appears with AWS CLI access
6. Follow step-by-step guide
7. Practice real AWS CLI commands
8. Session auto-expires after 2 hours
9. Sandbox account destroyed

### For Integration with Cyberange

1. Get Cyberange API credentials
2. Configure `CYBERANGE_API_URL` and `CYBERANGE_API_KEY`
3. Users redirected as: `https://your-domain.com?token=JWT&userId=123&purchaseId=456`
4. Platform auto-verifies and logs user in

## Scaling

**Development:**
- Single Node.js instance
- In-memory session storage
- Suitable for testing

**Production:**
- Load-balanced backend instances
- Redis for session storage
- Database for analytics
- Pre-created account pool for faster launches
- Multi-region deployment

See [ARCHITECTURE.md](./ARCHITECTURE.md#scaling-considerations) for details.

## Monitoring

Key metrics to track:
- Lab session creation time
- Sandbox account creation latency
- WebSocket connection stability
- Terminal command execution time
- Cost per session
- Active concurrent sessions

See [DEPLOYMENT.md](./DEPLOYMENT.md#monitoring) for setup.

## Troubleshooting

**Backend won't start:**
```bash
# Check Node version
node --version  # 18+

# Review logs
cd backend && npm run dev

# Verify ports are free
lsof -i :3001 :3002
```

**WebSocket fails to connect:**
- Ensure `NEXT_PUBLIC_BACKEND_URL` matches backend address
- Check firewall allows WebSocket (ws://)
- Verify backend is running: `curl http://localhost:3001/health`

**AWS commands fail:**
- In demo mode, commands are simulated
- For real AWS, set `AWS_CONTROL_TOWER_ENABLED=true`
- Verify AWS credentials: `aws sts get-caller-identity`

**Session doesn't create:**
- Check Cyberange API credentials
- Verify JWT token is valid
- Review backend logs for detailed error

See [QUICKSTART.md](./QUICKSTART.md#common-issues) for more.

## Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - Get running in 5 minutes
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Production deployment guide
- **[AWS_SETUP_GUIDE.md](./AWS_SETUP_GUIDE.md)** - AWS Control Tower setup
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design and scaling

## License

MIT

## Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## Support

For issues and questions:
- Check [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- Review [DEPLOYMENT.md](./DEPLOYMENT.md) for configuration
- Check [QUICKSTART.md](./QUICKSTART.md#common-issues) for troubleshooting
- Contact Cyberange support for integration issues

---

**Ready to get started?** → [QUICKSTART.md](./QUICKSTART.md)

**Need production setup?** → [DEPLOYMENT.md](./DEPLOYMENT.md)

**Understanding the system?** → [ARCHITECTURE.md](./ARCHITECTURE.md)
