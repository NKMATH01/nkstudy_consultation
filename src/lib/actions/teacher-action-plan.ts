"use server";

// 강사별 AI 조치 계획 생성. 저장하지 않고 매번 새로 만든다(재생성 가능).
//
// 이 화면은 principal/admin 전용이지만 서버 액션은 직접 호출될 수 있으므로
// 여기서 role을 다시 확인한다(RLS 교체 전까지 이 게이트가 주 방어선).

import { createClient } from "@/lib/supabase/server";
import { getCurrentTeacher } from "@/lib/actions/settings";
import { canViewRestrictedAnalytics } from "@/lib/menu-sectors";
import { callGeminiAPI, extractJSON } from "@/lib/gemini";
import {
  groupWithdrawalEvents,
  isGraduatingGrade,
  TENURE_BAND_LABEL,
} from "@/lib/withdrawal-insight/events";
import {
  detectSignals,
  hasThinSummary,
  SIGNAL_LABEL,
  SOURCE_FIELD_LABEL,
  SIGNAL_SOURCE_FIELDS,
} from "@/lib/withdrawal-insight/signals";
import type { Withdrawal } from "@/types";

export type ActionTimeframe = "이번 주" | "2주 내" | "이번 달";

export interface TeacherActionPlan {
  situationSummary: string;
  likelyFactors: Array<{ factor: string; evidence: string }>;
  actions: Array<{
    title: string;
    detail: string;
    timeframe: ActionTimeframe;
    checkMetric: string;
  }>;
  positiveNotes: string[];
}

type Result =
  | { success: true; data: TeacherActionPlan }
  | { success: false; error: string };

/** 원문을 프롬프트에 넣을 때 과도한 길이를 자른다. */
function clip(text: string, max = 220): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export async function generateTeacherActionPlan(teacherName: string): Promise<Result> {
  try {
    const currentTeacher = await getCurrentTeacher();
    if (!canViewRestrictedAnalytics(currentTeacher?.role)) {
      return { success: false, error: "권한이 없습니다" };
    }

    const name = teacherName.trim();
    if (!name) return { success: false, error: "강사명이 필요합니다" };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("teacher", name);

    if (error) {
      console.error("[조치계획] 퇴원 조회 실패", { name, message: error.message });
      return { success: false, error: error.message };
    }

    const events = groupWithdrawalEvents((data ?? []) as Withdrawal[]);
    if (events.length === 0) {
      return { success: false, error: "해당 담당의 퇴원 기록이 없습니다" };
    }

    const lines: string[] = [];
    let graduatingCount = 0;
    let recordGap = 0;

    for (const e of events) {
      const row = e.row;
      const graduating = isGraduatingGrade(row.grade);
      if (graduating) graduatingCount += 1;
      if (!row.final_consult_date?.trim() || hasThinSummary(row)) recordGap += 1;

      const topics = detectSignals(row).topics.map((t) => SIGNAL_LABEL[t]);
      const opinions = SIGNAL_SOURCE_FIELDS.map((f) => {
        const v = (row[f] ?? "").trim();
        return v ? `${SOURCE_FIELD_LABEL[f]}: ${clip(v)}` : null;
      }).filter(Boolean);

      lines.push(
        [
          `- ${row.withdrawal_date ?? "날짜미상"} / 재원 ${TENURE_BAND_LABEL[e.tenureBand]}`,
          graduating ? " / [고3]" : "",
          topics.length ? ` / 신호: ${topics.join(",")}` : "",
          opinions.length ? `\n    ${opinions.join("\n    ")}` : "\n    (기록된 서술 없음)",
        ].join(""),
      );
    }

    const prompt = `당신은 학원 운영 코치입니다. 아래는 한 담당 강사의 퇴원 기록입니다.
원장이 이 담당과 나눌 대화와 실행 항목을 준비하도록 도와주세요.

# 반드시 지킬 것
1. 퇴원율·비율·순위·점수·등급을 만들지 마세요. 다른 강사와 비교하지 마세요.
2. 낙인이나 단정("역량 부족", "문제 강사")을 쓰지 마세요. 아래 기록에 있는 사실만 인용하세요.
3. [고3] 표시 사건은 수능·졸업에 따른 자연 이탈일 수 있으니 원인 판단에 약하게만 반영하세요.
4. 기록이 얇으면(서술 없음·요약 짧음) 원인을 추측하지 말고 "기록 보완"을 우선 제안하세요.
5. 어투는 실행 지시형("~하세요", "~검토하세요")으로 씁니다.

# 담당 정보
- 담당: ${name} 선생님
- 전체 사건 ${events.length}건 (그중 고3 ${graduatingCount}건)
- 상담일 미기록 또는 요약 30자 미만: ${recordGap}건

# 퇴원 사건 기록
${lines.join("\n")}

# 출력 형식 (JSON만, 다른 텍스트 금지)
{
  "situationSummary": "2~3문장. 기록에서 드러나는 상황을 사실 위주로 요약",
  "likelyFactors": [
    {"factor": "추정 요인", "evidence": "위 기록에서 인용한 근거"}
  ],
  "actions": [
    {"title": "행동 제목", "detail": "구체적으로 무엇을 할지 1~2문장", "timeframe": "이번 주" 또는 "2주 내" 또는 "이번 달", "checkMetric": "무엇으로 효과를 확인할지"}
  ],
  "positiveNotes": ["기록에서 확인되는 잘하고 있는 점(없으면 빈 배열)"]
}
likelyFactors는 2~4개, actions는 3~5개로 만드세요.`;

    let parsed: TeacherActionPlan;
    try {
      const response = await callGeminiAPI(prompt);
      parsed = extractJSON<TeacherActionPlan>(response);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI 호출 실패";
      console.error("[조치계획] AI 호출 실패", { name, message: msg });
      return { success: false, error: `AI 조치 계획 생성 실패: ${msg}` };
    }

    // AI 응답 형태를 신뢰하지 않고 최소한으로 정규화한다.
    const allowed: ActionTimeframe[] = ["이번 주", "2주 내", "이번 달"];
    return {
      success: true,
      data: {
        situationSummary: String(parsed.situationSummary ?? ""),
        likelyFactors: Array.isArray(parsed.likelyFactors)
          ? parsed.likelyFactors.slice(0, 4).map((f) => ({
              factor: String(f?.factor ?? ""),
              evidence: String(f?.evidence ?? ""),
            }))
          : [],
        actions: Array.isArray(parsed.actions)
          ? parsed.actions.slice(0, 5).map((a) => ({
              title: String(a?.title ?? ""),
              detail: String(a?.detail ?? ""),
              timeframe: allowed.includes(a?.timeframe) ? a.timeframe : "이번 달",
              checkMetric: String(a?.checkMetric ?? ""),
            }))
          : [],
        positiveNotes: Array.isArray(parsed.positiveNotes)
          ? parsed.positiveNotes.map((n) => String(n))
          : [],
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "조치 계획 생성 실패";
    console.error("[조치계획] 예외", { teacherName, message: msg });
    return { success: false, error: msg };
  }
}
