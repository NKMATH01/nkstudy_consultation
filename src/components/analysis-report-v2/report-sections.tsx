// 상담자·학부모 공용 섹션 블록. 두 화면이 동일 함수를 호출해 점수·문구가 어긋나지 않게 한다.
// 스타일은 report-premium-css.ts 클래스로만 제어. 데이터 계약·섹션 순서·parentSafe·점수 로직은 변경하지 않는다.
// 라벨은 report-theme.ts의 CONSTRUCT_LABEL/COACHING_LABEL(쉬운 우리말)만 사용한다.

import type {
  CommonScores,
  EnglishScores,
  MathScores,
  MbtiAxes,
  NkFitStage,
  Score,
  SubjectSelection,
} from "@/lib/assessment/v2/types";
import {
  COACHING_GLOSS,
  COACHING_LABEL,
  CONSTRUCT_GLOSS,
  CONSTRUCT_LABEL,
  isNum,
  pct,
} from "./report-theme";
import { CoachingCoordinate, CoreSignalsRadar } from "./report-ui";

type CoachingLite = {
  coachingType: string;
  autonomyStructureType: string;
  challenge: Score;
  safety: Score;
  autonomy: Score;
  structure: Score;
};

type NkAreaLite = { preference: number | null; readiness: number | null; featureFit: number | null };
type NkFitLite = {
  stage: NkFitStage;
  overall: number | null;
  areas: { clinic: NkAreaLite; weeklyTest: NkAreaLite; homework: NkAreaLite; immediateFeedback: NkAreaLite };
};

/** 큰 표기용 숫자(소수 첫째 자리 고정, §8.1). 정보 부족은 대시. */
function numText(s: Score): string {
  return isNum(s) ? s.toFixed(1) : "–";
}
function w(s: Score): string {
  return `${pct(s)}%`;
}
function caution(s: Score, threshold = 50, reverse = false): boolean {
  if (!isNum(s)) return false;
  return reverse ? s >= 60 : s < threshold;
}

// ── 핵심 신호 카드 6개 ──────────────────────────────────────────────────────
export function ProfileSignals({ common }: { common: CommonScores }) {
  const cards: { key: keyof CommonScores; state: string; risk?: boolean }[] = [
    { key: "learningAttitude", state: "수업 신호" },
    { key: "homeworkReliability", state: "숙제 신호" },
    { key: "phoneBoundary", state: "생활 습관", risk: true },
    { key: "longTermPersistence", state: "목표 유지" },
    { key: "shortTermRecovery", state: "회복", risk: true },
    { key: "peerLearningResource", state: "친구 관계" },
  ];
  return (
    <div className="profile-signals" aria-label="핵심 학습 신호">
      {cards.map((c) => {
        const s = common[c.key];
        const isCaution = c.risk ? caution(s, 50) : caution(s, 45);
        return (
          <article key={c.key} className={isCaution ? "is-caution" : undefined}>
            <span>{CONSTRUCT_LABEL[c.key]}</span>
            <strong>{c.state}</strong>
            <b>{numText(s)}</b>
            <p>{CONSTRUCT_GLOSS[c.key]}</p>
          </article>
        );
      })}
    </div>
  );
}

// ── 지도 방법 + 핵심 신호 SVG 2figure ───────────────────────────────────────
export function AnalysisVisualGrid({
  common,
  coaching,
}: {
  common: CommonScores;
  coaching: CoachingLite;
}) {
  const radarAxes = (
    [
      "learningAttitude",
      "homeworkReliability",
      "phoneBoundary",
      "longTermPersistence",
      "shortTermRecovery",
      "peerLearningResource",
    ] as (keyof CommonScores)[]
  ).map((k) => ({ label: CONSTRUCT_LABEL[k], score: common[k] }));
  return (
    <div className="analysis-visual-grid">
      <figure className="analysis-figure">
        <figcaption>
          <span>지도 방법</span>
          <strong>강하게 밀기 × 편하게 전하기</strong>
        </figcaption>
        <CoachingCoordinate
          challenge={coaching.challenge}
          safety={coaching.safety}
          coachingType={coaching.coachingType}
        />
        <p>
          <strong>이렇게 지도해요</strong> 기준은 {coaching.coachingType}입니다. 고칠 점은 여러 학생 앞이 아니라
          1:1로 짚어 주면 좋아요.
        </p>
      </figure>
      <figure className="analysis-figure">
        <figcaption>
          <span>핵심 학습 신호</span>
          <strong>여섯 가지 힘 한눈에</strong>
        </figcaption>
        <CoreSignalsRadar axes={radarAxes} />
        <p>
          <strong>읽는 법</strong> 다른 학생과 비교한 점수가 아니라, 이 학생을 도울 순서예요. 낮은 점수는
          혼낼 부분이 아니라 먼저 도와줄 부분입니다.
        </p>
      </figure>
    </div>
  );
}

// ── 공용 막대 세트(라벨 + 막대 + 점수 + 한 줄 풀이) ─────────────────────────
function Bars({ rows }: { rows: { label: string; score: Score; gloss?: string; risk?: boolean }[] }) {
  return (
    <div className="bullet-bars">
      {rows.map((r) => (
        <div key={r.label} className={r.risk && caution(r.score, 50) ? "is-caution" : undefined}>
          <span>{r.label}</span>
          <i>
            <b style={{ width: w(r.score) }} />
          </i>
          <strong>{numText(r.score)}</strong>
          {r.gloss && <small>{r.gloss}</small>}
        </div>
      ))}
    </div>
  );
}

// ── §학습: 수업 태도 + 숙제 ─────────────────────────────────────────────────
export function LearningPanels({ common }: { common: CommonScores }) {
  return (
    <div className="learning-panels">
      <article className="evidence-panel">
        <div className="panel-title">
          <span>수업 참여</span>
          <h3>{CONSTRUCT_LABEL.learningAttitude}</h3>
          <b>{numText(common.learningAttitude)}</b>
        </div>
        <Bars
          rows={[
            {
              label: CONSTRUCT_LABEL.learningAttitude,
              score: common.learningAttitude,
              gloss: CONSTRUCT_GLOSS.learningAttitude,
            },
            {
              label: CONSTRUCT_LABEL.longTermPersistence,
              score: common.longTermPersistence,
              gloss: CONSTRUCT_GLOSS.longTermPersistence,
            },
          ]}
        />
        <p className="evidence-explain">
          <strong>쉽게 말하면</strong> 수업에 잘 들어오고 중요한 내용을 잘 챙기면, 선생님 설명이 그대로 공부
          자료가 돼요. 아는 내용이 반복될 때는 짧게 질문을 던지거나 설명을 시켜 보면 집중이 오래 갑니다.
        </p>
      </article>
      <article className="evidence-panel">
        <div className="panel-title">
          <span>숙제 흐름</span>
          <h3>{CONSTRUCT_LABEL.homeworkReliability}</h3>
          <b>{numText(common.homeworkReliability)}</b>
        </div>
        <Bars
          rows={[
            {
              label: CONSTRUCT_LABEL.homeworkReliability,
              score: common.homeworkReliability,
              gloss: CONSTRUCT_GLOSS.homeworkReliability,
            },
            {
              label: CONSTRUCT_LABEL.shortTermRecovery,
              score: common.shortTermRecovery,
              gloss: CONSTRUCT_GLOSS.shortTermRecovery,
              risk: true,
            },
          ]}
        />
        <p className="evidence-explain">
          <strong>쉽게 말하면</strong> 숙제 양을 늘리기보다 시작 시각을 정해 주고, 틀린 문제를 3일 뒤 다시
          풀게 하는 편이 좋아요. 제출만 확인하지 말고 틀린 이유와 다시 풀기까지 함께 챙깁니다.
        </p>
      </article>
    </div>
  );
}

// ── §학습: 목표와 회복 + 지도 방식 ──────────────────────────────────────────
export function WillCoachingGrid({
  common,
  coaching,
}: {
  common: CommonScores;
  coaching: CoachingLite;
}) {
  const lt = common.longTermPersistence;
  const sr = common.shortTermRecovery;
  return (
    <div className="will-guidance-grid">
      <article className="will-dossier">
        <div className="panel-title">
          <span>목표와 회복</span>
          <h3>버티는 힘과 다시 시작하는 힘</h3>
          <b>
            {numText(lt)} / {numText(sr)}
          </b>
        </div>
        <Bars
          rows={[
            {
              label: CONSTRUCT_LABEL.longTermPersistence,
              score: lt,
              gloss: CONSTRUCT_GLOSS.longTermPersistence,
            },
            {
              label: CONSTRUCT_LABEL.shortTermRecovery,
              score: sr,
              gloss: CONSTRUCT_GLOSS.shortTermRecovery,
              risk: true,
            },
          ]}
        />
        <p>
          목표를 낮출 이유는 없어요. 시험 점수가 낮거나 문제가 막힌 바로 뒤에, 무엇부터 다시 시작할지 순서를
          정해 주는 것이 가장 중요합니다.
        </p>
      </article>
      <article className="coaching-dossier">
        <div className="panel-title">
          <span>지도 방식</span>
          <h3>이 학생에게 맞는 지도</h3>
        </div>
        <div className="coaching-lines">
          <div>
            <span>{COACHING_LABEL.challenge}</span>
            <i>
              <b style={{ width: w(coaching.challenge) }} />
            </i>
            <strong>{numText(coaching.challenge)}</strong>
            <small>{COACHING_GLOSS.challenge}</small>
          </div>
          <div>
            <span>{COACHING_LABEL.safety}</span>
            <i>
              <b style={{ width: w(coaching.safety) }} />
            </i>
            <strong>{numText(coaching.safety)}</strong>
            <small>{COACHING_GLOSS.safety}</small>
          </div>
          <div>
            <span>{COACHING_LABEL.autonomy}</span>
            <i>
              <b style={{ width: w(coaching.autonomy) }} />
            </i>
            <strong>{numText(coaching.autonomy)}</strong>
            <small>{COACHING_GLOSS.autonomy}</small>
          </div>
          <div>
            <span>{COACHING_LABEL.structure}</span>
            <i>
              <b style={{ width: w(coaching.structure) }} />
            </i>
            <strong>{numText(coaching.structure)}</strong>
            <small>{COACHING_GLOSS.structure}</small>
          </div>
        </div>
        <blockquote>
          <strong>{coaching.coachingType}</strong>
          <p>
            틀린 점은 분명히 말해도 괜찮아요. 다만 다른 학생 앞이 아니라 1:1로, 이유를 설명한 뒤 다음에 할
            것 하나를 학생이 고르게 해 주세요.
          </p>
        </blockquote>
      </article>
    </div>
  );
}

// ── §생활: 휴대폰 조절 ──────────────────────────────────────────────────────
export function PhoneFeature({ common }: { common: CommonScores }) {
  const s = common.phoneBoundary;
  return (
    <div className="phone-feature">
      <div className="phone-score-block">
        <span>휴대폰 자기조절</span>
        <strong>{numText(s)}</strong>
        <b>{isNum(s) && s < 50 ? "옆에서 도와주면 좋아요" : "스스로 조절하는 편이에요"}</b>
        <p>공부 시작할 때 자동으로 확인하거나 늦게 자는 습관이 집중을 흔드는지 살펴봐요.</p>
      </div>
      <div className="phone-analysis">
        <div className="phone-bars">
          <div className={caution(s, 50) ? "is-caution" : undefined}>
            <span>{CONSTRUCT_LABEL.phoneBoundary}</span>
            <i>
              <b style={{ width: w(s) }} />
            </i>
            <strong>{numText(s)}</strong>
            <small>{CONSTRUCT_GLOSS.phoneBoundary}</small>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── §생활: 성격(MBTI 참고) + 친구 ───────────────────────────────────────────
type MbtiAxisKey = "interactionAxis" | "conceptAxis" | "relationalFeedbackAxis" | "flexibilityAxis";
const MBTI_ROWS: { label: string; key: MbtiAxisKey }[] = [
  { label: "혼자 정리·1:1 숙고", key: "interactionAxis" },
  { label: "사례·순서·구체 설명", key: "conceptAxis" },
  { label: "기준·원인 중심 피드백", key: "relationalFeedbackAxis" },
  { label: "구조·마감·중간 점검", key: "flexibilityAxis" },
];

export function PersonalityRelationGrid({
  common,
  coaching,
  mbtiAxes,
}: {
  common: CommonScores;
  coaching: CoachingLite;
  mbtiAxes: MbtiAxes;
}) {
  return (
    <div className="personality-relation-grid">
      <article className="personality-panel">
        <div className="panel-title">
          <span>학습 반응</span>
          <h3>
            {coaching.coachingType} · {coaching.autonomyStructureType}
          </h3>
        </div>
        <p>
          진행 방식과 관계가 편하다고 느끼면 질문과 참여가 늘어요. 점수는 실제 행동을 먼저 보고, 학생이 적은
          MBTI는 지도 방식을 정할 때만 조금 참고했어요.
        </p>
        <div className="mbti-adjustment-panel">
          <div>
            <span>MBTI 참고 조정</span>
            <strong>{mbtiAxes.applied ? "지도 방식에만 조금 참고" : "참고 반영 없음(점수 그대로)"}</strong>
          </div>
          <dl>
            {MBTI_ROWS.map((r) => {
              const ax = mbtiAxes[r.key];
              return (
                <div key={r.label}>
                  <dt>{r.label}</dt>
                  <dd>
                    <span>기본 {numText(ax.raw)}</span>
                    <b>{ax.delta === null ? "±0" : `${ax.delta > 0 ? "+" : ""}${ax.delta}`}</b>
                    <strong>{numText(ax.final)}</strong>
                  </dd>
                </div>
              );
            })}
          </dl>
          <p>숙제·성실성·목표·회복·휴대폰 점수에는 MBTI를 넣지 않았어요.</p>
        </div>
        <div className="spectrum-list">
          <div role="img" aria-label={`${COACHING_LABEL.challenge} ${numText(coaching.challenge)}`}>
            <span>공개 피드백</span>
            <i>
              <b style={{ left: w(coaching.challenge) }} />
            </i>
            <span>1:1 피드백</span>
          </div>
          <div role="img" aria-label={`${COACHING_LABEL.structure} ${numText(coaching.structure)}`}>
            <span>완전 자율</span>
            <i>
              <b style={{ left: w(coaching.structure) }} />
            </i>
            <span>구조 선호</span>
          </div>
        </div>
        <small>
          MBTI 유형에 좋고 나쁨을 매기거나 성격을 단정하지 않아요. 최근 행동과 다르면 행동을 먼저 봅니다.
        </small>
      </article>
      <article className="relation-panel">
        <div className="panel-title">
          <span>친구 관계</span>
          <h3>친구가 공부에 주는 영향</h3>
        </div>
        <div className="relation-signals">
          <div>
            <span>{CONSTRUCT_LABEL.peerLearningResource}</span>
            <strong>{numText(common.peerLearningResource)}</strong>
            <p>{CONSTRUCT_GLOSS.peerLearningResource}</p>
          </div>
          <div className={caution(common.peerFocusBoundary, 0, true) ? "is-caution" : undefined}>
            <span>{CONSTRUCT_LABEL.peerFocusBoundary}</span>
            <strong>{numText(common.peerFocusBoundary)}</strong>
            <p>{CONSTRUCT_GLOSS.peerFocusBoundary}</p>
          </div>
        </div>
        <p className="relation-note">
          <strong>반 배정 메모</strong> 친한 친구와 같은 반인 것 자체는 문제가 아니에요. 짝 확인 시간과 혼자
          집중하는 시간을 나눠 주는 운영이 잘 맞습니다.
        </p>
      </article>
    </div>
  );
}

// ── §NK 적합: 인트로 + 4영역 ────────────────────────────────────────────────
const NK_AREA_META: { key: keyof NkFitLite["areas"]; index: string; label: string }[] = [
  { key: "clinic", index: "01", label: "클리닉 · 보충 공부" },
  { key: "weeklyTest", index: "02", label: "주간 테스트 · 다시 보충" },
  { key: "homework", index: "03", label: "숙제 · 못한 부분 채우기" },
  { key: "immediateFeedback", index: "04", label: "진도 · 과제 바로 확인" },
];

export function NkFitSection({
  nkFit,
  interpretation,
}: {
  nkFit: NkFitLite;
  interpretation: string;
}) {
  const cell = (v: number | null) => (v === null ? "–" : v.toFixed(1));
  return (
    <>
      <div className="fit-intro">
        <h3>
          학생이 NK에 맞는지만 보는 게 아니라,
          <br />
          <em>NK가 무엇을 도와주면 학생과 잘 맞는지</em>도 함께 봐요.
        </h3>
        <p>{interpretation}</p>
      </div>
      <div className="fit-feature-list">
        {NK_AREA_META.map((a) => {
          const area = nkFit.areas[a.key];
          return (
            <article key={a.key}>
              <div>
                <span>
                  {a.index} · {a.label}
                </span>
                <strong>{nkFit.stage}</strong>
              </div>
              <div className="dual-fit">
                <p>
                  하고 싶은 마음 <b>{cell(area.preference)}</b>
                  <i>
                    <em style={{ width: `${area.preference ?? 0}%` }} />
                  </i>
                </p>
                <p>
                  지금 준비 정도 <b>{cell(area.readiness)}</b>
                  <i>
                    <em style={{ width: `${area.readiness ?? 0}%` }} />
                  </i>
                </p>
              </div>
              <p>마음과 준비의 차이를 보고, 처음 2주에 무엇을 도와줄지 정해요.</p>
            </article>
          );
        })}
      </div>
    </>
  );
}

// ── §NK 적합: 과목별 전략 ───────────────────────────────────────────────────
export function SubjectStrategy({
  subjectSelection,
  math,
  english,
  mathStrategy,
  englishStrategy,
}: {
  subjectSelection: SubjectSelection;
  math: MathScores | null;
  english: EnglishScores | null;
  mathStrategy: string | null;
  englishStrategy: string | null;
}) {
  const showMath = subjectSelection === "math" || subjectSelection === "both";
  const showEnglish = subjectSelection === "english" || subjectSelection === "both";
  return (
    <div className="subject-dossier">
      <div className="subject-dossier__head">
        <span>과목별</span>
        <h3>과목별 학습전략</h3>
      </div>
      {showMath && math && (
        <div className="subject-v2-profile">
          <div className="subject-v2-summary">
            <span>수학</span>
            <h4>수학 학습전략</h4>
            <div>
              <strong>{numText(math.mathStrategy)}</strong>
              <small>/ 100</small>
            </div>
            <p>{mathStrategy ?? "개념을 자기 말로 설명하고, 틀린 이유를 개념·계산·조건으로 나눠 봐요."}</p>
          </div>
          <div className="subject-v2-details">
            <div className="subject-v2-metrics">
              <SubjectMetric label="학습전략" score={math.mathStrategy} />
              <SubjectMetric label="자기효능감" score={math.mathSelfEfficacy} />
              <SubjectMetric label="낯선 유형 회피" score={math.mathNoveltyAvoidance} risk />
              <SubjectMetric label="시험 긴장 방해" score={math.mathTestInterference} risk />
            </div>
          </div>
        </div>
      )}
      {showEnglish && english && (
        <div className="subject-v2-profile">
          <div className="subject-v2-summary">
            <span>영어</span>
            <h4>영어 학습전략</h4>
            <div>
              <strong>{numText(english.englishStrategy)}</strong>
              <small>/ 100</small>
            </div>
            <p>{englishStrategy ?? "단어를 꾸준히 복습하고, 문장 구조와 근거를 표시하며 규칙을 예문에 적용해요."}</p>
          </div>
          <div className="subject-v2-details">
            <div className="subject-v2-metrics">
              <SubjectMetric label="학습전략" score={english.englishStrategy} />
              <SubjectMetric label="자기효능감" score={english.englishSelfEfficacy} />
              <SubjectMetric label="긴 지문 회피" score={english.englishReadingAvoidance} risk />
              <SubjectMetric label="시험 긴장 방해" score={english.englishTestInterference} risk />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SubjectMetric({ label, score, risk }: { label: string; score: Score; risk?: boolean }) {
  return (
    <div className={risk && caution(score, 0, true) ? "is-caution" : undefined}>
      <span>{label}</span>
      <strong>{numText(score)}</strong>
      <i>
        <b style={{ width: w(score) }} />
      </i>
      <p>{risk ? "높을수록 살펴볼 부분" : "높을수록 안정적"}</p>
    </div>
  );
}

// ── §솔루션: 강점·개선 ──────────────────────────────────────────────────────
export function StrengthGrowth({
  strengths,
  growthAreas,
}: {
  strengths: string[];
  growthAreas: string[];
}) {
  return (
    <div className="strength-growth-grid">
      <article className="legacy-list-panel strength-panel">
        <div className="panel-title">
          <span>강점</span>
          <h3>잘하고 있는 점</h3>
        </div>
        <ol>
          {strengths.map((t, i) => (
            <li key={i}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <p>{t}</p>
              </div>
            </li>
          ))}
        </ol>
      </article>
      <article className="legacy-list-panel growth-panel">
        <div className="panel-title">
          <span>도와줄 부분</span>
          <h3>함께 채워 갈 점</h3>
        </div>
        <ol>
          {growthAreas.map((t, i) => (
            <li key={i}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <p>{t}</p>
              </div>
            </li>
          ))}
        </ol>
      </article>
    </div>
  );
}

// ── §솔루션: 12주 계획 ──────────────────────────────────────────────────────
export function RoadmapLine({
  roadmap,
}: {
  roadmap: { weeks: string; focus: string; actions: string[] }[];
}) {
  return (
    <div className="roadmap-dossier">
      <div className="panel-title">
        <span>12주 계획</span>
        <h3>12주 맞춤 계획</h3>
      </div>
      <div className="roadmap-line">
        {roadmap.map((r, i) => (
          <article key={i}>
            <span>{r.weeks}</span>
            <strong>{r.focus}</strong>
            <p>{r.actions[0] ?? ""}</p>
            {r.actions[1] && <small>{r.actions[1]}</small>}
          </article>
        ))}
      </div>
    </div>
  );
}

// ── §솔루션: 첫 14일 확인 지표 ──────────────────────────────────────────────
export function VerifyLine({ items }: { items: string[] }) {
  return (
    <div className="verify-line">
      <span>첫 14일 확인 지표</span>
      <ul>
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

// ── 해석 원칙 주의 푸터 ─────────────────────────────────────────────────────
export function CautionFooter({ review }: { review: boolean }) {
  return (
    <footer className="report-v2-caution">
      <strong>읽는 원칙</strong>
      <p>
        이 결과는 학생이 최근 4주를 스스로 적은 응답으로 만든 학습 프로필이에요. 휴대폰 사용·성격·친구관계를
        병이나 문제로 진단하지 않고, 학원 등록 여부를 이 결과만으로 정하지 않아요.
        {review
          ? " 응답이 한쪽으로 치우쳐 있어, 첫 2주 동안 숙제·휴대폰·다시 시작하는 모습으로 꼭 함께 확인할게요."
          : " 첫 2주 동안 숙제·휴대폰·다시 시작하는 모습으로 함께 확인해 나가요."}
      </p>
    </footer>
  );
}
