import type { Registration } from "@/types";

export const REGISTRATION_GUIDE_TEMPLATE_CODE = "registration_guide";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

const orDash = (v: string): string => (v && v.trim() ? v : "-");

function fmtDate(ds: string | null): string {
  if (!ds) return "";
  const d = new Date(ds + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}(${DAY_NAMES[d.getDay()]})`;
}

/** 과목 구성에 따라 배정 반 문자열을 만든다. 수학2가 있으면 수학 쪽에 함께 묶는다. */
function classLine(r: Registration): string {
  const mathParts = [r.assigned_class, r.assigned_class_math2].filter(
    (v): v is string => !!v && v.trim().length > 0,
  );
  const engClass = r.assigned_class_2?.trim() || "";

  if (r.subject === "영어수학") {
    const math = mathParts.length > 0 ? `수학 ${mathParts.join(", ")}` : "";
    const eng = engClass ? `영어 ${engClass}` : "";
    return [math, eng].filter(Boolean).join(" / ");
  }
  if (r.subject === "영어") return engClass;
  return mathParts.join(", ");
}

/** 담당 선생님도 과목 구성에 맞춰 묶는다. */
function teacherLine(r: Registration): string {
  const mathTeachers = [r.teacher, r.teacher_math2].filter(
    (v): v is string => !!v && v.trim().length > 0,
  );
  const engTeacher = r.teacher_2?.trim() || "";

  if (r.subject === "영어수학") {
    const math = mathTeachers.length > 0 ? `수학 ${mathTeachers.join(", ")}` : "";
    const eng = engTeacher ? `영어 ${engTeacher}` : "";
    return [math, eng].filter(Boolean).join(" / ");
  }
  if (r.subject === "영어") return engTeacher;
  return mathTeachers.join(", ");
}

export function buildRegistrationGuideVars(
  registration: Registration,
  token: string,
): Record<string, string> {
  return {
    이름: orDash(registration.name),
    등록일: orDash(fmtDate(registration.registration_date)),
    반: orDash(classLine(registration)),
    담당: orDash(teacherLine(registration)),
    토큰: orDash(token),
  };
}
