// 상담자용 V2 결과 보고서 (§12.1 순서 유지). 프로토타입 PRIVATE LEARNING DOSSIER DOM으로 렌더한다.
// 데이터 계약·섹션 순서·점수 로직은 변경하지 않고 표현만 재작업. counselor-only 블록은 학부모 공유본에 없다.

import type { ResultProfileV2 } from "@/lib/assessment/v2/interpretation";
import type { CommonScores } from "@/lib/assessment/v2/types";
import { SUBJECT_LABEL, formatDate, isNum } from "./report-theme";
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
      label: "장기 목표와 매일의 시작",
      a: ["목표 의지", lt],
      b: ["단기 회복", sr],
      note: "공부를 잘하고 싶은 마음은 분명하지만 시작·재시작이 흔들립니다. 의지보다 시작 예약을 먼저 관리합니다.",
    });
  }
  if (isNum(la) && isNum(hr) && la - hr >= 20) {
    out.push({
      label: "태도와 실행 구조",
      a: ["학습 태도", la],
      b: ["숙제 신뢰", hr],
      note: "태도에 비해 제출·오답 복구가 약합니다. 의지보다 시작 시각·완료 기준 등 실행 구조를 관리합니다.",
    });
  }
  if (isNum(common.phoneBoundary) && common.phoneBoundary < 50) {
    out.push({
      label: "치우려는 계획과 자동 확인",
      a: ["보관 계획", 60],
      b: ["확인 억제", common.phoneBoundary],
      note: "치워야 한다는 것은 알지만 손이 닿는 거리에서는 자동 확인이 이어집니다. 실제 보관 거리를 확인합니다.",
    });
  }
  return out;
}

export function CounselorReport({ profile, header, background, contacts }: CounselorReportProps) {
  const { scores: s, interpretation: i } = profile;
  const review = s.responseQuality.status === "review";
  const sourceLabel = profile.source === "ai" ? "AI 해석 · 행동 확인 전" : "규칙 기반 요약 · 행동 확인 전";
  const gaps = computeGaps(s.common);
  const summaryParas = splitParas(i.detailedSummary, 3);
  const maskPhone = (p?: string | null) =>
    p ? p.replace(/(\d{2,3})-?(\d{3,4})-?(\d{2})\d{2}/, "$1-$2-$3**") : "–";
  const genDate = formatDate(profile.generatedAt) || formatDate(header.createdAt);

  const metaFacts: { label: string; value?: string | null }[] = [
    { label: "학교·학년", value: header.schoolGrade },
    { label: "진단 과목", value: SUBJECT_LABEL[profile.subjectSelection] },
    { label: "희망 직업·장래 목표", value: background?.dream },
    { label: "목표 대학·계열", value: background?.targetUniversity },
    { label: "기존 학습환경", value: background?.prevAcademy },
    { label: "주요 변경 이유", value: background?.prevLeaveReason },
    { label: "NK 인지 수준", value: background?.nkKnowledge },
    { label: "유입 경로", value: background?.referral },
    { label: "희망 요일", value: background?.preferredDays },
    { label: "등원 가능 시간", value: background?.availableTime },
    { label: "클리닉 참여 조건", value: background?.clinicCondition },
    { label: "학생·학부모 연락처(상담자 전용)", value: `${maskPhone(contacts?.studentPhone)} · ${maskPhone(contacts?.parentPhone)}` },
  ].filter((f) => f.value && String(f.value).trim());

  return (
    <>
      <ReportCover
        eyebrow="CONFIDENTIAL · PRIVATE LEARNING DOSSIER"
        brandCode="NK-LP 2.0 / 2026"
        kicker="맞춤형 심층 학습 성향 분석 보고서 (상담자용)"
        name={`${header.name} 학생`}
        titleEm="학습 운영 프로필"
        meta={[header.schoolGrade, SUBJECT_LABEL[profile.subjectSelection], genDate]}
        verdictLabel="LEARNING RESPONSE TYPE"
        verdictType={i.studentType}
        verdictSubtype={`지도 유형 · ${s.coaching.coachingType}`}
        verdictNote={i.recommendedCoaching}
        footerLeft="NK EDUCATION CONSULTING GROUP"
        footerRight={`REPORT · ${genDate}`}
      />

      <ReportSection
        id="sec-summary"
        index="01"
        eyebrow="DIRECTOR'S SYNTHESIS"
        title="학생 분석 총평"
        aside={<b className="confidence-chip">{sourceLabel}</b>}
      >
        <article className="analysis-verdict">
          <div className="analysis-verdict__title">
            <span>CORE INTERPRETATION</span>
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
              <dt>관찰</dt>
              <dd>{i.coreObservation}</dd>
            </div>
            <div>
              <dt>작동 원인</dt>
              <dd>{i.operatingCause}</dd>
            </div>
            <div>
              <dt>권장 지도</dt>
              <dd>{i.recommendedCoaching}</dd>
            </div>
            <div>
              <dt>14일 검증</dt>
              <dd>{i.verificationPlan14Days[0] ?? "첫 14일 실제 행동 확인"}</dd>
            </div>
          </dl>
        </article>

        <AnalysisVisualGrid common={s.common} coaching={s.coaching} />

        {i.crossEvidence.length > 0 && (
          <div className="analysis-cross-evidence">
            <header>
              <span>CROSS EVIDENCE</span>
              <h3>이 총평이 나온 이유</h3>
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
              <span>TEACHER BRIEF</span>
              <h3>담당 선생님이 첫 수업 전에 읽을 메모</h3>
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
              <div>
                <span>COUNSELING CONTEXT</span>
                <h3>상담 배경과 서술 응답</h3>
              </div>
              <b>학생 직접 작성</b>
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
                  <span>STUDENT VOICE</span>
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
        eyebrow="LEARNING OPERATION"
        title="학습태도와 실행 구조"
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
        title="NK 운영 방식과의 일치"
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
        eyebrow="EVIDENCE TO ACTION"
        title="강점·간극·맞춤 솔루션"
        aside={<b className="section-note">기존 보고서 핵심 틀 유지</b>}
      >
        <StrengthGrowth strengths={i.strengths} growthAreas={i.growthAreas} />

        {gaps.length > 0 && (
          <div className="gap-dossier counselor-only">
            <div className="panel-title">
              <span>PSYCHOLOGICAL GAP</span>
              <h3>학생의 의도와 최근 행동 사이</h3>
            </div>
            <div className="gap-rows">
              {gaps.map((g, idx) => (
                <article key={idx}>
                  <div>
                    <span>GAP {String(idx + 1).padStart(2, "0")}</span>
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
          <span>NK FINAL GUIDANCE</span>
          <h3>{i.recommendedCoaching}</h3>
          <p>
            완료 기준은 분명히 유지하고, 미완료에는 반드시 후속조치를 연결하십시오. 동시에 공개 비교는 피하고,
            낮은 점수 뒤에는 시작 순서를 짧게 정리해 주십시오. 이 조합이 학생의 장기 의지를 실제 성취로 바꾸는
            핵심입니다.
            {i.cautions.length > 0 ? ` 유의: ${i.cautions[0]}` : ""}
          </p>
        </div>
      </ReportSection>

      <CautionFooter review={review} />
    </>
  );
}
