// 학부모 공유용 V2 결과 보고서. parent-safe snapshot만 렌더한다(화이트 톤·쉬운 우리말).
// 단일화(방향 변경): 상담자/학부모 보고서를 이 학부모 공유본 하나로 통일한다.
// 구조: 종합 분석 → 강점 → 약점 → 항목별 분석(레이더+구간별 3문장 해설) → 과목 이야기 → NK 지도 계획 → 읽는 안내.
// 학생 호칭은 "OO 학생"(실명+학생)으로 통일한다. 결정론 문구는 렌더가 이름을 받아 조립하고,
// AI/fallback 해석 문구는 name-substitution이 "{{학생}}" 토큰·따님/아이 등을 치환한다.
// parent-safe payload(allowlist)는 그대로 두고 렌더만 선별한다(§12.3, 기존 공유 snapshot 호환).
// 항목별 특징·약점 해설은 공용 매트릭스(signal-descriptions)를 사용한다(중복 정의 금지, 낙인 표현 금지).

import type { ParentSafeProfile, ParentSafeScores } from "@/lib/assessment/v2/parent-safe";
import { studentLabel } from "@/lib/assessment/v2/name-substitution";
import type { CommonScores, Score } from "@/lib/assessment/v2/types";
import { CONSTRUCT_LABEL, SUBJECT_LABEL, formatDate, isNum, pct } from "./report-theme";
import { ReportSection } from "./report-frame";
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

// detailedSummary(전 영역 상세 총평)를 문단으로 나눈다. AI는 빈 줄로 문단을 구분하지만,
// 규칙 기반 fallback은 한 덩어리로 오므로 문장 2개씩 묶어 모바일 가독(문단 간격)을 확보한다.
function splitParagraphs(text: string): string[] {
  const byPara = text
    .split(/\n\s*\n|\n/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (byPara.length >= 2) return byPara.slice(0, 8);
  const sentences = text
    .split(/(?<=[.!?。])\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (sentences.length <= 2) return [text.trim()];
  const out: string[] = [];
  for (let idx = 0; idx < sentences.length; idx += 2) {
    out.push(sentences.slice(idx, idx + 2).join(" "));
  }
  return out.slice(0, 8);
}

// "영역별 한눈에": 전 영역을 종합 분석 안에서 한 번씩 짚는 결정론적 요약(구획당 1문장).
// 각 구획에서 먼저 도와줄(점수가 낮은) 항목의 state 첫 문장만 뽑아 ④ 항목별 분석과 중복을 최소화한다.
const DIGEST_INSUFFICIENT = "아직 응답이 부족해 상담에서 함께 확인할 부분이에요.";

function commonState(key: keyof CommonScores, score: Score): string | null {
  const band = signalBandOf(score);
  const desc = SIGNAL_DESC[key];
  return band && desc ? firstSentence(desc[band].state) : null;
}

function subjectState(subject: "math" | "english", score: Score): string | null {
  const band = signalBandOf(score);
  return band ? firstSentence(SUBJECT_SIGNAL_DESC[subject][band].state) : null;
}

type DigestArea = { key: string; label: string; text: string };
type DigestCand = { state: string | null; score: Score };

// 구획 안에서 점수가 가장 낮은(먼저 도와줄) 항목의 문장 1개만 남긴다.
function lowestState(cands: DigestCand[]): string {
  const scored = cands.filter(
    (c): c is { state: string; score: number } => isNum(c.score) && !!c.state
  );
  if (scored.length === 0) return DIGEST_INSUFFICIENT;
  scored.sort((a, b) => a.score - b.score);
  return scored[0].state;
}

function buildAreaDigest(
  scores: ParentSafeScores,
  showMath: boolean,
  showEnglish: boolean
): DigestArea[] {
  const c = scores.common;
  const areas: DigestArea[] = [
    {
      key: "learning",
      label: "학습 · 수업과 숙제",
      text: lowestState([
        { state: commonState("learningAttitude", c.learningAttitude), score: c.learningAttitude },
        { state: commonState("homeworkReliability", c.homeworkReliability), score: c.homeworkReliability },
      ]),
    },
    {
      key: "life",
      label: "생활 · 휴대폰과 친구",
      text: lowestState([
        { state: commonState("phoneBoundary", c.phoneBoundary), score: c.phoneBoundary },
        { state: commonState("peerLearningResource", c.peerLearningResource), score: c.peerLearningResource },
      ]),
    },
    {
      key: "mind",
      label: "마음 · 의지와 회복",
      text: lowestState([
        { state: commonState("longTermPersistence", c.longTermPersistence), score: c.longTermPersistence },
        { state: commonState("shortTermRecovery", c.shortTermRecovery), score: c.shortTermRecovery },
      ]),
    },
  ];

  const subjectCands: DigestCand[] = [];
  if (showMath && scores.math)
    subjectCands.push({ state: subjectState("math", scores.math.mathStrategy), score: scores.math.mathStrategy });
  if (showEnglish && scores.english)
    subjectCands.push({
      state: subjectState("english", scores.english.englishStrategy),
      score: scores.english.englishStrategy,
    });
  if (subjectCands.length) areas.push({ key: "subject", label: "과목 · 학습 방법", text: lowestState(subjectCands) });

  return areas;
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

type LabeledScore = { label: string; score: Score };

// 강점 문장에 등장하는 항목 라벨을 찾아 관련 construct 점수·밴드를 매핑한다(약점 카드와 동일 배지).
// 매칭이 안 되면(라벨 미언급) 배지를 생략한다.
function matchStrengthScore(text: string, items: LabeledScore[]): { score: number; band: SignalBand } | null {
  for (const it of items) {
    if (isNum(it.score) && text.includes(it.label)) {
      const band = signalBandOf(it.score);
      // 낮은 밴드를 "강점" 카드에 배지로 달면 카드와 배지가 서로 모순된다.
      if (band && band !== "low") return { score: it.score, band };
    }
  }
  return null;
}

/** 0~100 서버 점수를 학부모 화면 표기(5점 만점 평균)로 바꾼다. */
function toFivePoint(score: number): string {
  return (score / 20).toFixed(1);
}

function StrengthCards({ items, scoreItems }: { items: string[]; scoreItems: LabeledScore[] }) {
  const shown = items.slice(0, 3);
  return (
    <div className="insight-cards">
      {shown.map((t, i) => {
        const { head, body } = splitInsight(t);
        const matched = matchStrengthScore(t, scoreItems);
        return (
          <article key={i}>
            <span className="insight-cards__idx">{String(i + 1).padStart(2, "0")}</span>
            <div>
              {(head || matched) && (
                <div className="insight-cards__head">
                  {head && <strong>{head}</strong>}
                  {matched && (
                    <span className="insight-cards__badge">
                      <b>{toFivePoint(matched.score)} / 5</b>
                      <span className={`analysis-rows__band b-${matched.band}`}>
                        {SIGNAL_BAND_LABEL[matched.band]}
                      </span>
                    </span>
                  )}
                </div>
              )}
              <p>{body}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

// 또래 관련 지표는 합산 축에서 뺀다.
// "도움 받는 힘"과 "집중 흔들림"이 한 점수로 상쇄돼 뜻이 흐려지기 때문이며,
// 대신 아래 "친구와 공부" 카드에서 문항 요지 + 학생이 고른 보기로 보여 준다.
const RADAR_KEYS: (keyof CommonScores)[] = [
  "learningAttitude",
  "homeworkReliability",
  "phoneBoundary",
  "longTermPersistence",
  "shortTermRecovery",
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
                {isNum(it.score) && signalBandOf(it.score) !== "low" && (
                  <b className="analysis-rows__score">{toFivePoint(it.score)} / 5</b>
                )}
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
              <b>{toFivePoint(w.score)} / 5</b>
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
const FIRST_14_DAYS_FALLBACK = [
  "숙제를 정한 시각에 스스로 시작하는지",
  "공부를 시작하기 전에 휴대폰을 정리하는지",
  "문제가 막혔을 때 무엇부터 다시 시작하는지",
];

/**
 * 첫 14일 확인 포인트를 그 학생의 약점에 맞춰 만든다.
 * 상담자 전용 verificationPlan14Days는 parent-safe 금지라 쓰지 않고,
 * 이미 화면에 있는 약점 해설(help)을 "관찰 가능한 문장"으로 바꿔 쓴다.
 */
function buildFirst14Days(weaknesses: Weakness[]): string[] {
  const fromWeak = weaknesses
    .map((w) => w.help.trim())
    .filter(Boolean)
    .map((help) => (help.endsWith("지") ? help : toObservable(help)));
  const merged = [...new Set([...fromWeak, ...FIRST_14_DAYS_FALLBACK])];
  return merged.slice(0, 3);
}

/** help 문장을 "~하는지" 형태의 관찰 문장으로 다듬는다. */
function toObservable(help: string): string {
  const trimmed = help.replace(/[.!]$/, "").trim();
  return `${trimmed}— 이 부분이 지켜지는지`;
}

/**
 * "00 한 장 요약"의 정렬 수평 바.
 * 레이더는 축 순서가 고정돼 무엇을 먼저 도와야 할지 읽기 어려웠다.
 * 점수 내림차순 수평 바로 바꾸면 위에서부터 "잘 되는 순"이 그대로 읽힌다.
 */
function SortedBars({ items }: { items: AnalysisItem[] }) {
  const sorted = [...items].sort((a, b) => {
    const av = isNum(a.score) ? (a.score as number) : -1;
    const bv = isNum(b.score) ? (b.score as number) : -1;
    return bv - av;
  });

  return (
    <div className="glance-bars">
      {sorted.map((it) => {
        const band = signalBandOf(it.score);
        const tone = signalToneOf(band);
        return (
          <div key={it.label} className="glance-bars__row">
            <span className="glance-bars__label">{it.label}</span>
            <i className="glance-bars__track">
              <b className={`b-${tone}`} style={{ width: `${pct(it.score)}%` }} />
            </i>
            <span className="glance-bars__meta">
              {isNum(it.score) && band !== "low" && (
                <b className="glance-bars__score">{toFivePoint(it.score as number)} / 5</b>
              )}
              <span className={`analysis-rows__band b-${tone}`}>
                {band ? SIGNAL_BAND_LABEL[band] : "정보 부족"}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * "친구와 공부" 카드. 점수·밴드 없이 문항 요지와 학생이 고른 보기만 보여 준다.
 * 응답 원본이 없는(예전에 발급된) 스냅샷에서는 렌더하지 않는다.
 */
function PeerStudyCard({ items }: { items: NonNullable<ParentSafeProfile["peerResponses"]> }) {
  return (
    <div className="analysis-rows">
      {items.map((p, i) => (
        <article key={i}>
          <header>
            <h4>{p.question}</h4>
            <span className="analysis-rows__badge">
              <b className="analysis-rows__score">{p.answerLabel}</b>
            </span>
          </header>
        </article>
      ))}
      <p className="report-note">
        친구 관계는 점수로 묶지 않고, 문항별로 어떻게 답했는지 그대로 보여 드립니다.
      </p>
    </div>
  );
}

export function ParentReport({ data }: { data: ParentSafeProfile }) {
  const s = data.scores;
  const i = data.interpretation;
  const review = s.responseQualityStatus === "review";
  const genDate = formatDate(data.generatedAt);

  const bandMeta = [data.display.schoolGrade, SUBJECT_LABEL[data.subjectSelection], genDate]
    .filter(Boolean)
    .join(" · ");


  const showMath = data.subjectSelection === "math" || data.subjectSelection === "both";
  const showEnglish = data.subjectSelection === "english" || data.subjectSelection === "both";
  const hasSubjectNote = (showMath && i.mathStrategy) || (showEnglish && i.englishStrategy);

  // 01 종합 분석 본문: AI 상세 총평(문단 분할) + 전 영역 결정론적 요약.
  // detailedSummary는 과거 공유 snapshot에 없을 수 있어 optional 처리(없으면 상세 본문 생략).
  const summaryParas = i.detailedSummary ? splitParagraphs(i.detailedSummary) : [];
  const areaDigest = buildAreaDigest(s, showMath, showEnglish);

  // 결정론 UI 문구의 학생 호칭(예: "강현찬 학생"). 렌더가 이미 이름을 알고 있어 "OO 학생"으로 쓴다.
  const who = studentLabel(data.display.name);

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
  // 00 요약 강점 칩 — 라벨만 쓴다(점수 노출 금지, 학부모 패널 합의).
  const strengthLabels = [...scored]
    .filter((it) => signalBandOf(it.score) === "high")
    .sort((a, b) => (b.score as number) - (a.score as number))
    .slice(0, 2)
    .map((it) => it.label);

  // 밴드가 첫 문장을 이미 보여 주므로 01에서는 그 뒤부터 이어 붙인다.
  const parentSummaryRest = (() => {
    const lead = firstSentence(i.parentSummary);
    const rest = i.parentSummary.slice(lead.length).trim();
    return rest;
  })();

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

      {/* ⓪ 한 장 요약 — 열자마자 "무엇을 먼저 도울지"가 보이게 */}
      <ReportSection
        id="sec-glance"
        index="00"
        title="한 장 요약"
        caption="위에서부터 잘 되고 있는 순서예요. 아래 항목을 먼저 도와드립니다."
      >
        <div className="glance">
          <h3 className="glance__type">{i.studentType}</h3>

          <SortedBars items={analysisItems} />

          <div className="glance__tags">
            {strengthLabels.length > 0 && (
              <div className="glance__chips">
                <b>잘 되는 부분</b>
                {strengthLabels.map((label) => (
                  <span key={label} className="glance__chip">
                    {label}
                  </span>
                ))}
              </div>
            )}
            {weaknesses.length > 0 && (
              <p className="glance__todo">
                먼저 도와줄 부분 {weaknesses.length}가지 — 03에서 자세히
              </p>
            )}
          </div>

          <p className="glance__promise">
            8주 후 같은 검사를 다시 해 이 그래프의 변화를 비교해 드립니다.
          </p>
        </div>
      </ReportSection>

      {/* ① 종합 분석 — 전문가 총평을 가장 비중 크게 */}
      <ReportSection
        id="sec-summary"
        index="01"
        title="종합 분석"
        caption={`${who}이 직접 쓴 최근 4주 응답으로 지금 학습 상태를 정리했습니다.`}
        aside={<b className="section-note">전문 분석 총평</b>}
      >
        <div className="executive-statement">
          <span>학습 유형</span>
          <h3>{i.studentType}</h3>
          {/* 밴드에 이미 첫 문장이 있어 여기서는 나머지부터 이어 붙인다(같은 문장 반복 방지). */}
          <p className="executive-statement__lead">{parentSummaryRest || i.parentSummary}</p>
          {summaryParas.length > 0 && (
            <details className="executive-statement__detail" open={false}>
              <summary>자세한 총평 더 보기</summary>
              {summaryParas.map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </details>
          )}
          {areaDigest.length > 0 && (
            <div className="summary-areas">
              <b className="summary-areas__title">영역별 한눈에</b>
              <div className="summary-areas__grid">
                {areaDigest.map((a) => (
                  <article key={a.key}>
                    <span>{a.label}</span>
                    <p>{a.text}</p>
                  </article>
                ))}
              </div>
            </div>
          )}
          <ul>
            <li>점수는 다른 학생과의 우열이 아니라, 먼저 도와줄 순서를 뜻합니다.</li>
            <li>처음 2주 동안 학원과 가정이 실제 모습으로 함께 확인해 맞춰 갑니다.</li>
          </ul>
        </div>
      </ReportSection>

      {/* ② OO 학생의 강점 */}
      <ReportSection
        id="sec-strength"
        index="02"
        title={`${who}의 강점`}
        caption="지금 학습에서 이미 잘 작동하고 있는, 앞으로 더 키워 갈 힘입니다."
      >
        <StrengthCards items={i.strengths} scoreItems={analysisItems} />
      </ReportSection>

      {/* ③ OO 학생의 약점 — 점수 근거 + 실제 나타남 + NK 도움 */}
      <ReportSection
        id="sec-weakness"
        index="03"
        title={`${who}의 약점`}
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
        {/* 레이더는 00 요약의 정렬 바로 대체했다(축 순서 고정 → 우선순위가 안 읽힘). */}
        <p className="report-note">
          점수는 다른 학생과의 우열이 아니라 도와줄 순서예요. 낮은 쪽은 혼낼 부분이 아니라 먼저 도와줄
          부분입니다.
        </p>
        <ItemAnalysisRows items={analysisItems} />

        {data.peerResponses && data.peerResponses.length > 0 && (
          <>
            <h3 className="report-subhead">친구와 공부</h3>
            <PeerStudyCard items={data.peerResponses} />
          </>
        )}
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
      >
        <div className="plan-intro">
          <span>NK의 지도 방향</span>
          <p>{i.nkFitInterpretation}</p>
        </div>
        <RoadmapLine roadmap={i.roadmap12Weeks} />
        <VerifyLine items={buildFirst14Days(weaknesses)} />
      </ReportSection>

      {/* ⑦ 읽는 안내 + 생성일 */}
      <CautionFooter review={review} />
      <p className="report-v2-genstamp">생성일 {genDate} · NK EDUCATION</p>
    </>
  );
}
