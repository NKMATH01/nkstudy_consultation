// 학부모 공유용 V2 결과 보고서. parent-safe snapshot만 렌더한다(프로토타입 DOM).
// 상담자 전용(교사 brief·근거·연락처·간극·확인질문)은 데이터에 없다(§12.3). 점수 블록은 상담자용과 동일 함수.

import type { ParentSafeProfile } from "@/lib/assessment/v2/parent-safe";
import { SUBJECT_LABEL, formatDate } from "./report-theme";
import { ReportCover, ReportSection } from "./report-frame";
import {
  AnalysisVisualGrid,
  CautionFooter,
  LearningPanels,
  NkFitSection,
  PersonalityRelationGrid,
  PhoneFeature,
  ProfileSignals,
  RoadmapLine,
  StrengthGrowth,
  SubjectStrategy,
  WillCoachingGrid,
} from "./report-sections";

function firstSentence(text: string): string {
  const m = text.split(/(?<=[.!?。])\s+/)[0];
  return m && m.trim() ? m.trim() : text;
}

export function ParentReport({ data }: { data: ParentSafeProfile }) {
  const s = data.scores;
  const i = data.interpretation;
  const review = s.responseQualityStatus === "review";
  const genDate = formatDate(data.generatedAt);

  return (
    <>
      <ReportCover
        eyebrow="LEARNING PROFILE · 학부모 공유본"
        brandCode="NK-LP 2.0 / 2026"
        kicker="학부모 공유용 학습 성향 분석 보고서"
        name={`${data.display.name} 학생`}
        titleEm="학습 프로필"
        meta={[data.display.schoolGrade, SUBJECT_LABEL[data.subjectSelection], genDate]}
        verdictLabel="LEARNING RESPONSE TYPE"
        verdictType={i.studentType}
        verdictNote={firstSentence(i.parentSummary)}
        footerLeft="NK EDUCATION"
        footerRight={`REPORT · ${genDate}`}
      />

      <ReportSection id="sec-summary" index="01" eyebrow="PROFILE SYNTHESIS" title="학습 프로필 요약">
        <div className="executive-layout">
          <div className="executive-statement">
            <span>학습 프로필 요약</span>
            <h3>{firstSentence(i.parentSummary)}</h3>
            <p>{i.parentSummary}</p>
            <ul>
              <li>모든 수치는 학생이 작성한 최근 4주 자기보고입니다.</li>
              <li>처음 2주 동안의 실제 행동으로 함께 확인해 나갑니다.</li>
              <li>점수는 우열이 아니라 먼저 지원할 학습 행동을 뜻합니다.</li>
            </ul>
          </div>
          <aside className="fit-seal-panel">
            <span>NK 운영 일치</span>
            <div className="fit-seal">
              <strong>{s.nkFit.overall !== null ? s.nkFit.overall.toFixed(0) : "–"}</strong>
              <small>/100</small>
            </div>
            <h3>{s.nkFit.stage}</h3>
            <p>학원과 가정이 같은 기준으로 학생의 학습 습관을 함께 만들어 갑니다.</p>
          </aside>
        </div>
        <AnalysisVisualGrid common={s.common} coaching={s.coaching} />
        <ProfileSignals common={s.common} />
      </ReportSection>

      <ReportSection
        id="sec-learning"
        index="02"
        eyebrow="LEARNING OPERATION"
        title="학습 태도와 실행 구조"
        aside={<b className="section-note">최근 4주 행동 기준</b>}
      >
        <LearningPanels common={s.common} />
        <WillCoachingGrid common={s.common} coaching={s.coaching} />
      </ReportSection>

      <ReportSection
        id="sec-life"
        index="03"
        eyebrow="DAILY LIFE & RELATION"
        title="핸드폰·성격·친구관계"
        aside={<b className="section-note">생활 조건과 학습의 연결</b>}
      >
        <PhoneFeature common={s.common} />
        <PersonalityRelationGrid common={s.common} coaching={s.coaching} mbtiAxes={s.mbtiAxes} />
      </ReportSection>

      <ReportSection
        id="sec-fit"
        index="04"
        eyebrow="NK ENVIRONMENT FIT"
        title="NK 운영 적합과 지원 조건"
        aside={<b className="fit-grade">{s.nkFit.stage}</b>}
      >
        <NkFitSection nkFit={s.nkFit} interpretation={i.nkFitInterpretation} />
        <SubjectStrategy
          subjectSelection={data.subjectSelection}
          math={s.math}
          english={s.english}
          mathStrategy={i.mathStrategy}
          englishStrategy={i.englishStrategy}
        />
      </ReportSection>

      <ReportSection
        id="sec-solution"
        index="05"
        eyebrow="STRENGTHS & PLAN"
        title="강점·개선·12주 계획"
        aside={<b className="section-note">가정 연계 지원</b>}
      >
        <StrengthGrowth strengths={i.strengths} growthAreas={i.growthAreas} />
        <RoadmapLine roadmap={i.roadmap12Weeks} />
        <div className="final-guidance">
          <span>NK GUIDANCE</span>
          <h3>학원과 가정이 같은 기준으로 학생의 높은 목표 의지를 실제 습관으로 이어가겠습니다.</h3>
          <p>
            과제와 테스트 기준은 분명히 유지하되, 어려운 순간에는 무엇부터 다시 시작할지 함께 정하겠습니다. 첫
            14일 동안 제출·휴대폰 보관·재시작 행동을 확인한 뒤 관리 강도를 조정하겠습니다.
          </p>
        </div>
      </ReportSection>

      <CautionFooter review={review} />
    </>
  );
}
