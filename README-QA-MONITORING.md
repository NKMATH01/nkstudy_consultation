# Zero Script QA Monitoring Setup

Real-time bug detection and issue documentation for NK Consultation System.

## What Is Zero Script QA?

Zero Script QA replaces traditional test automation with **intelligent log monitoring**:

- No test scripts to maintain
- Manual testing with real-time log analysis
- Automatic issue detection
- Complete request flow tracing
- Performance monitoring
- Immediate bug documentation

```
Write Test Scripts → Run Tests → Check Assertions → Debug
vs
Manual Testing → Claude Analyzes Logs → Auto-Detects Issues → Document
```

## Getting Started (5 minutes)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy your Supabase and API keys to `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
GEMINI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
```

### 3. Start Development

Terminal 1:
```bash
npm run dev
```

Terminal 2 (optional but recommended):
```bash
docker compose logs -f
```

### 4. Open Browser

Visit http://localhost:3000 and use the application normally.

### 5. Watch Logs

JSON logs appear in:
- Browser console (F12 > Console tab)
- Terminal 2 (if docker compose logs -f is running)

Example:
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

## Real-Time Monitoring

### Find Errors (Critical)

```bash
docker compose logs -f | grep '"level":"ERROR"'
```

### Find Slow Responses

Responses taking more than 1 second:

```bash
docker compose logs -f | grep -E '"duration_ms":[1-9][0-9]{3,}'
```

### Track Complete Request Flow

Every request has a Request ID. Find all logs for one request:

```bash
docker compose logs | grep 'req_a1b2c3d4'
```

Returns all logs from start to finish, showing complete flow.

### Find Failed API Calls

```bash
# 5xx errors (server error)
docker compose logs | grep '"status":5'

# 4xx errors (validation/auth)
docker compose logs | grep '"status":4'
```

## Issue Documentation

When you find an issue:

1. Create file: `docs/qa-issues/ISSUE-001-title.md`
2. Use template from: `docs/qa-issues/ISSUE-TEMPLATE.md`
3. Include:
   - What's broken
   - How to reproduce
   - Related logs
   - Suggested fix

Example:

```markdown
# ISSUE-001: Missing validation on consultation form

**Request ID**: req_a1b2c3d4
**Severity**: ERROR
**Endpoint**: POST /api/consultations

## Problem
Form accepts empty name field without error

## Reproduction
1. Open consultation form
2. Leave name empty
3. Click submit
4. Form submits despite being empty

## Log
{error log here}

## Fix
Add validation for required fields
```

## Documentation

### Quick Reference (5 min)
Start here: `docs/QA-QUICK-START.md`

### Complete Guide (20 min)
Read: `docs/ZERO-SCRIPT-QA.md`

### Visual Guide (10 min)
See: `docs/VISUAL-GUIDE.md`

### Code Integration (15 min)
Follow: `docs/INTEGRATION-GUIDE.md`

### Setup Details (15 min)
Reference: `ZERO-SCRIPT-QA-SETUP.md`

## Using Logger in Code

### Basic Logging

```typescript
import { logger } from '@/lib/logger';

// Log any event
logger.info('User submitted form', {
  request_id: requestId,
  formType: 'consultation',
});

// Log errors
logger.error('Database error', {
  request_id: requestId,
  error: error.message,
});
```

### API Client (Automatic Logging)

```typescript
import { apiPost, apiGet } from '@/lib/api-client';

// Automatically logged
const result = await apiPost('/consultations', {
  name: 'John',
  email: 'john@example.com',
});

const list = await apiGet('/consultations');
```

All API calls are logged automatically with:
- Request start
- Response status
- Duration in milliseconds
- Error details if failed

## Performance Monitoring

Track response times for each endpoint:

| Endpoint | Target | Alert |
|----------|--------|-------|
| List Consultations | <100ms | >500ms |
| Create Consultation | <500ms | >1500ms |
| AI Analysis | <5000ms | >10000ms |
| Generate Guidance | <3000ms | >8000ms |

Monitor with:
```bash
docker compose logs | jq 'select(.data.duration_ms > 1000)'
```

## Daily Workflow

### Morning
1. Open Terminal 1: `npm run dev`
2. Open Terminal 2: `docker compose logs -f`
3. Open Browser: http://localhost:3000

### During Development
1. Write code
2. Test feature manually
3. Watch logs appear in real-time
4. Spot issues immediately
5. Document in docs/qa-issues/

### After Feature
1. Review logs for errors
2. Check response times
3. Verify Request ID tracking works
4. Document any issues found

### Code Fix Cycle
1. Developer fixes code
2. Next.js auto-reloads (HMR)
3. Browser refreshes
4. Retest
5. Verify logs show success

## File Structure

New files created:

```
src/lib/
  ├── logger.ts          # Core logging utility
  └── api-client.ts      # API client with auto-logging

docker-compose.yml      # Docker configuration
Dockerfile.dev         # Development image

docs/
  ├── ZERO-SCRIPT-QA.md      # Complete guide
  ├── QA-QUICK-START.md       # Quick reference
  ├── VISUAL-GUIDE.md         # Diagrams and examples
  ├── INTEGRATION-GUIDE.md    # Code patterns
  └── qa-issues/
      └── ISSUE-TEMPLATE.md   # Issue format

ZERO-SCRIPT-QA-SETUP.md      # Setup checklist
IMPLEMENTATION-COMPLETE.md   # Setup summary
```

## Troubleshooting

### No logs appearing?

1. Check `npm run dev` is running
2. Open http://localhost:3000
3. Open browser console (F12 > Console)
4. Perform an action

### Request ID not tracking?

1. Check `apiClient` is used for API calls
2. Check Request ID header in Network tab
3. Verify `logger.info()` includes request_id

### Docker error?

Docker is optional. You can:
1. Use `npm run dev` without docker
2. Logs appear in browser console
3. Install Docker if you want `docker compose logs -f`

### Logs not JSON?

1. Check NODE_ENV is "development"
2. Logs should be JSON in browser console
3. May have both JSON and colored output

## Integration (Optional)

To add logging to existing code:

1. Read: `docs/INTEGRATION-GUIDE.md`
2. Pick one feature
3. Add logging to server actions
4. Add logging to components
5. Test and verify
6. Repeat for other features

Estimated time: 8-12 hours for complete project

## Success Checklist

After setup:

- [ ] npm run dev starts without errors
- [ ] Browser opens to http://localhost:3000
- [ ] Browser console shows JSON logs
- [ ] Logs have timestamp, level, service, request_id
- [ ] Request ID is consistent across logs
- [ ] Errors show as "level":"ERROR"
- [ ] Status codes are captured
- [ ] Duration in ms is logged
- [ ] Can filter with grep
- [ ] Can trace complete flow with Request ID

## Next Steps

1. Run: `npm run dev`
2. Read: `docs/QA-QUICK-START.md`
3. Open: http://localhost:3000
4. Test: Try any feature
5. Monitor: Watch logs in browser console
6. Document: Record any issues

## Support

All documentation is self-contained in:
- `docs/QA-QUICK-START.md` - Daily use
- `docs/ZERO-SCRIPT-QA.md` - Complete reference
- `docs/INTEGRATION-GUIDE.md` - Code examples
- `ZERO-SCRIPT-QA-SETUP.md` - Detailed setup

For questions, refer to appropriate guide above.

---

Ready to monitor? Start with:

```bash
npm run dev
```

Then read: `docs/QA-QUICK-START.md`

Happy monitoring!
