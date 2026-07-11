// 학부모 공유용 V2 결과 보고서. parent-safe snapshot만 렌더한다(화이트 톤·쉬운 우리말).
// 상담자 전용(선생님 메모·근거·연락처·간극·확인질문)은 데이터에 없다(§12.3). 점수 블록은 상담자용과 동일 함수.

import type { ParentSafeProfile } from "@/lib/assessment/v2/parent-safe";
import { SUBJECT_LABEL, formatDate } from "./report-theme";
import { ReportSection } from "./report-frame";
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

  const bandMeta = [data.display.schoolGrade, SUBJECT_LABEL[data.subjectSelection], genDate]
    .filter(Boolean)
    .join(" · ");

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

      <ReportSection
        id="sec-summary"
        index="01"
        title="학습 프로필 요약"
        caption="아이가 쓴 최근 4주 응답으로 정리했어요. 점수는 우열이 아니라 먼저 도와줄 부분을 뜻해요."
      >
        <div className="executive-layout">
          <div className="executive-statement">
            <span>한 줄 요약</span>
            <h3>{firstSentence(i.parentSummary)}</h3>
            <p>{i.parentSummary}</p>
            <ul>
              <li>모든 점수는 아이가 직접 쓴 최근 4주 응답이에요.</li>
              <li>처음 2주 동안 실제 모습으로 함께 확인해 나가요.</li>
              <li>낮은 점수는 혼낼 점이 아니라 먼저 도와줄 부분이에요.</li>
            </ul>
          </div>
          <aside className="fit-seal-panel">
            <span>NK 학원과 맞는 정도</span>
            <div className="fit-seal">
              <strong>{s.nkFit.overall !== null ? s.nkFit.overall.toFixed(0) : "–"}</strong>
              <small>/100</small>
            </div>
            <h3>{s.nkFit.stage}</h3>
            <p>학원과 가정이 같은 기준으로 아이의 공부 습관을 함께 만들어 가요.</p>
          </aside>
        </div>
        <AnalysisVisualGrid common={s.common} coaching={s.coaching} />
        <ProfileSignals common={s.common} />
      </ReportSection>

      <ReportSection
        id="sec-learning"
        index="02"
        title="수업 태도와 숙제 습관"
        caption="최근 4주 동안 수업과 숙제에서 보인 실제 모습이에요."
        aside={<b className="section-note">최근 4주 기준</b>}
      >
        <LearningPanels common={s.common} />
        <WillCoachingGrid common={s.common} coaching={s.coaching} />
      </ReportSection>

      <ReportSection
        id="sec-life"
        index="03"
        title="휴대폰·성격·친구관계"
        caption="공부에 영향을 주는 생활 습관과 관계를 함께 봐요."
        aside={<b className="section-note">생활과 공부의 연결</b>}
      >
        <PhoneFeature common={s.common} />
        <PersonalityRelationGrid common={s.common} coaching={s.coaching} mbtiAxes={s.mbtiAxes} />
      </ReportSection>

      <ReportSection
        id="sec-fit"
        index="04"
        title="NK 학원과 잘 맞는 부분"
        caption="합격·불합격이 아니라, 학원이 무엇을 도와주면 좋을지 보는 값이에요."
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
        title="강점과 12주 계획"
        caption="잘하는 점을 살리고, 처음에 도와줄 부분을 12주에 나눠 채워 가요."
        aside={<b className="section-note">가정 연계</b>}
      >
        <StrengthGrowth strengths={i.strengths} growthAreas={i.growthAreas} />
        <RoadmapLine roadmap={i.roadmap12Weeks} />
        <div className="final-guidance">
          <span>학원과 가정이 함께</span>
          <h3>아이의 높은 목표가 실제 습관으로 이어지도록 학원과 가정이 같은 기준으로 도울게요.</h3>
          <p>
            과제와 테스트 기준은 분명히 지키되, 어려운 순간에는 무엇부터 다시 시작할지 함께 정해요. 처음 14일
            동안 숙제·휴대폰·다시 시작하는 모습을 확인한 뒤 도와주는 방식을 맞춰 갈게요.
          </p>
        </div>
      </ReportSection>

      <CautionFooter review={review} />
    </>
  );
}
