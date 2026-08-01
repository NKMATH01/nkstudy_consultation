// 강사용 A4 1장 시트.
//
// ⚠️ 직원 전용, parent-safe를 거치지 않음 — 학부모 경로에 절대 연결 금지.
// teacherBrief·verificationPlan14Days·cautions·background는 parent-safe allowlist에서
// 명시적으로 제외된 값이다. 이 컴포넌트는 result_profile_v2 원본을 그대로 읽으므로
// 공유 토큰(/report/[token])·학부모 미리보기 어디에도 연결하면 안 된다.
//
// MBTI 4글자는 넣지 않는다(강사 합의) — 행동 문장만 남긴다.

import type { ResultProfileV2 } from "@/lib/assessment/v2/interpretation";
import type { CommonScores, Score } from "@/lib/assessment/v2/types";
import { ALL_ITEMS, isLikert } from "@/lib/assessment/v2/definition";
import { ITEMS_BY_CONSTRUCT } from "@/lib/assessment/v2/construct-guide";
import { SCALE_LABELS_V2 } from "@/lib/assessment/v2/display";
import {
  FIRST14_RESULT_LABEL,
  mapPlanToRows,
  type First14Result,
} from "@/lib/assessment/v2/first14";
import { CONSTRUCT_LABEL, SUBJECT_LABEL, formatDate, isNum, pct } from "./report-theme";
import { SIGNAL_DESC, SUBJECT_SIGNAL_DESC, signalBandOf, type SignalBand } from "./signal-descriptions";
import { AVOID_LINE, TALK_PRESCRIPTION, TALK_PRESCRIPTION_UNKNOWN } from "./teacher-guidance";
import type { CounselorBackground } from "./counselor-report";
import { TEACHER_SHEET_CSS } from "./teacher-sheet-css";

/** ① 지금 상태에 쓰는 5축. 학부모 결과지 00 요약과 같은 축이다. */
const STATE_KEYS: (keyof CommonScores)[] = [
  "learningAttitude",
  "homeworkReliability",
  "phoneBoundary",
  "longTermPersistence",
  "shortTermRecovery",
];

/** ④ 말 거는 방식에 쓰는 구인. */
const TALK_KEYS: (keyof CommonScores)[] = [
  "directFeedbackAcceptance",
  "relationshipSafetyNeed",
  "autonomyNeed",
];

export interface TeacherSheetCheck {
  itemIndex: number;
  result: First14Result;
  teacher: string;
  note?: string | null;
}

interface Props {
  profile: ResultProfileV2;
  header: { name: string; schoolGrade: string; createdAt?: string | null };
  /** 설문 raw 응답. ④에서 점수 대신 학생이 고른 보기를 보여 주는 데 쓴다. */
  responses?: Record<string, unknown> | null;
  background?: CounselorBackground | null;
  /** 저장된 14일 확인 결과. 없으면 빈 체크박스로 표시한다. */
  checks?: TeacherSheetCheck[];
}

type WeakItem = { key: string; label: string; band: SignalBand; help: string };

/** 약점 후보: 공통 5축 + 선택 과목 학습전략. 학부모 결과지와 같은 기준(45 미만)을 쓴다. */
function pickWeaknesses(profile: ResultProfileV2): WeakItem[] {
  const s = profile.scores;
  const pool: { key: string; label: string; score: Score; desc: Record<SignalBand, { help: string }> }[] =
    STATE_KEYS.map((k) => ({
      key: k,
      label: CONSTRUCT_LABEL[k],
      score: s.common[k],
      desc: SIGNAL_DESC[k],
    }));

  if (s.math) {
    pool.push({
      key: "mathStrategy",
      label: "수학 학습전략",
      score: s.math.mathStrategy,
      desc: SUBJECT_SIGNAL_DESC.math,
    });
  }
  if (s.english) {
    pool.push({
      key: "englishStrategy",
      label: "영어 학습전략",
      score: s.english.englishStrategy,
      desc: SUBJECT_SIGNAL_DESC.english,
    });
  }

  const scored = pool.filter((p) => isNum(p.score));
  const ascending = [...scored].sort((a, b) => (a.score as number) - (b.score as number));
  const low = ascending.filter((p) => (p.score as number) < 45);
  const picked = low.length > 0 ? low.slice(0, 2) : ascending.slice(0, 2);

  return picked.map((p) => {
    const band = (signalBandOf(p.score) ?? "mid") as SignalBand;
    return { key: p.key, label: p.label, band, help: p.desc[band].help };
  });
}

/** 그 구인을 재는 문항들의 "근거 라벨 → 학생이 고른 보기". 점수는 만들지 않는다. */
function responseLabels(
  constructKey: string,
  responses: Record<string, unknown> | null | undefined,
): { evidenceLabel: string; answer: string }[] {
  if (!responses) return [];
  const ids = ITEMS_BY_CONSTRUCT[constructKey] ?? [];
  const out: { evidenceLabel: string; answer: string }[] = [];

  for (const id of ids) {
    const item = ALL_ITEMS.find((it) => it.id === id);
    if (!item || !isLikert(item)) continue;
    const value = responses[id];
    if (typeof value !== "number" || value < 1 || value > 5) continue;
    out.push({
      evidenceLabel: item.evidenceLabel,
      answer: SCALE_LABELS_V2[item.scale][value - 1],
    });
  }
  return out;
}

export function TeacherSheet({ profile, header, responses, background, checks }: Props) {
  const s = profile.scores;
  const i = profile.interpretation;

  const weaknesses = pickWeaknesses(profile);
  const todo = weaknesses[0]?.help ?? "첫 2주 동안 수업 안 행동을 직접 보고 기록해 주세요.";
  const rows = mapPlanToRows(i.verificationPlan14Days);
  const checkByIndex = new Map((checks ?? []).map((c) => [c.itemIndex, c]));

  const review = s.responseQuality.status === "review";
  const callNote = background?.prevLeaveReason || background?.prevComplaint || null;

  const meta = [header.schoolGrade, SUBJECT_LABEL[profile.subjectSelection], formatDate(profile.generatedAt)]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="tsheet">
      <style dangerouslySetInnerHTML={{ __html: TEACHER_SHEET_CSS }} />

      <header className="tsheet__head">
        <h1>
          {header.name} <em>강사용 한 장</em>
        </h1>
        <span className="tsheet__meta">{meta}</span>
      </header>

      <section className="tsheet__todo">
        <b>오늘 할 것 하나</b>
        <p>{todo}</p>
      </section>

      <div className="tsheet__grid">
        <div className="tsheet__col">
          <section className="tsheet__box">
            <h2>① 지금 상태</h2>
            <ul className="tsheet__bars">
              {STATE_KEYS.map((k) => {
                const score = s.common[k];
                const band = signalBandOf(score);
                return (
                  <li key={k}>
                    <span className="tsheet__bar-label">{CONSTRUCT_LABEL[k]}</span>
                    <i className="tsheet__bar">
                      <b className={`is-${band ?? "none"}`} style={{ width: `${pct(score)}%` }} />
                    </i>
                    <span className="tsheet__bar-num">
                      {isNum(score) ? Math.round(score) : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="tsheet__box">
            <h2>② 먼저 도울 것</h2>
            {weaknesses.map((w) => (
              <div key={w.key} className="tsheet__weak">
                <b>{w.label}</b>
                <p className="tsheet__avoid">
                  <span>하지 말 것</span>
                  {AVOID_LINE[w.key] ?? "첫 대응을 서두르지 말고 한 주간 관찰부터 하세요."}
                </p>
                <p className="tsheet__do">
                  <span>할 것</span>
                  {w.help}
                </p>
              </div>
            ))}
          </section>
        </div>

        <div className="tsheet__col">
          <section className="tsheet__box">
            <h2>④ 말 거는 방식</h2>
            {TALK_KEYS.map((k) => {
              const band = signalBandOf(s.common[k]);
              const answers = responseLabels(k, responses);
              const prescription = band
                ? (TALK_PRESCRIPTION[k]?.[band] ?? TALK_PRESCRIPTION_UNKNOWN)
                : TALK_PRESCRIPTION_UNKNOWN;
              return (
                <div key={k} className="tsheet__talk">
                  <b>{CONSTRUCT_LABEL[k]}</b>
                  {answers.length > 0 && (
                    <p className="tsheet__answer">
                      <span>본인 응답</span>
                      {answers.map((a) => `${a.evidenceLabel}: ${a.answer}`).join(" / ")}
                    </p>
                  )}
                  <p className="tsheet__do">
                    <span>첫 수업</span>
                    {prescription}
                  </p>
                </div>
              );
            })}
          </section>

          <section className="tsheet__box">
            <h2>⑤ 2주 뒤 확인</h2>
            <ul className="tsheet__checks">
              {rows.map((row) => {
                const saved = checkByIndex.get(row.index);
                return (
                  <li key={row.index}>
                    <span className="tsheet__checkbox" aria-hidden>
                      {saved ? "☑" : "☐"}
                    </span>
                    <span className="tsheet__check-body">
                      <b>{row.title}</b>
                      <i>{row.hint ?? row.fallback}</i>
                      {saved && (
                        <em className={`tsheet__result is-${saved.result}`}>
                          {FIRST14_RESULT_LABEL[saved.result]} · {saved.teacher}
                        </em>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>

      <section className="tsheet__box tsheet__caution">
        <h2>③ 주의</h2>
        <ul>
          {/*
            review일 때 해석의 cautions도 같은 말을 반복한다(둘 다 응답 치우침을 근거로 만들어진다).
            A4 한 장에서 같은 문장을 두 번 읽게 하지 않으려고 한쪽만 남긴다.
          */}
          {review ? (
            <li>
              응답이 한쪽으로 치우쳐 있습니다. 지금 점수는 확정이 아니라 첫 2주에 직접 확인할 값입니다.
            </li>
          ) : (
            i.cautions.slice(0, 1).map((c) => <li key={c}>{c}</li>)
          )}
          {callNote && <li>학부모 첫 통화: 이전 학원 이야기가 남아 있습니다 — &ldquo;{callNote}&rdquo;</li>}
          {!review && !callNote && i.cautions.length === 0 && (
            <li>특별히 먼저 챙길 주의사항은 없습니다.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
