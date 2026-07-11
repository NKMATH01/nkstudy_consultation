// 상담자·학부모 공용 섹션 블록(프로토타입 PRIVATE LEARNING DOSSIER DOM).
// 두 화면이 동일 함수를 호출해 점수·문구가 어긋나지 않게 한다. 스타일은 report-premium-css.ts의 클래스로만 제어.
// 데이터 계약·섹션 순서·parentSafe·점수 로직은 변경하지 않는다(표현만 재작업).

import type {
  CommonScores,
  EnglishScores,
  MathScores,
  MbtiAxes,
  NkFitStage,
  Score,
  SubjectSelection,
} from "@/lib/assessment/v2/types";
import { CONSTRUCT_LABEL, isNum, pct } from "./report-theme";
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

// ── 핵심 신호 카드 6개(프로토타입 .profile-signals) ─────────────────────────
export function ProfileSignals({ common }: { common: CommonScores }) {
  const cards: { key: keyof CommonScores; state: string; note: string; risk?: boolean }[] = [
    { key: "learningAttitude", state: "수업 신호", note: "준비와 핵심 표시" },
    { key: "homeworkReliability", state: "숙제 신뢰", note: "제출과 오답 복구" },
    { key: "phoneBoundary", state: "자기조절", note: "자동 확인·취침 경계", risk: true },
    { key: "longTermPersistence", state: "장기 의지", note: "목표와 반복 유지" },
    { key: "shortTermRecovery", state: "단기 회복", note: "막힘 뒤 재시작", risk: true },
    { key: "peerLearningResource", state: "또래 자원", note: "관계가 학습 자원" },
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
            <p>{c.note}</p>
          </article>
        );
      })}
    </div>
  );
}

// ── 지도 좌표 + 핵심 신호 SVG 2figure(프로토타입 .analysis-visual-grid) ──────
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
          <span>COACHING MAP</span>
          <strong>강하게 밀기 × 안전하게 전달하기</strong>
        </figcaption>
        <CoachingCoordinate
          challenge={coaching.challenge}
          safety={coaching.safety}
          coachingType={coaching.coachingType}
        />
        <p>
          <strong>지도 결론</strong> 기준은 {coaching.coachingType}. 지적과 교정은 공개 비교가 아닌 1:1로
          전달합니다.
        </p>
      </figure>
      <figure className="analysis-figure">
        <figcaption>
          <span>LEARNING SIGNALS</span>
          <strong>핵심 학습 신호 분포</strong>
        </figcaption>
        <CoreSignalsRadar axes={radarAxes} />
        <p>
          <strong>읽는 법</strong> 동학년 평균이 아니라 이 보고서의 지도 우선순위 구간입니다. 낮은 점수는
          낙인이 아니라 먼저 지원할 행동입니다.
        </p>
      </figure>
    </div>
  );
}

// ── 공용 막대 세트 ──────────────────────────────────────────────────────────
function Bars({ rows }: { rows: { label: string; score: Score; risk?: boolean }[] }) {
  return (
    <div className="bullet-bars">
      {rows.map((r) => (
        <div key={r.label} className={r.risk && caution(r.score, 50) ? "is-caution" : undefined}>
          <span>{r.label}</span>
          <i>
            <b style={{ width: w(r.score) }} />
          </i>
          <strong>{numText(r.score)}</strong>
        </div>
      ))}
    </div>
  );
}

// ── §학습: 수업 태도 + 숙제 신뢰(프로토타입 .learning-panels) ────────────────
export function LearningPanels({ common }: { common: CommonScores }) {
  return (
    <div className="learning-panels">
      <article className="evidence-panel">
        <div className="panel-title">
          <span>CLASS ATTITUDE</span>
          <h3>수업 참여 신호</h3>
          <b>{numText(common.learningAttitude)}</b>
        </div>
        <Bars
          rows={[
            { label: "학습 태도", score: common.learningAttitude },
            { label: "장기 의지", score: common.longTermPersistence },
          ]}
        />
        <p className="evidence-explain">
          <strong>해석</strong> 수업 진입과 핵심 표시가 안정적일수록 교사의 설명을 학습 자료로 남길 수
          있습니다. 아는 내용이 반복될 때 짧은 확인 질문이나 설명 역할을 주면 집중을 유지하기 쉽습니다.
        </p>
      </article>
      <article className="evidence-panel">
        <div className="panel-title">
          <span>HOMEWORK FLOW</span>
          <h3>숙제 신뢰 흐름</h3>
          <b>{numText(common.homeworkReliability)}</b>
        </div>
        <Bars
          rows={[
            { label: "숙제 신뢰", score: common.homeworkReliability },
            { label: "단기 회복", score: common.shortTermRecovery, risk: true },
          ]}
        />
        <p className="evidence-explain">
          <strong>해석</strong> 숙제는 양을 늘리기보다 시작 시각을 고정하고 “3일 뒤 해설 없이 재풀이”를
          관리하는 편이 정확합니다. 제출 확인을 넘어 오답 원인과 재풀이까지 완료 기준으로 봅니다.
        </p>
      </article>
    </div>
  );
}

// ── §학습: 의지×회복 + 코칭 조합(프로토타입 .will-guidance-grid) ─────────────
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
          <span>WILL × RECOVERY</span>
          <h3>의지의 두 얼굴</h3>
          <b>
            {numText(lt)} / {numText(sr)}
          </b>
        </div>
        <Bars
          rows={[
            { label: "장기 의지", score: lt },
            { label: "단기 회복", score: sr, risk: true },
          ]}
        />
        <p>
          목표를 낮출 이유는 없습니다. 주간 테스트가 낮거나 문제가 막힌 직후, 무엇부터 다시 시작할지
          순서를 정해주는 것이 핵심입니다.
        </p>
      </article>
      <article className="coaching-dossier">
        <div className="panel-title">
          <span>COACHING RESPONSE</span>
          <h3>지도 방식 조합</h3>
        </div>
        <div className="coaching-lines">
          <div>
            <span>직접 피드백 수용</span>
            <i>
              <b style={{ width: w(coaching.challenge) }} />
            </i>
            <strong>{numText(coaching.challenge)}</strong>
          </div>
          <div>
            <span>관계 안전 필요</span>
            <i>
              <b style={{ width: w(coaching.safety) }} />
            </i>
            <strong>{numText(coaching.safety)}</strong>
          </div>
          <div>
            <span>자율성 필요</span>
            <i>
              <b style={{ width: w(coaching.autonomy) }} />
            </i>
            <strong>{numText(coaching.autonomy)}</strong>
          </div>
          <div>
            <span>구조 필요</span>
            <i>
              <b style={{ width: w(coaching.structure) }} />
            </i>
            <strong>{numText(coaching.structure)}</strong>
          </div>
        </div>
        <blockquote>
          <strong>{coaching.coachingType}</strong>
          <p>
            틀린 점은 분명하게 말해도 됩니다. 다만 다른 학생 앞이 아니라 1:1로 전달하고, 이유를 설명한 뒤
            순서 하나를 선택하게 합니다.
          </p>
        </blockquote>
      </article>
    </div>
  );
}

// ── §생활: 휴대폰 다크 피처(프로토타입 .phone-feature) ───────────────────────
export function PhoneFeature({ common }: { common: CommonScores }) {
  const s = common.phoneBoundary;
  return (
    <div className="phone-feature">
      <div className="phone-score-block">
        <span>DIGITAL BOUNDARY</span>
        <strong>{numText(s)}</strong>
        <b>{isNum(s) && s < 50 ? "경계 설정 지원 필요" : "자기조절 관찰"}</b>
        <p>공부 시작 시 자동 확인과 취침 지연이 집중 진입을 흔드는지 확인합니다.</p>
      </div>
      <div className="phone-analysis">
        <div className="phone-bars">
          <div className={caution(s, 50) ? "is-caution" : undefined}>
            <span>휴대폰 자기조절</span>
            <i>
              <b style={{ width: w(s) }} />
            </i>
            <strong>{numText(s)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── §생활: 성격 반응(MBTI 보조) + 친구관계(프로토타입 .personality-relation-grid) ──
type MbtiAxisKey = "interactionAxis" | "conceptAxis" | "relationalFeedbackAxis" | "flexibilityAxis";
const MBTI_ROWS: { label: string; key: MbtiAxisKey; poles: string }[] = [
  { label: "혼자 정리·1:1 숙고", key: "interactionAxis", poles: "혼자 정리 ↔ 즉시 대화" },
  { label: "사례·순서·구체 설명", key: "conceptAxis", poles: "사례·순서 ↔ 원리·큰그림" },
  { label: "기준·원인 중심 피드백", key: "relationalFeedbackAxis", poles: "기준 중심 ↔ 관계 안전" },
  { label: "구조·마감·중간 점검", key: "flexibilityAxis", poles: "구조·마감 ↔ 유연한 순서" },
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
          <span>LEARNING RESPONSE</span>
          <h3>
            {coaching.coachingType} · {coaching.autonomyStructureType}
          </h3>
        </div>
        <p>
          진행 방식과 관계가 안전하다고 느끼면 질문과 참여가 늘어납니다. 행동문항을 우선하고 학생이 입력한
          MBTI는 지도 선호축에만 보조 반영했습니다.
        </p>
        <div className="mbti-adjustment-panel">
          <div>
            <span>MBTI AUXILIARY SCORE</span>
            <strong>{mbtiAxes.applied ? "지도 선호축 보조 반영" : "보조 반영 없음(최종=원점수)"}</strong>
          </div>
          <dl>
            {MBTI_ROWS.map((r) => {
              const ax = mbtiAxes[r.key];
              return (
                <div key={r.label}>
                  <dt>{r.label}</dt>
                  <dd>
                    <span>원 {numText(ax.raw)}</span>
                    <b>{ax.delta === null ? "±0" : `${ax.delta > 0 ? "+" : ""}${ax.delta}`}</b>
                    <strong>{numText(ax.final)}</strong>
                  </dd>
                </div>
              );
            })}
          </dl>
          <p>숙제·성실성·의지·회복력·휴대폰 점수에는 MBTI를 반영하지 않았습니다.</p>
        </div>
        <div className="spectrum-list">
          <div role="img" aria-label={`직접 피드백 수용 ${numText(coaching.challenge)}`}>
            <span>공개 피드백</span>
            <i>
              <b style={{ left: w(coaching.challenge) }} />
            </i>
            <span>1:1 피드백</span>
          </div>
          <div role="img" aria-label={`구조 요구 ${numText(coaching.structure)}`}>
            <span>완전 자율</span>
            <i>
              <b style={{ left: w(coaching.structure) }} />
            </i>
            <span>구조 선호</span>
          </div>
        </div>
        <small>
          MBTI 유형 자체의 우열이나 고정 성격을 판정하지 않으며, 최근 학습 행동과 충돌하면 행동문항을
          우선합니다.
        </small>
      </article>
      <article className="relation-panel">
        <div className="panel-title">
          <span>PEER ENVIRONMENT</span>
          <h3>친구가 학습에 미치는 방식</h3>
        </div>
        <div className="relation-signals">
          <div>
            <span>또래 학습자원</span>
            <strong>{numText(common.peerLearningResource)}</strong>
            <p>서로 질문하는 반에서 참여가 높아짐</p>
          </div>
          <div className={caution(common.peerFocusBoundary, 0, true) ? "is-caution" : undefined}>
            <span>집중 방해 위험</span>
            <strong>{numText(common.peerFocusBoundary)}</strong>
            <p>친한 친구와 개인 집중시간 구분 필요</p>
          </div>
        </div>
        <p className="relation-note">
          <strong>반 배정 메모</strong> 친한 친구와 같은 반 자체가 문제는 아닙니다. 짝 확인 10분과 개인
          집중 시간을 분리하는 운영이 적합합니다.
        </p>
      </article>
    </div>
  );
}

// ── §NK 적합: 인트로 + 4영역 dual-fit(프로토타입 .fit-intro/.fit-feature-list) ──
const NK_AREA_META: { key: keyof NkFitLite["areas"]; index: string; label: string }[] = [
  { key: "clinic", index: "01", label: "클리닉 · 보완학습" },
  { key: "weeklyTest", index: "02", label: "주간 테스트 · 재보완" },
  { key: "homework", index: "03", label: "숙제 · 의무 보충" },
  { key: "immediateFeedback", index: "04", label: "진도 · 과제 즉시 피드백" },
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
          학생이 NK에 맞는가만 보는 것이 아니라,
          <br />
          <em>NK가 어떤 조건을 제공해야 학생과 맞는지</em> 함께 봅니다.
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
                  운영 선호 <b>{cell(area.preference)}</b>
                  <i>
                    <em style={{ width: `${area.preference ?? 0}%` }} />
                  </i>
                </p>
                <p>
                  현재 준비 <b>{cell(area.readiness)}</b>
                  <i>
                    <em style={{ width: `${area.readiness ?? 0}%` }} />
                  </i>
                </p>
              </div>
              <p>선호와 준비도의 차이를 보고 초기 2주 지원 조건을 정합니다.</p>
            </article>
          );
        })}
      </div>
    </>
  );
}

// ── §NK 적합: 과목별 전략(프로토타입 .subject-v2-profile) ────────────────────
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
        <div>
          <span>SUBJECT STRATEGY</span>
          <h3>과목별 학습전략</h3>
        </div>
      </div>
      {showMath && math && (
        <div className="subject-v2-profile">
          <div className="subject-v2-summary">
            <span>MATH</span>
            <h4>수학 학습전략</h4>
            <div>
              <strong>{numText(math.mathStrategy)}</strong>
              <small>/ 100</small>
            </div>
            <p>{mathStrategy ?? "개념을 자기 말로 설명하고, 오답 원인을 개념·계산·조건으로 나눕니다."}</p>
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
            <span>ENGLISH</span>
            <h4>영어 학습전략</h4>
            <div>
              <strong>{numText(english.englishStrategy)}</strong>
              <small>/ 100</small>
            </div>
            <p>{englishStrategy ?? "단어를 누적 복습하고, 문장 구조와 근거를 표시하며 규칙을 예문에 적용합니다."}</p>
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
      <p>{risk ? "높을수록 주의" : "높을수록 안정"}</p>
    </div>
  );
}

// ── §솔루션: 강점·개선(프로토타입 .strength-growth-grid) ─────────────────────
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
          <span>STRENGTHS</span>
          <h3>주요 강점</h3>
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
          <span>GROWTH AREAS</span>
          <h3>보완 및 개선 영역</h3>
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

// ── §솔루션: 12주 로드맵(프로토타입 .roadmap-line) ───────────────────────────
export function RoadmapLine({
  roadmap,
}: {
  roadmap: { weeks: string; focus: string; actions: string[] }[];
}) {
  return (
    <div className="roadmap-dossier">
      <div className="panel-title">
        <span>12-WEEK SOLUTION</span>
        <h3>12주 맞춤 솔루션</h3>
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

// ── §솔루션: 첫 14일 확인 지표(프로토타입 다크 스트립) ───────────────────────
export function VerifyLine({ items }: { items: string[] }) {
  return (
    <div className="verify-line">
      <span>14-DAY VERIFICATION · 첫 14일 행동 확인 지표</span>
      <ul>
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

// ── 해석 원칙 주의 푸터(프로토타입 .report-v2-caution) ───────────────────────
export function CautionFooter({ review }: { review: boolean }) {
  return (
    <footer className="report-v2-caution">
      <strong>해석 원칙</strong>
      <p>
        이 결과는 최근 4주의 자기보고에 기반한 상담용 학습 프로필입니다. 휴대폰 사용·성격·친구관계를
        의학적·심리적 진단으로 해석하지 않으며 NK 등록 적격 여부를 단독으로 결정하지 않습니다.
        {review
          ? " 초기 응답 품질이 낮아, 첫 14일 실제 제출률·휴대폰 보관·재시작·클리닉 참여 행동으로 반드시 재확인합니다."
          : " 첫 14일의 실제 제출률·휴대폰 보관·재시작·클리닉 참여 행동과 함께 확인해야 합니다."}
      </p>
    </footer>
  );
}
