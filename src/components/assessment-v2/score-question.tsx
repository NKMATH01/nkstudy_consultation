"use client";

// 점수형/상황 문항 1개를 한 화면에 렌더링한다(§7 한 화면 한 문항).
// 진단 영역·예상 점수는 노출하지 않는다(§2). 선택지는 전체 행 클릭·최소 44px.
// 자동 이동 판단은 상위(orchestrator)가 하며, 이 컴포넌트는 선택 이벤트만 보고한다.

import { forwardRef } from "react";
import { Check } from "lucide-react";
import type {
  AssessmentItem,
  LikertItem,
  LikertResponse,
  Scale,
  ScenarioItem,
} from "@/lib/assessment/v2/types";
import { isLikert } from "@/lib/assessment/v2/definition";

const SCALE_LABELS: Record<Scale, string[]> = {
  frequency: ["거의 없었다", "한두 번", "절반 정도", "자주", "거의 매번"],
  agreement: ["전혀 맞지 않다", "별로 맞지 않다", "반반이다", "대체로 맞다", "매우 잘 맞다"],
  fit: ["전혀 아니다", "별로 아니다", "반반이다", "대체로 그렇다", "매우 그렇다"],
};

export type ScoreValue = LikertResponse | number;

interface OptionRowProps {
  selected: boolean;
  label: string;
  /** 좌측 표기(1~5 번호 또는 A~D). */
  marker: string;
  onSelect: (viaPointer: boolean) => void;
  ariaLabel: string;
}

function OptionRow({ selected, label, marker, onSelect, ariaLabel }: OptionRowProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={ariaLabel}
      // e.detail === 0 → 키보드(Enter/Space) 활성화. >0 → 포인터/터치.
      onClick={(e) => onSelect(e.detail > 0)}
      className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl border-2 px-4 py-2.5 text-left text-[14px] font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
        selected
          ? "border-primary bg-primary/[0.06] text-primary"
          : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/40"
      }`}
    >
      <span
        aria-hidden
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-muted text-muted-foreground"
        }`}
      >
        {selected ? <Check className="h-3.5 w-3.5" /> : marker}
      </span>
      <span className="leading-snug">{label}</span>
    </button>
  );
}

interface Props {
  item: AssessmentItem;
  value: ScoreValue | null | undefined;
  onSelect: (value: ScoreValue, viaPointer: boolean) => void;
  supplements: Record<string, string>;
  onSupplementChange: (fieldId: string, value: string) => void;
  questionNumber: number;
  totalQuestions: number;
}

export const ScoreQuestion = forwardRef<HTMLHeadingElement, Props>(
  function ScoreQuestion(
    { item, value, onSelect, supplements, onSupplementChange, questionNumber, totalQuestions },
    titleRef
  ) {
    const likert = isLikert(item);
    const title = (
      <h2
        ref={titleRef}
        tabIndex={-1}
        className="text-[17px] font-bold leading-relaxed text-foreground focus:outline-none"
      >
        {item.text}
      </h2>
    );

    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <span className="text-[12px] font-semibold text-muted-foreground">
            {questionNumber} / {totalQuestions}
          </span>
          {title}
        </div>

        {likert ? (
          <LikertOptions item={item} value={value} onSelect={onSelect} />
        ) : (
          <ScenarioOptions item={item} value={value} onSelect={onSelect} />
        )}

        {likert && item.supplement && (
          <Supplement
            item={item}
            supplements={supplements}
            onSupplementChange={onSupplementChange}
          />
        )}
      </div>
    );
  }
);

function LikertOptions({
  item,
  value,
  onSelect,
}: {
  item: LikertItem;
  value: ScoreValue | null | undefined;
  onSelect: (value: ScoreValue, viaPointer: boolean) => void;
}) {
  const labels = SCALE_LABELS[item.scale];
  return (
    <div role="radiogroup" aria-label={item.text} className="space-y-2">
      {[1, 2, 3, 4, 5].map((v) => (
        <OptionRow
          key={v}
          marker={String(v)}
          selected={value === v}
          label={labels[v - 1]}
          ariaLabel={`${v}점: ${labels[v - 1]}`}
          onSelect={(viaPointer) => onSelect(v, viaPointer)}
        />
      ))}
      {item.allowUnknown && (
        <OptionRow
          marker="?"
          selected={value === "unknown"}
          label="아직 잘 모르겠음"
          ariaLabel="아직 잘 모르겠음"
          onSelect={(viaPointer) => onSelect("unknown", viaPointer)}
        />
      )}
    </div>
  );
}

function ScenarioOptions({
  item,
  value,
  onSelect,
}: {
  item: ScenarioItem;
  value: ScoreValue | null | undefined;
  onSelect: (value: ScoreValue, viaPointer: boolean) => void;
}) {
  return (
    <div role="radiogroup" aria-label={item.text} className="space-y-2">
      {item.options.map((opt) => (
        <OptionRow
          key={opt.index}
          marker={opt.choice}
          selected={value === opt.index}
          label={opt.text}
          ariaLabel={`${opt.choice}: ${opt.text}`}
          onSelect={(viaPointer) => onSelect(opt.index, viaPointer)}
        />
      ))}
    </div>
  );
}

function Supplement({
  item,
  supplements,
  onSupplementChange,
}: {
  item: LikertItem;
  supplements: Record<string, string>;
  onSupplementChange: (fieldId: string, value: string) => void;
}) {
  if (!item.supplement) return null;
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
      <p className="text-[12.5px] font-medium text-muted-foreground">
        {item.supplement.title}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {item.supplement.fields.map((field) => (
          <div key={field.id}>
            <label
              htmlFor={`sup-${field.id}`}
              className="mb-1 block text-[12px] font-semibold text-muted-foreground"
            >
              {field.label}
            </label>
            <select
              id={`sup-${field.id}`}
              value={supplements[field.id] ?? ""}
              onChange={(e) => onSupplementChange(field.id, e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              <option value="">선택 (선택 사항)</option>
              {field.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
