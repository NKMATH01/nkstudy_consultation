// 학부모 공유용 V2 결과 보고서. parent-safe snapshot만 렌더한다(화이트 톤·쉬운 우리말).
// 단일화(방향 변경): 상담자/학부모 보고서를 이 학부모 공유본 하나로 통일한다.
// 구조: 종합 분석 → 잘 작동하는 힘 → 먼저 도울 지점 → 항목별 분석 → 학습 선호 → 과목 보조 → 상담 제안.
// 학생 호칭은 "OO 학생"(실명+학생)으로 통일한다. 결정론 문구는 렌더가 이름을 받아 조립하고,
// AI/fallback 해석 문구는 name-substitution이 "{{학생}}" 토큰·따님/아이 등을 치환한다.
// parent-safe payload(allowlist)는 그대로 두고 렌더만 선별한다(§12.3, 기존 공유 snapshot 호환).
// 항목별 특징·지원 해설은 공용 매트릭스(signal-descriptions)를 사용한다(중복 정의 금지, 낙인 표현 금지).

import {
  toEntranceReportWording,
  type ParentBehaviorKey,
  type ParentSafeProfile,
  type ParentSafeScores,
} from "@/lib/assessment/v2/parent-safe";
import { studentLabel } from "@/lib/assessment/v2/name-substitution";
import type { CommonScores, Score } from "@/lib/assessment/v2/types";
import { CONSTRUCT_LABEL, SUBJECT_LABEL, formatDate, isNum, pct } from "./report-theme";
import { ReportSection } from "./report-frame";
import { CautionFooter, VerifyLine } from "./report-sections";
import {
  SIGNAL_BAND_LABEL,
  SIGNAL_DESC,
  SIGNAL_INSUFFICIENT,
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
): DigestArea[] {
  const c = scores.common;
  return [
    {
      key: "learning",
      label: "수업 · 참여와 질문",
      text: lowestState([
        { state: commonState("learningAttitude", c.learningAttitude), score: c.learningAttitude },
        { state: commonState("helpSeeking", c.helpSeeking), score: c.helpSeeking },
      ]),
    },
    {
      key: "homework",
      label: "과제 · 숙제와 피드백",
      text: lowestState([
        { state: commonState("homeworkReliability", c.homeworkReliability), score: c.homeworkReliability },
        { state: commonState("feedbackExecution", c.feedbackExecution), score: c.feedbackExecution },
      ]),
    },
    {
      key: "focus",
      label: "집중 · 휴대폰 조절",
      text: lowestState([
        { state: commonState("phoneBoundary", c.phoneBoundary), score: c.phoneBoundary },
      ]),
    },
    {
      key: "persistence",
      label: "꾸준함 · 의지와 회복",
      text: lowestState([
        { state: commonState("longTermPersistence", c.longTermPersistence), score: c.longTermPersistence },
        { state: commonState("shortTermRecovery", c.shortTermRecovery), score: c.shortTermRecovery },
      ]),
    },
  ];
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
const RADAR_KEYS: (keyof ParentSafeScores["common"])[] = [
  "learningAttitude",
  "homeworkReliability",
  "helpSeeking",
  "feedbackExecution",
  "phoneBoundary",
  "longTermPersistence",
  "shortTermRecovery",
];

type AnalysisItem = {
  key: string;
  label: string;
  score: Score;
  desc: Record<SignalBand, BandDesc>;
  evidence?: { question: string; answerLabel: string }[];
};

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
            <p>
              {band
                ? `${it.desc[band].state} ${toEntranceReportWording(it.desc[band].help)} 입학 상담에서 학생의 실제 경험을 더 확인합니다.`
                : SIGNAL_INSUFFICIENT}
            </p>
            {it.evidence && it.evidence.length > 0 && (
              <div className="analysis-rows__evidence">
                <b>학생 답변 근거</b>
                <ul>
                  {it.evidence.map((entry) => (
                    <li key={`${entry.question}-${entry.answerLabel}`}>
                      <span>{entry.question}</span>
                      <strong>{entry.answerLabel}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
            아직 응답만으로 우선 지원 지점을 꼽기는 일러요. 입학 상담에서 구체적인 공부 경험과 과목 테스트 결과를 함께 확인해요.
          </p>
        </article>
      </div>
    );
  }
  return (
    <div className="weakness-cards">
      {relative && (
        <p className="weakness-note">
          뚜렷한 어려움이 확인된 것은 아니에요. 학생의 다른 응답보다 상대적으로 먼저 살펴볼 부분입니다.
        </p>
      )}
      {items.map((w) => (
        <article key={w.label} className={`is-${w.band}`}>
          <header>
            <h4>{w.label}</h4>
            <span className="weakness-cards__badge">
              <span className={`analysis-rows__band b-${w.band}`}>{SIGNAL_BAND_LABEL[w.band]}</span>
            </span>
          </header>
          <p className="weak-manifest">{w.manifest}</p>
          <p className="weak-help">
            <b>등록 시 권장 도움</b> {w.help}
          </p>
        </article>
      ))}
    </div>
  );
}

// 학부모와 학생에게 입학 상담에서 직접 물어볼 수 있는 기본 질문.
const ENTRY_CONSULTATION_FALLBACK = [
  "평소 숙제를 언제 시작하고 무엇 때문에 미루는지",
  "공부할 때 휴대폰을 어디에 두는지",
  "문제가 막혔을 때 누구에게 어떻게 도움을 구하는지",
];

/**
 * 학생 응답에서 먼저 확인할 지점을 입학 상담 질문으로 바꾼다.
 * 내부 확인계획은 parent-safe 금지라 쓰지 않는다.
 */
function buildEntranceChecks(weaknesses: Weakness[]): string[] {
  const fromWeak = weaknesses
    .map((w) => `${w.label}: 언제 가장 어렵고 어떤 도움을 원하는지`);
  const merged = [...new Set([...fromWeak, ...ENTRY_CONSULTATION_FALLBACK])];
  return merged.slice(0, 3);
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
function StudentAnswerCards({
  items,
  note,
}: {
  items: NonNullable<ParentSafeProfile["peerResponses"]>;
  note: string;
}) {
  return (
    <div className="analysis-rows student-answer-cards">
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
      <p className="report-note">{note}</p>
    </div>
  );
}

export function ParentReport({ data }: { data: ParentSafeProfile }) {
  const s = data.scores;
  // 과거에 발급된 snapshot도 입학테스트 문맥으로 표시한다.
  const rawI = data.interpretation;
  const i = {
    ...rawI,
    studentType: toEntranceReportWording(rawI.studentType),
    parentSummary: toEntranceReportWording(rawI.parentSummary),
    detailedSummary: rawI.detailedSummary
      ? toEntranceReportWording(rawI.detailedSummary)
      : undefined,
    strengths: rawI.strengths.map(toEntranceReportWording),
    growthAreas: rawI.growthAreas.map(toEntranceReportWording),
    initialTeachingSuggestion: rawI.initialTeachingSuggestion
      ? toEntranceReportWording(rawI.initialTeachingSuggestion)
      : undefined,
    operationsConsultationNote: rawI.operationsConsultationNote
      ? toEntranceReportWording(rawI.operationsConsultationNote)
      : rawI.nkFitInterpretation
        ? toEntranceReportWording(rawI.nkFitInterpretation)
        : undefined,
    mathStrategy: rawI.mathStrategy
      ? toEntranceReportWording(rawI.mathStrategy)
      : null,
    englishStrategy: rawI.englishStrategy
      ? toEntranceReportWording(rawI.englishStrategy)
      : null,
  };
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
  const areaDigest = buildAreaDigest(s);

  // 결정론 UI 문구의 학생 호칭(예: "강현찬 학생"). 렌더가 이미 이름을 알고 있어 "OO 학생"으로 쓴다.
  const who = studentLabel(data.display.name);

  // 항목별 분석: 공통 핵심 7신호가 중심이고, 선택 과목은 뒤쪽 보조 정보로만 붙인다.
  // 00 요약·강점·먼저 도울 지점에는 과목 점수를 섞지 않는다.
  const glanceItems: AnalysisItem[] = RADAR_KEYS.map((k) => ({
    key: k,
    label: CONSTRUCT_LABEL[k],
    score: s.common[k],
    desc: SIGNAL_DESC[k],
    evidence: data.behaviorEvidence?.[k as ParentBehaviorKey],
  }));
  const analysisItems: AnalysisItem[] = glanceItems;

  // 약점: 낮은 점수 항목(45 미만)을 결정론적으로 뽑는다. 없으면 최하위 2개(상대적 보완점).
  const scored = glanceItems.filter((it) => isNum(it.score));
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
  const strongestEvidenceItem = [...scored]
    .sort((a, b) => (b.score as number) - (a.score as number))
    .find((item) => item.evidence?.length);
  const supportEvidenceItem = ascending.find(
    (item) => item.evidence?.length && item.key !== strongestEvidenceItem?.key,
  );
  const summaryEvidence: Array<{
    tone: "strength" | "support";
    label: string;
    question: string;
    answerLabel: string;
  }> = [];
  if (strongestEvidenceItem?.evidence?.[0]) {
    summaryEvidence.push({
      tone: "strength",
      label: strongestEvidenceItem.label,
      ...strongestEvidenceItem.evidence[0],
    });
  }
  if (supportEvidenceItem?.evidence?.[0]) {
    summaryEvidence.push({
      tone: "support",
      label: supportEvidenceItem.label,
      ...supportEvidenceItem.evidence[0],
    });
  }

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
        ? "이번 응답에서는 비교적 안정적으로 나타났어요. 다만 다른 응답보다 먼저 확인할 부분입니다."
        : `${bd.state} 입학 상담에서 언제 가장 어려운지 더 확인합니다.`;
    return { label: it.label, score: it.score as number, band, manifest, help: bd.help };
  });

  return (
    <>
      {/* 카톡 전송용 컴팩트 상단 밴드 — 큰 표지 대신 열자마자 요약이 보이게 */}
      <header className="report-v2-band">
        <div className="report-v2-band__brand">
          <span className="report-v2-band__mark">NK</span>
          <span>NK 입학 학습성향 프로필</span>
        </div>
        <h1>
          {data.display.name} 학생 <em>입학 학습성향 리포트</em>
        </h1>
        <div className="report-v2-band__meta">{bandMeta}</div>
        <div className="report-evidence-strip" aria-label="결과 해석 기준">
          <span>자료 · 학생 자기보고</span>
          <span>목적 · 학습성향 상담</span>
          <span>{review ? "응답 · 추가 확인 필요" : "응답 · 정상 완료"}</span>
        </div>
        <p className="report-v2-band__summary">{firstSentence(i.parentSummary)}</p>
      </header>

      {/* ⓪ 한 장 요약 — 열자마자 "무엇을 먼저 도울지"가 보이게 */}
      <ReportSection
        id="sec-glance"
        index="00"
        title="한 장 요약"
        caption="학생 자신의 응답 안에서 비교한 순서입니다. 또래 규준이나 능력 순위가 아닙니다."
      >
        <div className="glance">
          <h3 className="glance__type">{i.studentType}</h3>

          {data.entryPriority && (
            <div className="glance__priority">
              <span>학생이 직접 말한 가장 필요한 도움</span>
              <strong>{data.entryPriority}</strong>
            </div>
          )}

          {summaryEvidence.length > 0 && (
            <div className="glance__evidence-grid" aria-label="학생 답변 한눈에">
              {summaryEvidence.map((item) => (
                <article key={`${item.tone}-${item.label}`} className={`is-${item.tone}`}>
                  <span>
                    {item.tone === "strength" ? "잘 되는 답변" : "먼저 확인할 답변"} · {item.label}
                  </span>
                  <p>{item.question}</p>
                  <strong>{item.answerLabel}</strong>
                </article>
              ))}
            </div>
          )}

          <SortedBars items={glanceItems} />

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
            이 검사의 중심은 성적이 아니라 숙제·집중·끈기·질문·회복 같은 학습성향입니다. 학업 수준과 반은 별도의 과목 입학테스트로 확인합니다.
          </p>
        </div>
      </ReportSection>

      {/* ① 종합 분석 — 자기보고에 근거한 잠정 해석 */}
      <ReportSection
        id="sec-summary"
        index="01"
        title="종합 분석"
        caption={`${who}이 직접 쓴 이번 응답으로 지금의 학습 행동 가설을 정리했습니다.`}
        aside={<b className="section-note">응답 기반 해석</b>}
      >
        <div className="executive-statement">
           <span>이번 응답에서 보인 학습 모습</span>
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
            <li>막대는 학생 자신의 응답을 환산한 내부 지표이며 규준 점수가 아닙니다.</li>
            <li>관계·수업 선호와 친구 문항은 좋고 나쁜 점수로 묶지 않고 학생이 고른 답 그대로 봅니다.</li>
          </ul>
        </div>
      </ReportSection>

      {/* ② OO 학생의 강점 */}
      <ReportSection
        id="sec-strength"
        index="02"
        title={`${who}에게 잘 작동하는 힘`}
        caption="학생이 이번 설문에서 비교적 잘된다고 답한 부분입니다. 실제 경험은 입학 상담에서 확인합니다."
      >
        <StrengthCards items={i.strengths} scoreItems={analysisItems} />
      </ReportSection>

      {/* ③ 먼저 도울 지점 — 낙인 없이 행동 가설로 */}
      <ReportSection
        id="sec-weakness"
        index="03"
        title={`${who}을 먼저 도울 지점`}
        caption="낮은 응답을 결함으로 부르지 않고, 입학 상담에서 먼저 물어볼 내용으로 정리했습니다."
        aside={<b className="section-note">상담 확인 항목</b>}
      >
        <WeaknessCards items={weaknesses} relative={relativeWeak} />
      </ReportSection>

      {/* ④ 항목별 분석 — 상단 레이더 + 항목별 점수·밴드·3문장 해설 */}
      <ReportSection
        id="sec-signals"
        index="04"
        title="항목별 분석"
        caption="일곱 학습행동을 상태와 학생 답변 근거로 함께 확인합니다. 과목 공부 방식은 전체 우선순위에 섞지 않습니다."
      >
        {/* 레이더는 00 요약의 정렬 바로 대체했다(축 순서 고정 → 우선순위가 안 읽힘). */}
        <p className="report-note">
          막대는 학생의 자기보고를 0~100 범위로 환산한 내부 지표입니다. 규준·백분위·능력 점수가 아니며,
          낮은 쪽은 혼낼 부분이 아니라 입학 상담에서 먼저 확인할 부분입니다.
        </p>
        <details className="report-expandable">
          <summary>학습행동과 답변 근거 {analysisItems.length}개 보기</summary>
          <ItemAnalysisRows items={analysisItems} />

          {data.peerResponses && data.peerResponses.length > 0 && (
            <>
              <h3 className="report-subhead">친구와 공부</h3>
              <StudentAnswerCards
                items={data.peerResponses}
                note="친구 관계는 점수로 묶지 않고, 문항별로 어떻게 답했는지 그대로 보여 드립니다."
              />
            </>
          )}
        </details>
      </ReportSection>

      {/* ⑤ 학습 선호 — 좋고 나쁜 점수로 만들지 않고 원응답을 먼저 보여 준다. */}
      <ReportSection
        id="sec-preference"
        index="05"
        title="학습할 때 편한 방식"
        caption="직접·개별 피드백, 정해진 틀과 선택권처럼 학생이 편하게 배우는 조건을 고른 답 그대로 보여 드립니다."
      >
        {data.preferenceResponses && data.preferenceResponses.length > 0 ? (
          <details className="report-expandable">
            <summary>학생이 고른 답 {data.preferenceResponses.length}개 보기</summary>
            <StudentAnswerCards
              items={data.preferenceResponses}
              note="이 답은 수업 방식에 대한 상담 질문입니다. 능력 점수나 고정 성격 유형이 아닙니다."
            />
          </details>
        ) : (
          <p className="report-note">저장된 원응답이 없어 입학 상담에서 직접 확인합니다.</p>
        )}
        {data.mbti && (
          <div className="report-v2-band__mbti">
            <span className="mbti-pill">{data.mbti.type}</span>
            <span className="mbti-caption">학생이 적은 비공식 메모 · 점수와 추천에 미반영</span>
          </div>
        )}
      </ReportSection>

      {/* ⑥ 과목별 공부 방식 — 전체 학습성향 뒤에 두는 10문항 보조 정보 */}
      {hasSubjectNote && (
        <ReportSection
          id="sec-subject"
          index="06"
          title="과목별 공부 방식"
          caption="과목별 10문항으로 본 보조 정보입니다. 수학·영어 실력이나 반 배치 점수가 아닙니다."
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

      {/* ⑥ 입학 상담 제안 — 초기 수업 방향 + 이전 경험 반영 + 상담 질문 */}
      <ReportSection
        id="sec-plan"
        index="07"
        title="입학 상담·초기 수업 제안"
        caption="학생의 응답과 이전 학습환경을 바탕으로 상담에서 함께 결정할 내용입니다. 등록 전 확정 계획은 아닙니다."
      >
        <div className="plan-intro">
          <span>등록한다면 권장할 시작 방식</span>
          <p>{
            i.initialTeachingSuggestion ??
            i.operationsConsultationNote ??
            "학생이 답한 숙제·집중·질문·피드백 습관을 상담에서 확인한 뒤, 등록 시 시작 방식을 제안합니다."
          }</p>
        </div>
        {data.transitionPlan && data.transitionPlan.length > 0 && (
          <div className="transition-contract">
            <header>
              <span>이전 경험 반영</span>
              <h3>입학 상담에서 합의할 운영 조건</h3>
              <p>이전 학원명이나 원문은 공유하지 않고, 같은 불편을 줄이기 위해 상담할 조건만 남겼습니다.</p>
            </header>
            <div className="transition-contract__grid">
              {data.transitionPlan.map((item, index) => (
                <article key={`${item.concern}-${index}`}>
                  <span>{item.concern}</span>
                  <h4>{item.title}</h4>
                  <p>{toEntranceReportWording(item.commitment)}</p>
                  <small><b>등록 시 적용 후보</b> {toEntranceReportWording(item.check)}</small>
                </article>
              ))}
            </div>
          </div>
        )}
        <VerifyLine items={buildEntranceChecks(weaknesses)} />
      </ReportSection>

      {/* ⑦ 읽는 안내 + 생성일 */}
      <CautionFooter review={review} />
      <p className="report-v2-genstamp">생성일 {genDate} · NK EDUCATION</p>
    </>
  );
}
