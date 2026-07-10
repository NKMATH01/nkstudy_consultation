// 상담자용 V2 결과 보고서 (§12.1 화면 순서 1~14). 전체 result_profile_v2를 렌더한다.
// 학부모 공유본과 공유하는 점수 블록은 report-sections.tsx에서 온다.

import type { ResultProfileV2 } from "@/lib/assessment/v2/interpretation";
import type { CommonScores } from "@/lib/assessment/v2/types";
import { C, SUBJECT_LABEL, formatDate, isNum } from "./report-theme";
import {
  BulletList,
  Card,
  CoachingCoordinate,
  InfoNote,
  Paragraph,
  SectionTitle,
} from "./report-ui";
import { ReportPage } from "./report-frame";
import {
  CoreSignalsBlock,
  LearningHomeworkBlock,
  MbtiBlock,
  NkFitBlock,
  PersistenceRecoveryBlock,
  PhoneFriendsPersonalityBlock,
  PrinciplesBlock,
  RoadmapBlock,
  StrengthsGrowthBlock,
  SubjectStrategyBlock,
} from "./report-sections";

/** 상담자 배경 교차해석용 사전정보(intake_v2에서 서버가 선별). 학부모 공유본에는 전달하지 않는다. */
export interface CounselorBackground {
  prevAcademy?: string | null;
  prevLeaveReason?: string | null;
  prevComplaint?: string | null;
  referral?: string | null;
  nkKnowledge?: string | null;
  nkExpectations?: string[] | null;
  preferredDays?: string | null;
  availableTime?: string | null;
  clinicCondition?: string | null;
  hasFuturePlan?: string | null;
  dream?: string | null;
  targetUniversity?: string | null;
  studyCore?: string | null;
  problemSelf?: string | null;
  mathDifficulty?: string | null;
  englishDifficulty?: string | null;
  healthNote?: string | null;
  requests?: string | null;
}

export interface CounselorReportProps {
  profile: ResultProfileV2;
  header: { name: string; schoolGrade: string; createdAt?: string | null };
  background?: CounselorBackground | null;
  contacts?: { studentPhone?: string | null; parentPhone?: string | null } | null;
}

function computeGaps(common: CommonScores): string[] {
  const out: string[] = [];
  const { longTermPersistence: lt, shortTermRecovery: sr, homeworkReliability: hr } = common;
  if (isNum(lt) && isNum(sr) && Math.abs(lt - sr) >= 20) {
    out.push(
      lt > sr
        ? "장기 의지는 높지만 단기 회복이 낮습니다 — 목표는 있으나 당일 막힘에서 다시 시작하는 구조가 필요합니다."
        : "단기 회복은 좋지만 장기 의지가 낮습니다 — 당장은 버티나 장기 루틴을 눈에 보이게 만드는 지원이 필요합니다."
    );
  }
  if (isNum(common.learningAttitude) && isNum(hr) && common.learningAttitude - hr >= 20) {
    out.push(
      "학습 태도에 비해 숙제 신뢰도가 낮습니다 — 의지보다 시작·제출 실행 구조의 문제일 수 있습니다."
    );
  }
  if (isNum(common.phoneBoundary) && common.phoneBoundary < 50) {
    out.push("공부 시작 시 휴대폰 자동 확인이 주의 전환 위험으로 나타날 수 있습니다(물리적 분리 권장).");
  }
  return out;
}

function BackgroundFacts({ bg }: { bg: CounselorBackground }) {
  const facts: { label: string; value?: string | null }[] = [
    { label: "기존 학원", value: bg.prevAcademy },
    { label: "이전 학원 이탈 이유", value: bg.prevLeaveReason },
    { label: "기존 학원 아쉬운 점", value: bg.prevComplaint },
    { label: "유입 경로", value: bg.referral },
    { label: "NK 인지 수준", value: bg.nkKnowledge },
    { label: "희망 요일", value: bg.preferredDays },
    { label: "등원 가능 시간", value: bg.availableTime },
    { label: "클리닉 참여 조건", value: bg.clinicCondition },
    { label: "미래 계획 여부", value: bg.hasFuturePlan },
    { label: "희망 직업", value: bg.dream },
    { label: "목표 대학·계열", value: bg.targetUniversity },
    { label: "공부의 핵심(자기 인식)", value: bg.studyCore },
    { label: "스스로 느끼는 문제", value: bg.problemSelf },
    { label: "수학 어려움", value: bg.mathDifficulty },
    { label: "영어 어려움", value: bg.englishDifficulty },
    { label: "건강·특이사항(내부)", value: bg.healthNote },
    { label: "학원에 바라는 점", value: bg.requests },
  ].filter((f) => f.value && String(f.value).trim());

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
      {bg.nkExpectations && bg.nkExpectations.length > 0 && (
        <div style={{ gridColumn: "1 / -1" }}>
          <span style={{ fontSize: 11, color: C.faint, fontWeight: 600 }}>NK 기대(우선순위)</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            {bg.nkExpectations.map((e, i) => (
              <span key={i} style={{ fontSize: 12, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 999, padding: "3px 10px", color: C.navy }}>
                {e}
              </span>
            ))}
          </div>
        </div>
      )}
      {facts.map((f) => (
        <div key={f.label}>
          <span style={{ fontSize: 11, color: C.faint, fontWeight: 600 }}>{f.label}</span>
          <p style={{ fontSize: 13, color: C.ink, margin: "2px 0 0", wordBreak: "keep-all" }}>{f.value}</p>
        </div>
      ))}
      {facts.length === 0 && (bg.nkExpectations?.length ?? 0) === 0 && (
        <p style={{ fontSize: 12.5, color: C.faint }}>사전정보 서술이 없습니다.</p>
      )}
    </div>
  );
}

export function CounselorReport({ profile, header, background, contacts }: CounselorReportProps) {
  const { scores: s, interpretation: i } = profile;
  const review = s.responseQuality.status === "review";
  const sourceLabel = profile.source === "ai" ? "AI 해석" : "규칙 기반 요약";
  const gaps = computeGaps(s.common);
  const maskPhone = (p?: string | null) =>
    p ? p.replace(/(\d{2,3})-?(\d{3,4})-?(\d{2})\d{2}/, "$1-$2-$3**") : null;

  return (
    <>
      {/* 표지 (독립 1페이지) */}
      <ReportPage cover>
        <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.2em", color: C.brass, margin: 0 }}>
              NK EDUCATION
            </p>
            <h1 style={{ fontSize: 30, fontWeight: 900, color: C.navy, margin: "10px 0 4px", letterSpacing: "-0.02em" }}>
              NK 학습운영 프로필
            </h1>
            <p style={{ fontSize: 13, color: C.sub, margin: 0 }}>
              상담 직후 지도 결정을 위한 학생 자기작성형 학습 프로필 (상담자용)
            </p>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 26, fontWeight: 900, color: C.ink }}>{header.name}</span>
              <span style={{ fontSize: 15, color: C.sub }}>{header.schoolGrade}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", background: C.navy, padding: "3px 10px", borderRadius: 6 }}>
                {SUBJECT_LABEL[profile.subjectSelection]}
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: C.brass, background: "#FBF4E4", padding: "4px 12px", borderRadius: 999 }}>
                {i.studentType}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: C.navy, background: "#E7ECF5", padding: "4px 12px", borderRadius: 999 }}>
                지도 유형 · {s.coaching.coachingType}
              </span>
            </div>
            {(contacts?.studentPhone || contacts?.parentPhone) && (
              <p style={{ fontSize: 12, color: C.faint, margin: "4px 0 0" }}>
                연락처(상담자 전용): 학생 {maskPhone(contacts?.studentPhone) ?? "-"} · 학부모{" "}
                {maskPhone(contacts?.parentPhone) ?? "-"}
              </p>
            )}
            {review && (
              <div style={{ marginTop: 4 }}>
                <InfoNote tone="caution">
                  응답 품질: 첫 14일 행동 확인 필요 — 초기 수치는 확정이 아니라 확인 대상으로 해석하세요.
                </InfoNote>
              </div>
            )}
          </div>

          <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 12, color: C.faint }}>
            <span>해석 출처: {sourceLabel}</span>
            <span>생성일 {formatDate(profile.generatedAt) || formatDate(header.createdAt)}</span>
          </div>
        </div>
      </ReportPage>

      {/* §1 총평 + §2 핵심 지도 판정 */}
      <ReportPage id="sec-summary">
        <div>
          <SectionTitle index="01" title="학생 분석 총평" />
          <Card>
            <Paragraph>{i.detailedSummary}</Paragraph>
            {review && (
              <InfoNote tone="caution">
                행동 확인 전 단계입니다. 단정 표현보다 첫 14일 재확인을 전제로 읽어주세요.
              </InfoNote>
            )}
          </Card>
        </div>
        <div>
          <SectionTitle index="02" title="핵심 지도 판정" sub={`${s.coaching.coachingType} · ${s.coaching.autonomyStructureType}`} />
          <Card>
            <LabeledPara label="핵심 관찰" text={i.coreObservation} />
            <LabeledPara label="작동 원인(가설)" text={i.operatingCause} />
            <LabeledPara label="권장 지도" text={i.recommendedCoaching} />
          </Card>
        </div>
      </ReportPage>

      {/* §3 지도 좌표 + 6 핵심 신호 */}
      <ReportPage>
        <div>
          <SectionTitle index="03" title="지도 좌표와 핵심 신호" sub="강하게 밀기(직접 피드백 수용) × 안전하게 전달하기(관계 안전 요구)" />
          <Card style={{ marginBottom: 14 }}>
            <CoachingCoordinate
              challenge={s.coaching.challenge}
              safety={s.coaching.safety}
              coachingType={s.coaching.coachingType}
            />
          </Card>
          <CoreSignalsBlock common={s.common} />
        </div>
      </ReportPage>

      {/* §4 교사 brief + §5 배경 교차해석 */}
      <ReportPage>
        <div>
          <SectionTitle index="04" title="첫 수업 전 교사 브리핑" />
          <Card>
            <BulletList items={i.teacherBrief} color={C.brass} />
          </Card>
        </div>
        <div>
          <SectionTitle index="05" title="배경·서술 교차해석" sub="사전정보와 행동 신호를 함께 확인" />
          <Card style={{ marginBottom: 14 }}>
            {background ? <BackgroundFacts bg={background} /> : <p style={{ fontSize: 12.5, color: C.faint }}>사전정보가 없습니다.</p>}
          </Card>
          {i.crossEvidence.length > 0 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.navy, margin: "0 0 8px" }}>교차 관찰</p>
              <BulletList items={i.crossEvidence} />
            </Card>
          )}
        </div>
      </ReportPage>

      {/* §6 학습·숙제 + §7 장기·단기 */}
      <ReportPage id="sec-learning">
        <div>
          <SectionTitle index="06" title="학습 태도와 숙제 흐름" />
          <LearningHomeworkBlock common={s.common} />
        </div>
        <div>
          <SectionTitle index="07" title="장기 의지와 단기 회복" />
          <PersistenceRecoveryBlock common={s.common} />
        </div>
      </ReportPage>

      {/* §8 휴대폰·성격·친구 + §9 MBTI */}
      <ReportPage id="sec-life">
        <div>
          <SectionTitle index="08" title="휴대폰·성격 반응·친구관계" />
          <PhoneFriendsPersonalityBlock common={s.common} coaching={s.coaching} />
        </div>
        <div>
          <SectionTitle index="09" title="MBTI 보조 점수" sub="원점수 / MBTI 조정 / 최종" />
          <MbtiBlock mbtiAxes={s.mbtiAxes} />
        </div>
      </ReportPage>

      {/* §10 NK 적합 + §11 과목 전략 */}
      <ReportPage id="sec-nkfit">
        <div>
          <SectionTitle index="10" title="NK 운영 선호·준비도·지원 조건" />
          <NkFitBlock nkFit={s.nkFit} interpretation={i.nkFitInterpretation} />
        </div>
        <div>
          <SectionTitle index="11" title="과목별 학습전략" />
          <SubjectStrategyBlock
            subjectSelection={profile.subjectSelection}
            math={s.math}
            english={s.english}
            mathStrategy={i.mathStrategy}
            englishStrategy={i.englishStrategy}
          />
        </div>
      </ReportPage>

      {/* §12 강점·개선·간극 + §13 12주·14일 + §14 원칙 */}
      <ReportPage id="sec-solution">
        <div>
          <SectionTitle index="12" title="강점·개선·심리적 간극" />
          <StrengthsGrowthBlock strengths={i.strengths} growthAreas={i.growthAreas} />
          {gaps.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <Card>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.navy, margin: "0 0 8px" }}>심리적 간극</p>
                <BulletList items={gaps} color={C.amber} />
              </Card>
            </div>
          )}
        </div>
        <div>
          <SectionTitle index="13" title="12주 솔루션과 첫 14일 지표" />
          <RoadmapBlock roadmap={i.roadmap12Weeks} />
          <div style={{ marginTop: 14 }}>
            <Card style={{ borderLeft: `3px solid ${C.navy}` }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: C.navy, margin: "0 0 8px" }}>첫 14일 행동 확인 지표</p>
              <BulletList items={i.verificationPlan14Days} color={C.navy} />
            </Card>
          </div>
          {i.cautions.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <Card>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.amber, margin: "0 0 8px" }}>지도 시 유의점</p>
                <BulletList items={i.cautions} color={C.amber} />
              </Card>
            </div>
          )}
        </div>
        <PrinciplesBlock responseQualityStatus={s.responseQuality.status} />
      </ReportPage>
    </>
  );
}

function LabeledPara({ label, text }: { label: string; text: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <span style={{ fontSize: 11.5, fontWeight: 800, color: C.brass, letterSpacing: "0.04em" }}>
        {label}
      </span>
      <Paragraph>{text}</Paragraph>
    </div>
  );
}
