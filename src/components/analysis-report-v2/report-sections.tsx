// 상담자·학부모 공용 섹션 블록. 두 화면이 동일 함수를 호출해 점수·문구가 어긋나지 않게 한다.
// 각 블록은 상담자 원본과 학부모 parent-safe가 모두 제공하는 최소 shape만 받는다.

import type { ReactNode } from "react";
import type {
  CommonScores,
  EnglishScores,
  MathScores,
  MbtiAxes,
  NkFitStage,
  Score,
  SubjectSelection,
} from "@/lib/assessment/v2/types";
import { C, CONSTRUCT_LABEL, isNum, scoreText } from "./report-theme";
import {
  BulletList,
  Card,
  CoreSignalsRadar,
  InfoNote,
  MbtiAxisTable,
  NkAreaRow,
  Paragraph,
  ScoreRow,
  SectionTitle,
} from "./report-ui";

type CoachingLite = {
  coachingType: string;
  autonomyStructureType: string;
  challenge: Score;
  safety: Score;
  autonomy: Score;
  structure: Score;
};

type NkFitLite = {
  stage: NkFitStage;
  overall: number | null;
  areas: {
    clinic: NkAreaLite;
    weeklyTest: NkAreaLite;
    homework: NkAreaLite;
    immediateFeedback: NkAreaLite;
  };
};
type NkAreaLite = {
  preference: number | null;
  readiness: number | null;
  featureFit: number | null;
};

const MBTI_NOTICE =
  "숙제·성실성·의지·회복력·휴대폰·NK 적합도·과목점수에는 MBTI를 반영하지 않습니다. MBTI는 지도 선호축에만 확신도(0/4/8%)로 보조 반영됩니다.";

export function CoreSignalsBlock({ common }: { common: CommonScores }) {
  const keys: (keyof CommonScores)[] = [
    "learningAttitude",
    "homeworkReliability",
    "phoneBoundary",
    "longTermPersistence",
    "shortTermRecovery",
    "peerLearningResource",
  ];
  const radarAxes = keys.map((k) => ({
    label: CONSTRUCT_LABEL[k],
    score: common[k],
  }));
  return (
    <Card>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 8 }}>
        <CoreSignalsRadar axes={radarAxes} />
        <div>
          {keys.map((k) => (
            <ScoreRow key={k} label={CONSTRUCT_LABEL[k]} score={common[k]} />
          ))}
        </div>
      </div>
    </Card>
  );
}

/** 8.3 성실성 구성요소 공개 + 학습 태도·숙제. */
export function LearningHomeworkBlock({ common }: { common: CommonScores }) {
  const cons = common.conscientiousness;
  return (
    <Card>
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: C.navy }}>학습 성실성 종합</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: isNum(cons) ? C.navy : C.faint }}>
            {scoreText(cons)}
          </span>
        </div>
        <p style={{ fontSize: 12, color: C.sub, margin: "4px 0 0" }}>
          성실성은 단일 인상이 아니라 학습 태도·숙제 신뢰·장기 의지의 구성으로 봅니다
          (0.30·태도 + 0.45·숙제 + 0.25·장기 의지). 셋 중 하나라도 정보가 부족하면 종합값을 만들지 않습니다.
        </p>
      </div>
      <ScoreRow label="학습 태도" score={common.learningAttitude} />
      <ScoreRow label="숙제 신뢰도" score={common.homeworkReliability} />
      <ScoreRow label="장기 의지(성실성 구성)" score={common.longTermPersistence} />
    </Card>
  );
}

export function PersistenceRecoveryBlock({ common }: { common: CommonScores }) {
  const lt = common.longTermPersistence;
  const sr = common.shortTermRecovery;
  let cross: string | null = null;
  if (isNum(lt) && isNum(sr)) {
    if (lt >= 60 && sr < 60)
      cross =
        "목표는 유지하지만 당일 막힘·낮은 점수 직후 복귀가 약할 수 있습니다. 과제 분할과 빠른 재시작 신호, 짧은 성공 경험이 도움이 됩니다.";
    else if (lt < 60 && sr >= 60)
      cross =
        "당장은 버티지만 장기 루틴이 흔들릴 수 있습니다. 주간 계획과 눈에 보이는 누적 기록, 정기 점검이 도움이 됩니다.";
  }
  return (
    <Card>
      <ScoreRow label="장기 의지" score={lt} />
      <ScoreRow label="단기 회복력" score={sr} />
      {cross && (
        <div style={{ marginTop: 8 }}>
          <InfoNote tone="info">{cross}</InfoNote>
        </div>
      )}
    </Card>
  );
}

export function PhoneFriendsPersonalityBlock({
  common,
  coaching,
}: {
  common: CommonScores;
  coaching: CoachingLite;
}) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.navy, margin: "0 0 8px" }}>
          휴대폰 자기조절
        </p>
        <ScoreRow label="휴대폰 자기조절" score={common.phoneBoundary} />
      </Card>
      <Card>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.navy, margin: "0 0 8px" }}>
          친구와 학습 환경
        </p>
        <ScoreRow label="또래 학습 자원" score={common.peerLearningResource} />
        <ScoreRow
          label="또래 집중 경계(높을수록 주의)"
          score={common.peerFocusBoundary}
          reverse
        />
      </Card>
      <Card>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.navy, margin: "0 0 8px" }}>
          학습 반응 성격(지도 선호 신호)
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          <TypePill label="지도 유형" value={coaching.coachingType} />
          <TypePill label="자율·구조" value={coaching.autonomyStructureType} />
        </div>
        <ScoreRow label="직접 피드백 수용" score={coaching.challenge} />
        <ScoreRow label="관계 안전 요구" score={coaching.safety} />
        <ScoreRow label="자율성 요구" score={coaching.autonomy} />
        <ScoreRow label="구조 요구" score={coaching.structure} />
        <div style={{ marginTop: 8 }}>
          <InfoNote>
            성격 축은 우열이 아니라 학습 상황에서의 반응입니다. 낙인 없이 교사의 전달 방식으로만
            사용합니다.
          </InfoNote>
        </div>
      </Card>
    </div>
  );
}

function TypePill({ label, value }: { label: string; value: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        gap: 6,
        alignItems: "center",
        background: C.panel,
        border: `1px solid ${C.line}`,
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 12,
      }}
    >
      <span style={{ color: C.faint }}>{label}</span>
      <span style={{ color: C.navy, fontWeight: 700 }}>{value}</span>
    </span>
  );
}

export function MbtiBlock({ mbtiAxes }: { mbtiAxes: MbtiAxes }) {
  const rows = [
    {
      label: "상호작용 선호",
      axis: mbtiAxes.interactionAxis,
      poles: "혼자 정리·1:1 숙고 ↔ 즉시 대화·협력",
    },
    {
      label: "설명 방식",
      axis: mbtiAxes.conceptAxis,
      poles: "사례·순서·구체 ↔ 원리·패턴·큰그림",
    },
    {
      label: "피드백 방식",
      axis: mbtiAxes.relationalFeedbackAxis,
      poles: "기준·원인 중심 ↔ 관계 안전·의미 중심",
    },
    {
      label: "진행 방식",
      axis: mbtiAxes.flexibilityAxis,
      poles: "구조·마감·중간점검 ↔ 선택권·유연한 순서",
    },
  ];
  return (
    <Card>
      <MbtiAxisTable rows={rows} />
      <div style={{ marginTop: 10 }}>
        <InfoNote tone="caution">{MBTI_NOTICE}</InfoNote>
      </div>
      {!mbtiAxes.applied && (
        <p style={{ fontSize: 12, color: C.faint, marginTop: 8 }}>
          유효한 MBTI·확신도가 없어 조정값이 0입니다(최종=원점수).
        </p>
      )}
    </Card>
  );
}

const NK_AREA_LABEL: Record<string, string> = {
  clinic: "클리닉·보완학습",
  weeklyTest: "주간 테스트·재보완",
  homework: "숙제·의무 보충",
  immediateFeedback: "진도·과제 즉시 피드백",
};

export function NkFitBlock({
  nkFit,
  interpretation,
}: {
  nkFit: NkFitLite;
  interpretation: string;
}) {
  const areaKeys = ["clinic", "weeklyTest", "homework", "immediateFeedback"] as const;
  return (
    <Card>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 800, color: C.navy }}>
          NK 운영 적합도: {nkFit.stage}
        </span>
        <span style={{ fontSize: 12, color: C.sub }}>
          {nkFit.overall !== null ? `종합 ${nkFit.overall}` : "종합 산출 보류"}
        </span>
      </div>
      <div style={{ marginBottom: 10 }}>
        {areaKeys.map((k) => (
          <NkAreaRow key={k} label={NK_AREA_LABEL[k]} {...nkFit.areas[k]} />
        ))}
      </div>
      <Paragraph>{interpretation}</Paragraph>
      <InfoNote>
        NK 적합도는 등록 합격·부적합 판정이 아니라, 선호와 현재 준비도를 나눠 보고 NK가 제공해야 할
        지원 조건을 함께 확인하는 지표입니다.
      </InfoNote>
    </Card>
  );
}

export function SubjectStrategyBlock({
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
    <div style={{ display: "grid", gap: 14 }}>
      {showMath && math && (
        <Card>
          <p style={{ fontSize: 14, fontWeight: 800, color: C.navy, margin: "0 0 10px" }}>
            수학 학습전략
          </p>
          <ScoreRow label="수학 학습전략" score={math.mathStrategy} />
          <ScoreRow label="수학 자기효능감" score={math.mathSelfEfficacy} />
          <ScoreRow label="낯선 유형 회피(높을수록 주의)" score={math.mathNoveltyAvoidance} reverse />
          <ScoreRow label="시험 긴장 방해(높을수록 주의)" score={math.mathTestInterference} reverse />
          {mathStrategy && (
            <div style={{ marginTop: 8 }}>
              <Paragraph>{mathStrategy}</Paragraph>
            </div>
          )}
        </Card>
      )}
      {showEnglish && english && (
        <Card>
          <p style={{ fontSize: 14, fontWeight: 800, color: C.navy, margin: "0 0 10px" }}>
            영어 학습전략
          </p>
          <ScoreRow label="영어 학습전략" score={english.englishStrategy} />
          <ScoreRow label="영어 자기효능감" score={english.englishSelfEfficacy} />
          <ScoreRow label="긴 지문 회피(높을수록 주의)" score={english.englishReadingAvoidance} reverse />
          <ScoreRow label="시험 긴장 방해(높을수록 주의)" score={english.englishTestInterference} reverse />
          {englishStrategy && (
            <div style={{ marginTop: 8 }}>
              <Paragraph>{englishStrategy}</Paragraph>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

export function StrengthsGrowthBlock({
  strengths,
  growthAreas,
}: {
  strengths: string[];
  growthAreas: string[];
}) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card style={{ borderLeft: `3px solid ${C.teal}` }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: C.teal, margin: "0 0 8px" }}>강점</p>
        <BulletList items={strengths} color={C.teal} />
      </Card>
      <Card style={{ borderLeft: `3px solid ${C.coral}` }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: C.coral, margin: "0 0 8px" }}>
          개선·초기 확인 영역
        </p>
        <BulletList items={growthAreas} color={C.coral} />
      </Card>
    </div>
  );
}

export function RoadmapBlock({
  roadmap,
}: {
  roadmap: { weeks: string; focus: string; actions: string[] }[];
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {roadmap.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: 0 }} className="rpt-card">
          <div style={{ width: 4, background: C.brass, borderRadius: 4, flexShrink: 0 }} />
          <div style={{ padding: "10px 14px", flex: 1, background: C.cardBg, border: `1px solid ${C.line}`, borderLeft: "none", borderRadius: "0 10px 10px 0" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: C.navy, padding: "2px 8px", borderRadius: 6 }}>
                {r.weeks}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{r.focus}</span>
            </div>
            <BulletList items={r.actions} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PrinciplesBlock({
  responseQualityStatus,
  extra,
}: {
  responseQualityStatus: "normal" | "review";
  extra?: ReactNode;
}) {
  return (
    <Card>
      <SectionTitle index="14" title="해석 원칙" />
      <BulletList
        items={[
          "모든 수치는 최근 4주 학생 자기보고이며, 첫 14일 실제 행동으로 재확인하는 것을 전제로 해석합니다.",
          "행동 점수와 상황문항·서술이 달라도 거짓으로 단정하지 않고 상담에서 확인합니다.",
          "휴대폰 사용·성격·친구관계를 의학적·심리적 진단으로 해석하지 않습니다.",
          "NK 적합도는 등록 판정이 아니라 필요한 지원 조건을 함께 보는 지표입니다.",
          "MBTI는 지도 선호축에만 보조 반영되며 성실성·의지·회복력을 단정하지 않습니다.",
        ]}
      />
      {responseQualityStatus === "review" && (
        <div style={{ marginTop: 10 }}>
          <InfoNote tone="caution">
            첫 14일 행동 확인 필요: 초기 수치는 확정이 아니라 확인 대상으로 해석하세요.
          </InfoNote>
        </div>
      )}
      {extra}
    </Card>
  );
}
