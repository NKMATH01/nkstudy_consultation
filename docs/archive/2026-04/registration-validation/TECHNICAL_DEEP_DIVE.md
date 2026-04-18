# Technical Deep Dive: Registration Validation Bug Fix

> For developers who want to understand the complete technical architecture and implementation details

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Validation Schema Deep Dive](#validation-schema-deep-dive)
3. [Form Handler Implementation](#form-handler-implementation)
4. [Server Action Flow](#server-action-flow)
5. [Data Flow Diagrams](#data-flow-diagrams)
6. [Testing Strategy](#testing-strategy)
7. [Performance Considerations](#performance-considerations)
8. [Future Optimizations](#future-optimizations)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────┐
│ Next.js App Router (16.1)                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Frontend (React 19 + TypeScript)                   │
│  ├─ registration-form-client.tsx                   │
│  │  ├─ useForm (react-hook-form)                  │
│  │  ├─ Validation (Zod schema)                    │
│  │  └─ Event handlers                             │
│  │                                                │
│  │  Components:                                    │
│  │  ├─ ClassSelect                                │
│  │  ├─ TeacherSelect                              │
│  │  ├─ ScheduleInput                              │
│  │  └─ ErrorDisplay                               │
│  │                                                │
│  └─ handleClassChange, setValue logic             │
│                                                   │
│  ─────────────────────────────────────────────    │
│                                                   │
│  Backend (Server Actions)                          │
│  ├─ createRegistration                            │
│  ├─ regenerateRegistration                        │
│  └─ DB queries (Supabase)                         │
│                                                   │
│  Data Layer:                                       │
│  ├─ Supabase PostgreSQL                           │
│  ├─ RLS Policies                                  │
│  └─ Real-time subscriptions (optional)            │
│                                                   │
└─────────────────────────────────────────────────────┘
```

---

## Validation Schema Deep Dive

### The Zod Schema Structure

**Location**: `src/lib/validations/registration.ts`

#### Before (Broken)

```typescript
export const registrationSchema = z.object({
  name: z.string().min(1, "이름을 입력하세요"),
  subject: z.enum(["영어", "수학", "영어수학"]),
  
  // ❌ PROBLEM: Always required, regardless of subject
  eng_class: z.string().min(1, "영어반을 선택하세요"),
  eng_teacher: z.string().min(1, "영어담임을 선택하세요"),
  eng_class_days: z.string().min(1, "영어 수업 요일을 입력하세요"),
  eng_class_time: z.string().min(1, "영어 수업 시간을 입력하세요"),
  
  // ❌ PROBLEM: Always required, even for English-only
  assigned_class: z.string().min(1, "배정반을 선택하세요"),
  teacher: z.string().min(1, "담임을 선택하세요"),
  // ...
});
```

**Problem Breakdown**:

```
User Flow: Create English-only registration
                    ↓
Form shows:
├─ Subject: 영어
├─ English Class: [filled]
├─ English Teacher: [filled]
└─ [NO Math fields - hidden by UI]
                    ↓
User clicks Submit
                    ↓
Validation checks:
├─ assigned_class (Math field): "" ← ❌ FAIL
└─ Never gets to check other fields
                    ↓
Error: "배정반을 선택하세요"
(But this field doesn't exist on the form!)
```

#### After (Fixed)

```typescript
export const registrationSchema = z.object({
  name: z.string().min(1, "이름을 입력하세요"),
  subject: z.enum(["영어", "수학", "영어수학"]),
  
  // ✅ FIX: Made optional (conditional later)
  eng_class: z.string().optional(),
  eng_teacher: z.string().optional(),
  eng_class_days: z.string().optional(),     // Optional: DB fallback
  eng_class_time: z.string().optional(),     // Optional: DB fallback
  
  // ✅ FIX: Made optional (conditional later)
  assigned_class: z.string().optional(),
  teacher: z.string().optional(),
  // ...
})
  // ✅ FIX: Add conditional validation
  .refine((data) => {
    // Rule 1: English classes must have English info
    if (data.subject === "영어" || data.subject === "영어수학") {
      return data.eng_class && data.eng_class.length > 0;
    }
    return true;
  }, {
    message: "영어반을 선택하세요",
    path: ["eng_class"],
  })
  .refine((data) => {
    // Rule 2: Math subjects must have Math info
    if (data.subject === "수학" || data.subject === "영어수학") {
      return data.assigned_class && data.assigned_class.length > 0;
    }
    return true;
  }, {
    message: "배정반을 선택하세요",
    path: ["assigned_class"],
  });
```

### Zod Validation Flow

```
Input: FormData
  ↓
registrationSchema.parse(data)
  ↓
z.object({...}) → Type checking (all fields)
  ↓
.refine() #1 → English conditional check
  ├─ if (subject includes English)
  │   └─ must have eng_class
  └─ else: skip
  ↓
.refine() #2 → Math conditional check
  ├─ if (subject includes Math)
  │   └─ must have assigned_class
  └─ else: skip
  ↓
Result:
├─ ✅ Valid: proceed to submit
└─ ❌ Invalid: return error with path
```

### Key Zod Features Used

```typescript
// 1. Enum validation
z.enum(["영어", "수학", "영어수학"])

// 2. Optional fields
z.string().optional()

// 3. Conditional validation (refine)
.refine((data) => condition, { message, path })

// 4. Multiple refine chains
schema
  .refine(rule1)
  .refine(rule2)
  .refine(rule3)
```

---

## Form Handler Implementation

### Location: `registration-form-client.tsx`

#### The Problem Code

```typescript
// ❌ BEFORE: Unsafe setValue
const handleClassChange = (classId: string) => {
  const selected = classes.find(c => c.id === classId);
  
  // parseClassSchedule() might return empty strings!
  const schedule = parseClassSchedule(selected?.description || "");
  
  // This ALWAYS executes, even if schedule is empty
  form.setValue("eng_class_days", schedule.days || "");
  form.setValue("eng_class_time", schedule.time || "");
  // ❌ Overwrites user's previous input with ""!
};
```

#### The Fixed Code

```typescript
// ✅ AFTER: Safe setValue with conditions
const handleClassChange = (classId: string) => {
  const selected = classes.find(c => c.id === classId);
  
  const schedule = parseClassSchedule(selected?.description || "");
  
  // Only update if we have real data
  if (schedule.days || schedule.time) {
    form.setValue("eng_class_days", schedule.days || "");
    form.setValue("eng_class_time", schedule.time || "");
  }
  // Otherwise: user's input is preserved!
};
```

#### parseClassSchedule() Function

```typescript
// Utility function in registration-form-client.tsx
function parseClassSchedule(description: string): {
  days: string | undefined;
  time: string | undefined;
} {
  if (!description) {
    return { days: undefined, time: undefined };
  }
  
  // Example: "Monday, Wednesday, Friday | 4:00 PM - 5:00 PM"
  const parts = description.split("|");
  
  return {
    days: parts[0]?.trim(),      // "Monday, Wednesday, Friday"
    time: parts[1]?.trim(),      // "4:00 PM - 5:00 PM"
  };
}
```

#### Multiple Handlers (All Fixed)

```typescript
// 1. handleClassChange - English class selection
// 2. handleClass2Change - Math class selection  
// 3. handleClassMathChange - Math2 class selection (new)

// All follow the same pattern:
if (schedule.days || schedule.time) {
  form.setValue(...);
}
```

#### Form State Management

```typescript
const form = useForm({
  resolver: zodResolver(registrationSchema),
  defaultValues: {
    subject: "영어",
    eng_class: "",
    eng_teacher: "",
    eng_class_days: "",
    eng_class_time: "",
    assigned_class: "",
    teacher: "",
    // ...
  },
});

// Watch subject to conditionally render fields
const subject = form.watch("subject");

return (
  <div>
    <SubjectSelect />
    
    {/* Show English fields if subject includes English */}
    {["영어", "영어수학"].includes(subject) && (
      <>
        <ClassSelect
          options={englishClasses}
          onChange={handleClassChange}
        />
        <TeacherSelect {...} />
        <ScheduleInput {...} />
      </>
    )}
    
    {/* Show Math fields if subject includes Math */}
    {["수학", "영어수학"].includes(subject) && (
      <>
        <ClassSelect
          options={mathClasses}
          onChange={handleClass2Change}
        />
        <TeacherSelect {...} />
        {/* Math schedule input - auto-filled from DB */}
      </>
    )}
  </div>
);
```

---

## Server Action Flow

### Location: `src/lib/actions/registration.ts`

#### Function: createRegistration

```typescript
export async function createRegistration(data: unknown) {
  // 1. Validate input
  const validated = registrationSchema.parse(data);
  // ^ Throws if validation fails
  
  // 2. Determine which classes to fetch
  let engClass: Class | null = null;
  let mathClass: Class | null = null;
  
  // ✅ FIX: Include "영어" in the condition
  if (["영어", "영어수학"].includes(validated.subject)) {
    engClass = await supabase
      .from("classes")
      .select("*")
      .eq("id", validated.eng_class)
      .single();
  }
  
  // ✅ FIX: Include "수학" in the condition
  if (["수학", "영어수학"].includes(validated.subject)) {
    mathClass = await supabase
      .from("classes")
      .select("*")
      .eq("id", validated.assigned_class)
      .single();
  }
  
  // 3. Prepare data for insertion
  const registrationData = {
    user_id: user.id,
    name: validated.name,
    subject: validated.subject,
    
    // English info
    eng_class_id: engClass?.id || null,
    eng_teacher_id: engClass?.teacher_id || null,
    eng_class_days: engClass?.class_days || validated.eng_class_days,
    eng_class_time: engClass?.class_time || validated.eng_class_time,
    
    // Math info
    assigned_class_id: mathClass?.id || null,
    teacher_id: mathClass?.teacher_id || null,
    class_days: mathClass?.class_days || validated.class_days,
    class_time: mathClass?.class_time || validated.class_time,
  };
  
  // 4. Insert into database
  const { data: registration, error } = await supabase
    .from("registrations")
    .insert([registrationData])
    .select()
    .single();
  
  if (error) throw error;
  
  // 5. Generate guidance document
  const guidance = await generateGuidance(registration);
  
  // 6. Cache invalidation
  revalidatePath("/registrations");
  
  return registration;
}
```

#### Function: regenerateRegistration

```typescript
export async function regenerateRegistration(registrationId: string) {
  // 1. Fetch existing registration
  const registration = await supabase
    .from("registrations")
    .select("*")
    .eq("id", registrationId)
    .single();
  
  // 2. Fetch class info based on subject
  // ✅ FIX: Added "영어" to condition
  if (["영어", "영어수학"].includes(registration.subject)) {
    const engClass = await supabase
      .from("classes")
      .select("*")
      .eq("id", registration.eng_class_id)
      .single();
    
    // Update with fresh schedule
    registration.eng_class_days = engClass.class_days;
    registration.eng_class_time = engClass.class_time;
  }
  
  if (["수학", "영어수학"].includes(registration.subject)) {
    const mathClass = await supabase
      .from("classes")
      .select("*")
      .eq("id", registration.assigned_class_id)
      .single();
    
    // Update with fresh schedule
    registration.class_days = mathClass.class_days;
    registration.class_time = mathClass.class_time;
  }
  
  // 3. Regenerate guidance with fresh data
  const guidance = await generateGuidance(registration);
  
  // 4. Update registration
  await supabase
    .from("registrations")
    .update({ guidance, updated_at: new Date() })
    .eq("id", registrationId);
  
  return registration;
}
```

#### Data Flow Diagram

```
User Input (Form)
      ↓
Form Validation (Zod Schema)
      ├─ Check subject
      ├─ Check English fields (if needed)
      ├─ Check Math fields (if needed)
      └─ ✅ Pass → proceed
      ↓
Server Action: createRegistration()
      ├─ Validate again (zod)
      ├─ Query DB for English class (if subject includes English)
      ├─ Query DB for Math class (if subject includes Math)
      │  └─ Get schedule: class_days, class_time
      ├─ Prepare registration data
      │  └─ Use DB schedule OR form input (DB precedence)
      ├─ Insert into registrations table
      ├─ Generate guidance document
      └─ Invalidate cache
      ↓
Database Update
      └─ registrations table + documents
      ↓
Return to Frontend
      └─ Success message
```

---

## Data Flow Diagrams

### Scenario 1: English-only Registration (After Fix)

```
User creates English class "English 1"
├─ No schedule info in class.description
│
User fills registration form
├─ Subject: 영어
├─ English Class: English 1 (selected)
├─ English Teacher: Park (selected)
├─ Class Days: [user types] "Mon, Wed, Fri"
├─ Class Time: [user types] "4:00 PM"
│
User clicks "Select Class" button
├─ handleClassChange() called
├─ parseClassSchedule("") → { days: undefined, time: undefined }
├─ if (days || time) → FALSE (no schedule data)
│  └─ ✅ Skip setValue (preserve user input!)
│
Form state:
├─ eng_class_days: "Mon, Wed, Fri" ✓ (unchanged)
├─ eng_class_time: "4:00 PM" ✓ (unchanged)
│
User submits
├─ Validation checks:
│  ├─ if (subject === "영어") check eng_class ✓
│  └─ Skip math check (not needed for English)
├─ ✅ PASS validation
│
Server:
├─ Fetch English class from DB ✅
│  └─ Schedule from DB: null/empty
├─ Use user's input: "Mon, Wed, Fri", "4:00 PM" ✓
├─ Insert registration
└─ Generate guidance with correct schedule
```

### Scenario 2: English+Math Registration (After Fix)

```
User creates English class + Math class (both with schedules)
├─ English class: "English 1" (description: "Mon, Wed, Fri | 4:00 PM")
├─ Math class: "Math A" (description: "Tue, Thu | 3:00 PM")
│
User fills form
├─ Subject: 영어수학
├─ English Class: English 1
├─ English Teacher: Park
├─ Math Class: Math A
├─ Math Teacher: Kim
├─ [No manual schedule input needed]
│
User clicks "Select English Class"
├─ parseClassSchedule("Mon, Wed, Fri | 4:00 PM")
│  └─ { days: "Mon, Wed, Fri", time: "4:00 PM" }
├─ if (days || time) → TRUE
│  └─ ✅ setValue for English schedule
│
User clicks "Select Math Class"
├─ parseClassSchedule("Tue, Thu | 3:00 PM")
│  └─ { days: "Tue, Thu", time: "3:00 PM" }
├─ if (days || time) → TRUE
│  └─ ✅ setValue for Math schedule
│
Form state:
├─ eng_class_days: "Mon, Wed, Fri" ✓
├─ eng_class_time: "4:00 PM" ✓
├─ class_days: "Tue, Thu" ✓
├─ class_time: "3:00 PM" ✓
│
User submits
├─ Validation:
│  ├─ English required? YES ✓
│  ├─ Math required? YES ✓
│  └─ ✅ PASS
│
Server:
├─ Fetch English class + schedule ✓
├─ Fetch Math class + schedule ✓
├─ Insert with complete data
└─ Generate guidance
```

---

## Testing Strategy

### Unit Tests (Recommended)

```typescript
// tests/lib/validations/registration.test.ts

describe("registrationSchema", () => {
  describe("Subject: English-only", () => {
    test("should validate with English fields filled", () => {
      const data = {
        subject: "영어",
        eng_class: "class-1",
        eng_teacher: "teacher-1",
        assigned_class: "",  // Empty, but should be OK
        teacher: "",         // Empty, but should be OK
      };
      
      const result = registrationSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
    
    test("should fail if English class is empty", () => {
      const data = {
        subject: "영어",
        eng_class: "",  // ❌ Required
        eng_teacher: "teacher-1",
      };
      
      const result = registrationSchema.safeParse(data);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].path).toContain("eng_class");
    });
  });
  
  describe("Subject: English+Math", () => {
    test("should require both English and Math fields", () => {
      const data = {
        subject: "영어수학",
        eng_class: "class-1",
        eng_teacher: "teacher-1",
        assigned_class: "class-2",
        teacher: "teacher-2",
      };
      
      const result = registrationSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
    
    test("should fail if either is missing", () => {
      const data = {
        subject: "영어수학",
        eng_class: "class-1",
        eng_teacher: "teacher-1",
        assigned_class: "",  // ❌ Required for English+Math
        teacher: "teacher-2",
      };
      
      const result = registrationSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });
});
```

### Integration Tests

```typescript
// tests/lib/actions/registration.test.ts

describe("createRegistration", () => {
  test("should create registration with English schedule from form input", async () => {
    const result = await createRegistration({
      subject: "영어",
      eng_class: "class-1",
      eng_teacher: "teacher-1",
      eng_class_days: "Mon, Wed",
      eng_class_time: "4:00 PM",
    });
    
    expect(result.eng_class_days).toBe("Mon, Wed");
    expect(result.eng_class_time).toBe("4:00 PM");
  });
  
  test("should use DB schedule if class has it", async () => {
    // Create class with schedule in description
    const classWithSchedule = await createClass({
      description: "Tue, Thu | 3:00 PM",
    });
    
    const result = await createRegistration({
      subject: "영어",
      eng_class: classWithSchedule.id,
      eng_teacher: "teacher-1",
      eng_class_days: "User input",  // Will be overridden
      eng_class_time: "User input",  // Will be overridden
    });
    
    // DB schedule takes precedence
    expect(result.eng_class_days).toBe("Tue, Thu");
    expect(result.eng_class_time).toBe("3:00 PM");
  });
});
```

### Manual Testing Scenarios

```
Test Case 1: English-only
├─ Create class "English 1" (no schedule)
├─ Create registration (subject: English)
├─ Fill form manually
├─ Submit
└─ ✅ Should succeed

Test Case 2: Math-only
├─ Create class "Math A" (with schedule)
├─ Create registration (subject: Math)
├─ Select class (should auto-fill schedule)
├─ Submit
└─ ✅ Should succeed

Test Case 3: English+Math
├─ Create both classes
├─ Create registration (subject: English+Math)
├─ Select both classes
├─ Submit
└─ ✅ Should succeed

Test Case 4: Invalid (English with empty class)
├─ Create registration (subject: English)
├─ Leave English class empty
├─ Submit
└─ ❌ Should show error: "영어반을 선택하세요"

Test Case 5: Form field preservation
├─ Fill English class days/time manually
├─ Select class without schedule
├─ Check that manual input is preserved
└─ ✅ Should not be overwritten
```

---

## Performance Considerations

### Query Optimization

```typescript
// ✅ GOOD: Single query with select()
const classes = await supabase
  .from("classes")
  .select("id, name, description, class_days, class_time")
  .eq("subject", "영어");

// ❌ BAD: N+1 queries
const classes = await supabase.from("classes").select("*");
for (const cls of classes) {
  const teacher = await supabase
    .from("teachers")
    .select("*")
    .eq("id", cls.teacher_id);  // ← Repeated query!
}
```

### Caching Strategy

```typescript
// Cache class list (rarely changes)
const CachedClasses = async (subject: string) => {
  // Use React Query or SWR
  const query = useQuery({
    queryKey: ["classes", subject],
    queryFn: () => fetchClasses(subject),
    staleTime: 1000 * 60 * 5,  // 5 minutes
  });
  
  return query.data;
};
```

### Form Rendering Performance

```typescript
// ✅ Memoize expensive components
const ClassSelect = React.memo(({ options, onChange }) => {
  return (
    <Select onChange={onChange}>
      {options.map(c => <Option key={c.id}>{c.name}</Option>)}
    </Select>
  );
});

// Avoid re-rendering on every keystroke
const subject = form.watch("subject");  // Only watch specific field
```

---

## Future Optimizations

### 1. SUBJECT_FIELDS Constant (Recommended)

```typescript
// src/lib/constants/subjects.ts
export const SUBJECT_FIELDS = {
  "영어": ["eng_class", "eng_teacher"],
  "수학": ["assigned_class", "teacher"],
  "영어수학": [
    "eng_class",
    "eng_teacher",
    "assigned_class",
    "teacher",
  ],
};

// Use in validation
.refine((data) => {
  const required = SUBJECT_FIELDS[data.subject] || [];
  return required.every(field => data[field]);
})

// Use in UI
{SUBJECT_FIELDS[subject].includes("eng_class") && <ClassSelect />}
```

### 2. Dynamic Field Builder

```typescript
// src/components/registrations/DynamicFieldBuilder.tsx
const DynamicRegistrationForm = ({ subject }) => {
  const fields = SUBJECT_FIELDS[subject];
  
  return (
    <Form>
      {fields.includes("eng_class") && <EnglishClassSection />}
      {fields.includes("assigned_class") && <MathClassSection />}
      <SubmitButton />
    </Form>
  );
};
```

### 3. Server-Side Validation Helper

```typescript
// src/lib/validation-helpers.ts
export function validateRegistrationBySubject(
  data: unknown,
  subject: string
) {
  const requiredFields = SUBJECT_FIELDS[subject];
  
  for (const field of requiredFields) {
    if (!data[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
}

// Use in Server Action
export async function createRegistration(data: unknown) {
  const validated = registrationSchema.parse(data);
  validateRegistrationBySubject(validated, validated.subject);
  // ... rest of logic
}
```

### 4. Granular Error Messages

```typescript
// src/lib/error-messages.ts
export const VALIDATION_MESSAGES = {
  eng_class: {
    "영어": "영어반을 선택하세요",
    "영어수학": "영어반을 선택하세요",
  },
  assigned_class: {
    "수학": "배정반을 선택하세요",
    "영어수학": "배정반을 선택하세요",
  },
};

// Use in schema
.refine(
  (data) => {
    if (SUBJECT_FIELDS[data.subject].includes("eng_class")) {
      return data.eng_class?.length > 0;
    }
    return true;
  },
  {
    message: VALIDATION_MESSAGES.eng_class[data.subject],
    path: ["eng_class"],
  }
)
```

---

## Debugging Tips

### Enable Debug Logging

```typescript
// In registration-form-client.tsx
const handleClassChange = (classId: string) => {
  console.log("[handleClassChange]", { classId });
  
  const selected = classes.find(c => c.id === classId);
  console.log("[handleClassChange] selected class:", selected);
  
  const schedule = parseClassSchedule(selected?.description || "");
  console.log("[handleClassChange] parsed schedule:", schedule);
  
  if (schedule.days || schedule.time) {
    console.log("[handleClassChange] setting schedule");
    form.setValue("eng_class_days", schedule.days || "");
    form.setValue("eng_class_time", schedule.time || "");
  } else {
    console.log("[handleClassChange] schedule empty, skipping setValue");
  }
};
```

### Inspect Form State

```typescript
// React Hook Form devtools
import { DevTool } from "@hookform/devtools";

export function RegistrationForm() {
  const form = useForm({ ... });
  
  return (
    <div>
      <form>
        {/* form fields */}
      </form>
      <DevTool control={form.control} />
    </div>
  );
}
```

### Test in Browser Console

```javascript
// In browser console after form loads
document.querySelector('input[name="subject"]').value  // Check subject
document.querySelector('input[name="eng_class"]').value  // Check class
document.querySelector('input[name="eng_class_days"]').value  // Check schedule
```

---

## Summary

| Area | Solution |
|------|----------|
| **Validation** | Use `.refine()` for conditional rules |
| **Form State** | Check before `setValue()` to preserve data |
| **Server** | Include all related subjects in conditions |
| **Testing** | Test all subject combinations |
| **Future** | Centralize SUBJECT_FIELDS constant |

---

**Created**: 2026-04-01  
**For**: Developers implementing or maintaining registration features
