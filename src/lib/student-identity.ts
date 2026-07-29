export interface StudentIdentityRecord {
  id: string;
  name: string;
  phone: string | null;
  parent_phone: string | null;
}

export interface ConsultationIdentityRecord {
  id: string;
  name: string;
  parent_phone: string | null;
  registration_id: string | null;
}

export interface SurveyConsultationIdentityRecord {
  id: string;
  name: string;
  parent_phone: string | null;
  analysis_id: string | null;
}

export type IdentitySelection<T> =
  | { kind: "existing"; record: T }
  | { kind: "new" }
  | { kind: "ambiguous"; records: T[] };

export function normalizeIdentityPhone(value?: string | null): string {
  if (!value) return "";
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("82")) digits = `0${digits.slice(2)}`;
  return digits;
}

export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function numericSuffixBase(name: string): string {
  return name.trim().replace(/\(\d+\)\s*$/, "").trim();
}

function isStudentNameVariant(candidateName: string, baseName: string): boolean {
  return numericSuffixBase(candidateName) === baseName.trim();
}

function isConsultationNameVariant(candidateName: string, baseName: string): boolean {
  const candidate = candidateName.trim();
  const base = baseName.trim();
  return candidate === base || candidate.startsWith(`${base}(`);
}

export function selectStudentIdentity(
  candidates: StudentIdentityRecord[],
  identity: { name: string; studentPhone?: string | null; parentPhone?: string | null },
): IdentitySelection<StudentIdentityRecord> {
  const studentPhone = normalizeIdentityPhone(identity.studentPhone);
  const parentPhone = normalizeIdentityPhone(identity.parentPhone);

  // 연락처 근거 없이 이름만 같은 학생을 갱신하면 동명이인을 덮어쓸 수 있다.
  if (!studentPhone && !parentPhone) return { kind: "new" };

  const matches = candidates.filter((candidate) => {
    if (!isStudentNameVariant(candidate.name, identity.name)) return false;
    const sameStudentPhone =
      Boolean(studentPhone) && normalizeIdentityPhone(candidate.phone) === studentPhone;
    const sameParentPhone =
      Boolean(parentPhone) && normalizeIdentityPhone(candidate.parent_phone) === parentPhone;
    return sameStudentPhone || sameParentPhone;
  });

  if (matches.length === 1) return { kind: "existing", record: matches[0] };
  if (matches.length > 1) return { kind: "ambiguous", records: matches };
  return { kind: "new" };
}

export function nextStudentDisplayName(
  baseName: string,
  candidates: Pick<StudentIdentityRecord, "name">[],
): string {
  const base = baseName.trim();
  const usedNames = new Set(
    candidates
      .map((candidate) => candidate.name.trim())
      .filter((name) => isStudentNameVariant(name, base)),
  );

  if (!usedNames.has(base)) return base;

  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}(${suffix})`;
    if (!usedNames.has(candidate)) return candidate;
  }
}

export function selectConsultationIdentity(
  candidates: ConsultationIdentityRecord[],
  identity: { name: string; parentPhone?: string | null },
): IdentitySelection<ConsultationIdentityRecord> {
  const parentPhone = normalizeIdentityPhone(identity.parentPhone);
  if (!parentPhone) return { kind: "new" };

  const matches = candidates.filter(
    (candidate) =>
      !candidate.registration_id &&
      isConsultationNameVariant(candidate.name, identity.name) &&
      normalizeIdentityPhone(candidate.parent_phone) === parentPhone,
  );

  if (matches.length === 1) return { kind: "existing", record: matches[0] };
  if (matches.length > 1) return { kind: "ambiguous", records: matches };
  return { kind: "new" };
}

/**
 * 설문/분석 화면에서 사용할 상담을 고른다.
 *
 * **candidates는 최신 상담이 앞에 오도록 정렬돼 있어야 한다**(consult_date desc 등).
 * 이 함수는 정렬을 하지 않고 호출자가 넘긴 순서를 그대로 신뢰한다.
 *
 * 재상담은 정상 업무 흐름이라, 같은 학생에게 몇 달 뒤 새 상담 행이 생긴다.
 * 분석 ID 일치를 절대 우선하면 화면의 상태 표시·변경이 분석이 스탬프된 옛 상담에
 * 영원히 묶이므로, 분석 ID 일치와 연락처 일치를 하나의 "강한 일치" 집합으로 보고
 * 그 중 가장 최신(목록 앞) 상담을 고른다.
 *
 * 강한 식별자(분석 ID·연락처)가 주어졌는데 강한 일치가 하나도 없으면,
 * 이름만 같은 동명이인으로 후퇴하지 않고 null을 반환한다.
 */
export function selectSurveyConsultation<
  T extends SurveyConsultationIdentityRecord,
>(
  candidates: T[],
  identity: {
    name: string;
    parentPhone?: string | null;
    analysisId?: string | null;
  },
  options: { allowNameFallback?: boolean } = {},
): T | null {
  const analysisId = identity.analysisId?.trim() ?? "";
  const parentPhone = normalizeIdentityPhone(identity.parentPhone);
  const nameMatches = candidates.filter((candidate) =>
    isConsultationNameVariant(candidate.name, identity.name),
  );

  const strongMatches = nameMatches.filter((candidate) => {
    const sameAnalysis =
      Boolean(analysisId) && candidate.analysis_id === analysisId;
    const sameParentPhone =
      Boolean(parentPhone) &&
      normalizeIdentityPhone(candidate.parent_phone) === parentPhone;
    return sameAnalysis || sameParentPhone;
  });

  if (strongMatches.length > 0) return strongMatches[0];

  if (analysisId || parentPhone || options.allowNameFallback === false) {
    return null;
  }

  return nameMatches[0] ?? null;
}

/**
 * FK stamping처럼 오연결을 허용할 수 없는 경로에서 사용할 유일 매칭이다.
 * 분석 ID와 학부모 연락처 중 하나라도 일치하는 후보가 정확히 한 건일 때만 반환한다.
 * 강한 식별자가 없거나 복수 후보가 잡히면 이름만으로 추정하지 않는다.
 */
export function selectUniqueSurveyConsultation<
  T extends SurveyConsultationIdentityRecord,
>(
  candidates: T[],
  identity: {
    name: string;
    parentPhone?: string | null;
    analysisId?: string | null;
  },
): T | null {
  const analysisId = identity.analysisId?.trim() ?? "";
  const parentPhone = normalizeIdentityPhone(identity.parentPhone);
  if (!analysisId && !parentPhone) return null;

  const matches = candidates.filter((candidate) => {
    if (!isConsultationNameVariant(candidate.name, identity.name)) return false;
    const sameAnalysis =
      Boolean(analysisId) && candidate.analysis_id === analysisId;
    const sameParentPhone =
      Boolean(parentPhone) &&
      normalizeIdentityPhone(candidate.parent_phone) === parentPhone;
    return sameAnalysis || sameParentPhone;
  });

  return matches.length === 1 ? matches[0] : null;
}
