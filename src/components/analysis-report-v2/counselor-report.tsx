// 상담자용 V2 결과 보고서 (§12.1 순서 유지). 화이트 톤·쉬운 우리말로 렌더한다.
// 데이터 계약·섹션 순서·점수 로직은 변경하지 않고 표현만 재작업. counselor-only 블록은 학부모 공유본에 없다.

import type { ResultProfileV2 } from "@/lib/assessment/v2/interpretation";
import type { CommonScores } from "@/lib/assessment/v2/types";
import { CONSTRUCT_LABEL, SUBJECT_LABEL, formatDate, isNum } from "./report-theme";
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
  VerifyLine,
  WillCoachingGrid,
} from "./report-sections";

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

/** detailedSummary를 최대 3개 컬럼용 단락으로 분할(문단 우선, 없으면 문장 그룹). */
function splitParas(text: string, n = 3): string[] {
  const byPara = text.split(/\n\s*\n|\n/).map((t) => t.trim()).filter(Boolean);
  if (byPara.length >= 2) return byPara.slice(0, n);
  const sentences = text.split(/(?<=[.!?。])\s+/).map((t) => t.trim()).filter(Boolean);
  if (sentences.length <= 1) return [text];
  const per = Math.ceil(sentences.length / n);
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += per) out.push(sentences.slice(i, i + per).join(" "));
  return out.slice(0, n);
}

function computeGaps(common: CommonScores): { label: string; a: [string, number]; b: [string, number]; note: string }[] {
  const out: { label: string; a: [string, number]; b: [string, number]; note: string }[] = [];
  const { longTermPersistence: lt, shortTermRecovery: sr, learningAttitude: la, homeworkReliability: hr } = common;
  if (isNum(lt) && isNum(sr) && Math.abs(lt - sr) >= 20) {
    out.push({
      label: "목표는 크지만 매일의 시작은 흔들림",
      a: [CONSTRUCT_LABEL.longTermPersistence, lt],
      b: [CONSTRUCT_LABEL.shortTermRecovery, sr],
      note: "잘하고 싶은 마음은 분명한데 시작·다시 시작이 흔들려요. 마음보다 시작 시각을 먼저 정해 줘요.",
    });
  }
  if (isNum(la) && isNum(hr) && la - hr >= 20) {
    out.push({
      label: "태도는 좋은데 실행은 아직",
      a: [CONSTRUCT_LABEL.learningAttitude, la],
      b: [CONSTRUCT_LABEL.homeworkReliability, hr],
      note: "태도에 비해 제출·오답 복습이 약해요. 마음보다 시작 시각·끝내는 기준 같은 구조를 챙겨 줘요.",
    });
  }
  if (isNum(common.phoneBoundary) && common.phoneBoundary < 50) {
    out.push({
      label: "치우려는 마음과 자동으로 확인하는 습관",
      a: ["치우려는 마음", 60],
      b: ["확인 참기", common.phoneBoundary],
      note: "치워야 한다는 건 알지만 손 닿는 곳에 있으면 자꾸 확인해요. 실제 보관 거리를 확인해 줘요.",
    });
  }
  return out;
}

export function CounselorReport({ profile, header, background, contacts }: CounselorReportProps) {
  const { scores: s, interpretation: i } = profile;
  const review = s.responseQuality.status === "review";
  const sourceLabel = profile.source === "ai" ? "AI 해석 · 첫 2주 확인 전" : "기본 요약 · 첫 2주 확인 전";
  const gaps = computeGaps(s.common);
  const summaryParas = splitParas(i.detailedSummary, 3);
  const maskPhone = (p?: string | null) =>
    p ? p.replace(/(\d{2,3})-?(\d{3,4})-?(\d{2})\d{2}/, "$1-$2-$3**") : "–";
  const genDate = formatDate(profile.generatedAt) || formatDate(header.createdAt);

  const metaFacts: { label: string; value?: string | null }[] = [
    { label: "학교·학년", value: header.schoolGrade },
    { label: "분석 과목", value: SUBJECT_LABEL[profile.subjectSelection] },
    { label: "장래 희망", value: background?.dream },
    { label: "목표 대학·계열", value: background?.targetUniversity },
    { label: "이전 학원", value: background?.prevAcademy },
    { label: "옮긴 이유", value: background?.prevLeaveReason },
    { label: "NK를 알던 정도", value: background?.nkKnowledge },
    { label: "알게 된 경로", value: background?.referral },
    { label: "원하는 요일", value: background?.preferredDays },
    { label: "올 수 있는 시간", value: background?.availableTime },
    { label: "클리닉 참여 조건", value: background?.clinicCondition },
    { label: "학생·학부모 연락처(상담용)", value: `${maskPhone(contacts?.studentPhone)} · ${maskPhone(contacts?.parentPhone)}` },
  ].filter((f) => f.value && String(f.value).trim());

  return (
    <>
      <ReportCover
        eyebrow="상담자용 · 학습 성향 분석 보고서"
        brandCode="NK 학습 프로필 2.0"
        kicker="맞춤 학습 성향 분석 (상담 선생님용)"
        name={`${header.name} 학생`}
        titleEm="학습 운영 프로필"
        meta={[header.schoolGrade, SUBJECT_LABEL[profile.subjectSelection], genDate]}
        verdictLabel="한 줄 요약"
        verdictType={i.studentType}
        verdictSubtype={`지도 유형 · ${s.coaching.coachingType}`}
        verdictNote={i.recommendedCoaching}
        footerLeft="NK EDUCATION"
        footerRight={`작성일 ${genDate}`}
      />

      <ReportSection
        id="sec-summary"
        index="01"
        title="학생 분석 총평"
        caption="학생이 쓴 최근 4주 응답으로 계산한 점수예요. 75점 이상이면 안정적, 40점 미만이면 처음에 도와줄 부분입니다."
        aside={<b className="confidence-chip">{sourceLabel}</b>}
      >
        <article className="analysis-verdict">
          <div className="analysis-verdict__title">
            <span>핵심 지도 판정</span>
            <b>{i.studentType}</b>
          </div>
          <h3>{i.recommendedCoaching}</h3>
          <div className="analysis-verdict__body">
            {summaryParas.map((p, idx) => (
              <p key={idx}>{p}</p>
            ))}
          </div>
          <dl className="analysis-chain">
            <div>
              <dt>무엇을 봤나</dt>
              <dd>{i.coreObservation}</dd>
            </div>
            <div>
              <dt>왜 그럴까</dt>
              <dd>{i.operatingCause}</dd>
            </div>
            <div>
              <dt>이렇게 지도해요</dt>
              <dd>{i.recommendedCoaching}</dd>
            </div>
            <div>
              <dt>첫 14일 확인</dt>
              <dd>{i.verificationPlan14Days[0] ?? "첫 2주 동안 실제 모습으로 확인"}</dd>
            </div>
          </dl>
        </article>

        <AnalysisVisualGrid common={s.common} coaching={s.coaching} />

        {i.crossEvidence.length > 0 && (
          <div className="analysis-cross-evidence">
            <header>
              <h3>이렇게 본 이유</h3>
            </header>
            <div>
              {i.crossEvidence.slice(0, 4).map((e, idx) => (
                <article key={idx}>
                  <span>근거 {String(idx + 1).padStart(2, "0")}</span>
                  <p>{e}</p>
                </article>
              ))}
            </div>
          </div>
        )}

        <ProfileSignals common={s.common} />

        {i.teacherBrief.length > 0 && (
          <div className="teacher-brief counselor-only">
            <div className="teacher-brief__title">
              <span>선생님 메모</span>
              <h3>첫 수업 전에 읽어 보면 좋은 메모</h3>
            </div>
            <ol>
              {i.teacherBrief.map((t, idx) => (
                <li key={idx}>
                  <span>{String(idx + 1).padStart(2, "0")}</span>
                  <p>{t}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {metaFacts.length > 0 && (
          <div className="consultation-context-dossier counselor-only">
            <header>
              <h3>상담 배경과 학생이 쓴 이야기</h3>
              <b>학생이 직접 작성</b>
            </header>
            <div className="context-meta-grid">
              {metaFacts.map((f) => (
                <div key={f.label}>
                  <span>{f.label}</span>
                  <strong>{f.value}</strong>
                </div>
              ))}
            </div>
            {(background?.problemSelf || background?.prevComplaint || background?.requests) && (
              <div className="context-consult-questions">
                <div>
                  <span>학생이 쓴 말</span>
                  <strong>{background?.problemSelf || background?.prevComplaint || background?.requests}</strong>
                </div>
                <ol aria-label="상담에서 확인할 배경">
                  {[background?.prevComplaint, background?.requests, background?.studyCore]
                    .filter((x): x is string => !!x && !!x.trim())
                    .slice(0, 3)
                    .map((x, idx) => (
                      <li key={idx}>
                        <b>{String(idx + 1).padStart(2, "0")}</b>
                        <p>{x}</p>
                      </li>
                    ))}
                </ol>
              </div>
            )}
          </div>
        )}
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
        aside={
          <b className="fit-grade">
            {s.nkFit.stage}
            {s.nkFit.overall !== null ? ` · ${s.nkFit.overall.toFixed(0)}` : ""}
          </b>
        }
      >
        <NkFitSection nkFit={s.nkFit} interpretation={i.nkFitInterpretation} />
        <SubjectStrategy
          subjectSelection={profile.subjectSelection}
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
        aside={<b className="section-note">실행 계획</b>}
      >
        <StrengthGrowth strengths={i.strengths} growthAreas={i.growthAreas} />

        {gaps.length > 0 && (
          <div className="gap-dossier counselor-only">
            <div className="panel-title">
              <span>마음과 행동의 차이</span>
              <h3>하고 싶은 마음과 실제 행동 사이</h3>
            </div>
            <div className="gap-rows">
              {gaps.map((g, idx) => (
                <article key={idx}>
                  <div>
                    <span>차이 {String(idx + 1).padStart(2, "0")}</span>
                    <strong>{g.label}</strong>
                  </div>
                  <div className="gap-values">
                    <p>
                      {g.a[0]} <b>{g.a[1].toFixed(0)}</b>
                    </p>
                    <i />
                    <p>
                      {g.b[0]} <b>{g.b[1].toFixed(0)}</b>
                    </p>
                  </div>
                  <p>{g.note}</p>
                </article>
              ))}
            </div>
          </div>
        )}

        <RoadmapLine roadmap={i.roadmap12Weeks} />
        <VerifyLine items={i.verificationPlan14Days} />

        <div className="final-guidance">
          <span>NK 최종 의견</span>
          <h3>{i.recommendedCoaching}</h3>
          <p>
            끝내는 기준은 분명히 지키고, 못한 부분은 꼭 다시 챙겨 주세요. 대신 여러 학생 앞에서 비교하지 말고,
            점수가 낮은 날에는 무엇부터 다시 시작할지 짧게 정리해 주세요. 이 조합이 학생의 목표를 실제 성과로
            바꾸는 핵심이에요.
            {i.cautions.length > 0 ? ` 참고: ${i.cautions[0]}` : ""}
          </p>
        </div>
      </ReportSection>

      <CautionFooter review={review} />
    </>
  );
}
