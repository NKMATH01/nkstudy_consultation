# Zero Script QA - Visual Guide

Step-by-step visual guide to understanding and using Zero Script QA monitoring.

## The Zero Script QA Concept

### Traditional QA vs Zero Script QA

```
TRADITIONAL TEST AUTOMATION:
write test code → execute → check assertions → maintain tests → debugging hard
(Time-consuming, Brittle, Requires test skills)

ZERO SCRIPT QA:
build log infrastructure → manual testing → Claude analyzes logs → auto-document
(Fast, Maintainable, Immediate insights)
```

## Log Flow Architecture

### How Logs Flow Through the System

```
Application Code
        ↓
    logger.info()    [or] apiClient()
        ↓
JSON Log Output
    ↓               ↓
Browser          Terminal
Console          Docker Logs
    ↓               ↓
Claude Code Analyzes Real-Time
        ↓
Detects Issues & Patterns
        ↓
Documents in GitHub Issues
```

### Request ID Tracking Across Services

```
Browser Request:
  1. Generate Request ID: req_a1b2c3d4
  2. Send to API with header: X-Request-ID: req_a1b2c3d4

Application:
  3. Receive header
  4. Include in all logs with same request_id
  5. Complete request

Result:
  All logs for this request have same request_id
  ↓
  Can trace complete flow with: grep 'req_a1b2c3d4' logs
```

## JSON Log Format Visualization

### Real Example

```json
{
  "timestamp": "2026-04-19T10:30:00.000Z",
  ↑
  When it happened (ISO 8601)

  "level": "INFO",
  ↑
  DEBUG | INFO | WARNING | ERROR
  (Severity level)

  "service": "web",
  ↑
  Which service (api, web, worker, etc.)

  "request_id": "req_a1b2c3d4",
  ↑
  Unique ID for tracking this request flow

  "message": "API Request completed",
  ↑
  What happened

  "data": {
    "method": "POST",
    "endpoint": "/api/consultations",
    "status": 200,
    "duration_ms": 125
  }
  ↑
  Additional context
}
```

## Daily Workflow

### Morning Session Setup

```
START
  ↓
1. Open Terminal 1
     npm run dev
     [Dev server starts]
  ↓
2. Open Terminal 2
     docker compose logs -f
     [Monitoring logs in real-time]
  ↓
3. Open Browser
     http://localhost:3000
     [Application ready for testing]
  ↓
4. Open DevTools
     F12 > Console
     [JSON logs visible here]
  ↓
READY FOR TESTING
```

### During Feature Development

```
Developer makes code change
     ↓
Auto-reload (HMR)
     ↓
Browser refreshes
     ↓
Test the feature
     ↓
WATCH LOGS APPEAR IN REAL-TIME
     ↓
Look for patterns:
  - RED flags: "level":"ERROR"
  - YELLOW flags: "duration_ms" > 1000
  - BLUE flags: "status": 4xx or 5xx
     ↓
Spot issue immediately
     ↓
Document in docs/qa-issues/ISSUE-{number}.md
     ↓
Developer fixes code
     ↓
Retest
     ↓
Issue resolved when logs show success
```

## Monitoring Command Reference (Cheat Sheet)

### View All Logs

```bash
# Everything
docker compose logs -f

# Just last 50 lines
docker compose logs -n 50

# Save to file
docker compose logs > backup.txt
```

### Filter by Level

```bash
# All errors (CRITICAL)
docker compose logs | grep '"level":"ERROR"'

# Warnings and errors
docker compose logs | grep -E '"level":"(ERROR|WARNING)"'

# Info only
docker compose logs | grep '"level":"INFO"'

# Debug messages
docker compose logs | grep '"level":"DEBUG"'
```

### Filter by Value

```bash
# Specific endpoint
docker compose logs | grep '/api/consultations'

# Specific request
docker compose logs | grep 'req_a1b2c3d4'

# Specific status code
docker compose logs | grep '"status":500'

# Slow responses
docker compose logs | grep -E '"duration_ms":[1-9][0-9]{3,}'
```

### Parse JSON

```bash
# Pretty print JSON
docker compose logs | jq .

# Extract just messages
docker compose logs | jq '.message'

# Filter by field
docker compose logs | jq 'select(.level=="ERROR")'

# Extract duration for specific endpoint
docker compose logs | jq 'select(.data.endpoint=="/api/consultations") | .data.duration_ms'
```

## Issue Detection Patterns

### Pattern 1: Error Detection

```
Log Pattern:
{"level":"ERROR", ...}

Detection:
docker compose logs | grep '"level":"ERROR"'

Action:
1. Extract Request ID
2. Gather all logs with that ID
3. Analyze error message
4. Suggest fix
5. Document in ISSUE-xxx.md
```

### Pattern 2: Slow Response

```
Log Pattern:
{"data": {"duration_ms": 2500}}

Threshold:
> 1000ms = investigate
> 3000ms = critical

Detection:
docker compose logs | grep -E '"duration_ms":[1-9][0-9]{3,}'

Action:
1. Identify endpoint
2. Check for:
   - Database queries
   - External API calls
   - Computational logic
3. Optimize bottleneck
4. Verify duration improves
```

### Pattern 3: Status Code Anomaly

```
Log Pattern:
{"data": {"status": 500}}

5xx = Server Error (CRITICAL)
4xx = Client Error (Check validation)

Detection:
docker compose logs | grep '"status":5'
docker compose logs | grep '"status":40[13]'

Action:
1. Identify endpoint
2. Check error details
3. Review code logic
4. Fix root cause
```

### Pattern 4: Consecutive Failures

```
Pattern:
Same endpoint fails 3+ times in short period

Example:
POST /api/consultations - ERROR
POST /api/consultations - ERROR
POST /api/consultations - ERROR

Action:
1. Check endpoint code
2. Verify database connectivity
3. Check for invalid data
4. Review recent code changes
5. Apply fix
```

## Integration Points

### Where Logging Happens Automatically

```
1. API Calls
   apiClient() → Automatic logging
   - Request start
   - Response received
   - Duration tracked
   - Errors logged

2. User Actions
   logger.info() → Manual logging (add to code)
   - Form submission
   - Button clicks
   - Page navigation

3. Business Logic
   logger.debug() → Details (development only)
   - Database operations
   - Data transformations
   - Complex calculations

4. Errors
   logger.error() → Always captured
   - Try/catch blocks
   - Failed API calls
   - Validation errors
```

## Real Request Flow Example

### Scenario: Create Consultation

```
1. User fills form and clicks Submit
   Browser: logger.info('Form submitted', {request_id: 'req_a1b2c3d4'})
   ↓
   {"timestamp":"...", "level":"INFO", "message":"Form submitted",
    "request_id":"req_a1b2c3d4", ...}

2. Form validation
   Browser: logger.info('Form validated', {request_id: 'req_a1b2c3d4'})
   ↓
   {"timestamp":"...", "level":"INFO", "message":"Form validated",
    "request_id":"req_a1b2c3d4", ...}

3. API call sent
   Browser: logger.info('API Request started', {request_id: 'req_a1b2c3d4',
            method: 'POST', endpoint: '/api/consultations'})
   ↓
   {"timestamp":"...", "level":"INFO", "message":"API Request started",
    "request_id":"req_a1b2c3d4", "data":{"method":"POST",...}}

4. Server receives and processes
   Server: logger.info('Creating consultation', {request_id: 'req_a1b2c3d4'})
   ↓
   {"timestamp":"...", "level":"INFO", "message":"Creating consultation",
    "request_id":"req_a1b2c3d4", ...}

5. Database write
   Server: logger.info('Consultation created', {request_id: 'req_a1b2c3d4',
           id: 'consultation_123'})
   ↓
   {"timestamp":"...", "level":"INFO", "message":"Consultation created",
    "request_id":"req_a1b2c3d4", "data":{"id":"consultation_123"}}

6. Response sent
   Browser: logger.info('API Request completed', {request_id: 'req_a1b2c3d4',
            status: 200, duration_ms: 125})
   ↓
   {"timestamp":"...", "level":"INFO", "message":"API Request completed",
    "request_id":"req_a1b2c3d4", "data":{"status":200,"duration_ms":125}}

7. UI updated
   Browser: logger.info('Form reset', {request_id: 'req_a1b2c3d4'})
   ↓
   {"timestamp":"...", "level":"INFO", "message":"Form reset",
    "request_id":"req_a1b2c3d4", ...}

RESULT:
  Entire flow visible with 7 logs, all with same request_id
  Can trace complete journey by searching: grep 'req_a1b2c3d4' logs
  Performance visible: 125ms end-to-end
  No errors: all logs are level=INFO
```

## Bug Detection in Action

### Example: Missing Validation

```
Test Scenario:
  1. Fill form with invalid data
  2. Submit
  3. Watch logs

Expected:
  logger.error('Validation failed', {request_id: 'req_...'})

If Missing:
  No error log
  Request succeeds with invalid data
  Issue: Validation not implemented

Action:
  1. Document: ISSUE-001: Missing form validation
  2. Add validation code
  3. Retest
  4. Verify error appears in logs
  5. Mark issue FIXED
```

## Performance Monitoring Dashboard (Mental Model)

```
Endpoint Performance Tracking:

POST /api/consultations
  First Test:    512ms  [PASS]
  Second Test:   498ms  [PASS]
  Third Test:   2156ms  [SLOW!] ← Alert!
  Fourth Test:    520ms  [PASS - Fixed]

GET /api/consultations?limit=100
  First Test:    145ms  [PASS]
  Second Test:    892ms  [SLOW!] ← Warning
  Third Test:    156ms  [PASS]

Analysis:
  Occasional slowness = Cache issue?
  Consistent slowness = Optimization needed
  Timeout = Hanging request
```

## Files & Commands Quick Reference

### Key Files Created

```
src/lib/logger.ts
  → Core logging utility

src/lib/api-client.ts
  → API client with automatic logging

docker-compose.yml
  → Service configuration

Dockerfile.dev
  → Development image

docs/ZERO-SCRIPT-QA.md
  → Complete guide

docs/QA-QUICK-START.md
  → Daily reference

docs/INTEGRATION-GUIDE.md
  → Code patterns

docs/qa-issues/ISSUE-TEMPLATE.md
  → Issue format
```

### Essential Commands

```bash
# Start development
npm run dev

# Monitor logs
docker compose logs -f

# Find errors
docker compose logs -f | grep ERROR

# Track request
docker compose logs | grep 'req_abc'

# Pretty JSON
docker compose logs | jq .

# Save logs
docker compose logs > logs_backup.txt
```

## Success Checklist

When QA monitoring is working correctly:

- [x] JSON logs appear in browser console
- [x] Logs appear in `docker compose logs -f` output
- [x] Logs are valid JSON (can be parsed with jq)
- [x] Each log has timestamp, level, service, request_id, message
- [x] Request ID is consistent for related logs
- [x] Errors appear with "level":"ERROR"
- [x] Status codes are captured
- [x] Duration in ms is tracked
- [x] Filters work: grep, jq
- [x] Can trace complete flow with Request ID

## Next Steps

1. Read `docs/QA-QUICK-START.md` (5 minutes)
2. Run `npm run dev`
3. Test a feature
4. Monitor logs in another terminal
5. Document findings
6. Repeat for all features

---

**Visual Guide Version**: 1.0
**Created**: 2026-04-19
