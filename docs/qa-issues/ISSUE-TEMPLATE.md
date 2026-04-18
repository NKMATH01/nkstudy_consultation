# ISSUE-{number}: {Title}

**Status**: OPEN / INVESTIGATING / FIXED / VERIFIED
**Feature**: [Feature Name]
**Severity**: CRITICAL / HIGH / MEDIUM / LOW
**Date Found**: YYYY-MM-DD
**Request IDs**: req_xxxxx, req_yyyyy

## Summary

One paragraph summary of the issue. What's broken? What's the impact?

## Detection

How was this issue detected?

- Pattern: Error Detection / Slow Response / Status Code Anomaly
- Trigger: [What specific log pattern triggered detection]
- Time: [When first detected]

## Reproduction

Step-by-step instructions to reproduce:

1. [Step 1]
2. [Step 2]
3. [Step 3]
4. Observe: [What happens]
5. Expected: [What should happen]

## Error Logs

```json
{
  "timestamp": "2026-04-19T10:30:00.000Z",
  "level": "ERROR",
  "service": "web",
  "request_id": "req_abc12345",
  "message": "Error message here",
  "data": {
    "additional": "context"
  }
}
```

## Root Cause Analysis

- **Why it happened**: [Analysis]
- **Affected code**: [Files/functions]
- **Impact scope**: [What else might be affected]
- **Root cause**: [Underlying issue]

## Recommended Fix

### Code Change

File: `src/lib/actions/consultation.ts`
Function: `createConsultation()`

```typescript
// Before
async function createConsultation(data) {
  // Missing error handling
  const result = await db.create(data);
  return result;
}

// After
async function createConsultation(data) {
  try {
    const result = await db.create(data);
    logger.info('Consultation created', {
      request_id: requestId,
      id: result.id,
    });
    return result;
  } catch (error) {
    logger.error('Failed to create consultation', {
      request_id: requestId,
      error: error.message,
    });
    throw error;
  }
}
```

### Why This Fixes It

[Explanation of how the fix addresses root cause]

## Test Verification

### Reproduction Test

After applying fix:

1. [Reproduce step 1]
2. [Reproduce step 2]
3. Verify: [What should now work]
4. Check logs: [What logs should appear]

### Log Verification

Expected successful logs:

```json
{
  "timestamp": "2026-04-19T10:35:00.000Z",
  "level": "INFO",
  "service": "web",
  "request_id": "req_def67890",
  "message": "Consultation created",
  "data": {
    "id": "consultation_123",
    "duration_ms": 125
  }
}
```

### Checklist

- [ ] Code fix applied and saved
- [ ] Browser auto-reloaded (HMR)
- [ ] Manual test passed (reproduction steps)
- [ ] No ERROR logs in subsequent tests
- [ ] Response time within acceptable range
- [ ] Related functionality still works
- [ ] No new errors introduced

## Related Issues

- Links to similar issues
- Related features that might be affected

## Notes

Additional context or observations.

---

## QA Monitoring Details

- **Detected by**: Claude Code Zero Script QA
- **Log monitoring**: Real-time JSON log analysis
- **Request ID tracking**: Complete flow traced
- **Performance baseline**: [endpoint should complete in X ms]

---

## Sign-Off

**Reporter**: Claude Code QA
**Date Reported**: 2026-04-19
**Status Updated**: 2026-04-19
**Fixed By**: [Developer name]
**Verified By**: [QA person]
