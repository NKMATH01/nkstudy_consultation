// 강사용 A4 1장 시트 (v2.3).
//
// ⚠️ 직원 전용, parent-safe를 거치지 않음 — 학부모 경로에 절대 연결 금지.
// teacherBrief·입학 상담 확인 질문·cautions·background는 parent-safe allowlist에서
// 명시적으로 제외된 값이다. 이 컴포넌트는 result_profile_v2 원본을 그대로 읽으므로
// 공유 토큰(/report/[token])·학부모 미리보기 어디에도 연결하면 안 된다.
//
// MBTI 4글자는 넣지 않는다(강사 합의) — 행동 문장만 남긴다.

import type { ResultProfileV2 } from "@/lib/assessment/v2/interpretation";
import type { CommonConstruct, Score } from "@/lib/assessment/v2/types";
import { GRADE_LABEL, gradeOf } from "@/lib/assessment/v2/scoring";
import { CONSTRUCT_LABEL, SUBJECT_LABEL, formatDate, isNum, pct } from "./report-theme";
import { SIGNAL_DESC, signalBandOf, type SignalBand } from "./signal-descriptions";
import {
  AVOID_LINE,
  GUIDANCE_PRESCRIPTION,
  MANAGEMENT_PRESCRIPTION,
} from "./teacher-guidance";
import type { CounselorBackground } from "./counselor-background";
import { TEACHER_SHEET_CSS } from "./teacher-sheet-css";

/** ① 지금 상태에 쓰는 여덟 학습행동(지도 방식 반응은 ④ 핵심 판단에서). */
const STATE_KEYS: CommonConstruct[] = [
  "learningAttitude",
  "homeworkReliability",
  "goalClarity",
  "shortTermRecovery",
  "managementAcceptance",
  "questionInitiative",
  "phoneBoundary",
  "peerFocusBoundary",
];

interface Props {
  profile: ResultProfileV2;
  header: { name: string; schoolGrade: string; createdAt?: string | null };
  /** 설문 raw 응답(호환용). v2.3 시트는 문항 문장을 싣지 않아 쓰지 않는다. */
  responses?: Record<string, unknown> | null;
  background?: CounselorBackground | null;
}

type WeakItem = { key: string; label: string; band: SignalBand; help: string };

/** 약점 후보: 공통 학습행동만 사용한다. 과목 공부 방식은 전체 우선순위에 섞지 않는다. */
function pickWeaknesses(profile: ResultProfileV2): WeakItem[] {
  const s = profile.scores;
  const pool: { key: CommonConstruct; label: string; score: Score }[] = STATE_KEYS.map((k) => ({
    key: k,
    label: CONSTRUCT_LABEL[k],
    score: s.common[k],
  }));

  const scored = pool.filter((p) => isNum(p.score));
  const ascending = [...scored].sort((a, b) => (a.score as number) - (b.score as number));
  const low = ascending.filter((p) => gradeOf(p.score) === "help");
  const picked = low.length > 0 ? low.slice(0, 2) : ascending.slice(0, 2);

  return picked.map((p) => {
    const band = (signalBandOf(p.score) ?? "mid") as SignalBand;
    return { key: p.key, label: p.label, band, help: SIGNAL_DESC[p.key][band].help };
  });
}

export function TeacherSheet({ profile, header, background }: Props) {
  const s = profile.scores;
  const i = profile.interpretation;
  const v = s.verdicts;

  const weaknesses = pickWeaknesses(profile);
  const todo = weaknesses[0]?.help ?? "첫 수업에서 문제를 시작하고 도움을 구하는 방식을 확인해 주세요.";
  const consultationQuestions = i.verificationPlan14Days.slice(0, 4);

  const review = s.responseQuality.status === "review";
  const callNote = background?.prevLeaveReason || background?.prevComplaint || null;
  const entryPriority = background?.entryPriority || background?.commitment14 || null;

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
                const grade = gradeOf(score);
                return (
                  <li key={k}>
                    <span className="tsheet__bar-label">{CONSTRUCT_LABEL[k]}</span>
                    <i className="tsheet__bar">
                      <b className={`is-${band ?? "none"}`} style={{ width: `${pct(score)}%` }} />
                    </i>
                    <span className="tsheet__bar-num">{grade ? GRADE_LABEL[grade] : "—"}</span>
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
            <h2>④ 핵심 판단</h2>
            <div className="tsheet__talk">
              <b>철저한 관리를 버틸 수 있는가 — {v?.management.verdict ?? "판정 보류"}</b>
              {v?.management.directAnswer && (
                <p className="tsheet__answer">
                  <span>본인 답</span>
                  {v.management.directAnswer}
                  {v.management.basisNote ? ` · ${v.management.basisNote}` : ""}
                </p>
              )}
              <p className="tsheet__do">
                <span>첫 달</span>
                {MANAGEMENT_PRESCRIPTION[v?.management.verdict ?? "판정 보류"]}
              </p>
            </div>
            <div className="tsheet__talk">
              <b>강하게 밀어도 되는가 — {v?.guidance.verdict ?? "판정 보류"}</b>
              {v?.guidance.choiceText && (
                <p className="tsheet__answer">
                  <span>고른 선생님</span>
                  {v.guidance.choiceText}
                  {v.guidance.confirmInCounseling ? " · 응답과 갈려 상담에서 확인" : ""}
                </p>
              )}
              <p className="tsheet__do">
                <span>첫 수업</span>
                {GUIDANCE_PRESCRIPTION[v?.guidance.verdict ?? "판정 보류"]}
              </p>
            </div>
            {entryPriority && (
              <div className="tsheet__talk">
                <b>학생이 가장 도움받고 싶은 점</b>
                <p className="tsheet__answer">
                  <span>본인 글</span>
                  {entryPriority}
                </p>
              </div>
            )}
          </section>

          <section className="tsheet__box">
            <h2>⑤ 입학 상담 확인</h2>
            <ul className="tsheet__checks">
              {consultationQuestions.map((question, index) => (
                <li key={`${index}-${question}`}>
                  <span className="tsheet__checkbox" aria-hidden>
                    ☐
                  </span>
                  <span className="tsheet__check-body">
                    <b>확인 질문 {index + 1}</b>
                    <i>{question}</i>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section className="tsheet__box tsheet__caution">
        <h2>③ 주의</h2>
        <ul>
          {review ? (
            <li>
              응답이 한쪽으로 치우쳐 있습니다. 입학 상담과 첫 수업에서 문항 뜻과 실제 경험을 다시 확인해 주세요.
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
