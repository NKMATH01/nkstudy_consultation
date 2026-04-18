# Zero Script QA Setup Checklist

Complete setup and integration of Zero Script QA for NK Consultation System.

## Pre-Setup: Verify Environment

- [ ] Node.js 20+ installed: `node -v`
- [ ] npm available: `npm -v`
- [ ] Docker installed (optional for local dev, required for docker compose logs)
- [ ] Project cloned and ready: `/c/Users/nk_ma/OneDrive/01. 클로드 코워크/24.NK 상담관리/nk-consultation/`

## Phase 1: Infrastructure Setup (Already Done)

- [x] Logger utility created: `src/lib/logger.ts`
- [x] API Client created: `src/lib/api-client.ts`
- [x] docker-compose.yml configured
- [x] Dockerfile.dev created
- [x] Documentation created:
  - [x] `docs/ZERO-SCRIPT-QA.md` - Complete guide
  - [x] `docs/QA-QUICK-START.md` - Fast reference
  - [x] `docs/INTEGRATION-GUIDE.md` - Code patterns
  - [x] `docs/qa-issues/ISSUE-TEMPLATE.md` - Issue documentation
  - [x] `ZERO-SCRIPT-QA-SETUP.md` - This file

## Phase 2: Prepare Development Environment

### Step 1: Install Dependencies

```bash
cd "/c/Users/nk_ma/OneDrive/01. 클로드 코워크/24.NK 상담관理/nk-consultation"
npm install
```

Checklist:
- [ ] npm install completes without errors
- [ ] node_modules directory created
- [ ] package-lock.json updated

### Step 2: Configure Environment

Copy `.env.example` to `.env.local` and fill in values:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your keys:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxx
GEMINI_API_KEY=xxxxxx
ANTHROPIC_API_KEY=sk-xxxxxx
```

Checklist:
- [ ] .env.local created
- [ ] NEXT_PUBLIC_SUPABASE_URL filled
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY filled
- [ ] GEMINI_API_KEY filled
- [ ] ANTHROPIC_API_KEY filled

### Step 3: Verify Installation

```bash
npm run build
```

Checklist:
- [ ] Build completes successfully
- [ ] No TypeScript errors
- [ ] No missing dependencies

## Phase 3: Start Monitoring (Manual/Local Development)

### Option A: Direct Development (No Docker)

**Terminal 1 - Start dev server**:
```bash
npm run dev
```

Checklist:
- [ ] Server starts on http://localhost:3000
- [ ] No compilation errors
- [ ] Can access application

**Terminal 2 - Monitor logs**:
```bash
# Run in separate terminal - logs will appear here as you use the app
# Note: Browser console logs will be captured here
```

### Option B: Docker-Based Development (Recommended for Full QA)

**Terminal 1 - Start Docker services**:
```bash
docker compose up -d
docker compose logs -f
```

Checklist:
- [ ] Container builds without errors
- [ ] Service starts successfully
- [ ] Logs appear in real-time

**Terminal 2 - Monitor specific patterns**:
```bash
# Monitor errors only
docker compose logs -f | grep '"level":"ERROR"'
```

## Phase 4: Manual Testing & QA

### Test 1: Verify Logging Works

1. Open browser: http://localhost:3000
2. Open browser DevTools (F12)
3. Go to Console tab
4. You should see JSON log entries

Example output:
```json
{
  "timestamp": "2026-04-19T10:30:00.000Z",
  "level": "INFO",
  "service": "web",
  "request_id": "req_a1b2c3d4",
  "message": "Application started",
  "data": {}
}
```

Checklist:
- [ ] JSON logs appear in browser console
- [ ] Logs have correct structure
- [ ] Request IDs are present

### Test 2: Test Feature with Logging

Feature: User Login

1. Navigate to login page
2. Enter test credentials
3. Click submit
4. Watch logs in Terminal 2

Expected logs:
```json
{
  "level": "INFO",
  "message": "API Request started",
  "data": {
    "method": "POST",
    "endpoint": "/login"
  }
}
```

Checklist:
- [ ] See "Request started" log
- [ ] See "Request completed" log after login
- [ ] Status code is 200 (or expected error code)
- [ ] Response time is logged

### Test 3: Test Error Handling

1. Navigate to login page
2. Enter invalid credentials
3. Submit form
4. Look for ERROR level logs

Expected:
```json
{
  "level": "ERROR",
  "message": "Login failed",
  "data": {
    "status": 401,
    "error": "Invalid credentials"
  }
}
```

Checklist:
- [ ] Error is logged
- [ ] Error includes status code
- [ ] Error message is descriptive

### Test 4: Track Request Flow

1. Perform any action (e.g., create consultation)
2. Find the Request ID in logs: `req_xxxxx`
3. Search logs for that Request ID
4. Verify it appears in all related logs

```bash
docker compose logs | grep 'req_xxxxx'
```

Expected: 5-10 log entries with same Request ID

Checklist:
- [ ] Request ID is consistent across logs
- [ ] Can trace complete flow
- [ ] All services use same Request ID

## Phase 5: Integration with Code (Optional - For Production QA)

To get full logging coverage, add logging to server actions and components.

See `docs/INTEGRATION-GUIDE.md` for detailed instructions.

Checklist:
- [ ] Read INTEGRATION-GUIDE.md
- [ ] Pick one feature to integrate
- [ ] Add logging to server actions
- [ ] Add logging to client components
- [ ] Test and verify logs appear
- [ ] Document any issues found

## Phase 6: Set Up QA Issue Tracking

Create folder for issues:
```bash
mkdir -p docs/qa-issues
```

For each issue found, create file: `docs/qa-issues/ISSUE-{number}-{title}.md`

Template: See `docs/qa-issues/ISSUE-TEMPLATE.md`

Checklist:
- [ ] QA issues folder created
- [ ] Template understood
- [ ] First issue documented (if any found)

## Phase 7: Configure IDE (Optional)

### VS Code Extensions (Recommended)

Install to improve QA workflow:
- JSON Viewer
- Log File Highlighter
- Better Comments

## Success Criteria

Your Zero Script QA setup is complete when:

### Logging
- [x] Logger utility available (`src/lib/logger.ts`)
- [x] API Client available (`src/lib/api-client.ts`)
- [x] JSON logs output to console
- [x] Logs contain required fields

### Monitoring
- [ ] Can start app and see logs
- [ ] Logs appear in real-time
- [ ] Can filter by error level
- [ ] Can filter by Request ID
- [ ] Can filter by endpoint

### Documentation
- [x] ZERO-SCRIPT-QA.md complete
- [x] QA-QUICK-START.md complete
- [x] INTEGRATION-GUIDE.md complete
- [x] ISSUE-TEMPLATE.md complete
- [ ] Team has read documentation

### Testing
- [ ] Manual test executed
- [ ] Logging verified working
- [ ] Error handling verified
- [ ] Request ID tracking verified
- [ ] No setup issues remaining

## Quick Troubleshooting

### Issue: "PORT 3000 already in use"

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
# Or use different port
PORT=3001 npm run dev
```

### Issue: "Cannot find module @/lib/logger"

```bash
# Verify path alias is configured
cat tsconfig.json | grep -A5 paths

# Should include:
# "@/*": ["./src/*"]
```

### Issue: "No logs appearing"

1. Check browser console (F12 > Console)
2. Check terminal for errors
3. Verify npm run dev is running
4. Check .env.local is configured

### Issue: "Docker not found"

Docker is optional. You can use:
```bash
npm run dev  # Direct node
# Logs will appear in this terminal
```

## Next Steps

1. **Start Development**: Run `npm run dev`
2. **Monitor Logs**: Watch browser console or terminal
3. **Test Features**: Use the application normally
4. **Document Issues**: Create files in `docs/qa-issues/`
5. **Review Guide**: Read `docs/ZERO-SCRIPT-QA.md` for details
6. **Integrate Logging** (optional): Follow `docs/INTEGRATION-GUIDE.md`

## File Locations Summary

| File | Purpose |
|------|---------|
| `src/lib/logger.ts` | Core logging utility |
| `src/lib/api-client.ts` | API calls with logging |
| `docker-compose.yml` | Docker configuration |
| `Dockerfile.dev` | Development Docker image |
| `docs/ZERO-SCRIPT-QA.md` | Complete guide |
| `docs/QA-QUICK-START.md` | Quick reference |
| `docs/INTEGRATION-GUIDE.md` | Code patterns |
| `docs/qa-issues/` | Issue documentation |

## Support & Resources

### Documentation Files

1. Start here: `docs/QA-QUICK-START.md` (5 min read)
2. Deep dive: `docs/ZERO-SCRIPT-QA.md` (20 min read)
3. Code patterns: `docs/INTEGRATION-GUIDE.md` (15 min read)
4. Issue format: `docs/qa-issues/ISSUE-TEMPLATE.md` (reference)

### Common Commands

```bash
# Start development
npm run dev

# View logs (docker)
docker compose logs -f

# Find errors
docker compose logs -f | grep ERROR

# Track request
docker compose logs | grep 'req_xxxxx'

# Save logs
docker compose logs > logs_backup.txt

# Stop containers
docker compose down
```

## Completion

When all checkboxes are complete:

1. You can monitor the application in real-time
2. Issues are automatically detected
3. Logs provide complete flow tracing
4. QA process is structured and documented
5. Ready for production deployment

---

**Setup Date**: 2026-04-19
**Version**: 1.0
**Status**: Ready to Use

For questions or issues, refer to:
- `docs/ZERO-SCRIPT-QA.md` - Comprehensive guide
- `docs/QA-QUICK-START.md` - Quick reference
- `CLAUDE.md` - Project technical details
