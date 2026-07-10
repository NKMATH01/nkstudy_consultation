// 학부모 공유용 V2 결과 보고서. parent-safe snapshot만 렌더한다.
// 상담자 전용(교사 brief·근거 코드·연락처·내부 확인질문)은 데이터 자체에 없다(§12.3).
// 점수 블록은 상담자용과 동일한 report-sections.tsx를 사용해 화면 간 값이 일치한다.

import type { ParentSafeProfile } from "@/lib/assessment/v2/parent-safe";
import { C, SUBJECT_LABEL, formatDate } from "./report-theme";
import { Card, InfoNote, Paragraph, SectionTitle } from "./report-ui";
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

export function ParentReport({ data }: { data: ParentSafeProfile }) {
  const s = data.scores;
  const i = data.interpretation;
  const review = s.responseQualityStatus === "review";

  return (
    <>
      {/* 표지 */}
      <ReportPage cover>
        <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.2em", color: C.brass, margin: 0 }}>
              NK EDUCATION
            </p>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: C.navy, margin: "10px 0 4px", letterSpacing: "-0.02em" }}>
              NK 학습 프로필
            </h1>
            <p style={{ fontSize: 13, color: C.sub, margin: 0 }}>학부모 공유용 학습 프로필</p>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 26, fontWeight: 900, color: C.ink }}>{data.display.name}</span>
              <span style={{ fontSize: 15, color: C.sub }}>{data.display.schoolGrade}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", background: C.navy, padding: "3px 10px", borderRadius: 6 }}>
                {SUBJECT_LABEL[data.subjectSelection]}
              </span>
            </div>
            <div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: C.brass, background: "#FBF4E4", padding: "4px 12px", borderRadius: 999 }}>
                {i.studentType}
              </span>
            </div>
            {review && (
              <div style={{ marginTop: 4 }}>
                <InfoNote tone="caution">
                  첫 14일 재확인 필요: 아래 내용은 처음 2주 동안의 실제 행동으로 함께 확인해 나갈 예정입니다.
                </InfoNote>
              </div>
            )}
          </div>
          <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 10, textAlign: "right", fontSize: 12, color: C.faint }}>
            생성일 {formatDate(data.generatedAt)}
          </div>
        </div>
      </ReportPage>

      {/* 요약 */}
      <ReportPage id="sec-summary">
        <div>
          <SectionTitle index="01" title="학습 프로필 요약" />
          <Card>
            <Paragraph>{i.parentSummary}</Paragraph>
            <InfoNote>
              모든 수치는 학생이 작성한 최근 4주 자기보고이며, 처음 2주 동안의 실제 행동으로 함께
              확인해 나갑니다.
            </InfoNote>
          </Card>
        </div>
        <div>
          <SectionTitle index="02" title="핵심 행동 신호" />
          <CoreSignalsBlock common={s.common} />
        </div>
      </ReportPage>

      {/* 학습 */}
      <ReportPage id="sec-learning">
        <div>
          <SectionTitle index="03" title="학습 태도와 숙제" />
          <LearningHomeworkBlock common={s.common} />
        </div>
        <div>
          <SectionTitle index="04" title="장기 의지와 단기 회복" />
          <PersistenceRecoveryBlock common={s.common} />
        </div>
      </ReportPage>

      {/* 생활·관계 */}
      <ReportPage id="sec-life">
        <div>
          <SectionTitle index="05" title="휴대폰·성격 반응·친구관계" />
          <PhoneFriendsPersonalityBlock common={s.common} coaching={s.coaching} />
        </div>
        <div>
          <SectionTitle index="06" title="MBTI 보조 점수" sub="원점수 / 조정 / 최종" />
          <MbtiBlock mbtiAxes={s.mbtiAxes} />
        </div>
      </ReportPage>

      {/* NK 적합 */}
      <ReportPage id="sec-nkfit">
        <div>
          <SectionTitle index="07" title="NK 운영 적합과 지원 조건" />
          <NkFitBlock nkFit={s.nkFit} interpretation={i.nkFitInterpretation} />
        </div>
      </ReportPage>

      {/* 솔루션 */}
      <ReportPage id="sec-solution">
        <div>
          <SectionTitle index="08" title="과목별 학습전략" />
          <SubjectStrategyBlock
            subjectSelection={data.subjectSelection}
            math={s.math}
            english={s.english}
            mathStrategy={i.mathStrategy}
            englishStrategy={i.englishStrategy}
          />
        </div>
        <div>
          <SectionTitle index="09" title="강점과 개선 영역" />
          <StrengthsGrowthBlock strengths={i.strengths} growthAreas={i.growthAreas} />
        </div>
        <div>
          <SectionTitle index="10" title="12주 학습 계획" />
          <RoadmapBlock roadmap={i.roadmap12Weeks} />
        </div>
        <PrinciplesBlock responseQualityStatus={s.responseQualityStatus} />
      </ReportPage>
    </>
  );
}
