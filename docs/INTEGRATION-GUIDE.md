# Zero Script QA Integration Guide

How to integrate Zero Script QA logging into existing NK Consultation code.

## Quick Integration (5 minutes)

### 1. Import Logger in Components

**Before (No logging)**:
```typescript
// src/components/consultations/consultation-form.tsx
export function ConsultationForm() {
  async function handleSubmit(data) {
    const response = await fetch('/api/consultations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const result = await response.json();
  }
}
```

**After (With logging)**:
```typescript
import { logger, generateRequestId } from '@/lib/logger';

export function ConsultationForm() {
  async function handleSubmit(data) {
    const requestId = generateRequestId();
    
    logger.info('Creating consultation', {
      request_id: requestId,
      consultationType: data.type,
    });

    try {
      const response = await fetch('/api/consultations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
        },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      
      logger.info('Consultation created', {
        request_id: requestId,
        id: result.id,
      });
    } catch (error) {
      logger.error('Failed to create consultation', {
        request_id: requestId,
        error: error.message,
      });
    }
  }
}
```

### 2. Use apiClient for API Calls

**Replace all fetch calls with apiClient**:

```typescript
import { apiPost } from '@/lib/api-client';

// Simple usage - automatic logging
const result = await apiPost('/consultations', {
  name: 'John',
  email: 'john@example.com',
});

// With custom Request ID
const result = await apiPost(
  '/consultations',
  { name: 'Jane' },
  customRequestId
);
```

## Integration by Feature

### Consultations Management

File: `src/lib/actions/consultation.ts`

Add logging to each action:

```typescript
import { logger } from '@/lib/logger';

export async function createConsultation(
  data: ConsultationFormData,
  requestId?: string
) {
  const id = requestId || `req_${Date.now()}`;

  logger.info('Creating consultation', {
    request_id: id,
    consultationType: data.type,
  });

  try {
    // Existing creation logic
    const consultation = await db.consultations.create({
      ...data,
      created_at: new Date(),
    });

    logger.info('Consultation created', {
      request_id: id,
      id: consultation.id,
      duration_ms: calculateDuration(), // Track duration
    });

    return consultation;
  } catch (error) {
    logger.error('Failed to create consultation', {
      request_id: id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
```

### Survey Management

File: `src/lib/actions/survey.ts`

```typescript
import { logger } from '@/lib/logger';

export async function submitSurvey(
  surveyData: SurveyData,
  requestId?: string
) {
  const id = requestId || `req_${Date.now()}`;

  logger.info('Submitting survey', {
    request_id: id,
    questionCount: surveyData.answers.length,
  });

  try {
    const result = await processSurvey(surveyData);

    logger.info('Survey submitted', {
      request_id: id,
      surveyId: result.id,
    });

    return result;
  } catch (error) {
    logger.error('Survey submission failed', {
      request_id: id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
```

### AI Analysis

File: `src/lib/actions/analysis.ts`

```typescript
import { logger } from '@/lib/logger';

export async function analyzeResponse(
  responseId: string,
  requestId?: string
) {
  const id = requestId || `req_${Date.now()}`;

  logger.info('Starting AI analysis', {
    request_id: id,
    responseId,
  });

  const startTime = Date.now();

  try {
    const analysis = await runGeminiAnalysis(responseId);

    logger.info('AI analysis completed', {
      request_id: id,
      analysisId: analysis.id,
      duration_ms: Date.now() - startTime,
      factorCount: analysis.factors.length,
    });

    return analysis;
  } catch (error) {
    logger.error('AI analysis failed', {
      request_id: id,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration_ms: Date.now() - startTime,
    });
    throw error;
  }
}
```

### Registration Guidance Generation

File: `src/lib/actions/registration.ts`

```typescript
import { logger } from '@/lib/logger';

export async function generateGuidance(
  studentId: string,
  requestId?: string
) {
  const id = requestId || `req_${Date.now()}`;

  logger.info('Generating registration guidance', {
    request_id: id,
    studentId,
  });

  const startTime = Date.now();

  try {
    const guidance = await callClaudeAPI(studentId);

    logger.info('Guidance generated', {
      request_id: id,
      guidanceId: guidance.id,
      duration_ms: Date.now() - startTime,
      characterCount: guidance.content.length,
    });

    return guidance;
  } catch (error) {
    logger.error('Guidance generation failed', {
      request_id: id,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration_ms: Date.now() - startTime,
    });
    throw error;
  }
}
```

## Client Component Integration

### List Component Example

File: `src/components/consultations/consultations-list.tsx`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { logger, generateRequestId } from '@/lib/logger';
import { apiGet } from '@/lib/api-client';

export function ConsultationsList() {
  const requestId = generateRequestId();

  const { data, error, isLoading } = useQuery({
    queryKey: ['consultations'],
    queryFn: async () => {
      logger.info('Fetching consultations list', {
        request_id: requestId,
      });

      try {
        const data = await apiGet('/consultations', requestId);

        logger.info('Consultations loaded', {
          request_id: requestId,
          count: data.length,
        });

        return data;
      } catch (err) {
        logger.error('Failed to load consultations', {
          request_id: requestId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        throw err;
      }
    },
  });

  if (error) {
    logger.error('Rendering error state', {
      request_id: requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error.message}</p>}
      {data && <ConsultationTable data={data} requestId={requestId} />}
    </div>
  );
}
```

### Form Component Example

File: `src/components/consultations/consultation-form.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { logger, generateRequestId } from '@/lib/logger';
import { apiPost } from '@/lib/api-client';
import { consultationSchema } from '@/lib/validations/consultation';

export function ConsultationForm() {
  const requestId = generateRequestId();
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm({
    resolver: zodResolver(consultationSchema),
  });

  async function onSubmit(data) {
    setIsLoading(true);

    logger.info('Submitting consultation form', {
      request_id: requestId,
      fields: Object.keys(data),
    });

    try {
      const result = await apiPost('/consultations', data, requestId);

      logger.info('Consultation submitted', {
        request_id: requestId,
        id: result.id,
      });

      form.reset();
    } catch (error) {
      logger.error('Consultation submission failed', {
        request_id: requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Form fields */}
      <button disabled={isLoading}>
        {isLoading ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}
```

## Migration Checklist

Use this to systematically integrate logging:

### Phase 1: Core Infrastructure (1 hour)
- [ ] `src/lib/logger.ts` created
- [ ] `src/lib/api-client.ts` created
- [ ] docker-compose.yml updated
- [ ] Documentation files created
- [ ] Testing logs output to console

### Phase 2: Server Actions (2-3 hours)
- [ ] `src/lib/actions/consultation.ts` - add logging
- [ ] `src/lib/actions/survey.ts` - add logging
- [ ] `src/lib/actions/analysis.ts` - add logging
- [ ] `src/lib/actions/registration.ts` - add logging
- [ ] `src/lib/actions/settings.ts` - add logging
- [ ] `src/lib/actions/booking.ts` - add logging
- [ ] `src/lib/actions/withdrawal.ts` - add logging

### Phase 3: Client Components (2-3 hours)
- [ ] Dashboard components updated
- [ ] List components updated
- [ ] Form components updated
- [ ] Detail/view components updated
- [ ] Error boundaries updated

### Phase 4: Testing & Validation (1-2 hours)
- [ ] Test each feature with logs enabled
- [ ] Verify Request IDs track through flow
- [ ] Check performance metrics are captured
- [ ] Document any issues found
- [ ] Apply fixes

### Phase 5: Documentation (30 mins)
- [ ] All example logs recorded
- [ ] QA monitoring guide completed
- [ ] Issue templates verified
- [ ] Team trained on monitoring

## Testing Integration

After adding logging to a feature, verify it works:

### 1. Start Monitoring

```bash
docker compose logs -f
```

### 2. Test the Feature

- Use the feature in browser
- Watch logs appear in Terminal
- Verify Request ID is consistent

### 3. Check Log Format

Logs should be valid JSON:
```bash
docker compose logs | jq . | head -20
```

### 4. Trace Flow

Find your Request ID and verify it appears in all related logs:
```bash
docker compose logs | grep 'req_abc12345'
```

## Common Integration Patterns

### Pattern 1: Server Action with Logging

```typescript
export async function serverAction(data, requestId?: string) {
  const id = requestId || `req_${Math.random().toString(36).substring(2, 10)}`;
  
  logger.info('Starting operation', { request_id: id, operation: 'name' });
  
  try {
    const result = await doSomething(data);
    logger.info('Operation completed', { request_id: id, result: result.id });
    return result;
  } catch (error) {
    logger.error('Operation failed', { 
      request_id: id, 
      error: error.message 
    });
    throw error;
  }
}
```

### Pattern 2: API Client Usage

```typescript
async function myFunction() {
  const requestId = generateRequestId();
  
  try {
    const data = await apiGet('/endpoint', requestId);
    logger.info('Data loaded', { request_id: requestId, count: data.length });
    return data;
  } catch (error) {
    logger.error('Load failed', { request_id: requestId, error });
    throw error;
  }
}
```

### Pattern 3: React Hook with Logging

```typescript
export function useMyFeature() {
  const requestId = generateRequestId();
  
  const { data, error } = useQuery({
    queryKey: ['feature'],
    queryFn: () => apiGet('/endpoint', requestId),
  });
  
  useEffect(() => {
    if (error) {
      logger.error('Hook error', { request_id: requestId, error });
    }
  }, [error, requestId]);
  
  return { data, error };
}
```

## Troubleshooting Integration

### Logs Not Appearing

1. Check import is correct: `import { logger } from '@/lib/logger'`
2. Verify code is being called: check browser DevTools
3. Check environment: `NODE_ENV` should be 'development'

### Request ID Not Consistent

1. Generate once per operation: `const requestId = generateRequestId()`
2. Pass same ID to all related calls
3. Verify header is sent: inspect Network tab

### Performance Degradation After Adding Logging

1. Logging is minimal overhead - should be <1ms
2. Check for other bottlenecks
3. Monitor with performance tracking

## Next Steps

1. Review current NK Consultation code
2. Pick one feature to start (e.g., Consultation CRUD)
3. Add logging following patterns above
4. Test with `docker compose logs -f`
5. Document any issues
6. Move to next feature

---

**Integration Time**: ~8-12 hours for complete migration
**Difficulty**: Easy to Moderate
**Dependencies**: None - uses existing packages
