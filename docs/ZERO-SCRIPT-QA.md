# Zero Script QA - NK Consultation System

Real-time QA monitoring using structured JSON logs without test scripts. This guide enables automated bug detection and issue documentation through log analysis.

## Quick Start

### 1. Environment Setup

Create `.env.local` with required variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
GEMINI_API_KEY=your_gemini_key
ANTHROPIC_API_KEY=your_anthropic_key
```

### 2. Start Docker Environment

```bash
docker compose up -d
docker compose logs -f
```

This starts the Next.js dev server with JSON logging enabled for real-time monitoring.

### 3. Manual Testing

While monitoring logs in a separate terminal:

1. Open http://localhost:3000 in your browser
2. Test features:
   - Log in as admin
   - Create consultation record
   - Submit survey
   - Create student
   - Access analytics
   - Generate registration guidance
3. Check browser console for JSON logs
4. Claude Code analyzes logs in real-time

### 4. Monitor Output

All logs follow this JSON format:

```json
{
  "timestamp": "2026-04-19T10:30:00.000Z",
  "level": "INFO",
  "service": "web",
  "request_id": "req_abc12345",
  "message": "API Request completed",
  "data": {
    "method": "GET",
    "endpoint": "/api/consultations",
    "status": 200,
    "duration_ms": 125
  }
}
```

## Logging Integration Points

### Frontend (Next.js)

Logger is available in all client components:

```typescript
import { logger, generateRequestId } from '@/lib/logger';

// Basic logging
logger.info('User action', {
  request_id: requestId,
  action: 'create_consultation',
  userId: user.id,
});

// Error logging
logger.error('API failed', {
  request_id: requestId,
  endpoint: '/api/consultations',
  error: error.message,
});
```

### API Client

All API calls are automatically logged:

```typescript
import { apiClient, apiGet, apiPost } from '@/lib/api-client';

// Automatic logging with Request ID
const result = await apiPost('/consultations', {
  name: 'John',
  email: 'john@example.com',
});

// With custom Request ID
const data = await apiGet('/consultations', customRequestId);
```

## Monitoring Commands

### Stream All Logs

```bash
docker compose logs -f
```

### Watch Errors Only

```bash
docker compose logs -f web | grep '"level":"ERROR"'
```

### Track Specific Request

```bash
# Find all logs for request ID req_abc12345
docker compose logs -f web | grep 'req_abc12345'
```

### Filter by Endpoint

```bash
# Monitor API consultations endpoint
docker compose logs -f web | grep '/api/consultations'
```

### Find Slow Responses

```bash
# Find requests over 1000ms
docker compose logs -f web | grep -E '"duration_ms":[0-9]{4,}'
```

### Save Logs to File

```bash
docker compose logs > logs_$(date +%Y%m%d_%H%M%S).txt
```

## Issue Detection Patterns

Claude Code monitors for these patterns in real-time:

### 1. ERROR Level Logs

Detection:
```bash
docker compose logs -f | grep '"level":"ERROR"'
```

Action: Immediate documentation with:
- Request ID
- Error message
- Endpoint affected
- Recommended fix

Example log:
```json
{
  "timestamp": "2026-04-19T10:30:00.000Z",
  "level": "ERROR",
  "service": "web",
  "request_id": "req_abc12345",
  "message": "API Request failed",
  "data": {
    "endpoint": "/api/consultations",
    "status": 500,
    "error": "Database connection timeout"
  }
}
```

### 2. Slow Responses (> 1000ms)

Detection:
```bash
docker compose logs -f | grep -E '"duration_ms":[0-9]{4,}'
```

Action:
- Identify endpoint
- Note duration
- Check for database queries or external API calls
- Document as performance issue

### 3. Failed API Status Codes

Detection:
```bash
# 5xx errors
docker compose logs -f | grep '"status":5'

# 4xx errors (auth/validation)
docker compose logs -f | grep '"status":4'
```

Action: Document failure pattern

### 4. Consecutive Failures

Pattern: 3+ failures on same endpoint within short time

Action:
- Check endpoint logic
- Verify database state
- Review recent changes

## QA Issue Report Format

When issues are detected, document as:

```markdown
## ISSUE-{number}: {Title}

**Request ID**: req_abc12345
**Service**: web
**Severity**: ERROR / WARNING / INFO
**Time**: 2026-04-19T10:30:00.000Z

### Detection
Detected via pattern: [Error Detection / Slow Response / Status Code]

### Related Logs
```json
{complete log entry}
```

### Analysis
[Description of what went wrong]

### Reproduction Steps
1. [Step 1]
2. [Step 2]

### Code Location
File: `src/lib/actions/consultation.ts`
Function: `createConsultation`

### Recommended Fix
[Specific fix suggestion with code example if applicable]

### Test Verification
- [ ] Fix applied
- [ ] Manual test passed
- [ ] No related errors in logs
```

## Feature-Specific Monitoring

### Consultation Management

Key requests to monitor:
- POST `/api/consultations` - Create consultation
- GET `/api/consultations` - List consultations
- PATCH `/api/consultations/{id}` - Update consultation
- DELETE `/api/consultations/{id}` - Delete consultation

Monitor for:
- Database write failures
- Validation errors
- Missing required fields
- Slow response times

### Survey & Analysis

Key requests to monitor:
- POST `/api/surveys` - Create survey
- POST `/api/analyses` - Run AI analysis
- GET `/api/analyses` - List analysis results

Monitor for:
- Gemini API timeouts
- JSON parse errors
- Missing analysis results
- Slow AI processing

### Registration Guidance

Key requests to monitor:
- POST `/api/registrations` - Generate guidance
- GET `/api/registrations` - List guidance

Monitor for:
- Claude API errors
- HTML template rendering issues
- Missing student data
- Long generation times

### Settings Management

Key requests to monitor:
- POST `/api/settings/classes` - Create class
- POST `/api/settings/teachers` - Create teacher
- POST `/api/settings/students` - Create student

Monitor for:
- Duplicate entries
- Missing validation
- Circular references
- Soft delete issues

## Test Cycle Workflow

### Cycle Structure

Each test cycle follows this pattern:

1. **Start Monitoring**: Open log stream
   ```bash
   docker compose logs -f
   ```

2. **Execute Tests**: Manual UX testing in browser
   - Test specific feature
   - Exercise different paths
   - Try edge cases

3. **Analyze Logs**: Claude Code monitors real-time
   - Detect errors immediately
   - Track Request IDs through flow
   - Identify performance issues

4. **Document Issues**: Create issue report
   - Save to `docs/qa-issues/`
   - Include all relevant logs
   - Suggest fixes

5. **Fix & Retest**: Developer applies fix
   - Hot reload detects changes
   - Run same test again
   - Verify logs show success

### Documentation Template

Create file: `docs/qa-issues/ISSUE-{number}-{slug}.md`

```markdown
# ISSUE-001: [Title]

**Status**: OPEN / INVESTIGATING / FIXED / VERIFIED
**Feature**: Consultation Management
**Severity**: CRITICAL / HIGH / MEDIUM / LOW
**Date Found**: 2026-04-19
**Request IDs**: req_abc12345, req_def67890

## Summary
One paragraph describing the issue.

## Detection
How was this found? What pattern triggered detection?

## Reproduction
Step-by-step to reproduce:
1. Open page
2. Fill form
3. Submit
4. Observe error

## Error Logs
```json
{relevant logs}
```

## Root Cause
Analysis of why this happened.

## Recommended Fix
```typescript
// Example code fix
```

## Verification Checklist
- [ ] Code fix applied
- [ ] Manual test passed
- [ ] No related errors in logs
- [ ] Performance is acceptable
```

## Daily QA Checklist

Before each development session:

- [ ] Environment variables configured
- [ ] Docker compose running
- [ ] Logs streaming and accessible
- [ ] Previous issues documented

During development:

- [ ] Log monitoring active
- [ ] Test each feature change
- [ ] Document new issues immediately
- [ ] Fix high-severity issues first

After session:

- [ ] All issues documented
- [ ] Critical fixes applied
- [ ] No ERROR logs remaining
- [ ] Average response time acceptable

## Performance Baselines

Track these metrics:

| Feature | Endpoint | Target | Alert |
|---------|----------|--------|-------|
| List Consultations | GET /api/consultations | <100ms | >500ms |
| Create Consultation | POST /api/consultations | <500ms | >1500ms |
| AI Analysis | POST /api/analyses | <5000ms | >10000ms |
| Generate Guidance | POST /api/registrations | <3000ms | >8000ms |
| List Surveys | GET /api/surveys | <100ms | >500ms |

## Troubleshooting

### Logs Not Appearing

1. Check Docker is running:
   ```bash
   docker compose ps
   ```

2. Check logs are reaching stdout:
   ```bash
   docker compose logs -n 50
   ```

3. Verify JSON format (open browser console in DevTools)

### Request ID Not Tracking

1. Verify logger.ts is imported
2. Check apiClient is used for API calls
3. Verify header is propagating: inspect Network tab

### Performance Degradation

1. Check for database query logs
2. Look for external API timeouts
3. Monitor browser DevTools Performance tab
4. Check system resources (CPU, memory)

## Integration with Development

### Hot Reload

When using `npm run dev`, changes reload automatically:

1. Modify code
2. Save file
3. Browser reloads (Next.js HMR)
4. Continue testing with same logs

### Continuous Monitoring

Keep logs streaming in separate terminal during:
- Feature development
- Bug fixes
- UI changes
- Database schema updates

### Pre-Commit Checks

Before git commit:

1. Review all recent errors
2. Fix any ERROR level logs
3. Document WARNING level issues
4. Performance within baseline

## Resources

- Logger Implementation: `src/lib/logger.ts`
- API Client: `src/lib/api-client.ts`
- Docker Config: `docker-compose.yml`
- Dockerfile: `Dockerfile.dev`
- Issue Template: See Test Cycle Workflow above

## Support

For issues with QA monitoring setup:

1. Check logs are valid JSON: `docker compose logs | head -50 | jq .`
2. Verify service name in logs matches "web"
3. Ensure Request IDs are consistent across logs
4. Check environment variables are loaded

---

**Last Updated**: 2026-04-19
**Version**: 1.0
