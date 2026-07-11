// 학부모 공유용 V2 결과 보고서. parent-safe snapshot만 렌더한다(화이트 톤·쉬운 우리말).
// 단일화(방향 변경): 상담자/학부모 보고서를 이 학부모 공유본 하나로 통일한다.
// 구조: 종합 분석 → 강점 → 우리 아이의 약점 → 항목별 분석(레이더+구간별 3문장 해설) → 과목 이야기 → NK 지도 계획 → 읽는 안내.
// parent-safe payload(allowlist)는 그대로 두고 렌더만 선별한다(§12.3, 기존 공유 snapshot 호환).
// 항목별 특징·약점 해설은 공용 매트릭스(signal-descriptions)를 사용한다(중복 정의 금지, 낙인 표현 금지).

import type { ParentSafeProfile } from "@/lib/assessment/v2/parent-safe";
import type { CommonScores, Score } from "@/lib/assessment/v2/types";
import { CONSTRUCT_LABEL, SUBJECT_LABEL, formatDate, isNum, pct } from "./report-theme";
import { ReportSection } from "./report-frame";
import { CoreSignalsRadar } from "./report-ui";
import { CautionFooter, RoadmapLine, VerifyLine } from "./report-sections";
import {
  SIGNAL_BAND_LABEL,
  SIGNAL_DESC,
  SIGNAL_INSUFFICIENT,
  SUBJECT_SIGNAL_DESC,
  describeBand,
  signalBandOf,
  signalToneOf,
  type BandDesc,
  type SignalBand,
} from "./signal-descriptions";

function firstSentence(text: string): string {
  const m = text.split(/(?<=[.!?。])\s+/)[0];
  return m && m.trim() ? m.trim() : text;
}

// 규칙 기반(fallback) 강점 문자열은 "라벨: 설명 (점수점)" 꼴 → 앞부분을 소제목으로.
// AI 생성 자유 문장(콜론 없음)은 통째로 설명으로 렌더한다.
function splitInsight(text: string): { head: string | null; body: string } {
  const idx = text.indexOf(":");
  if (idx > 0 && idx < 24) {
    return { head: text.slice(0, idx).trim(), body: text.slice(idx + 1).trim() };
  }
  return { head: null, body: text };
}

function StrengthCards({ items }: { items: string[] }) {
  const shown = items.slice(0, 3);
  return (
    <div className="insight-cards">
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

type AnalysisItem = { label: string; score: Score; desc: Record<SignalBand, BandDesc> };

// ④ 항목별 분석: 항목명 + 점수·밴드 배지 + 슬림 막대 + 구간별 3문장 해설.
function ItemAnalysisRows({ items }: { items: AnalysisItem[] }) {
  return (
    <div className="analysis-rows">
      {items.map((it) => {
        const band = signalBandOf(it.score);
        const tone = signalToneOf(band);
        return (
          <article key={it.label} className={band ? `is-${tone}` : undefined}>
            <header>
              <h4>{it.label}</h4>
              <span className="analysis-rows__badge">
                <b className="analysis-rows__score">{isNum(it.score) ? it.score.toFixed(1) : "–"}점</b>
                <span className={`analysis-rows__band b-${tone}`}>
                  {band ? SIGNAL_BAND_LABEL[band] : "정보 부족"}
                </span>
              </span>
            </header>
            {band && (
              <i>
                <b style={{ width: `${pct(it.score)}%` }} />
              </i>
            )}
            <p>{band ? describeBand(it.desc[band]) : SIGNAL_INSUFFICIENT}</p>
          </article>
        );
      })}
    </div>
  );
}

// ③ 약점 카드: 약점 명칭 + 점수 근거 + 실제 나타남 + NK 도움.
type Weakness = { label: string; score: number; band: SignalBand; manifest: string; help: string };

function WeaknessCards({ items, relative }: { items: Weakness[]; relative: boolean }) {
  if (items.length === 0) {
    return (
      <div className="weakness-cards">
        <article className="is-none">
          <p className="weak-manifest">
            아직 점수로 뚜렷한 약점을 꼽기는 일러요. 처음 몇 주간 실제 모습으로 함께 확인하며 보완점을 찾아갈게요.
          </p>
        </article>
      </div>
    );
  }
  return (
    <div className="weakness-cards">
      {relative && (
        <p className="weakness-note">
          지금 뚜렷한 약점은 없어요. 다른 강점에 비해 상대적으로 먼저 챙기면 좋은 부분을 짚어 둘게요.
        </p>
      )}
      {items.map((w) => (
        <article key={w.label} className={`is-${w.band}`}>
          <header>
            <h4>{w.label}</h4>
            <span className="weakness-cards__badge">
              <b>{w.score.toFixed(1)}점</b>
              <span className={`analysis-rows__band b-${w.band}`}>{SIGNAL_BAND_LABEL[w.band]}</span>
            </span>
          </header>
          <p className="weak-manifest">{w.manifest}</p>
          <p className="weak-help">
            <b>NK의 도움</b> {w.help}
          </p>
        </article>
      ))}
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
    desc: SIGNAL_DESC[k],
  }));
  if (showMath && s.math) {
    analysisItems.push({ label: "수학 학습전략", score: s.math.mathStrategy, desc: SUBJECT_SIGNAL_DESC.math });
  }
  if (showEnglish && s.english) {
    analysisItems.push({
      label: "영어 학습전략",
      score: s.english.englishStrategy,
      desc: SUBJECT_SIGNAL_DESC.english,
    });
  }

  // 약점: 낮은 점수 항목(45 미만)을 결정론적으로 뽑는다. 없으면 최하위 2개(상대적 보완점).
  const scored = analysisItems.filter((it) => isNum(it.score));
  const ascending = [...scored].sort((a, b) => (a.score as number) - (b.score as number));
  const lowOnes = ascending.filter((it) => (it.score as number) < 45).slice(0, 3);
  const relativeWeak = lowOnes.length === 0;
  const pickedWeak = relativeWeak ? ascending.slice(0, 2) : lowOnes;
  const weaknesses: Weakness[] = pickedWeak.map((it) => {
    const band = signalBandOf(it.score) as SignalBand;
    const bd = it.desc[band];
    const manifest =
      band === "high"
        ? "지금은 안정적인 편이에요. 다만 다른 강점에 비하면 상대적으로 먼저 챙겨 두면 좋습니다."
        : bd.example;
    return { label: it.label, score: it.score as number, band, manifest, help: bd.help };
  });

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
        <StrengthCards items={i.strengths} />
      </ReportSection>

      {/* ③ 우리 아이의 약점 — 점수 근거 + 실제 나타남 + NK 도움 */}
      <ReportSection
        id="sec-weakness"
        index="03"
        title="우리 아이의 약점"
        caption="약점은 혼낼 점이 아니라 함께 보완할 지점입니다. 실제로 어떻게 나타나는지와 도울 방법을 함께 적었어요."
        aside={<b className="section-note">낙인 없이</b>}
      >
        <WeaknessCards items={weaknesses} relative={relativeWeak} />
      </ReportSection>

      {/* ④ 항목별 분석 — 상단 레이더 + 항목별 점수·밴드·3문장 해설 */}
      <ReportSection
        id="sec-signals"
        index="04"
        title="항목별 분석"
        caption="핵심 학습 신호를 점수와 함께, 항목별로 상태·실제 모습·도울 방법까지 풀어 정리했습니다."
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
