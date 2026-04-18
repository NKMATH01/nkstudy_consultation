# 강사 비밀번호 통합 (teacher-password-integration) - 테스트 시나리오

> **작성일**: 2026-04-19  
> **작성자**: 상담관리앱 Claude Code  
> **관련 앱**: 상담관리앱 + 학습관리앱 + 설문조사앱  
> **목적**: 3앱 비밀번호 통합 기능 검증  
> **실행 환경**: Supabase 개발/스테이징 DB

---

## 개요

이 문서는 `teacher-password-integration` 기능의 5가지 핵심 시나리오에 대한 테스트 체크리스트, 기대 로그, 디버깅 가이드를 제시합니다.

각 시나리오는 다음 구성으로 작성됩니다:
1. **시나리오 설명**: 어떤 동작을 수행하는가
2. **선행 조건**: 테스트 전 준비사항
3. **테스트 단계**: 상담관리앱/학습관리앱/설문조사앱에서 수행할 작업
4. **기대 결과**: 각 앱/DB에서의 예상 상태
5. **검증 SQL**: DB에서 확인하는 쿼리
6. **실패 시 디버깅**: 문제 발생 시 확인사항

---

## 시나리오 1: 신규 강사 생성 (기본 비밀번호 "1234")

### 시나리오 설명
관리자가 상담관리앱에서 새로운 강사를 등록합니다. 비밀번호 필드를 입력하지 않으면 기본값 "1234"가 적용되고, `custom_password`는 **NULL로 유지**되어야 합니다. 이를 통해 학습관리앱이 `requires_password_change=true`를 감지하고 강사에게 비밀번호 변경을 강제할 수 있습니다.

### 선행 조건
- 상담관리앱 관리자 계정 로그인 완료
- 테스트용 전화번호: `010-1111-1111` (기존에 없는 번호)
- Supabase 개발 DB 접근 가능

### 테스트 단계

#### 1단계: 상담관리앱에서 신규 강사 등록

**작업**:
1. 상담관리앱 → 설정 → 선생님 관리 → "새로운 선생님" 버튼 클릭
2. 폼 입력:
   - **이름**: "테스트강사1"
   - **전화번호**: "010-1111-1111"
   - **과목** (선택): "수학"
   - **학년** (선택): "고1"
   - **역할** (선택): "teacher"
   - **비밀번호**: **공백 유지** (입력 안 함)
3. "저장" 버튼 클릭

**예상 로그** (브라우저 콘솔):
```json
{
  "action": "createTeacher",
  "status": "success",
  "teacher": {
    "name": "테스트강사1",
    "phone": "010-1111-1111",
    "building": "수학",
    "target_grade": "고1",
    "password": "1234",
    "custom_password": null
  },
  "auth": {
    "created": true,
    "email": "01011111111@nk.local",
    "password_hash": "nk1234"
  }
}
```

#### 2단계: Supabase 대시보드에서 확인
1. Supabase 대시보드 → SQL Editor
2. 아래 쿼리 실행

#### 3단계: 학습관리앱에서 상태 확인 (협의 필요)
학습관리앱이 `custom_password IS NULL`을 감지하고 `requires_password_change=true`로 플래그 설정했는지 확인.

### 기대 결과

| 확인 항목 | 기대값 | 검증 방법 |
|---------|-------|---------|
| teachers.password | "1234" | SQL 쿼리 |
| teachers.custom_password | NULL | SQL 쿼리 |
| auth.users 존재 | yes | SQL 쿼리 |
| auth.users.email | "01011111111@nk.local" | SQL 쿼리 |
| 학습관리앱 requires_password_change | true | 학습앱 DB 확인 |
| 설문조사앱 로그인 가능 | no (custom_password=NULL) | 설문앱 테스트 |

### 검증 SQL

```sql
-- ===== 상담관리앱 DB =====
-- 1. teachers 테이블에서 강사 정보 확인
SELECT 
  id, 
  name, 
  phone, 
  password, 
  custom_password, 
  role,
  building,
  auth_user_id
FROM teachers 
WHERE phone = '010-1111-1111';

-- 2. Supabase Auth 사용자 확인
SELECT 
  id, 
  email, 
  created_at
FROM auth.users 
WHERE email = '01011111111@nk.local';

-- ===== 학습관리앱 DB (참고) =====
-- 3. 학습관리앱의 requires_password_change 플래그 확인
SELECT 
  id,
  name,
  phone,
  requires_password_change,
  custom_password
FROM teachers 
WHERE phone = '010-1111-1111';
```

### 실패 시 디버깅

#### 증상 1: custom_password가 "1234"로 저장됨
```
실제: custom_password = "1234"
기대: custom_password = NULL
```

**원인**:
- `createTeacher` 라인 478-480의 조건 로직 실패
- 또는 UI에서 "1234"가 명시적으로 입력됨

**확인**:
```typescript
// src/lib/actions/settings.ts:478-480
if (parsed.data.password && parsed.data.password !== "1234") {
  insertData.custom_password = parsed.data.password;
}
// 이 조건이 false여야 함 (insertData에 custom_password 추가 안 됨)
```

**해결**:
1. 상담앱 로그에서 `parsed.data.password` 값 확인
2. UI에서 비밀번호 필드가 정말 공백인지 확인
3. 폼 검증 스키마 (`teacherFormSchema`) 확인

#### 증상 2: Auth 사용자가 생성되지 않음
```
실제: auth.users에 01011111111@nk.local 없음
기대: 존재
```

**원인**:
- `SUPABASE_SERVICE_ROLE_KEY` 미설정
- 또는 line 450 조건 `parsed.data.role !== "clinic"` 실패

**확인**:
```bash
# .env.local에 SUPABASE_SERVICE_ROLE_KEY 존재 확인
echo $SUPABASE_SERVICE_ROLE_KEY
```

**해결**:
1. `.env.local`에 `SUPABASE_SERVICE_ROLE_KEY` 추가
2. 브라우저 콘솔의 `[Teacher Auth] 생성 실패` 에러 메시지 확인

#### 증상 3: 선생님이 teachers 테이블에 저장되지 않음
```
SQL 쿼리 결과: 행 없음
```

**원인**:
- 폼 검증 실패 (`teacherFormSchema`)
- 또는 DB 권한 문제 (RLS)

**확인**:
```typescript
// 브라우저 콘솔에서 에러 메시지 확인
console.error("[Settings]", e);
```

**해결**:
1. 입력값 재확인 (이름은 필수, 전화번호 형식)
2. Supabase RLS 정책 확인: `teachers_all_authenticated`

---

## 시나리오 2: 신규 강사 생성 (명시 비밀번호 "5678")

### 시나리오 설명
관리자가 상담관리앱에서 비밀번호를 명시적으로 입력하여 강사를 등록합니다. 이 경우 `custom_password = "5678"`로 저장되어, 학습관리앱과 설문조사앱에서 즉시 "5678"으로 로그인할 수 있어야 합니다.

### 선행 조건
- 상담관리앱 관리자 계정 로그인 완료
- 테스트용 전화번호: `010-2222-2222` (기존에 없는 번호)
- Supabase 개발 DB 접근 가능

### 테스트 단계

#### 1단계: 상담관리앱에서 신규 강사 등록 (비밀번호 명시)

**작업**:
1. 상담관리앱 → 설정 → 선생님 관리 → "새로운 선생님" 버튼
2. 폼 입력:
   - **이름**: "테스트강사2"
   - **전화번호**: "010-2222-2222"
   - **과목** (선택): "영어"
   - **학년** (선택): "고2"
   - **역할** (선택): "teacher"
   - **비밀번호**: "5678" (명시적 입력)
3. "저장" 버튼 클릭

**예상 로그** (브라우저 콘솔):
```json
{
  "action": "createTeacher",
  "status": "success",
  "teacher": {
    "name": "테스트강사2",
    "phone": "010-2222-2222",
    "password": "5678",
    "custom_password": "5678"
  }
}
```

#### 2단계: Supabase 대시보드 확인

아래 SQL 쿼리 실행.

#### 3단계: 학습관리앱에서 로그인 테스트

**작업**:
1. 학습관리앱 로그인 페이지 (아직 구현 안 되었다면 후술)
2. 전화번호: "010-2222-2222"
3. 비밀번호: "5678"
4. 로그인 시도

**기대 결과**: ✅ 로그인 성공

#### 4단계: 설문조사앱에서 로그인 테스트

**작업**:
1. 설문조사앱 로그인 페이지
2. 전화번호: "010-2222-2222"
3. 비밀번호: "5678"
4. 로그인 시도

**기대 결과**: ✅ 로그인 성공

### 기대 결과

| 확인 항목 | 기대값 | 검증 방법 |
|---------|-------|---------|
| teachers.password | "5678" | SQL 쿼리 |
| teachers.custom_password | "5678" | SQL 쿼리 |
| auth.users.email | "01022222222@nk.local" | SQL 쿼리 |
| 학습관리앱 로그인 | 성공 (requires_password_change=false) | 학습앱 테스트 |
| 설문조사앱 로그인 | 성공 (custom_password="5678" 사용) | 설문앱 테스트 |

### 검증 SQL

```sql
-- ===== 상담관리앱 DB =====
SELECT 
  id, 
  name, 
  phone, 
  password, 
  custom_password, 
  role
FROM teachers 
WHERE phone = '010-2222-2222';

-- ===== 학습관리앱 DB =====
SELECT 
  id,
  name,
  phone,
  requires_password_change,
  custom_password
FROM teachers 
WHERE phone = '010-2222-2222';

-- ===== 설문조사앱 DB (참고) =====
-- custom_password 읽기만 함
SELECT 
  id,
  name,
  phone,
  custom_password
FROM teachers 
WHERE phone = '010-2222-2222';
```

### 실패 시 디버깅

#### 증상: custom_password가 NULL로 저장됨
```
실제: custom_password = NULL
기대: custom_password = "5678"
```

**원인**:
- `createTeacher` 라인 478의 조건 `parsed.data.password !== "1234"`가 실패
- 또는 폼 검증 실패로 `parsed.data.password`가 undefined

**확인**:
```typescript
// 라인 478 조건 재확인
if (parsed.data.password && parsed.data.password !== "1234") {
  insertData.custom_password = parsed.data.password;
}
```

**해결**:
1. 브라우저 콘솔에서 form 데이터 로깅
2. 폼 검증 스키마 확인

#### 증상: 학습관리앱 로그인 실패
```
에러: "Invalid credentials" 또는 "requires_password_change"
```

**원인**:
- 학습관리앱의 `fn_authenticate_with_phone` RPC가 custom_password 읽기 실패
- 또는 Auth 사용자 생성 실패로 phone 기반 인증 되지 않음

**확인**:
```sql
-- custom_password 값 재확인
SELECT phone, custom_password FROM teachers WHERE phone = '010-2222-2222';

-- 학습관리앱 RPC 로그 확인
-- (학습관리앱 Dashboard에서 함수 호출 로그 확인)
```

**해결**:
1. 상담앱과 학습앱이 같은 Supabase 프로젝트 사용 중인지 확인
2. 학습관리앱의 `fn_authenticate_with_phone` 구현 재확인

---

## 시나리오 3: 강사 본인 비밀번호 변경 ("1234" → "9999")

### 시나리오 설명
강사가 상담관리앱에 로그인한 후, 비밀번호를 변경합니다 ("1234" → "9999"). 상담관리앱은 `custom_password = "9999"`로 동시에 업데이트하며, 이를 통해 학습관리앱과 설문조사앱도 "9999"로 즉시 로그인할 수 있어야 합니다.

### 선행 조건
- 시나리오 1에서 생성한 강사 "테스트강사1" (010-1111-1111, custom_password=NULL) 존재
- 상담관리앱에 "테스트강사1"으로 로그인 가능한 상태
- Supabase 개발 DB 접근 가능

### 테스트 단계

#### 1단계: 상담관리앱에 강사 계정으로 로그인

**작업**:
1. 상담관리앱 로그인 페이지 (필요시 먼저 로그아웃)
2. 전화번호: "010-1111-1111"
3. 비밀번호: "1234"
4. "로그인" 버튼 클릭

**예상 로그** (브라우저 콘솔):
```json
{
  "action": "login",
  "status": "success",
  "user": {
    "email": "01011111111@nk.local",
    "role": "teacher"
  }
}
```

**기대 결과**: ✅ 대시보드로 이동

#### 2단계: 설정 → 내 정보에서 비밀번호 변경

**작업**:
1. 대시보드 → 설정 (또는 우측 상단 메뉴)
2. "내 정보" 또는 "비밀번호 변경" 섹션 찾기
3. 현재 비밀번호: "1234"
4. 새 비밀번호: "9999"
5. 새 비밀번호 확인: "9999"
6. "변경" 버튼 클릭

**예상 로그** (브라우저 콘솔):
```json
{
  "action": "changeTeacherPassword",
  "phone": "010-1111-1111",
  "newPassword": "9999",
  "status": "success",
  "updated": {
    "password": "changed",
    "custom_password": "9999"
  }
}
```

#### 3단계: 상담관리앱 재로그인 (새 비밀번호)

**작업**:
1. 상담관리앱 로그아웃
2. 로그인 페이지에서:
   - 전화번호: "010-1111-1111"
   - 비밀번호: "9999" (새 비밀번호)
3. "로그인" 버튼 클릭

**기대 결과**: ✅ 로그인 성공

#### 4단계: 학습관리앱 로그인 (새 비밀번호)

**작업**:
1. 학습관리앱 로그인 페이지
2. 전화번호: "010-1111-1111"
3. 비밀번호: "9999"
4. 로그인 시도

**기대 결과**: ✅ 로그인 성공 (requires_password_change=false)

#### 5단계: 설문조사앱 로그인 (새 비밀번호)

**작업**:
1. 설문조사앱 로그인 페이지
2. 전화번호: "010-1111-1111"
3. 비밀번호: "9999"
4. 로그인 시도

**기대 결과**: ✅ 로그인 성공

### 기대 결과

| 확인 항목 | 기대값 | 검증 방법 |
|---------|-------|---------|
| teachers.password | "changed" | SQL 쿼리 |
| teachers.custom_password | "9999" | SQL 쿼리 |
| auth.users.password_hash | "nk9999" (해시) | SQL 쿼리 |
| 상담관리앱 로그인 ("9999") | 성공 | 앱 테스트 |
| 학습관리앱 로그인 ("9999") | 성공 | 앱 테스트 |
| 설문조사앱 로그인 ("9999") | 성공 | 앱 테스트 |
| 구 비밀번호 ("1234") 로그인 | 실패 | 앱 테스트 |

### 검증 SQL

```sql
-- ===== 상담관리앱 DB =====
SELECT 
  id, 
  name, 
  phone, 
  password, 
  custom_password, 
  updated_at
FROM teachers 
WHERE phone = '010-1111-1111';

-- ===== Supabase Auth =====
SELECT 
  id, 
  email, 
  updated_at
FROM auth.users 
WHERE email = '01011111111@nk.local';

-- ===== 학습관리앱 DB =====
SELECT 
  id,
  name,
  phone,
  custom_password,
  requires_password_change,
  updated_at
FROM teachers 
WHERE phone = '010-1111-1111';
```

### 실패 시 디버깅

#### 증상 1: custom_password가 업데이트되지 않음
```
실제: custom_password = NULL (변경 전과 동일)
기대: custom_password = "9999"
```

**원인**:
- `changeTeacherPassword` 라인 675-677 로직 실패
- 또는 authenticated 세션에서 쓰기 권한 없음 (RLS)

**확인**:
```typescript
// src/lib/actions/settings.ts:675-677
const { error } = await supabase
  .from("teachers")
  .update({ password: "changed", custom_password: newPassword })
  .eq("id", teacherId);
```

**해결**:
1. Supabase RLS 정책 확인: `teachers_all_authenticated`는 authenticated 세션 허용해야 함
2. 브라우저 콘솔 에러 메시지 확인

#### 증상 2: 학습관리앱 로그인 실패 (새 비밀번호)
```
에러: "Invalid credentials"
```

**원인**:
- 학습관리앱이 아직 custom_password를 읽지 않음
- 또는 DB 동기화 지연

**확인**:
```sql
-- custom_password 값 확인
SELECT phone, custom_password FROM teachers WHERE phone = '010-1111-1111';

-- 타임스탬프 확인 (동기화 지연 가능성)
SELECT phone, custom_password, updated_at FROM teachers WHERE phone = '010-1111-1111';
```

**해결**:
1. 5~10초 후 재시도 (DB 동기화 대기)
2. 학습관리앱의 `fn_authenticate_with_phone` 로그 확인

#### 증상 3: Auth 비밀번호 업데이트 실패
```
상담앱은 "changed" 마커로 업데이트되지만, Auth는 그대로
```

**원인**:
- Auth 업데이트 로직이 `changeTeacherPassword`에 없음 (설계상 의도)
- 또는 Auth 업데이트가 별도 함수에서 처리되어야 함

**확인**:
```typescript
// changeTeacherPassword에는 Auth 업데이트 로직 없음
// (상담앱이 Auth와 DB를 동시에 관리하지 않음 - 보안 고려)
```

**참고**: 현재 구현상 `changeTeacherPassword`는 `custom_password`만 업데이트합니다. Auth 비밀번호는 상담앱 내부 로직이 별도로 처리해야 합니다.

---

## 시나리오 4: 관리자가 강사 수정 폼에서 비밀번호 변경 ("8888")

### 시나리오 설명
관리자가 상담관리앱의 "선생님 관리" 페이지에서 기존 강사의 정보를 수정하면서 비밀번호를 "8888"로 변경합니다. `custom_password = "8888"`로 업데이트되며, 학습관리앱과 설문조사앱도 "8888"로 즉시 로그인할 수 있어야 합니다.

### 선행 조건
- 시나리오 1에서 생성한 강사 "테스트강사1" (010-1111-1111) 존재
- 상담관리앱 관리자 계정 로그인 완료
- Supabase 개발 DB 접근 가능

### 테스트 단계

#### 1단계: 상담관리앱 관리자로 강사 수정 페이지 접근

**작업**:
1. 상담관리앱 → 설정 → 선생님 관리
2. "테스트강사1" (010-1111-1111) 행에서 "수정" 또는 "편집" 버튼 클릭
3. 수정 폼 로드

#### 2단계: 비밀번호 필드에 "8888" 입력 및 저장

**작업**:
1. 수정 폼의 다양한 필드:
   - **이름**: 변경 안 함 또는 그대로 "테스트강사1"
   - **전화번호**: 변경 안 함 (010-1111-1111)
   - **비밀번호 필드**: "8888" 입력
2. "저장" 버튼 클릭

**예상 로그** (브라우저 콘솔):
```json
{
  "action": "updateTeacher",
  "teacherId": "...",
  "status": "success",
  "updated": {
    "name": "테스트강사1",
    "phone": "010-1111-1111",
    "password": "changed",
    "custom_password": "8888"
  },
  "auth": {
    "updated": true,
    "email": "01011111111@nk.local"
  }
}
```

#### 3단계: 학습관리앱 로그인 테스트 (새 비밀번호)

**작업**:
1. 학습관리앱 로그인 페이지
2. 전화번호: "010-1111-1111"
3. 비밀번호: "8888"
4. 로그인 시도

**기대 결과**: ✅ 로그인 성공

#### 4단계: 설문조사앱 로그인 테스트 (새 비밀번호)

**작업**:
1. 설문조사앱 로그인 페이지
2. 전화번호: "010-1111-1111"
3. 비밀번호: "8888"
4. 로그인 시도

**기대 결과**: ✅ 로그인 성공

### 기대 결과

| 확인 항목 | 기대값 | 검증 방법 |
|---------|-------|---------|
| teachers.password | "changed" | SQL 쿼리 |
| teachers.custom_password | "8888" | SQL 쿼리 |
| auth.users.email | "01011111111@nk.local" | SQL 쿼리 |
| auth.users.updated_at | (현재 시각) | SQL 쿼리 |
| 학습관리앱 로그인 ("8888") | 성공 | 앱 테스트 |
| 설문조사앱 로그인 ("8888") | 성공 | 앱 테스트 |

### 검증 SQL

```sql
-- ===== 상담관리앱 DB =====
SELECT 
  id, 
  name, 
  phone, 
  password, 
  custom_password, 
  role,
  auth_user_id,
  updated_at
FROM teachers 
WHERE phone = '010-1111-1111';

-- ===== Supabase Auth =====
SELECT 
  id, 
  email, 
  updated_at
FROM auth.users 
WHERE email = '01011111111@nk.local';

-- ===== 학습관리앱 DB =====
SELECT 
  id,
  name,
  phone,
  custom_password,
  requires_password_change,
  updated_at
FROM teachers 
WHERE phone = '010-1111-1111';
```

### 실패 시 디버깅

#### 증상: custom_password가 업데이트되지 않음
```
실제: custom_password = (이전 값)
기대: custom_password = "8888"
```

**원인**:
- `updateTeacher` 라인 583-586의 조건 로직 실패
- 또는 관리자 세션 권한 문제

**확인**:
```typescript
// src/lib/actions/settings.ts:583-586
if (newPassword) {
  updateData.password = "changed";
  updateData.custom_password = newPassword; // 3앱 통합 비번
}
```

**해결**:
1. 폼 검증 확인: `newPassword`가 정말 "8888"인지
2. Supabase RLS: 관리자 세션이 `teachers_all_authenticated` 정책 통과하는지 확인

#### 증상: Auth 업데이트 실패
```
DB는 업데이트되지만 Auth는 실패
```

**원인**:
- `updateTeacher` 라인 527-571의 Auth 동기화 로직 실패
- 또는 `SUPABASE_SERVICE_ROLE_KEY` 미설정

**확인**:
```bash
echo $SUPABASE_SERVICE_ROLE_KEY
```

**해결**:
1. `.env.local`에 `SUPABASE_SERVICE_ROLE_KEY` 추가
2. 브라우저 콘솔의 `[Teacher Auth]` 에러 메시지 확인

---

## 시나리오 5: 관리자가 비밀번호 초기화 클릭

### 시나리오 설명
관리자가 "선생님 관리" 페이지에서 "비밀번호 초기화" 버튼을 클릭합니다. 강사의 비밀번호가 기본값 "1234"로 복귀하고, `custom_password = NULL`로 설정됩니다. 이를 통해 학습관리앱이 `requires_password_change=true`를 감지하도록 합니다.

### 선행 조건
- 시나리오 2에서 생성한 강사 "테스트강사2" (010-2222-2222, custom_password="5678") 또는
- 시나리오 4에서 수정한 강사 (010-1111-1111, custom_password="8888") 존재
- 상담관리앱 관리자 계정 로그인 완료
- Supabase 개발 DB 접근 가능

### 테스트 단계

#### 1단계: 강사 관리 페이지에서 초기화 버튼 찾기

**작업**:
1. 상담관리앱 → 설정 → 선생님 관리
2. 테스트 강사 행 찾기 (010-2222-2222 또는 010-1111-1111)
3. "비밀번호 초기화" 또는 "Reset Password" 버튼 클릭

#### 2단계: 초기화 확인 대화

일부 UI는 확인 대화를 표시할 수 있습니다:
```
"비밀번호를 '1234'로 초기화하시겠습니까?"
```

**작업**:
- "확인" 버튼 클릭

**예상 로그** (브라우저 콘솔):
```json
{
  "action": "resetTeacherPassword",
  "teacherId": "...",
  "status": "success",
  "reset": {
    "password": "1234",
    "custom_password": null
  },
  "auth": {
    "updated": true,
    "email": "01011111111@nk.local",
    "password": "nk1234"
  }
}
```

#### 3단계: 상담관리앱 로그인 테스트 (기본 비밀번호)

**작업**:
1. 상담관리앱 로그아웃
2. 로그인 페이지에서:
   - 전화번호: "010-2222-2222" (또는 010-1111-1111)
   - 비밀번호: "1234" (기본값)
3. "로그인" 버튼 클릭

**기대 결과**: ✅ 로그인 성공

#### 4단계: 학습관리앱에서 requires_password_change 확인

**작업** (학습관리앱 로직 검증):
1. 학습관리앱이 `custom_password IS NULL` 감지
2. 강사가 학습관리앱에 접속하면 "비밀번호 변경 필수" 메시지 표시
3. 또는 `requires_password_change=true` 플래그 설정

**기대 결과**: ✅ requires_password_change=true로 설정됨

#### 5단계: 학습관리앱에서 비밀번호 변경 강제

**참고**: 학습관리앱의 구현 방식에 따라 다름.

가능한 시나리오:
- 학습앱이 강사를 로그인 페이지로 리다이렉트
- 또는 "비밀번호 변경" 모달 표시

**작업** (예시):
1. 학습관리앱 로그인: 010-2222-2222 / 1234
2. requires_password_change 감지
3. 강사가 새 비밀번호 입력 (예: "4321")
4. 학습관리앱이 상담앱의 API를 호출하여 비밀번호 변경 (또는 각자 구현)

**기대 결과**: ✅ 비밀번호 변경 가능, requires_password_change=false로 복귀

### 기대 결과

| 확인 항목 | 기대값 | 검증 방법 |
|---------|-------|---------|
| teachers.password | "1234" | SQL 쿼리 |
| teachers.custom_password | NULL | SQL 쿼리 |
| auth.users.password_hash | "nk1234" (해시) | SQL 쿼리 |
| 학습관리앱 requires_password_change | true | 학습앱 DB 또는 UI |
| 상담관리앱 로그인 ("1234") | 성공 | 앱 테스트 |
| 구 비밀번호 (이전 값, 예: "5678") | 실패 | 앱 테스트 |

### 검증 SQL

```sql
-- ===== 상담관리앱 DB =====
SELECT 
  id, 
  name, 
  phone, 
  password, 
  custom_password, 
  auth_user_id,
  updated_at
FROM teachers 
WHERE phone = '010-2222-2222';  -- 또는 010-1111-1111

-- ===== Supabase Auth =====
SELECT 
  id, 
  email, 
  updated_at
FROM auth.users 
WHERE email = '01022222222@nk.local';  -- 또는 01011111111@nk.local

-- ===== 학습관리앱 DB =====
SELECT 
  id,
  name,
  phone,
  custom_password,
  requires_password_change,
  updated_at
FROM teachers 
WHERE phone = '010-2222-2222';  -- 또는 010-1111-1111
```

### 실패 시 디버깅

#### 증상 1: custom_password가 NULL로 설정되지 않음
```
실제: custom_password = (이전 값)
기대: custom_password = NULL
```

**원인**:
- `resetTeacherPassword` 라인 630-633 로직 실패
- 또는 관리자 권한 문제

**확인**:
```typescript
// src/lib/actions/settings.ts:630-633
const { error } = await admin
  .from("teachers")
  .update({ password: "1234", custom_password: null })
  .eq("id", id);
```

**해결**:
1. Supabase RLS: `SUPABASE_SERVICE_ROLE_KEY` 확인
2. 브라우저 콘솔 에러 메시지 확인

#### 증상 2: Auth 비밀번호가 리셋되지 않음
```
실제: auth.users.password_hash != "nk1234"
기대: auth.users.password_hash = "nk1234"
```

**원인**:
- `resetTeacherPassword` 라인 616-627의 Auth 동기화 실패
- 또는 `SUPABASE_SERVICE_ROLE_KEY` 미설정

**확인**:
```bash
echo $SUPABASE_SERVICE_ROLE_KEY
```

**해결**:
1. `.env.local`에 `SUPABASE_SERVICE_ROLE_KEY` 추가
2. 브라우저 콘솔 에러 메시지 확인

#### 증상 3: 학습관리앱이 requires_password_change를 감지하지 못함
```
학습앱 DB: requires_password_change = false (변경되지 않음)
또는 학습앱이 강사 접속 시 비밀번호 변경을 강제하지 않음
```

**원인**:
- 학습관리앱의 DB 동기화 로직 미완성
- 또는 `requires_password_change` 플래그가 자동 설정되지 않음

**확인**:
```sql
-- 학습관리앱 DB에서 requires_password_change 열 존재 확인
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'teachers' AND column_name = 'requires_password_change';
```

**해결**:
1. 학습관리앱 담당자에게 연락: requires_password_change 동기화 로직 확인
2. 수동으로 학습앱 DB에서 플래그 설정 (테스트용):
   ```sql
   UPDATE teachers 
   SET requires_password_change = true 
   WHERE phone = '010-2222-2222';
   ```

---

## 전체 테스트 체크리스트

### 테스트 실행 순서
```
시나리오 1 (기본 비밀번호) 
  ↓
시나리오 2 (명시 비밀번호)
  ↓
시나리오 3 (강사 본인 변경)
  ↓
시나리오 4 (관리자 수정)
  ↓
시나리오 5 (비밀번호 초기화)
```

### 최종 검증 체크리스트

| 항목 | 시나리오 | 상태 | 비고 |
|------|---------|------|------|
| custom_password NULL (기본) | 1 | ⬜ | |
| custom_password 저장 (명시) | 2 | ⬜ | |
| custom_password 업데이트 (강사 변경) | 3 | ⬜ | |
| custom_password 업데이트 (관리자 수정) | 4 | ⬜ | |
| custom_password NULL (초기화) | 5 | ⬜ | |
| Auth 사용자 생성 | 1 | ⬜ | |
| Auth 비밀번호 동기화 | 3, 4, 5 | ⬜ | |
| 학습관리앱 로그인 | 2, 3, 4 | ⬜ | |
| 설문조사앱 로그인 | 2, 3, 4 | ⬜ | |
| requires_password_change 트리거 | 1, 5 | ⬜ | |
| TypeScript 컴파일 | 모두 | ⬜ | |
| RLS 권한 검증 | 모두 | ⬜ | |

---

## 기술 지원

### 로그 수집 방법

**브라우저 콘솔 로그**:
1. F12 또는 우측 클릭 → "검사" → "Console" 탭
2. 작업 수행 후 콘솔 메시지 스크린샷 또는 복사
3. 필요시 에러 메시지 공유

**Supabase 로그**:
1. Supabase 대시보드 → 좌측 메뉴 "Logs" (있을 경우)
2. 또는 "Database" → "SQL Editor" → 쿼리 직접 실행

**학습관리앱 로그**:
1. 학습관리앱 대시보드에서 함수 호출 로그 확인
2. 또는 학습앱 측 개발 도구 활용

### 문제 보고 템플릿

```markdown
## 테스트 결과 보고

**시나리오**: [번호]  
**예상 결과**: [기대값]  
**실제 결과**: [실제값]  
**에러 메시지**: [에러 내용]  
**스크린샷**: [첨부]  

### 재현 단계
1. ...
2. ...

### 환경
- 상담관리앱 브라우저: [Chrome/Safari/...]
- Supabase 프로젝트: [프로젝트명]
- DB 환경: [개발/스테이징/프로덕션]
```

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-19  
**Status**: Ready for Testing
