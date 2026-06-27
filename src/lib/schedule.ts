// 반 시간표 표시용 공유 포매터 (읽기 전용).
// 저장 형식은 class-form-client.tsx의 serializeSets와 동일:
//   class_days:  "화목|토"            (세트는 |, 요일은 연속 문자)
//   class_time:  "17:30~19:00|11:30~13:00"  (세트별 수업 시간, 빈 칸 가능)
//   clinic_time: 동일 형식 (선택)

export interface ScheduleSegment {
  days: string;        // 예: "화목"
  classTime: string;   // 예: "17:30~19:00" (없으면 "")
  clinicTime: string;  // 예: "20:30~22:00" (없으면 "")
}

export interface FormattedSchedule {
  segments: ScheduleSegment[];
  /** 한 줄 요약: "화목 17:30~19:00 · 토 11:30~13:00" */
  text: string;
}

function splitSets(value: string | null | undefined): string[] {
  return (value ?? "").split("|").map((s) => s.trim());
}

export function formatSchedule(
  classDays: string | null | undefined,
  classTime: string | null | undefined,
  clinicTime?: string | null | undefined
): FormattedSchedule {
  const dayParts = splitSets(classDays).filter((d) => d.length > 0);
  if (dayParts.length === 0) {
    return { segments: [], text: "" };
  }

  const timeParts = splitSets(classTime);
  const clinicParts = splitSets(clinicTime);

  const segments: ScheduleSegment[] = dayParts.map((days, i) => ({
    days,
    classTime: timeParts[i] && timeParts[i].includes("~") ? timeParts[i] : "",
    clinicTime: clinicParts[i] && clinicParts[i].includes("~") ? clinicParts[i] : "",
  }));

  const text = segments
    .map((seg) => (seg.classTime ? `${seg.days} ${seg.classTime}` : seg.days))
    .join(" · ");

  return { segments, text };
}
