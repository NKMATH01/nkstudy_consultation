"use client";

// 퇴원 분석 첫 화면 4블록 + 데이터 신뢰도 패널.
// 집계는 src/lib/withdrawal-insight/blocks.ts(순수 모듈)가 하고 여기서는 렌더만 한다.
//
// 봉인 원칙: 퇴원율·순위·등급·"심각" 어휘를 쓰지 않는다.
// 강사 실명은 "원문 확인 큐"에서만, 건수·기록 공백 같은 원시 사실과 함께 표시한다.

import { useCallback, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  analyzeEvents,
  buildEarlyExit,
  buildPersistence,
  buildRecentShift,
  buildReliability,
  buildStableTeachers,
  buildTeacherAnalysis,
  MIN_EVENTS_FOR_READING,
  STABLE_MIN_ENROLLED,
  STABLE_RECENT_MONTHS,
  type AnalyzedEvent,
} from "@/lib/withdrawal-insight/blocks";
import {
  generateTeacherActionPlan,
  type TeacherActionPlan,
} from "@/lib/actions/teacher-action-plan";
import { addManualAction } from "@/lib/actions/improvement-action";
import { groupWithdrawalEvents, TENURE_BAND_LABEL } from "@/lib/withdrawal-insight/events";
import {
  DEPARTURE_LABEL,
  estimateDepartureTarget,
  isParentOpinionCopied,
  SIGNAL_GLOSS,
  SIGNAL_LABEL,
  SOURCE_FIELD_LABEL,
  type SignalTopic,
} from "@/lib/withdrawal-insight/signals";
import type { Withdrawal } from "@/types";

/** 기본 노출할 강사 카드 수. 나머지는 "더 보기"로 편다. */
const TEACHER_PREVIEW_COUNT = 6;

const INK = "rgb(var(--wr-navy-strong))";
const SUB = "rgb(var(--wr-ink-sub))";
const LINE = "rgb(var(--wr-line-soft))";

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-nk-surface p-5" style={{ border: `1px solid ${LINE}` }}>
      <div className="mb-3">
        <div className="text-[13px] font-extrabold" style={{ color: INK }}>
          {title}
        </div>
        {hint && (
          <div className="text-[11px] mt-0.5" style={{ color: SUB }}>
            {hint}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/** 월별 사건 수 미니 막대. 축 없이 상대 높이만 보여 준다. */
function MiniBars({
  months,
  counts,
}: {
  months: number[];
  counts: Record<number, number>;
}) {
  const max = Math.max(1, ...months.map((m) => counts[m] ?? 0));
  return (
    <div className="flex items-end gap-[3px]" style={{ height: 28 }}>
      {months.map((m) => {
        const v = counts[m] ?? 0;
        return (
          <div
            key={m}
            title={`${m}월 ${v}건`}
            className="w-[10px] rounded-sm"
            style={{
              height: `${Math.max(2, (v / max) * 28)}px`,
              background: v === 0 ? "rgb(var(--wr-sunken))" : INK,
              opacity: v === 0 ? 1 : 0.35 + (v / max) * 0.65,
            }}
          />
        );
      })}
    </div>
  );
}

export function WithdrawalInsightBlocks({
  withdrawals,
  teacherStudentCounts,
}: {
  withdrawals: Withdrawal[];
  teacherStudentCounts?: Record<string, number>;
}) {
  const [openTeacher, setOpenTeacher] = useState<string | null>(null);
  const [planning, setPlanning] = useState<string | null>(null);
  const [plans, setPlans] = useState<Record<string, TeacherActionPlan>>({});
  const [planError, setPlanError] = useState<Record<string, string>>({});
  const [addedActions, setAddedActions] = useState<Set<string>>(new Set());
  // 강사가 많으면 접힌 카드만으로도 섹션이 길어진다. 읽을 순서 상위부터 보여 준다.
  const [showAllTeachers, setShowAllTeachers] = useState(false);

  const analyzed = useMemo(
    () => analyzeEvents(groupWithdrawalEvents(withdrawals)),
    [withdrawals],
  );
  const persistence = useMemo(() => buildPersistence(analyzed), [analyzed]);
  const earlyExit = useMemo(() => buildEarlyExit(analyzed), [analyzed]);
  const recentShift = useMemo(() => buildRecentShift(analyzed), [analyzed]);
  const teacherRows = useMemo(
    () => buildTeacherAnalysis(analyzed, teacherStudentCounts),
    [analyzed, teacherStudentCounts],
  );
  const stableTeachers = useMemo(
    () => buildStableTeachers(analyzed, teacherStudentCounts, new Date().getMonth() + 1),
    [analyzed, teacherStudentCounts],
  );
  const reliability = useMemo(
    () => buildReliability(analyzed, withdrawals.length),
    [analyzed, withdrawals.length],
  );

  const byId = useMemo(() => {
    const map = new Map<string, AnalyzedEvent>();
    analyzed.forEach((a) => map.set(a.event.id, a));
    return map;
  }, [analyzed]);

  const handleGeneratePlan = useCallback(async (teacher: string) => {
    setPlanning(teacher);
    setPlanError((prev) => ({ ...prev, [teacher]: "" }));
    try {
      const result = await generateTeacherActionPlan(teacher);
      if (result.success) {
        setPlans((prev) => ({ ...prev, [teacher]: result.data }));
      } else {
        setPlanError((prev) => ({ ...prev, [teacher]: result.error }));
      }
    } finally {
      setPlanning(null);
    }
  }, []);

  const handleAddAction = useCallback(
    async (teacher: string, title: string, detail: string, key: string) => {
      const formData = new FormData();
      formData.set("action_text", `${title} — ${detail}`.slice(0, 200));
      formData.set("owner", teacher);
      const result = await addManualAction(formData);
      if (result.success) {
        setAddedActions((prev) => new Set(prev).add(key));
        toast.success("실행 항목에 추가했습니다");
      } else {
        toast.error(result.error || "실행 항목 추가 실패");
      }
    },
    [],
  );

  if (analyzed.length === 0) {
    return (
      <Panel title="사건 기반 분석">
        <div className="text-[12px]" style={{ color: SUB }}>
          분석할 퇴원 기록이 없습니다.
        </div>
      </Panel>
    );
  }

  const visibleTeacherRows = showAllTeachers
    ? teacherRows
    : teacherRows.slice(0, TEACHER_PREVIEW_COUNT);
  const hiddenTeacherCount = teacherRows.length - visibleTeacherRows.length;

  const activeTopics = persistence.topics.filter((t) => t.totalEvents > 0);
  const pct = (n: number) => ((n / analyzed.length) * 100).toFixed(1);

  return (
    <div className="space-y-5">
      {/* 데이터 신뢰도 — 아래 숫자를 어디까지 믿을지 먼저 밝힌다 */}
      <div
        className="rounded-2xl p-4"
        style={{ background: "rgb(var(--wr-status-warn-soft))", border: "1px solid rgb(var(--wr-status-warn-soft))" }}
      >
        <div className="text-[12px] font-extrabold mb-2" style={{ color: "rgb(var(--wr-status-warn))" }}>
          이 화면의 데이터 신뢰도
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-[11.5px]" style={{ color: "rgb(var(--wr-status-warn))" }}>
          <div>퇴원 기록 {reliability.totalRows}행 → 사건 {reliability.totalEvents}건 (중복 {reliability.mergedRows}행 병합)</div>
          <div>상담일 미기록 {reliability.missingConsultDate}/{reliability.totalEvents}건</div>
          <div>
            상담일 기록 {reliability.consultDateRecorded}건 중 연도 포함 {reliability.consultDateWithYear}건 — 경과일 계산 불가
          </div>
          <div>상담 요약 30자 미만 {reliability.thinSummary}건</div>
          <div>학부모 의견이 학생 의견과 동일 {reliability.parentCopiedFromStudent}건</div>
          <div>회고 작성 완료 {reliability.retrospectiveDone}건</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ① 지속 문제 */}
        <Panel
          title="지속 문제"
          hint={`자유서술에서 반복 등장하는 주제 (퇴원 월 ${persistence.months.length}개월 기준)${
            persistence.graduatingCount > 0 ? ` · 고3 ${persistence.graduatingCount}건 별도` : ""
          }`}
        >
          {activeTopics.length === 0 ? (
            <div className="text-[12px]" style={{ color: SUB }}>
              자유서술에서 잡힌 주제가 없습니다.
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeTopics.map((t) => (
                <div key={t.topic} className="flex items-center gap-3">
                  <div className="w-[104px] flex-shrink-0">
                    <div className="text-[12px] font-bold" style={{ color: INK }}>
                      {SIGNAL_LABEL[t.topic]}
                    </div>
                    <div className="text-[10px]" style={{ color: SUB }}>
                      {t.totalEvents}건
                    </div>
                  </div>
                  <MiniBars months={persistence.months} counts={t.monthlyCounts} />
                  <span
                    className="ml-auto rounded-md px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: "rgb(var(--wr-sunken))", color: INK }}
                  >
                    {t.monthsWithEvents}/{persistence.months.length}개월 지속
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-[11px] leading-relaxed" style={{ color: SUB }}>
            키워드 자동 태깅 결과입니다. 판정이 아니라 원문을 확인할 사건을 좁히는 용도입니다.
          </p>
        </Panel>

        {/* ② 초기 이탈 */}
        <Panel
          title="초기 이탈"
          hint={`입학 후 6개월 이내에 떠난 사건${
            earlyExit.graduatingCount > 0 ? ` · 고3 ${earlyExit.graduatingCount}건 별도` : ""
          }`}
        >
          <div className="flex items-end gap-5">
            <div>
              <div className="text-3xl font-extrabold leading-none" style={{ color: INK }}>
                {earlyExit.within6}
              </div>
              <div className="text-[11px] mt-1" style={{ color: SUB }}>
                6개월 이내 ({pct(earlyExit.within6)}%)
              </div>
            </div>
            <div>
              <div className="text-xl font-extrabold leading-none" style={{ color: INK }}>
                {earlyExit.within2}
              </div>
              <div className="text-[11px] mt-1" style={{ color: SUB }}>
                그중 2개월 이내
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(Object.entries(earlyExit.topicCounts) as [SignalTopic, number][])
              .filter(([, n]) => n > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([topic, n]) => (
                <span
                  key={topic}
                  title={SIGNAL_GLOSS[topic]}
                  className="rounded-md px-2 py-0.5 text-[10.5px] font-semibold"
                  style={{ background: "rgb(var(--wr-sunken))", color: INK }}
                >
                  {SIGNAL_LABEL[topic]} {n}
                </span>
              ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed" style={{ color: SUB }}>
            입학 반 배치·과제량 기대치·첫 8주 적응 관리 점검 대상입니다.
          </p>
        </Panel>

        {/* ③ 최근 변화 */}
        <Panel
          title="최근 변화"
          hint={
            recentShift.latestMonth
              ? `${recentShift.latestMonth}월 vs 직전 ${recentShift.baselineMonths.length}개월 평균`
              : "비교할 기간이 부족합니다"
          }
        >
          {recentShift.risen.length === 0 ? (
            <div className="text-[12px]" style={{ color: SUB }}>
              직전 평균보다 늘어난 주제가 없습니다.
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentShift.risen.map((r) => (
                <div key={r.topic} className="flex items-center justify-between text-[12px]">
                  <span className="font-bold" style={{ color: INK }}>
                    {SIGNAL_LABEL[r.topic]}
                  </span>
                  <span style={{ color: SUB }}>
                    {r.latestCount}건 (직전 평균 {r.baselineAvg.toFixed(1)}건)
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-[11px] leading-relaxed" style={{ color: SUB }}>
            시험 시즌·기록 방식 변화 영향 가능, 재원 분모 없음 — 비율 해석 금지.
          </p>
        </Panel>

      </div>

      {/* ④ 강사별 확인 포인트 */}
      <div className="rounded-2xl bg-nk-surface p-5" style={{ border: `1px solid ${LINE}` }}>
        <div className="mb-1 text-[13px] font-extrabold" style={{ color: INK }}>
          강사별 확인 포인트
        </div>
        <div className="mb-3 text-[11px]" style={{ color: SUB }}>
          순위·평가가 아니라 원장이 원문을 열어볼 순서입니다.
        </div>

        {/* 안정 담당 — 문제만 보여 주면 화면이 책임 추궁으로 읽힌다. 사실 그대로 인정한다. */}
        {stableTeachers.length > 0 && (
          <div
            className="mb-3 rounded-xl px-3 py-2.5"
            style={{ background: "rgb(var(--wr-status-done-soft))", border: "1px solid rgb(var(--wr-status-done-soft))" }}
          >
            <div className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-extrabold" style={{ color: "rgb(var(--wr-status-done))" }}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              안정 담당 (담당 재원 {STABLE_MIN_ENROLLED}명 이상 · 최근 {STABLE_RECENT_MONTHS}개월 기준)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {stableTeachers.map((st) => (
                <span
                  key={st.teacher}
                  className="rounded-full bg-nk-surface px-2.5 py-1 text-[11px] font-semibold"
                  style={{ color: "rgb(var(--wr-status-done))", boxShadow: "inset 0 0 0 1px rgb(var(--wr-status-done-soft))" }}
                >
                  {st.teacher} T · 담당 {st.enrolledCount}명 ·{" "}
                  {st.recentCount === 0 ? "최근 3개월 퇴원 없음" : `최근 3개월 ${st.recentCount}건`}
                </span>
              ))}
            </div>
          </div>
        )}

        {teacherRows.length === 0 ? (
          <div className="text-[12px]" style={{ color: SUB }}>
            담당이 기록된 사건이 없습니다.
          </div>
        ) : (
          <div className="space-y-1.5">
            {visibleTeacherRows.map((t) => {
              const open = openTeacher === t.teacher;
              const headline = t.topicTallies.filter((x) => !x.oneOff).slice(0, 2);
              return (
                <div key={t.teacher} className="rounded-lg" style={{ border: `1px solid ${LINE}` }}>
                  <button
                    type="button"
                    onClick={() => setOpenTeacher(open ? null : t.teacher)}
                    className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left hover:bg-nk-sunken"
                  >
                    {open ? (
                      <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" style={{ color: SUB }} />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: SUB }} />
                    )}
                    <span className="text-[12.5px] font-bold" style={{ color: INK }}>
                      {t.teacher} T
                    </span>
                    <span className="text-[11px]" style={{ color: SUB }}>
                      사건 {t.eventCount}건
                      {t.graduatingCount > 0 && ` (+고3 ${t.graduatingCount}건)`} ·{" "}
                      {t.activeMonths}개월
                      {t.enrolledCount !== null && ` · 담당 재원 ${t.enrolledCount}명`}
                    </span>
                    {headline.map((x) => (
                      <span
                        key={x.topic}
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ background: "rgb(var(--wr-sunken))", color: INK }}
                      >
                        {SIGNAL_LABEL[x.topic]}
                      </span>
                    ))}
                    {t.holdJudgement && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                        style={{ background: "rgb(var(--wr-sunken))", color: SUB }}
                      >
                        판단 보류 (n&lt;{MIN_EVENTS_FOR_READING})
                      </span>
                    )}
                    <span className="ml-auto text-[10.5px]" style={{ color: SUB }}>
                      기록 공백 {t.recordGapCount}/{t.eventCount}
                    </span>
                  </button>

                  {open && (
                    <div className="space-y-3 border-t px-3 py-3" style={{ borderColor: LINE }}>
                      <div>
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: SUB }}>
                          반복 신호
                        </div>
                        {t.topicTallies.length === 0 ? (
                          <div className="text-[11px]" style={{ color: SUB }}>
                            자유서술에서 잡힌 주제가 없습니다.
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            {t.topicTallies.slice(0, 3).map((x) => (
                              <div key={x.topic} className="text-[11.5px]" style={{ color: INK }}>
                                {SIGNAL_LABEL[x.topic]} — {x.count}건
                                {x.months > 0 && ` · ${x.months}개월`}
                                <span style={{ color: SUB }}>{x.oneOff ? " (단발)" : " 반복"}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: SUB }}>
                          직접 수업·소통 신호
                        </div>
                        {t.teachingSnippets.length === 0 ? (
                          <div className="text-[11px]" style={{ color: SUB }}>
                            직접 불만 기록 없음
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {t.teachingSnippets.map((sn, i) => (
                              <div
                                key={i}
                                className="rounded-md bg-nk-sunken px-2.5 py-1.5 text-[11px]"
                                style={{ color: SUB }}
                              >
                                <span className="font-semibold" style={{ color: INK }}>
                                  {sn.studentName}
                                </span>{" "}
                                <span className="font-semibold">
                                  {SOURCE_FIELD_LABEL[sn.field as keyof typeof SOURCE_FIELD_LABEL]}
                                </span>{" "}
                                {sn.snippet}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: SUB }}>
                          기록 공백
                        </div>
                        <div className="text-[11.5px]" style={{ color: INK }}>
                          상담일 미기록 {t.missingConsultDate}건 · 요약 30자 미만 {t.thinSummary}건 · 회고
                          미작성 {t.missingRetrospective}건{" "}
                          <span style={{ color: SUB }}>(담당 사건 {t.eventCount}건 대비)</span>
                        </div>
                      </div>

                      <div>
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: SUB }}>
                          확인 포인트
                        </div>
                        <ul className="space-y-0.5">
                          {t.checkPoints.map((cp, i) => (
                            <li key={i} className="text-[11.5px]" style={{ color: INK }}>
                              · {cp}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: SUB }}>
                          사건 목록
                        </div>
                        <div className="space-y-1">
                          {[...t.eventIds, ...t.graduatingEventIds].map((id) => {
                            const a = byId.get(id);
                            if (!a) return null;
                            // 고3 사건은 숨기지 않되 회색 톤 + 뱃지로 판정 대상이 아님을 밝힌다.
                            return (
                              <div key={id} className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                <span className="font-bold" style={{ color: a.graduating ? "rgb(var(--wr-ink-hint))" : INK }}>
                                  {a.event.row.name}
                                </span>
                                <span style={{ color: a.graduating ? "rgb(var(--wr-ink-hint))" : SUB }}>
                                  {a.month !== null ? `${a.month}월` : "월 미상"} ·{" "}
                                  {TENURE_BAND_LABEL[a.event.tenureBand]}
                                </span>
                                {a.graduating && (
                                  <span
                                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                                    style={{ background: "rgb(var(--wr-sunken))", color: "rgb(var(--wr-ink-hint))" }}
                                  >
                                    고3 (수능·졸업 자연 이탈 가능)
                                  </span>
                                )}
                                {a.topics.map((tp) => (
                                  <span
                                    key={tp}
                                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                                    style={{
                                      background: a.graduating ? "rgb(var(--wr-sunken))" : "rgb(var(--wr-sunken))",
                                      color: a.graduating ? "rgb(var(--wr-ink-hint))" : INK,
                                    }}
                                  >
                                    {SIGNAL_LABEL[tp]}
                                  </span>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* AI 조치 계획 — 규칙 기반 확인 포인트와 별개의 보조 자료 */}
                      <div className="border-t pt-3" style={{ borderColor: LINE }}>
                        <button
                          type="button"
                          onClick={() => handleGeneratePlan(t.teacher)}
                          disabled={planning === t.teacher}
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-bold transition-colors disabled:opacity-60"
                          style={{ background: "rgb(var(--wr-sunken))", color: INK }}
                        >
                          {planning === t.teacher ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          {plans[t.teacher] ? "AI 조치 계획 다시 생성" : "AI 조치 계획 생성"}
                        </button>

                        {planError[t.teacher] && (
                          <div
                            className="mt-2 rounded-md px-2.5 py-1.5 text-[11px]"
                            style={{ background: "rgb(var(--wr-status-late-soft))", color: "rgb(var(--wr-status-late))" }}
                          >
                            {planError[t.teacher]}
                          </div>
                        )}

                        {plans[t.teacher] && (
                          <div className="mt-2 space-y-2.5">
                            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: SUB }}>
                              AI 생성 — 참고용, 원문 확인 후 적용
                            </div>
                            <p className="text-[11.5px] leading-relaxed" style={{ color: INK }}>
                              {plans[t.teacher].situationSummary}
                            </p>

                            {plans[t.teacher].likelyFactors.length > 0 && (
                              <div>
                                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: SUB }}>
                                  추정 요인
                                </div>
                                {plans[t.teacher].likelyFactors.map((f, i) => (
                                  <div key={i} className="text-[11.5px]" style={{ color: INK }}>
                                    · {f.factor}
                                    <span style={{ color: SUB }}> — {f.evidence}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div>
                              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: SUB }}>
                                제안 조치
                              </div>
                              <div className="space-y-1.5">
                                {plans[t.teacher].actions.map((ac, i) => {
                                  const key = `${t.teacher}:${i}`;
                                  const added = addedActions.has(key);
                                  return (
                                    <div key={i} className="rounded-md bg-nk-sunken px-2.5 py-2">
                                      <div className="flex items-start gap-2">
                                        <div className="min-w-0 flex-1">
                                          <div className="text-[11.5px] font-bold" style={{ color: INK }}>
                                            {ac.title}
                                            <span
                                              className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                                              style={{ background: "rgb(var(--wr-sunken))", color: SUB }}
                                            >
                                              {ac.timeframe}
                                            </span>
                                          </div>
                                          <div className="text-[11px]" style={{ color: SUB }}>
                                            {ac.detail}
                                          </div>
                                          {ac.checkMetric && (
                                            <div className="text-[10.5px]" style={{ color: SUB }}>
                                              확인 지표: {ac.checkMetric}
                                            </div>
                                          )}
                                        </div>
                                        <button
                                          type="button"
                                          disabled={added}
                                          onClick={() => handleAddAction(t.teacher, ac.title, ac.detail, key)}
                                          className="flex-shrink-0 rounded-md px-2 py-1 text-[10.5px] font-bold transition-colors disabled:opacity-50"
                                          style={{ background: added ? "rgb(var(--wr-sunken))" : "rgb(var(--wr-sunken))", color: added ? SUB : INK }}
                                        >
                                          {added ? "추가됨" : "실행 항목으로 추가"}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {plans[t.teacher].positiveNotes.length > 0 && (
                              <div className="rounded-md px-2.5 py-2" style={{ background: "rgb(var(--wr-status-done-soft))" }}>
                                <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgb(var(--wr-status-done))" }}>
                                  잘하고 있는 점
                                </div>
                                {plans[t.teacher].positiveNotes.map((n, i) => (
                                  <div key={i} className="text-[11.5px]" style={{ color: "rgb(var(--wr-status-done))" }}>
                                    · {n}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {(hiddenTeacherCount > 0 || showAllTeachers) && (
              <button
                type="button"
                onClick={() => setShowAllTeachers((v) => !v)}
                className="w-full rounded-lg py-2 text-[11.5px] font-bold transition-colors hover:bg-nk-sunken"
                style={{ border: `1px dashed ${LINE}`, color: SUB }}
              >
                {showAllTeachers
                  ? "접기"
                  : `더 보기 (${hiddenTeacherCount}명) — 읽을 순서 하위`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** 사건(학생) 상세용 4축 요약. 전부 자동 추정임을 라벨로 밝힌다. */
export function EventAxesSummary({ row }: { row: Withdrawal }) {
  const [analyzed] = analyzeEvents(groupWithdrawalEvents([row]));
  if (!analyzed) return null;

  const departure = estimateDepartureTarget(row);
  const parentCopied = isParentOpinionCopied(row);
  const sources: string[] = [];
  if (row.student_opinion?.trim()) sources.push("학생");
  if (row.parent_opinion?.trim() && !parentCopied) sources.push("학부모");
  if (row.teacher_opinion?.trim()) sources.push("강사");

  const axes: { label: string; value: string }[] = [
    { label: "떠난 곳", value: DEPARTURE_LABEL[departure] },
    {
      label: "근본 문제",
      value:
        analyzed.topics.length > 0
          ? analyzed.topics.map((t) => SIGNAL_LABEL[t]).join(", ")
          : "자유서술에서 잡히지 않음",
    },
    { label: "근거 출처", value: sources.length > 0 ? sources.join(", ") : "기록 없음" },
    { label: "발생 단계", value: TENURE_BAND_LABEL[analyzed.event.tenureBand] },
  ];

  return (
    <div className="rounded-xl p-3" style={{ background: "rgb(var(--wr-sunken))", border: `1px solid ${LINE}` }}>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: SUB }}>
        자동 추정 4축 (판정 아님)
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {axes.map((a) => (
          <div key={a.label}>
            <div className="text-[10px]" style={{ color: SUB }}>
              {a.label}
            </div>
            <div className="text-[11.5px] font-semibold" style={{ color: INK }}>
              {a.value}
            </div>
          </div>
        ))}
      </div>
      {parentCopied && (
        <div className="mt-2 text-[11px]" style={{ color: "rgb(var(--wr-status-warn))" }}>
          학부모 의견은 학생 의견과 동일합니다(별도 진술 아님).
        </div>
      )}
    </div>
  );
}
