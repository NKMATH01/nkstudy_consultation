// 학부모 공유용 V2 결과보고서(3판, v2.3 문항표 기준). parent-safe snapshot만 렌더한다.
// 짜임(심리검사 보고서형): 표지 → 01 검사 개요·응답 신뢰도 → 02 핵심 판단 두 가지 → 03 프로파일
//   → 04 질문별 해석 8 → 05 학생이 직접 적은 것 → 06 과목 공부 방식 → 07 종합 소견(MBTI 두 문장 포함)
//   → 08 NK 지도 방향 → 09 등록 시 12주 운영 계획(안) → 10 학부모님께 여쭙니다 → 꼬리말.
// 규칙: 유형 이름·MBTI 원인 문장·점수 숫자·문항 문장 인용 금지. 초등학생도 아는 낱말. 소견서 톤("~로 나타났습니다").
// 설계 원본: docs/prototypes/2026-09-04-parent-report-v3/Main.dc.html

import type { ParentSafeProfile, StudentAnswersSafe } from "@/lib/assessment/v2/parent-safe";
import { toEntranceReportWording } from "@/lib/assessment/v2/parent-safe";
import { studentLabel } from "@/lib/assessment/v2/name-substitution";
import type { CommonConstruct, Score } from "@/lib/assessment/v2/types";
import { GRADE_LABEL, gradeOf, type GradeKey } from "@/lib/assessment/v2/scoring";
import { C, CONSTRUCT_LABEL, CONSTRUCT_QUESTION, SUBJECT_LABEL, formatDate, isNum, pct } from "./report-theme";
import { ReportSection } from "./report-frame";
import { ANSWER_LINE, SIGNAL_DESC, SIGNAL_INSUFFICIENT, SUBJECT_SIGNAL_DESC, signalBandOf } from "./signal-descriptions";

// ── 문장 헬퍼 ────────────────────────────────────────────────────────────

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

/** 프로파일·질문별 해석에 쓰는 여덟 척도(지도 방식 반응은 02 핵심 판단에서만 다룬다). */
const PROFILE_KEYS: CommonConstruct[] = [
  "learningAttitude",
  "homeworkReliability",
  "goalClarity",
  "shortTermRecovery",
  "managementAcceptance",
  "questionInitiative",
  "phoneBoundary",
  "peerFocusBoundary",
];

const GRADE_TONE: Record<GradeKey, "good" | "watch" | "help"> = { good: "good", watch: "watch", help: "help" };
const GRADE_COLOR: Record<GradeKey, string> = { good: C.teal, watch: C.brass, help: C.coral };

function gradeTone(score: Score): "good" | "watch" | "help" | "none" {
  const g = gradeOf(score);
  return g ? GRADE_TONE[g] : "none";
}

/** 판정 문구 → 배지 색. 유형 이름이 아니라 방향(안정/조건부/도움)만 색으로 보인다. */
function verdictTone(verdict: string | undefined): "good" | "watch" | "help" | "none" {
  if (verdict === "버틸 수 있음" || verdict === "강하게 밀어도 됨") return "good";
  if (verdict === "도움이 있으면 버팀" || verdict === "강하게 하되 다독임을 같이") return "watch";
  if (verdict === "지금은 어려움" || verdict === "차분히 다독이며") return "help";
  return "none";
}

// ── 그래프 부품(inline SVG · 숫자 없음) ─────────────────────────────────────

function GradeBadge({ score, big = false }: { score: Score; big?: boolean }) {
  const g = gradeOf(score);
  return (
    <span className={`pr3-badge is-${gradeTone(score)}${big ? " is-big" : ""}`}>
      {g ? GRADE_LABEL[g] : "정보 부족"}
    </span>
  );
}

/** 3구간 띠 위의 마커. 구간 폭 62.5 / 12.5 / 25. */
function ZoneBar({ score }: { score: Score }) {
  const g = gradeOf(score);
  return (
    <div className="pr3-zone" aria-hidden>
      <span className="pr3-zone__help" />
      <span className="pr3-zone__watch" />
      <span className="pr3-zone__good" />
      {g && (
        <i className="pr3-zone__marker" style={{ left: `${pct(score)}%`, background: GRADE_COLOR[g] }} />
      )}
    </div>
  );
}

/** 여덟 축 레이더. 안쪽 원 = 지켜볼 것 경계(62.5), 바깥 원 = 잘 되고 있음 경계(75). */
function Radar({ axes }: { axes: { label: string; score: Score }[] }) {
  const cx = 175;
  const cy = 148;
  const r = 88;
  const n = axes.length;
  const point = (i: number, value: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const rr = (r * value) / 100;
    return [cx + rr * Math.cos(angle), cy + rr * Math.sin(angle)] as const;
  };
  const poly = axes
    .map((a, i) => point(i, isNum(a.score) ? a.score : 0))
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  return (
    <svg className="pr3-svg" viewBox="0 0 350 300" role="img" aria-label="여덟 행동의 모양">
      {[25, 50, 100].map((v) => (
        <circle key={v} cx={cx} cy={cy} r={(r * v) / 100} fill="none" stroke={C.line} strokeWidth={1} />
      ))}
      <circle cx={cx} cy={cy} r={(r * 62.5) / 100} fill="none" stroke={C.brass} strokeWidth={1} strokeDasharray="3 3" />
      <circle cx={cx} cy={cy} r={(r * 75) / 100} fill="none" stroke={C.teal} strokeWidth={1} strokeDasharray="3 3" />
      {axes.map((a, i) => {
        const [x, y] = point(i, 100);
        return <line key={a.label} x1={cx} y1={cy} x2={x} y2={y} stroke={C.line} strokeWidth={1} />;
      })}
      <polygon points={poly} fill="rgba(21,32,51,0.16)" stroke={C.navy} strokeWidth={2} strokeLinejoin="round" />
      {axes.map((a, i) => {
        const [x, y] = point(i, isNum(a.score) ? a.score : 0);
        return <circle key={`p-${a.label}`} cx={x} cy={y} r={3.2} fill={C.navy} />;
      })}
      {axes.map((a, i) => {
        const [x, y] = point(i, 122);
        const anchor = Math.abs(x - cx) < 8 ? "middle" : x > cx ? "start" : "end";
        return (
          <text key={`t-${a.label}`} x={x} y={y + 4} textAnchor={anchor} fontSize={10.5} fill={C.sub} fontWeight={700}>
            {a.label}
          </text>
        );
      })}
    </svg>
  );
}

/** 지도 방식 사분면. 가로 = 세게 말해도 따라옴(지도 방식 반응), 세로 = 힘들어도 다시 시작(단기 회복력). */
function GuidanceQuadrant({ x, y }: { x: Score; y: Score }) {
  const left = 46;
  const top = 20;
  const w = 280;
  const h = 180;
  const px = (v: number) => left + (w * v) / 100;
  const py = (v: number) => top + h - (h * v) / 100;
  const hasPoint = isNum(x) && isNum(y);
  return (
    <svg className="pr3-svg" viewBox="0 0 340 236" role="img" aria-label="지도 방식에 대한 반응의 자리">
      <rect x={left} y={top} width={w} height={h} fill={C.panel} stroke={C.line} />
      <line x1={px(62.5)} y1={top} x2={px(62.5)} y2={top + h} stroke={C.brass} strokeDasharray="4 3" />
      <line x1={left} y1={py(62.5)} x2={left + w} y2={py(62.5)} stroke={C.brass} strokeDasharray="4 3" />
      <text x={left + w - 6} y={top + 14} textAnchor="end" fontSize={9.5} fill={C.sub} fontWeight={700}>세게 해도 되고 다시 시작함</text>
      <text x={left + 6} y={top + 14} fontSize={9.5} fill={C.sub} fontWeight={700}>다시 시작은 하나 세게 하면 힘듦</text>
      <text x={left + w - 6} y={top + h - 6} textAnchor="end" fontSize={9.5} fill={C.sub} fontWeight={700}>세게 해도 되나 회복이 느림</text>
      <text x={left + 6} y={top + h - 6} fontSize={9.5} fill={C.sub} fontWeight={700}>차분히 다독이며 회복도 도움</text>
      {hasPoint && (
        <>
          <circle cx={px(x)} cy={py(y)} r={9} fill="rgba(168,67,61,0.18)" />
          <circle cx={px(x)} cy={py(y)} r={4.5} fill={C.coral} stroke="#fff" strokeWidth={1.5} />
        </>
      )}
      <text x={left + w / 2} y={top + h + 16} textAnchor="middle" fontSize={10} fill={C.sub}>가로 · 세게 말해도 따라옴 →</text>
      <text x={14} y={top + h / 2} textAnchor="middle" fontSize={10} fill={C.sub} transform={`rotate(-90 14 ${top + h / 2})`}>세로 · 힘들어도 다시 시작 →</text>
    </svg>
  );
}

/** 빈도 문항 응답 분포 스택 막대. */
function DistributionBar({ counts, notApplicable, total }: { counts: number[]; notApplicable: number; total: number }) {
  const labels = ["거의 하지 않았다", "가끔 했다", "절반쯤 했다", "대부분 했다", "할 때마다 했다"];
  const colors = [C.coral, "#c98a7a", C.brass, "#7fa39a", C.teal];
  const half = counts[2] ?? 0;
  return (
    <div className="pr3-dist">
      <div className="pr3-dist__bar" aria-hidden>
        {counts.map((c, i) => (
          <span key={labels[i]} style={{ flexGrow: c, background: colors[i] }} />
        ))}
        {notApplicable > 0 && <span style={{ flexGrow: notApplicable, background: C.line }} />}
      </div>
      <ul className="pr3-dist__legend">
        {counts.map((c, i) => (
          <li key={labels[i]}>
            <i style={{ background: colors[i] }} />
            <span>{labels[i]}</span>
            <b>{c}</b>
          </li>
        ))}
        {notApplicable > 0 && (
          <li>
            <i style={{ background: C.line }} />
            <span>경험 없음</span>
            <b>{notApplicable}</b>
          </li>
        )}
      </ul>
      <p className="pr3-note">
        {total}문항 가운데 절반쯤 했다가 {half}문항입니다. 이 검사에서 절반은 &lsquo;보통&rsquo;이 아니라 아직 습관이 되지 않은 쪽으로 봅니다.
      </p>
    </div>
  );
}

/** 12주 타임라인(3구간). */
function Timeline({ phases }: { phases: { weeks: string; goal: string; actions: string[]; check: string; owner: string }[] }) {
  return (
    <div className="pr3-timeline">
      <div className="pr3-timeline__strip" aria-hidden>
        {phases.map((p, i) => (
          <span key={p.weeks} className={`is-${i}`}>{p.weeks}</span>
        ))}
      </div>
      <div className="pr3-timeline__cards">
        {phases.map((p, i) => (
          <article key={p.weeks} className={`is-${i}`}>
            <b>{p.weeks}</b>
            <dl>
              <div><dt>목표</dt><dd>{p.goal}</dd></div>
              <div><dt>행동</dt><dd>{p.actions.map((a) => <span key={a}>{a}</span>)}</dd></div>
              <div><dt>확인</dt><dd>{p.check}</dd></div>
              <div><dt>담당</dt><dd>{p.owner}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}

// ── 결정론 문장(판정) ─────────────────────────────────────────────────────

function managementLine(v: ParentSafeProfile["verdicts"]): { sentence: string; direct: string | null; note: string | null } {
  const m = v?.management;
  if (!m) return { sentence: "관리를 버틸 수 있는지는 응답이 부족해 입학 상담에서 확인합니다.", direct: null, note: null };
  const map: Record<string, string> = {
    "버틸 수 있음": "남아서 하라고 하면 남고, 힘든 구간에서도 다시 시작한다고 답했습니다. NK의 관리 방식을 그대로 적용해도 됩니다.",
    "도움이 있으면 버팀": "관리를 받아들이겠다고 답했지만, 결과가 늦게 나오는 구간에서 한 번 멈추는 쪽입니다. 그 구간에서 손을 잡아 주면 버팁니다.",
    "지금은 어려움": "검사와 지적이 많은 관리를 힘들어하고, 힘든 뒤 다시 시작하는 응답도 낮았습니다. 첫 달은 관리 강도를 조절해 시작합니다.",
    "판정 보류": "응답이 부족해 판정을 미룹니다. 남아서 하기·매주 시험 경험을 입학 상담에서 직접 확인합니다.",
  };
  return { sentence: map[m.verdict] ?? map["판정 보류"], direct: m.directAnswer, note: m.basisNote };
}

function guidanceLine(v: ParentSafeProfile["verdicts"]): { sentence: string; choice: string | null; confirm: boolean } {
  const g = v?.guidance;
  if (!g) return { sentence: "강하게 밀어도 되는지는 응답이 부족해 입학 상담에서 확인합니다.", choice: null, confirm: false };
  const map: Record<string, string> = {
    "강하게 밀어도 됨": "세게 지적받으면 더 열심히 하고 기분이 오래 상하지 않는다고 답했습니다. 고칠 점을 바로 짚어 주는 방식이 맞습니다.",
    "강하게 하되 다독임을 같이": "세게 지적받은 뒤 더 열심히 한 경험이 있지만, 크게 혼나면 그 과목을 피한 적도 있습니다. 바로 짚되 잘한 점을 먼저 말하는 방식이 맞습니다.",
    "차분히 다독이며": "크게 혼나면 그 과목이 싫어지고 기분이 오래 남는다고 답했습니다. 잘한 점을 먼저 말한 뒤 차분히 고쳐 주는 방식이 맞습니다.",
    "판정 보류": "응답이 부족해 판정을 미룹니다. 첫 수업에서 세게 짚었을 때의 반응을 직접 확인합니다.",
  };
  return { sentence: map[g.verdict] ?? map["판정 보류"], choice: g.choiceText, confirm: g.confirmInCounseling };
}

const STUDENT_ANSWER_LABEL: Record<keyof StudentAnswersSafe, string> = {
  problemSelf: "공부할 때 스스로 느끼는 문제점은?",
  mathDifficulty: "수학에서 가장 어려운 단원·영역",
  englishDifficulty: "영어에서 가장 어려운 영역",
  studyCore: "공부의 핵심이 무엇이라고 생각하나요?",
  entryPriority: "입학 상담에서 가장 도움받고 싶은 점",
  dream: "하고 싶은 직업 또는 목표",
  targetUniversity: "목표 대학·계열·전공",
  requests: "학원에 바라는 점",
  prevComplaint: "기존 학원에서 아쉬웠던 점",
};
const STUDENT_ANSWER_ORDER: (keyof StudentAnswersSafe)[] = [
  "problemSelf",
  "mathDifficulty",
  "englishDifficulty",
  "studyCore",
  "entryPriority",
  "dream",
  "targetUniversity",
  "requests",
  "prevComplaint",
];

const PARENT_QUESTIONS: { q: string; options?: string[]; blank?: string; blanks?: string[] }[] = [
  { q: "학생에게 강한 학습(철저한 관리, 많은 숙제)을 원하시나요?", options: ["원한다", "적당히", "부담 없이"] },
  { q: "이 결과지가 파악한 학생 모습이 학부모님 생각과 같으신가요?", options: ["같다", "대체로 같다", "다르다"], blank: "다른 점:" },
  { q: "학원에서 연락을 얼마나 자주 받고 싶으신가요?", options: ["매주", "2주에 한 번", "한 달에 한 번", "필요할 때만"] },
  { q: "공부 문제에서 학생이 원하는 대로 따라가 주시는 편인가요?", options: ["그렇다", "반반이다", "아니다"] },
  { q: "좋은 대학 진학이 목표인가요?", options: ["그렇다", "아직 정하지 않았다", "다른 목표가 있다"], blank: "다른 목표:" },
  { q: "이번 시험의 목표 점수는 몇 점인가요?", blanks: ["수학", "영어"] },
  { q: "학생이 힘들어할 때 학원이 어떻게 해 주길 원하시나요?", options: ["강하게 밀어 주기", "다독여 주기", "학부모와 먼저 상의"] },
  { q: "학원에 특별히 바라는 점이 있으신가요?", blank: "바라는 점:" },
];

// ── 본체 ───────────────────────────────────────────────────────────────────

export function ParentReport({ data }: { data: ParentSafeProfile }) {
  const s = data.scores;
  const rawI = data.interpretation;
  const i = {
    ...rawI,
    studentType: toEntranceReportWording(rawI.studentType),
    parentSummary: toEntranceReportWording(rawI.parentSummary),
    detailedSummary: rawI.detailedSummary ? toEntranceReportWording(rawI.detailedSummary) : undefined,
    mathStrategy: rawI.mathStrategy ? toEntranceReportWording(rawI.mathStrategy) : null,
    englishStrategy: rawI.englishStrategy ? toEntranceReportWording(rawI.englishStrategy) : null,
  };
  const review = s.responseQualityStatus === "review";
  const genDate = formatDate(data.generatedAt);
  const who = studentLabel(data.display.name);
  const showMath = data.subjectSelection === "math" || data.subjectSelection === "both";
  const showEnglish = data.subjectSelection === "english" || data.subjectSelection === "both";
  const subjectItemNote = [showMath ? "수학 10문항" : null, showEnglish ? "영어 10문항" : null].filter(Boolean).join(" + ");

  const profileItems = PROFILE_KEYS.map((k) => ({ key: k, label: CONSTRUCT_LABEL[k], score: s.common[k] }));
  const management = managementLine(data.verdicts);
  const guidance = guidanceLine(data.verdicts);
  const summaryParas = i.detailedSummary ? splitParagraphs(i.detailedSummary) : [i.parentSummary];
  const answers = data.studentAnswers ?? (data.entryPriority ? { entryPriority: data.entryPriority } : {});
  const answerEntries = STUDENT_ANSWER_ORDER.filter((k) => answers[k]).map((k) => ({ key: k, label: STUDENT_ANSWER_LABEL[k], value: answers[k] as string }));
  const tags = data.difficultyTags ?? {};
  const grade = (k: CommonConstruct) => gradeOf(s.common[k]);

  // 08 NK 지도 방향 — 판정과 등급에서 결정론적으로 만든다.
  const gv = data.verdicts?.guidance.verdict;
  const guidanceRows = [
    {
      area: "피드백 방식",
      line: gv === "강하게 밀어도 됨" ? "고칠 점을 바로 짚어 줍니다." : gv === "차분히 다독이며" ? "잘한 점을 먼저 말한 뒤 차분히 고쳐 줍니다." : "바로 짚되 잘한 점을 먼저 말합니다.",
      why: guidance.sentence,
    },
    {
      area: "과제·계획의 틀",
      line: grade("goalClarity") === "good" ? "학생이 세운 계획을 그대로 쓰고 한 주 단위로만 점검합니다." : "첫 달은 정해진 틀로 시작하고, 이후 선택권을 넓힙니다.",
      why: grade("goalClarity") === "good" ? "목표와 이번 주 계획을 스스로 말할 수 있다고 답했습니다." : "이번 주 할 공부를 미리 정하는 답이 낮았습니다. 틀을 먼저 주고 4주 뒤부터 선택지를 늘립니다.",
    },
    {
      area: "질문·오답 처리",
      line: grade("questionInitiative") === "good" ? "수업 중 바로 묻게 두고, 오답은 학생이 정한 순서로 봅니다." : "강사가 먼저 묻고, 오답은 무엇부터 볼지 순서를 정해 줍니다.",
      why: grade("questionInitiative") === "good" ? "모르면 바로 손을 들고 묻는다고 답했습니다." : "먼저 묻는 편이 아니라고 답했습니다.",
    },
    {
      area: "결과가 늦을 때",
      line: grade("shortTermRecovery") === "good" ? "힘든 구간을 따로 잡지 않아도 정규 과제로 갑니다." : "낮은 결과가 나온 직후 이틀 안에 할 일을 잘게 쪼개 줍니다.",
      why: grade("shortTermRecovery") === "good" ? "낮은 점수 뒤에도 다시 시작한다고 답했습니다." : "낮은 점수를 받으면 다음 공부를 미루는 쪽으로 나타났습니다.",
    },
    {
      area: "학부모 소통",
      line: data.transitionPlan?.some((t) => t.concern === "성적 변화 체감 부족") ? "작은 변화 지표를 4주마다 공유합니다." : "한 달에 한 번 학습 상황을 공유합니다.",
      why: data.transitionPlan?.some((t) => t.concern === "성적 변화 체감 부족") ? "이전 학원에서 성적 변화를 체감하지 못한 점을 골랐습니다." : "학부모 질문(10번)의 연락 빈도에 맞춰 조정합니다.",
    },
  ];

  const phases = [
    {
      weeks: "1~4주",
      goal: grade("shortTermRecovery") === "good" ? "학원의 관리 방식을 그대로 익힙니다." : "결과가 늦게 나오는 구간을 먼저 잡습니다.",
      actions: [
        grade("shortTermRecovery") === "good" ? "정규 과제와 주간 확인으로 시작합니다." : "점수가 나온 뒤 이틀 안에 할 일을 잘게 쪼개 전달합니다.",
        grade("questionInitiative") === "good" ? "수업 중 바로 묻게 둡니다." : "수업 중 담당 강사가 먼저 막힌 곳을 묻습니다.",
      ],
      check: "주간 질문 횟수와 숙제 제출 전 확인 체크",
      owner: "담당 강사",
    },
    {
      weeks: "5~8주",
      goal: "오답을 무엇부터 볼지 순서를 고정합니다.",
      actions: ["오답 처리 순서를 정해 매주 같은 순서로 씁니다.", "고친 문제를 다시 확인하는 단계를 숙제 마무리에 넣습니다."],
      check: "오답 노트 재확인 비율",
      owner: "담당 강사",
    },
    {
      weeks: "9~12주",
      goal: "계획을 학생이 세우고 한 주 단위로만 점검합니다.",
      actions: ["학생이 스스로 주간 계획을 세웁니다.", "작은 변화 지표를 학부모와 공유합니다."],
      check: "계획 지속 여부와 변화 지표 공유 1회",
      owner: "상담 담당 · 학부모 공유",
    },
  ];

  return (
    <>
      {/* 표지 */}
      <header className="pr3-cover" id="sec-cover">
        <div className="pr3-cover__brand">
          <span className="pr3-cover__mark">NK</span>
          <span>입학 학습성향 프로필 · 결과보고서</span>
          <em>{genDate}</em>
        </div>
        <h1>{data.display.name} 학생</h1>
        <p className="pr3-cover__sub">입학 학습성향 결과보고서</p>
        <dl className="pr3-cover__info">
          <div><dt>학년</dt><dd>{data.display.schoolGrade || "—"}</dd></div>
          <div><dt>검사 과목</dt><dd>{SUBJECT_LABEL[data.subjectSelection]}</dd></div>
          <div><dt>검사 형태</dt><dd>공통 36문항 + {subjectItemNote}</dd></div>
          <div><dt>응답 방식</dt><dd>본인 자기보고(최근 2주 기준)</dd></div>
        </dl>
      </header>

      {/* 01 */}
      <ReportSection id="sec-overview" index="01" title="검사 개요 및 응답 신뢰도">
        <p className="pr3-lead">
          이 검사는 학습 태도·숙제·목표·회복·관리 수용·질문·휴대폰·친구 여덟 갈래의 <b>행동 습관</b>을 학생 본인이 보고한 자료입니다.
        </p>
        <p className="pr3-sub">성적이나 지능을 재는 검사가 아니고 성격을 나누는 검사도 아니며, 또래와 비교한 등수도 아닙니다.</p>
        <table className="pr3-table">
          <thead>
            <tr><th>응답 신뢰도 지표</th><th>확인 결과</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><b>추가 확인 신호</b><span>응답 시간·같은 답 반복·서로 반대인 문항의 어긋남을 봅니다.</span></td>
              <td className={review ? "is-help" : "is-good"}>{review ? "있음" : "없음"}</td>
            </tr>
            <tr>
              <td><b>해석 방식</b><span>{review ? "입학 상담에서 문항 뜻과 실제 경험을 다시 확인한 뒤 해석합니다." : "응답을 그대로 해석해도 됩니다."}</span></td>
              <td className={review ? "is-watch" : "is-good"}>{review ? "확인 후 해석" : "바로 해석"}</td>
            </tr>
          </tbody>
        </table>
        {data.responseDistribution && (
          <>
            <h3 className="pr3-h3">빈도 문항의 선택지 분포</h3>
            <DistributionBar {...data.responseDistribution} />
          </>
        )}
      </ReportSection>

      {/* 02 */}
      <ReportSection id="sec-verdict" index="02" title="핵심 판단 두 가지">
        <article className="pr3-verdict">
          <span className="pr3-eyebrow">철저한 관리를 버틸 수 있는가</span>
          <p className="pr3-verdict__q">NK는 철저한 관리로 조금 힘들 수 있는데 버틸 수 있겠니?</p>
          <b className={`pr3-verdict__badge is-${verdictTone(data.verdicts?.management.verdict)}`}>{data.verdicts?.management.verdict ?? "판정 보류"}</b>
          <p className="pr3-verdict__body">{management.sentence}</p>
          {management.direct && (
            <p className="pr3-verdict__direct"><span>학생에게 직접 물었습니다</span><b>본인 답: &ldquo;{management.direct}&rdquo;</b></p>
          )}
          {management.note && <p className="pr3-note">{management.note}</p>}
          <p className="pr3-verdict__basis">
            <span>이 판단이 나온 곳</span>
            <b>관리 수용 <GradeBadge score={s.common.managementAcceptance} /></b>
            <b>단기 회복력 <GradeBadge score={s.common.shortTermRecovery} /></b>
          </p>
        </article>

        <article className="pr3-verdict">
          <span className="pr3-eyebrow">강하게 밀어도 되는가, 다독여야 하는가</span>
          <p className="pr3-verdict__q">강사가 강하게 해도 버틸 수 있는 아이인가, 차분하게 다독이며 가야 하는 학생인가?</p>
          <b className={`pr3-verdict__badge is-${verdictTone(data.verdicts?.guidance.verdict)}`}>{data.verdicts?.guidance.verdict ?? "판정 보류"}</b>
          <p className="pr3-verdict__body">{guidance.sentence}</p>
          {guidance.choice && (
            <p className="pr3-verdict__direct"><span>두 선생님 중 고르게 했습니다</span><b>본인 선택: {guidance.choice}</b></p>
          )}
          <GuidanceQuadrant x={s.common.coachingResponse} y={s.common.shortTermRecovery} />
          <p className="pr3-note">
            점선은 지켜볼 것이 시작되는 경계입니다.{" "}
            {guidance.confirm ? "본인이 고른 선생님과 응답이 갈려 첫 상담에서 실제 사례를 확인합니다." : "본인 선택과 응답이 같은 방향입니다."}
          </p>
        </article>
      </ReportSection>

      {/* 03 */}
      <ReportSection id="sec-profile" index="03" title="프로파일">
        <h3 className="pr3-h3">여덟 행동의 모양</h3>
        <Radar axes={profileItems.map((it) => ({ label: it.label, score: it.score }))} />
        <p className="pr3-note">안쪽 점선 원이 지켜볼 것의 경계, 바깥 점선 원이 잘 되고 있음의 경계입니다. 바깥으로 갈수록 습관이 자리 잡은 쪽입니다.</p>
        <ul className="pr3-legend" aria-label="등급 범례">
          <li><i style={{ background: C.coral }} />먼저 도울 것</li>
          <li><i style={{ background: C.brass }} />지켜볼 것</li>
          <li><i style={{ background: C.teal }} />잘 되고 있음</li>
        </ul>
        <div className="pr3-rows">
          {profileItems.map((it) => (
            <div key={it.key} className="pr3-rows__row">
              <div className="pr3-rows__head"><h4>{it.label}</h4><GradeBadge score={it.score} /></div>
              <ZoneBar score={it.score} />
            </div>
          ))}
          {(showMath || showEnglish) && <span className="pr3-rows__divider">과목 공부 방식 · 보조</span>}
          {showMath && s.math && (
            <div className="pr3-rows__row">
              <div className="pr3-rows__head"><h4>수학 공부 방식</h4><GradeBadge score={s.math.mathStrategy} /></div>
              <ZoneBar score={s.math.mathStrategy} />
            </div>
          )}
          {showEnglish && s.english && (
            <div className="pr3-rows__row">
              <div className="pr3-rows__head"><h4>영어 공부 방식</h4><GradeBadge score={s.english.englishStrategy} /></div>
              <ZoneBar score={s.english.englishStrategy} />
            </div>
          )}
        </div>
        <p className="pr3-note">막대는 학생 본인의 응답을 환산한 내부 지표입니다. 또래 규준·백분위·능력 점수가 아닙니다.</p>
      </ReportSection>

      {/* 04 */}
      <ReportSection id="sec-questions" index="04" title="질문별 해석" caption="묻고 싶은 것마다 답을 한 줄로 먼저 적었습니다.">
        <div className="pr3-qs">
          {profileItems.map((it, idx) => {
            const band = signalBandOf(it.score);
            const g = gradeOf(it.score);
            const desc = band ? SIGNAL_DESC[it.key][band] : null;
            const isMgmt = it.key === "managementAcceptance";
            return (
              <article key={it.key} className={`pr3-q is-${gradeTone(it.score)}`}>
                <header>
                  <span className="pr3-q__num">{idx + 1}</span>
                  <div>
                    <h4>{it.label}</h4>
                    <p className="pr3-q__question">{CONSTRUCT_QUESTION[it.key]}</p>
                  </div>
                  <GradeBadge score={it.score} />
                </header>
                <p className="pr3-q__answer">{g && band ? ANSWER_LINE[it.key][band] : SIGNAL_INSUFFICIENT}</p>
                {desc && <p className="pr3-q__state">{desc.state} {desc.example}</p>}
                {isMgmt && management.direct && (
                  <p className="pr3-q__direct">본인 답: &ldquo;{management.direct}&rdquo;</p>
                )}
                {desc && (
                  <p className="pr3-q__help"><span>학원에서는</span>{desc.help}</p>
                )}
              </article>
            );
          })}
        </div>
      </ReportSection>

      {/* 05 */}
      <ReportSection id="sec-answers" index="05" title="학생이 직접 적은 것" caption="현재 학습의 어려운 점은 무엇인가?">
        {(tags.math?.length || tags.english?.length) ? (
          <div className="pr3-chips-block">
            {tags.math?.length ? (
              <div><span className="pr3-eyebrow">수학에서 고른 어려운 점</span><div className="pr3-chips">{tags.math.map((t) => <span key={t}>{t}</span>)}</div></div>
            ) : null}
            {tags.english?.length ? (
              <div><span className="pr3-eyebrow">영어에서 고른 어려운 점</span><div className="pr3-chips">{tags.english.map((t) => <span key={t}>{t}</span>)}</div></div>
            ) : null}
            <p className="pr3-note">여덟 개 가운데 최대 세 개까지 고르게 했습니다.</p>
          </div>
        ) : null}
        {answerEntries.length > 0 ? (
          <dl className="pr3-answers">
            {answerEntries.map((a) => (
              <div key={a.key}>
                <dt>{a.label}</dt>
                <dd>&ldquo;{a.value}&rdquo;</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="pr3-note">학생이 적은 문장이 없습니다.</p>
        )}
        <p className="pr3-note">학생이 적은 문장을 고치지 않고 그대로 옮겼습니다. 학원 이름은 싣지 않습니다.</p>
      </ReportSection>

      {/* 06 */}
      {(showMath || showEnglish) && (
        <ReportSection id="sec-subject" index="06" title="과목 공부 방식" caption="과목 실력이 아니라 공부하는 방식에 대한 응답입니다. 실력은 별도의 입학테스트로 봅니다.">
          <div className="pr3-subjects">
            {showMath && s.math && (
              <article>
                <header><h4>수학</h4><GradeBadge score={s.math.mathStrategy} /></header>
                <ZoneBar score={s.math.mathStrategy} />
                <p>{i.mathStrategy ?? (signalBandOf(s.math.mathStrategy) ? SUBJECT_SIGNAL_DESC.math[signalBandOf(s.math.mathStrategy)!].state : SIGNAL_INSUFFICIENT)}</p>
              </article>
            )}
            {showEnglish && s.english && (
              <article>
                <header><h4>영어</h4><GradeBadge score={s.english.englishStrategy} /></header>
                <ZoneBar score={s.english.englishStrategy} />
                <p>{i.englishStrategy ?? (signalBandOf(s.english.englishStrategy) ? SUBJECT_SIGNAL_DESC.english[signalBandOf(s.english.englishStrategy)!].state : SIGNAL_INSUFFICIENT)}</p>
              </article>
            )}
          </div>
        </ReportSection>
      )}

      {/* 07 */}
      <ReportSection id="sec-summary" index="07" title="종합 소견" caption={`${who}이 직접 쓴 응답을 바탕으로 정리했습니다.`}>
        <div className="pr3-summary">
          {summaryParas.map((p, idx) => (
            <p key={idx}>{p}</p>
          ))}
          {data.mbti && (
            <p className="pr3-summary__mbti">
              학생이 적은 MBTI는 {data.mbti.type}입니다. 공식 검사가 아니라 점수·등급에 반영하지 않으며, 상담에서 참고만 합니다.
            </p>
          )}
        </div>
      </ReportSection>

      {/* 08 */}
      <ReportSection id="sec-guidance" index="08" title="NK 지도 방향">
        <p className="pr3-lead pr3-lead--navy">
          {gv === "강하게 밀어도 됨" ? "틀을 정해 주고 고칠 점을 바로 짚으며" : gv === "차분히 다독이며" ? "잘한 점을 먼저 말하고 차분히 고치며" : "틀을 먼저 주고 바로 짚되 잘한 점을 먼저 말하며"}, 막힌 곳은 강사가 먼저 묻고, 결과가 늦게 나오는 구간을 잡아 주는 방향으로 시작합니다.
        </p>
        <table className="pr3-table pr3-table--guidance">
          <tbody>
            {guidanceRows.map((r) => (
              <tr key={r.area}>
                <th>{r.area}</th>
                <td><b>{r.line}</b><span>{r.why}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="pr3-note">지도 방향은 등록 후 첫 상담에서 학생·보호자와 확인해 조정합니다.</p>
      </ReportSection>

      {/* 09 */}
      <ReportSection id="sec-plan" index="09" title="등록 시 12주 운영 계획(안)">
        {data.transitionPlan && data.transitionPlan.length > 0 && (
          <div className="pr3-transition">
            <span className="pr3-eyebrow">학생이 고른 이전 학원 경험</span>
            <ul>
              {data.transitionPlan.map((t, idx) => (
                <li key={`${t.concern}-${idx}`}><b>{t.concern}</b><span>{t.title}</span></li>
              ))}
            </ul>
          </div>
        )}
        <Timeline phases={phases} />
        <p className="pr3-note">등록 후 입학 상담에서 합의해 확정합니다. 학생 일정에 맞춰 조정합니다.</p>
      </ReportSection>

      {/* 10 */}
      <ReportSection id="sec-parent" index="10" title="학부모님께 여쭙니다" caption="상담 전에 표시해 주시면 상담이 빨라집니다.">
        <ol className="pr3-parent">
          {PARENT_QUESTIONS.map((pq, idx) => (
            <li key={pq.q}>
              <span className="pr3-parent__num">{idx + 1}</span>
              <div>
                <p>{pq.q}</p>
                {pq.options && (
                  <div className="pr3-parent__opts">{pq.options.map((o) => <span key={o}>{o}</span>)}</div>
                )}
                {pq.blank && <p className="pr3-parent__blank"><span>{pq.blank}</span><i /></p>}
                {pq.blanks && (
                  <div className="pr3-parent__blanks">
                    {pq.blanks.map((b) => <p key={b}><span>{b}</span><i /><em>점</em></p>)}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
        <p className="pr3-note">표시해 주신 답은 입학 상담에서 함께 봅니다.</p>
      </ReportSection>

      {/* 꼬리말 */}
      <footer className="report-v2-caution">
        <strong>이 결과보고서에 대하여</strong>
        <p>
          학생 본인의 자기보고 응답을 정리한 것입니다. 성적·지능·성격 유형을 재는 검사가 아닙니다. 또래 규준이 없는 검사이며, 등급은 학원 내부 기준으로 나눈 것입니다. 답한 날의 상태에 따라 달라질 수 있어, 등원 후 4주 시점에 실제 모습과 다시 맞춰 봅니다.
          {review ? " 응답에 추가 확인 신호가 있어, 입학 상담에서 문항 뜻과 학생의 실제 경험을 다시 확인해야 합니다." : ""}
        </p>
      </footer>
      <p className="report-v2-genstamp">NK EDUCATION · 학습성향 프로필 · 결과보고서 3판 · 생성일 {genDate}</p>
    </>
  );
}
