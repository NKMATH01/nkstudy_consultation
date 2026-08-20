import type { Survey } from "@/types";
import { buildSurveyV2DisplayData } from "@/lib/assessment/v2/display";

interface Props {
  survey: Survey;
  variant?: "cards" | "compact";
}

export function SurveyV2ResponseView({ survey, variant = "cards" }: Props) {
  const data = buildSurveyV2DisplayData(survey);
  const compact = variant === "compact";
  const cardClass = compact
    ? "rounded-xl border border-nk-line-soft bg-nk-surface p-3"
    : "rounded-2xl border border-nk-line-soft bg-nk-surface p-6 shadow-[0_1px_3px_rgb(var(--wr-navy-strong)_/_0.02),0_4px_12px_rgb(var(--wr-navy-strong)_/_0.02)]";

  return (
    <div className={compact ? "space-y-3" : "space-y-5"} data-survey-version="v2">
      <section className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.08em] text-nk-cat-3">
              V2 학습 프로필
            </span>
            <h3 className={`${compact ? "text-xs" : "text-[14.5px]"} mt-1 font-bold text-nk-ink`}>
              {data.subjectLabel} · 최신 설문 원문
            </h3>
          </div>
          <span data-testid="v2-response-count" className="rounded-full bg-nk-cat-3-soft px-2.5 py-1 text-[10px] font-black text-nk-cat-3">
            {data.answeredCount}/{data.questionCount}문항 응답
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-nk-ink-sub">
          현재 V2 설문의 사전정보, 문항, 선택지와 저장된 원응답을 그대로 연결한 화면입니다.
        </p>
      </section>

      {data.intakeSections.map((section) => (
        <section key={section.key} className={cardClass}>
          <h4 className={`${compact ? "text-xs" : "text-[14px]"} font-bold text-nk-ink`}>
            {section.title}
          </h4>
          <div className={`mt-3 grid grid-cols-1 ${compact ? "gap-2 sm:grid-cols-2" : "gap-3 sm:grid-cols-2"}`}>
            {section.fields.map((item) => (
              <div key={item.key} className="rounded-lg bg-nk-sunken px-3 py-2.5">
                <span className="text-[10px] font-semibold text-nk-ink-hint">{item.label}</span>
                <p className={`mt-0.5 whitespace-pre-wrap ${compact ? "text-[11px]" : "text-[12.5px]"} font-medium ${item.value ? "text-nk-ink" : "text-nk-ink-hint"}`}>
                  {item.value ?? "-"}
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}

      {data.questionGroups.map((group) => (
        <section key={group.subject} className={cardClass}>
          <div className="flex items-center justify-between gap-2">
            <h4 className={`${compact ? "text-xs" : "text-[14px]"} font-bold text-nk-ink`}>
              {group.title}
            </h4>
            <span className="text-[10px] font-semibold text-nk-ink-hint">{group.questions.length}문항</span>
          </div>
          <div className="mt-3 divide-y divide-nk-line-soft">
            {group.questions.map((question) => (
              <div key={question.id} data-testid={`v2-question-${question.id}`} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 min-w-8 rounded-md bg-nk-sunken px-1.5 py-0.5 text-center text-[9px] font-black text-nk-ink-sub">
                    {question.id}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`${compact ? "text-[11px]" : "text-[12.5px]"} leading-relaxed text-nk-ink`}>
                      {question.question}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span data-testid={`v2-answer-${question.id}`} className={`rounded-md px-2 py-1 text-[10px] font-bold ${question.answer ? "bg-nk-cat-3-soft text-nk-cat-3" : "bg-nk-sunken text-nk-ink-hint"}`}>
                        {question.answer ?? "미응답"}
                      </span>
                      <span className="text-[9px] font-semibold text-nk-ink-hint">근거: {question.evidenceLabel}</span>
                    </div>
                    {question.supplements.length > 0 && (
                      <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {question.supplements.map((supplement) => (
                          <div key={supplement.id} className="rounded-md border border-nk-line-soft bg-nk-sunken/70 px-2 py-1.5 text-[10px]">
                            <span className="font-semibold text-nk-ink-hint">{supplement.label}</span>
                            <span className={`ml-1 font-bold ${supplement.value ? "text-nk-ink" : "text-nk-ink-hint"}`}>
                              {supplement.value ?? "미선택"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
