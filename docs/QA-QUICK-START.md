# Zero Script QA - Quick Start Guide

Fast setup for real-time log monitoring and bug detection.

## 60-Second Setup

### Terminal 1: Start Services

```bash
cd /c/Users/nk_ma/OneDrive/01.\ 클로드\ 코워크/24.NK\ 상담관리/nk-consultation
npm install
npm run dev
```

App runs at http://localhost:3000

### Terminal 2: Monitor Logs

```bash
# Option A: All logs (recommended)
docker compose logs -f

# Option B: Errors only
docker compose logs -f | grep '"level":"ERROR"'

# Option C: Track specific request
docker compose logs -f | grep 'req_YOUR_REQUEST_ID'
```

### Browser: Test Features

1. Open http://localhost:3000
2. Log in
3. Test feature
4. Watch logs in Terminal 2

## Common Monitoring Commands

```bash
# Watch all service logs in real-time
docker compose logs -f

# Just the web service
docker compose logs -f web

# Errors and warnings only
docker compose logs -f | grep -E '"level":"(ERROR|WARNING)"'

# Find slow API calls (>1000ms)
docker compose logs -f | jq 'select(.data.duration_ms > 1000)'

# Track complete flow by Request ID
docker compose logs | grep 'req_abc12345'

# Save logs to file
docker compose logs > logs_$(date +%Y%m%d_%H%M%S).txt

# Show last 100 lines
docker compose logs -n 100

# Follow specific endpoint
docker compose logs -f | grep '/api/consultations'
```

## Expected Log Format

Each log is valid JSON:

```json
{
  "timestamp": "2026-04-19T10:30:00.000Z",
  "level": "INFO",
  "service": "web",
  "request_id": "req_a1b2c3d4",
  "message": "API Request completed",
  "data": {
    "method": "POST",
    "endpoint": "/api/consultations",
    "status": 200,
    "duration_ms": 125
  }
}
```

## Real-Time Issue Detection

Claude Code monitors for and reports:

| Pattern | Severity | Action |
|---------|----------|--------|
| `"level":"ERROR"` | CRITICAL | Immediate report |
| `"status":5` (5xx) | CRITICAL | Immediate report |
| `"duration_ms" > 3000` | CRITICAL | Performance alert |
| `"status":4` (4xx) | WARNING | Check validation |
| `"duration_ms" > 1000` | WARNING | Slow response |
| Consecutive failures | WARNING | Pattern alert |

## Using Logger in Code

### In Client Components

```typescript
import { logger, generateRequestId } from '@/lib/logger';

const requestId = generateRequestId();

// Info logs
logger.info('User opened form', {
  request_id: requestId,
  form: 'consultation',
});

// Error logs
logger.error('Form submission failed', {
  request_id: requestId,
  error: error.message,
});
```

### In API Calls

```typescript
import { apiClient, apiPost } from '@/lib/api-client';

// Automatic logging (no explicit logger calls needed)
const result = await apiPost('/consultations', {
  name: 'Student Name',
  email: 'student@example.com',
});

// With custom Request ID
const data = await apiPost(
  '/consultations',
  { name: 'John' },
  customRequestId
);
```

## Test Cycle Workflow

1. **Start monitoring**: `docker compose logs -f` in Terminal 2
2. **Open app**: http://localhost:3000
3. **Test feature**: Click through UI, perform actions
4. **Watch logs**: Terminal 2 shows all activity
5. **Spot issues**: 
   - Look for `"level":"ERROR"`
   - Look for status >= 400
   - Look for `"duration_ms"` > 1000
6. **Report issues**: Document in `docs/qa-issues/ISSUE-{number}.md`
7. **Apply fix**: Developer makes code change
8. **Auto-reload**: Next.js detects change, browser reloads
9. **Retest**: Repeat from step 3

## Issue Documentation

Create file: `docs/qa-issues/ISSUE-001-title-slug.md`

```markdown
# ISSUE-001: [Title]

**Request ID**: req_a1b2c3d4
**Severity**: ERROR / WARNING / INFO
**Endpoint**: POST /api/consultations
**Time**: 2026-04-19T10:30:00.000Z

## Problem
What went wrong?

## Log
```json
{error log}
```

## Root Cause
Why did it happen?

## Fix
What changed to fix it?

## Verification
- [ ] Manual test passed
- [ ] No related errors in logs
```

## Environment Setup

File: `.env.local`

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
GEMINI_API_KEY=your_gemini_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
```

Get values from:
- Supabase: Dashboard > Settings > API
- Gemini: Google AI Studio
- Anthropic: Console > API Keys

## Troubleshooting

### Logs not appearing?

1. Check Docker running: `docker compose ps`
2. Check service is up: `docker compose logs -n 20`
3. Check browser logs: F12 > Console tab
4. Verify .env.local is set

### Request ID not tracking?

1. Open DevTools Network tab
2. Look for `X-Request-ID` header in requests
3. Check browser console for JSON logs
4. Verify apiClient is used for all API calls

### Performance slow?

1. Check for `"duration_ms" > 1000` logs
2. Look for database timeouts
3. Check Gemini/Anthropic API calls
4. Review browser DevTools Performance tab

## File Locations

- Logger: `src/lib/logger.ts`
- API Client: `src/lib/api-client.ts`
- Full Guide: `docs/ZERO-SCRIPT-QA.md`
- Docker: `docker-compose.yml`, `Dockerfile.dev`

## Next Steps

1. Read `docs/ZERO-SCRIPT-QA.md` for detailed guide
2. Start with simple feature test (e.g., List Consultations)
3. Document any errors found
4. Apply fixes and retest
5. Move to next feature

---

**Pro Tip**: Keep logs streaming in Terminal 2 at all times during development. You'll spot issues immediately as they occur.
