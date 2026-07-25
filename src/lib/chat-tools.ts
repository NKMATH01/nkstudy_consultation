import { createHmac, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

// =============================================
// 엔티티별 설정
// =============================================

/** 엔티티별 한국어 레이블 */
export const ENTITY_LABELS: Record<string, string> = {
  consultation: "상담",
  student: "학생",
  booking: "예약",
  withdrawal: "퇴원생",
  teacher: "강사",
  class: "반",
};

/** 작업별 한국어 레이블 */
export const OPERATION_LABELS: Record<string, string> = {
  create: "신규등록",
  update: "수정",
  delete: "삭제",
};

/** 엔티티별 테이블명 */
const TABLE_MAP: Record<string, string> = {
  consultation: "consultations",
  student: "students",
  booking: "bookings",
  withdrawal: "withdrawals",
  teacher: "teachers",
  class: "classes",
};

/** 엔티티별 허용 필드 (화이트리스트) */
export const ALLOWED_FIELDS: Record<string, string[]> = {
  consultation: [
    "name", "school", "grade", "parent_phone",
    "subject", "location",
    "consult_type", "memo", "result_status",
    "prev_academy", "prev_complaint", "school_score", "test_score",
    "advance_level", "study_goal", "prefer_days",
    "plan_date", "plan_class", "requests",
    "student_consult_note", "parent_consult_note",
    "parent_consult_date", "parent_consult_time", "parent_location",
    "doc_sent", "call_done", "notify_sent", "consult_done",
    "reserve_text_sent", "reserve_deposit",
    "attitude", "willingness", "parent_level", "student_level",
    "payment_type", "referral", "has_friend",
    "test_fee_paid", "test_fee_method",
  ],
  student: [
    "name", "school", "grade", "phone", "parent_phone",
    "class_name", "teacher_name", "subject", "memo",
    "is_active",
  ],
  booking: [
    "student_name", "parent_name", "phone",
    "booking_date", "booking_hour", "branch",
    "consult_type", "subject", "school", "grade",
    "paid", "pay_method", "memo",
  ],
  withdrawal: [
    "name", "school", "subject", "class_name", "teacher", "grade",
    "enrollment_start", "enrollment_end", "duration_months",
    "withdrawal_date", "class_attitude", "homework_submission",
    "attendance", "grade_change", "recent_grade",
    "reason_category", "student_opinion", "parent_opinion",
    "teacher_opinion", "final_consult_date", "final_counselor",
    "final_consult_summary", "parent_thanks",
    "comeback_possibility", "expected_comeback_date", "special_notes",
  ],
  teacher: [
    // role 제외 — 권한 변경은 AI를 통해 하면 안 됨 (설정 > 선생님 관리에서만)
    "name", "phone", "subject", "is_active",
  ],
  class: [
    "name", "target_grade", "class_days", "class_time",
    "clinic_time", "weekly_test_time", "location", "is_active",
  ],
};

/** 엔티티별 허용 작업 */
export const ALLOWED_OPERATIONS: Record<string, string[]> = {
  consultation: ["create", "update"],
  student: ["create", "update"],
  booking: [],
  withdrawal: ["create", "update", "delete"],
  teacher: ["create", "update", "delete"],
  class: ["create", "update", "delete"],
};

export function isChatMutationAllowed(
  entity: string,
  operation: "create" | "update" | "delete",
): boolean {
  return ALLOWED_OPERATIONS[entity]?.includes(operation) ?? false;
}

/**
 * DB 컬럼 매핑: 사용자 친화적 필드명 → 실제 DB 컬럼명
 * teacher.subject → building, class.class_days → description
 */
const FIELD_TO_COLUMN: Record<string, Record<string, string>> = {
  teacher: { subject: "building" },
  class: { class_days: "description" },
};

// =============================================
// HMAC 서명 (Vercel 서버리스 환경용)
// =============================================

const PROPOSAL_TTL_MS = 5 * 60 * 1000; // 5분
const FUTURE_SKEW_MS = 30_000; // 서버 간 시계 오차 허용

function getSigningSecret(): string {
  const secret = env.CHAT_PROPOSAL_SIGNING_SECRET.trim();
  if (!secret) {
    throw new Error(
      "CHAT_PROPOSAL_SIGNING_SECRET 미설정 — 챗 제안 기능을 사용할 수 없습니다.",
    );
  }
  return secret;
}

export interface Proposal {
  entity: string;
  operation: "create" | "update" | "delete";
  targetId?: string;
  targetName: string;
  changes: Record<string, unknown>;
  currentData?: Record<string, unknown>;
  description: string;
  timestamp: number;
  signature: string;
}

/** 제안 데이터에 HMAC 서명 생성 */
export function signProposal(data: Omit<Proposal, "signature">): string {
  const payload = JSON.stringify({
    entity: data.entity,
    operation: data.operation,
    targetId: data.targetId,
    targetName: data.targetName,
    changes: data.changes,
    timestamp: data.timestamp,
  });
  return createHmac("sha256", getSigningSecret()).update(payload).digest("hex");
}

/** HMAC 서명 검증 */
export function verifyProposal(proposal: Proposal): { valid: boolean; error?: string } {
  const now = Date.now();
  if (proposal.timestamp > now + FUTURE_SKEW_MS) {
    return {
      valid: false,
      error: "제안 시각이 유효하지 않습니다. 다시 요청해주세요.",
    };
  }

  const age = now - proposal.timestamp;
  if (age > PROPOSAL_TTL_MS) {
    return { valid: false, error: "제안이 만료되었습니다 (5분 초과). 다시 요청해주세요." };
  }

  const expected = signProposal(proposal);
  const actualSignature = proposal.signature ?? "";
  const isHexSignature =
    actualSignature.length % 2 === 0 &&
    /^[0-9a-fA-F]+$/.test(actualSignature);
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = isHexSignature
    ? Buffer.from(actualSignature, "hex")
    : Buffer.alloc(0);
  const sigValid =
    expectedBuf.length === actualBuf.length &&
    expectedBuf.length > 0 &&
    timingSafeEqual(expectedBuf, actualBuf);

  if (!sigValid) {
    return { valid: false, error: "제안 데이터가 변조되었습니다." };
  }
  return { valid: true };
}

// =============================================
// 대상 레코드 조회
// =============================================

/**
 * 이름으로 대상 레코드 조회.
 * - 1건이면 반환
 * - 다건이면 동명이인 에러 (단, 같은 반이 아니면 최근 1건 반환)
 * - 0건이면 null
 */
export async function findTargetByName(entity: string, name: string): Promise<{ id: string; data: Record<string, unknown> } | null> {
  const db = createAdminClient();
  const table = TABLE_MAP[entity];
  if (!table) return null;

  const nameField = entity === "booking" ? "student_name" : "name";
  const orderField = entity === "consultation" ? "consult_date"
    : entity === "booking" ? "booking_date"
    : "created_at";

  const { data, error } = await db
    .from(table)
    .select("*")
    .eq(nameField, name)
    .order(orderField, { ascending: false })
    .limit(10);

  if (error || !data || data.length === 0) return null;

  // 1건이면 바로 반환
  if (data.length === 1) {
    return { id: data[0].id, data: data[0] as Record<string, unknown> };
  }

  // 다건: 동명이인 판단
  // consultation/booking은 같은 사람이 여러 건 가능 → 최근 1건
  if (entity === "consultation" || entity === "booking" || entity === "withdrawal") {
    return { id: data[0].id, data: data[0] as Record<string, unknown> };
  }

  // student/teacher/class: 같은 반(class_name)이면 진짜 동명이인 → 에러
  // 다른 반이면 허용 (고2/고3 2개반 수강 가능)
  if (entity === "student") {
    const classes = new Set(data.map((d: Record<string, unknown>) => d.class_name));
    if (classes.size < data.length) {
      // 같은 반에 동명이인 존재
      const classInfo = data.map((d: Record<string, unknown>) => `${d.class_name}반 (${d.grade})`).join(", ");
      throw new Error(`'${name}' 학생이 ${data.length}명 있습니다: ${classInfo}. 어떤 학생인지 반 이름을 포함해서 다시 요청해주세요.`);
    }
  }

  // teacher/class: 동명이인이면 에러
  if (entity === "teacher" || entity === "class") {
    if (data.length > 1) {
      const info = data.map((d: Record<string, unknown>) => {
        if (entity === "teacher") return `${d.name} (${d.phone || "전화번호 없음"})`;
        return `${d.name} (${d.target_grade || "학년 미설정"})`;
      }).join(", ");
      throw new Error(`'${name}'이(가) ${data.length}건 있습니다: ${info}. 어떤 것인지 더 구체적으로 알려주세요.`);
    }
  }

  // 기본: 최근 1건
  return { id: data[0].id, data: data[0] as Record<string, unknown> };
}

/** ID로 대상 레코드 조회 */
export async function findTargetById(entity: string, id: string): Promise<{ id: string; data: Record<string, unknown> } | null> {
  const db = createAdminClient();
  const table = TABLE_MAP[entity];
  if (!table) return null;

  const { data, error } = await db
    .from(table)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return { id: data.id, data: data as Record<string, unknown> };
}

// =============================================
// 제안 생성
// =============================================

export interface ProposalResult {
  proposal: Proposal;
  summary: string;
}

export async function createProposal(params: {
  entity: string;
  operation: "create" | "update" | "delete";
  targetName: string;
  targetId?: string;
  changes: Record<string, unknown>;
  reason: string;
}): Promise<ProposalResult> {
  const { entity, operation, targetName, targetId, changes, reason } = params;

  // 작업 허용 여부 확인
  if (!isChatMutationAllowed(entity, operation)) {
    const lifecycleHint =
      entity === "booking" || entity === "consultation"
        ? " 예약·상담의 취소·삭제·일정 변경은 해당 관리 화면에서 처리해주세요."
        : "";
    throw new Error(`${ENTITY_LABELS[entity] || entity}에 대한 ${OPERATION_LABELS[operation] || operation} 작업은 지원하지 않습니다.${lifecycleHint}`);
  }

  // 필드 화이트리스트 검증 — 비지원 필드는 에러로 알림 (silent drop 방지)
  const allowedFields = ALLOWED_FIELDS[entity] || [];
  const filteredChanges: Record<string, unknown> = {};
  const rejectedFields: string[] = [];
  for (const [key, value] of Object.entries(changes)) {
    if (allowedFields.includes(key)) {
      filteredChanges[key] = value;
    } else {
      rejectedFields.push(key);
    }
  }
  if (rejectedFields.length > 0) {
    throw new Error(`지원하지 않는 필드입니다: ${rejectedFields.join(", ")}. ${ENTITY_LABELS[entity] || entity}에서 사용 가능한 필드: ${allowedFields.join(", ")}`);
  }

  // 수정/삭제 시 대상 레코드 조회
  let currentData: Record<string, unknown> | undefined;
  let resolvedTargetId = targetId;

  if (operation !== "create") {
    const target = targetId
      ? await findTargetById(entity, targetId)
      : await findTargetByName(entity, targetName);

    if (!target) {
      throw new Error(`${ENTITY_LABELS[entity]} 데이터에서 '${targetName}'을(를) 찾을 수 없습니다.`);
    }

    resolvedTargetId = target.id;

    // 변경되는 필드의 현재 값만 추출 (DB 컬럼 매핑 고려)
    if (operation === "update") {
      currentData = {};
      const columnMap = FIELD_TO_COLUMN[entity] || {};
      for (const key of Object.keys(filteredChanges)) {
        const dbColumn = columnMap[key] || key;
        currentData[key] = target.data[dbColumn] ?? target.data[key];
      }
    } else {
      // 삭제: 주요 필드를 최대한 표시 (사용자가 확인할 수 있도록)
      const nameField = entity === "booking" ? "student_name" : "name";
      currentData = { [nameField]: target.data[nameField] };
      const showFields: Record<string, string[]> = {
        consultation: ["consult_date", "school", "grade", "subject", "status", "memo"],
        student: ["school", "grade", "class_name", "teacher_name", "phone"],
        booking: ["booking_date", "booking_hour", "branch", "phone"],
        withdrawal: ["school", "subject", "class_name", "teacher", "withdrawal_date"],
        teacher: ["phone", "building", "is_active"],
        class: ["target_grade", "class_time", "location", "is_active"],
      };
      for (const field of (showFields[entity] || [])) {
        if (target.data[field] != null && target.data[field] !== "") {
          const reverseMap = FIELD_TO_COLUMN[entity] || {};
          const displayKey = Object.entries(reverseMap).find(([, col]) => col === field)?.[0] || field;
          currentData[displayKey] = target.data[field];
        }
      }
    }
  }

  const timestamp = Date.now();
  const proposalData = {
    entity,
    operation: operation as "create" | "update" | "delete",
    targetId: resolvedTargetId,
    targetName,
    changes: operation === "delete" ? {} : filteredChanges,
    currentData,
    description: reason,
    timestamp,
  };

  const signature = signProposal(proposalData);
  const proposal: Proposal = { ...proposalData, signature };

  const entityLabel = ENTITY_LABELS[entity] || entity;
  const opLabel = OPERATION_LABELS[operation] || operation;
  const summary = `[${entityLabel} ${opLabel}] ${targetName} - ${reason}`;

  return { proposal, summary };
}

// =============================================
// 제안 실행
// =============================================

export async function executeMutation(proposal: Proposal): Promise<{ success: boolean; message: string }> {
  const { entity, operation, targetId, targetName, changes } = proposal;
  if (!isChatMutationAllowed(entity, operation)) {
    return {
      success: false,
      message:
        entity === "booking" || entity === "consultation"
          ? "예약·상담의 취소·삭제·일정 변경은 해당 관리 화면에서 처리해주세요."
          : "허용되지 않은 작업입니다.",
    };
  }
  const db = createAdminClient();
  const table = TABLE_MAP[entity];

  if (!table) {
    return { success: false, message: `알 수 없는 엔티티: ${entity}` };
  }

  try {
    // DB 컬럼 매핑 적용 (예: teacher.subject → building)
    const columnMap = FIELD_TO_COLUMN[entity] || {};
    const mappedChanges: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(changes)) {
      const dbColumn = columnMap[key] || key;
      mappedChanges[dbColumn] = value;
    }

    if (operation === "create") {
      const nameField = entity === "booking" ? "student_name" : "name";
      const insertData = { ...mappedChanges, [nameField]: targetName };

      if (entity === "teacher" && !insertData.role) {
        insertData.role = "teacher";
      }

      const { error } = await db.from(table).insert(insertData);
      if (error) {
        console.error(`[chat-execute] ${table} INSERT 실패:`, error.message);
        return { success: false, message: `등록 실패: ${error.message}` };
      }
      return { success: true, message: `${ENTITY_LABELS[entity]} '${targetName}' 등록이 완료되었습니다.` };
    }

    if (operation === "update") {
      if (!targetId) return { success: false, message: "수정 대상 ID가 없습니다." };

      const { data: check } = await db.from(table).select("id").eq("id", targetId).maybeSingle();
      if (!check) return { success: false, message: "수정 대상이 존재하지 않습니다. 이미 삭제되었을 수 있습니다." };

      const { error } = await db.from(table).update(mappedChanges).eq("id", targetId);
      if (error) {
        console.error(`[chat-execute] ${table} UPDATE 실패:`, error.message);
        return { success: false, message: `수정 실패: ${error.message}` };
      }
      return { success: true, message: `${ENTITY_LABELS[entity]} '${targetName}' 수정이 완료되었습니다.` };
    }

    if (operation === "delete") {
      if (!targetId) return { success: false, message: "삭제 대상 ID가 없습니다." };

      // 삭제 전 존재 + 이름 일치 확인
      const nameField = entity === "booking" ? "student_name" : "name";
      const { data: check } = await db.from(table).select(`id, ${nameField}`).eq("id", targetId).maybeSingle();
      if (!check) return { success: false, message: "삭제 대상이 존재하지 않습니다. 이미 삭제되었을 수 있습니다." };

      const checkName = (check as Record<string, unknown>)[nameField];
      if (checkName && String(checkName) !== targetName) {
        return { success: false, message: `삭제 대상 이름 불일치: DB='${checkName}', 요청='${targetName}'. 안전을 위해 삭제를 중단합니다.` };
      }

      const { error } = await db.from(table).delete().eq("id", targetId);
      if (error) {
        console.error(`[chat-execute] ${table} DELETE 실패:`, error.message);
        return { success: false, message: `삭제 실패: ${error.message}` };
      }
      return { success: true, message: `${ENTITY_LABELS[entity]} '${targetName}' 삭제가 완료되었습니다.` };
    }

    return { success: false, message: `알 수 없는 작업: ${operation}` };
  } catch (e) {
    console.error("[chat-execute] 예외:", e);
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return { success: false, message: `실행 중 오류: ${msg}` };
  }
}
