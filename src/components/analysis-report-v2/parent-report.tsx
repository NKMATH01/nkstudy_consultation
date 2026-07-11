// 학부모 공유용 V2 결과 보고서. parent-safe snapshot만 렌더한다(화이트 톤·쉬운 우리말).
// 4차 재설계: 설문 점수 echo(전 항목 막대 나열)를 제거하고, 전문가의 "선별된 종합 분석"으로 재구성.
// 종합 분석 → 강점 → 도와줄 부분 → 학습 신호(레이더 1개) → 과목 이야기 → NK 지도 계획 → 읽는 안내.
// parent-safe payload(allowlist)는 그대로 두고 렌더만 선별한다(§12.3, 기존 공유 snapshot 호환).
// 상담자용(counselor-report)·공용 컴포넌트·점수 로직은 변경하지 않는다.

import type { ParentSafeProfile } from "@/lib/assessment/v2/parent-safe";
import type { CommonScores, Score } from "@/lib/assessment/v2/types";
import { CONSTRUCT_LABEL, SUBJECT_LABEL, formatDate, isNum, pct } from "./report-theme";
import { ReportSection } from "./report-frame";
import { CoreSignalsRadar } from "./report-ui";
import { CautionFooter, RoadmapLine, VerifyLine } from "./report-sections";

function firstSentence(text: string): string {
  const m = text.split(/(?<=[.!?。])\s+/)[0];
  return m && m.trim() ? m.trim() : text;
}

// 규칙 기반(fallback) 강점/개선 문자열은 "라벨: 설명 (점수점)" 꼴 → 앞부분을 소제목으로.
// AI 생성 자유 문장(콜론 없음)은 통째로 설명으로 렌더한다.
function splitInsight(text: string): { head: string | null; body: string } {
  const idx = text.indexOf(":");
  if (idx > 0 && idx < 24) {
    return { head: text.slice(0, idx).trim(), body: text.slice(idx + 1).trim() };
  }
  return { head: null, body: text };
}

function InsightCards({ items, tone }: { items: string[]; tone: "strength" | "growth" }) {
  const shown = items.slice(0, 3);
  return (
    <div className={`insight-cards${tone === "growth" ? " is-growth" : ""}`}>
      {shown.map((t, i) => {
        const { head, body } = splitInsight(t);
        return (
          <article key={i}>
            <span className="insight-cards__idx">{String(i + 1).padStart(2, "0")}</span>
            <div>
              {head && <strong>{head}</strong>}
              <p>{body}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

const RADAR_KEYS: (keyof CommonScores)[] = [
  "learningAttitude",
  "homeworkReliability",
  "phoneBoundary",
  "longTermPersistence",
  "shortTermRecovery",
  "peerLearningResource",
];

// ── 항목별 분석: 점수 구간(밴드)별 결정론적 특징 해설 ────────────────────────
// 모든 common 점수는 높을수록 안정적(§8.1). 밴드: high≥65 / mid 45~64 / low<45.
type Band = "high" | "mid" | "low";
const BAND_LABEL: Record<Band, string> = { high: "안정적", mid: "보통", low: "먼저 도와줄 부분" };

function bandOf(score: Score): Band | null {
  if (!isNum(score)) return null;
  if (score >= 65) return "high";
  if (score >= 45) return "mid";
  return "low";
}

// 항목 × 밴드별 구체적 행동 특징(1~2문장). 단순 밴드 문구 반복이 아니라 구간별 서술.
const ITEM_DESC: Record<string, Record<Band, string>> = {
  learningAttitude: {
    high: "수업에 집중해 들어오고 중요한 내용을 스스로 챙겨요. 선생님 설명이 그대로 공부 자료가 됩니다.",
    mid: "수업은 대체로 따라오지만 아는 내용이 반복되면 집중이 흔들리는 날이 있어요. 짧은 질문으로 참여를 이어 주면 좋습니다.",
    low: "수업 집중이 자주 끊겨요. 설명을 시켜 보거나 확인 질문을 자주 던지면 참여가 살아납니다.",
  },
  homeworkReliability: {
    high: "숙제를 기한 안에 해오는 습관이 잘 잡혀 있어요. 시작을 미루는 날이 드뭅니다.",
    mid: "숙제는 하지만 마감에 몰아서 하는 편이에요. 시작 시각을 정해 주면 흐름이 안정됩니다.",
    low: "숙제 시작을 자주 미뤄요. 양을 늘리기보다 시작 시각을 함께 정하는 것이 먼저입니다.",
  },
  phoneBoundary: {
    high: "공부할 때 휴대폰을 스스로 정리하는 편이에요. 집중을 크게 방해받지 않습니다.",
    mid: "휴대폰이 곁에 있으면 가끔 집중이 흔들려요. 시작 전에 눈에서 치우면 도움이 됩니다.",
    low: "공부를 시작할 때 휴대폰을 자동으로 확인하는 습관이 있어요. 처음에는 옆에서 정리를 도와주면 좋습니다.",
  },
  longTermPersistence: {
    high: "목표를 향해 꾸준히 버티는 힘이 좋아요. 세운 계획을 오래 이어 갑니다.",
    mid: "목표는 뚜렷하지만 중간에 흐트러질 때가 있어요. 주간 점검이 버팀목이 됩니다.",
    low: "목표를 오래 유지하기 어려워해요. 큰 목표를 짧게 쪼개 주면 끝까지 가기 쉬워집니다.",
  },
  shortTermRecovery: {
    high: "점수가 낮거나 문제가 막혀도 금방 다시 시작해요. 회복 탄력이 좋습니다.",
    mid: "실수한 뒤 다시 시작하기까지 시간이 조금 걸려요. 무엇부터 할지 정해 주면 빨라집니다.",
    low: "막히거나 틀린 뒤 오래 멈춰 있는 편이에요. 바로 다음 한 걸음을 함께 정해 주는 것이 중요합니다.",
  },
  peerLearningResource: {
    high: "친구와 함께 공부하는 것이 서로에게 힘이 되는 편이에요. 좋은 자극을 주고받습니다.",
    mid: "친구의 영향이 상황에 따라 달라요. 짝 확인 시간과 혼자 집중 시간을 나눠 주면 좋습니다.",
    low: "아직 친구가 공부에 큰 힘이 되지는 않아요. 혼자 집중할 수 있는 환경이 더 잘 맞습니다.",
  },
};

const SUBJECT_DESC: Record<"math" | "english", Record<Band, string>> = {
  math: {
    high: "수학 학습 방법이 자리 잡혀 있어요. 개념을 자기 말로 설명하고 틀린 이유를 나눠 봅니다.",
    mid: "기본 방법은 있지만 꾸준함이 필요해요. 오답 정리를 루틴으로 굳히면 점수로 이어집니다.",
    low: "수학 학습 방법을 함께 잡아 가야 해요. 개념 설명과 오답 정리부터 작게 시작하면 좋습니다.",
  },
  english: {
    high: "영어 학습 방법이 자리 잡혀 있어요. 단어를 꾸준히 복습하고 근거를 찾아 읽습니다.",
    mid: "기본 방법은 있지만 꾸준함이 필요해요. 단어 복습과 구조 읽기를 루틴으로 굳히면 좋습니다.",
    low: "영어 학습 방법을 함께 잡아 가야 해요. 단어 복습과 문장 구조 표시부터 작게 시작하면 좋습니다.",
  },
};

type AnalysisItem = { label: string; score: Score; desc: Record<Band, string> };

function ItemAnalysisRows({ items }: { items: AnalysisItem[] }) {
  return (
    <div className="analysis-rows">
      {items.map((it) => {
        const band = bandOf(it.score);
        const tone = band ? `is-${band}` : undefined;
        return (
          <article key={it.label} className={tone}>
            <header>
              <h4>{it.label}</h4>
              <span className="analysis-rows__badge">
                <b className="analysis-rows__score">{isNum(it.score) ? it.score.toFixed(1) : "–"}점</b>
                <span className={`analysis-rows__band b-${band ?? "none"}`}>
                  {band ? BAND_LABEL[band] : "정보 부족"}
                </span>
              </span>
            </header>
            {band && (
              <i>
                <b style={{ width: `${pct(it.score)}%` }} />
              </i>
            )}
            <p>
              {band
                ? it.desc[band]
                : "응답이 적어 이번에는 점수 표시를 미뤘어요. 처음 몇 주간 실제 모습으로 함께 살펴볼게요."}
            </p>
          </article>
        );
      })}
    </div>
  );
}

// 첫 14일 확인 포인트는 상담자 전용 데이터(verificationPlan14Days)를 쓰지 않는다(parent-safe 금지).
// 가정에서 함께 볼 수 있는 일반 지침으로 제시한다.
const FIRST_14_DAYS = [
  "숙제를 정한 시각에 스스로 시작하는지",
  "공부를 시작하기 전에 휴대폰을 정리하는지",
  "문제가 막혔을 때 무엇부터 다시 시작하는지",
];

export function ParentReport({ data }: { data: ParentSafeProfile }) {
  const s = data.scores;
  const i = data.interpretation;
  const review = s.responseQualityStatus === "review";
  const genDate = formatDate(data.generatedAt);

  const bandMeta = [data.display.schoolGrade, SUBJECT_LABEL[data.subjectSelection], genDate]
    .filter(Boolean)
    .join(" · ");

  const radarAxes = RADAR_KEYS.map((k) => ({ label: CONSTRUCT_LABEL[k], score: s.common[k] }));

  const showMath = data.subjectSelection === "math" || data.subjectSelection === "both";
  const showEnglish = data.subjectSelection === "english" || data.subjectSelection === "both";
  const hasSubjectNote = (showMath && i.mathStrategy) || (showEnglish && i.englishStrategy);

  // 항목별 분석: 핵심 6신호 + 선택 과목 학습전략 신호(6~8개).
  const analysisItems: AnalysisItem[] = RADAR_KEYS.map((k) => ({
    label: CONSTRUCT_LABEL[k],
    score: s.common[k],
    desc: ITEM_DESC[k],
  }));
  if (showMath && s.math) {
    analysisItems.push({ label: "수학 학습전략", score: s.math.mathStrategy, desc: SUBJECT_DESC.math });
  }
  if (showEnglish && s.english) {
    analysisItems.push({ label: "영어 학습전략", score: s.english.englishStrategy, desc: SUBJECT_DESC.english });
  }

  return (
    <>
      {/* 카톡 전송용 컴팩트 상단 밴드 — 큰 표지 대신 열자마자 요약이 보이게 */}
      <header className="report-v2-band">
        <div className="report-v2-band__brand">
          <span className="report-v2-band__mark">NK</span>
          <span>NK 학습 프로필 2.0</span>
        </div>
        <h1>
          {data.display.name} 학생 <em>학습 프로필</em>
        </h1>
        <div className="report-v2-band__meta">{bandMeta}</div>
        <p className="report-v2-band__summary">{firstSentence(i.parentSummary)}</p>
      </header>

      {/* ① 종합 분석 — 전문가 총평을 가장 비중 크게 */}
      <ReportSection
        id="sec-summary"
        index="01"
        title="종합 분석"
        caption="아이가 직접 쓴 최근 4주 응답을 바탕으로, 지금 학습 상태를 종합해 정리했습니다."
        aside={<b className="section-note">전문 분석 총평</b>}
      >
        <div className="executive-statement">
          <span>학습 유형</span>
          <h3>{i.studentType}</h3>
          <p>{i.parentSummary}</p>
          <ul>
            <li>점수는 다른 학생과의 우열이 아니라, 먼저 도와줄 순서를 뜻합니다.</li>
            <li>처음 2주 동안 학원과 가정이 실제 모습으로 함께 확인해 맞춰 갑니다.</li>
          </ul>
        </div>
      </ReportSection>

      {/* ② 우리 아이의 강점 */}
      <ReportSection
        id="sec-strength"
        index="02"
        title="우리 아이의 강점"
        caption="지금 학습에서 이미 잘 작동하고 있는, 앞으로 더 키워 갈 힘입니다."
      >
        <InsightCards items={i.strengths} tone="strength" />
      </ReportSection>

      {/* ③ 함께 도와줄 부분 */}
      <ReportSection
        id="sec-growth"
        index="03"
        title="함께 도와줄 부분"
        caption="부족한 점이 아니라, 처음 몇 주 동안 학원과 가정이 먼저 채워 줄 부분입니다."
        aside={<b className="section-note">낙인 없이</b>}
      >
        <InsightCards items={i.growthAreas} tone="growth" />
      </ReportSection>

      {/* ④ 항목별 분석 — 상단 레이더 + 항목별 점수·밴드·특징 해설 */}
      <ReportSection
        id="sec-signals"
        index="04"
        title="항목별 분석"
        caption="핵심 학습 신호를 점수와 함께, 항목별 특징으로 풀어 정리했습니다."
      >
        <div className="signal-solo">
          <figure className="analysis-figure">
            <figcaption>
              <span>핵심 학습 신호</span>
              <strong>여섯 가지 힘 한눈에</strong>
            </figcaption>
            <CoreSignalsRadar axes={radarAxes} />
            <p>
              <strong>읽는 법</strong> 점수는 다른 학생과의 우열이 아니라 도와줄 순서예요. 낮은 쪽은 혼낼
              부분이 아니라 먼저 도와줄 부분입니다. 항목별 특징은 아래에서 이어집니다.
            </p>
          </figure>
        </div>
        <ItemAnalysisRows items={analysisItems} />
      </ReportSection>

      {/* ⑤ 과목 이야기 — 전략 해석 1문단(세부 지표 나열 제거) */}
      {hasSubjectNote && (
        <ReportSection
          id="sec-subject"
          index="05"
          title="과목 이야기"
          caption="선택한 과목에서 지금 어떤 방식이 잘 맞는지 한 문단으로 정리했습니다."
        >
          <div className="subject-notes">
            {showMath && i.mathStrategy && (
              <article>
                <span>수학</span>
                <p>{i.mathStrategy}</p>
              </article>
            )}
            {showEnglish && i.englishStrategy && (
              <article>
                <span>영어</span>
                <p>{i.englishStrategy}</p>
              </article>
            )}
          </div>
        </ReportSection>
      )}

      {/* ⑥ NK의 지도 계획 — 12주 로드맵 + 첫 14일 확인 포인트 */}
      <ReportSection
        id="sec-plan"
        index="06"
        title="NK의 지도 계획"
        caption="위 분석을 바탕으로, 학원이 언제 무엇을 도와줄지 계획으로 정리했습니다."
        aside={<b className="fit-grade">{s.nkFit.stage}</b>}
      >
        <div className="plan-intro">
          <span>NK의 지도 방향</span>
          <p>{i.nkFitInterpretation}</p>
          <b>학원과 맞는 정도 · {s.nkFit.stage}</b>
        </div>
        <RoadmapLine roadmap={i.roadmap12Weeks} />
        <VerifyLine items={FIRST_14_DAYS} />
      </ReportSection>

      {/* ⑦ 읽는 안내 + 생성일 */}
      <CautionFooter review={review} />
      <p className="report-v2-genstamp">생성일 {genDate} · NK EDUCATION</p>
    </>
  );
}
