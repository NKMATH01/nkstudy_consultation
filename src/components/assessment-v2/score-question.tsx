"use client";

// 점수형/상황 문항 1개를 한 화면에 렌더링한다(§7 한 화면 한 문항).
// 진단 영역·예상 점수는 노출하지 않는다(§2). 선택지는 전체 행 클릭·최소 44px.
// 자동 이동 판단은 상위(orchestrator)가 하며, 이 컴포넌트는 선택 이벤트만 보고한다.

import { forwardRef } from "react";
import { Check } from "lucide-react";
import type {
  AssessmentItem,
  ChoiceItem,
  LikertItem,
  LikertResponse,
} from "@/lib/assessment/v2/types";
import { isLikert } from "@/lib/assessment/v2/definition";
import { SCALE_LABELS_V2 } from "@/lib/assessment/v2/display";

export type ScoreValue = LikertResponse | number;

interface OptionRowProps {
  selected: boolean;
  label: string;
  /** 좌측 표기(1~5 번호 또는 A~D). */
  marker: string;
  onSelect: (viaPointer: boolean) => void;
  ariaLabel: string;
  /** 최소 높이 클래스. 점수형은 52px, 상황·강제선택은 48px. */
  heightClass?: string;
  /**
   * 점수 선택지가 아닌 보조 선택("아직 잘 모르겠음").
   * 같은 강도로 보이면 6번째 점수처럼 읽혀 척도가 6점이 돼 버린다.
   */
  muted?: boolean;
}

function OptionRow({
  selected,
  label,
  marker,
  onSelect,
  ariaLabel,
  heightClass = "min-h-[48px]",
  muted = false,
}: OptionRowProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={ariaLabel}
      // e.detail === 0 → 키보드(Enter/Space) 활성화. >0 → 포인터/터치.
      onClick={(e) => onSelect(e.detail > 0)}
      className={`flex ${heightClass} w-full items-center gap-3 rounded-xl border-2 px-4 py-2.5 text-left text-[14px] font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
        selected
          ? "border-primary bg-primary/[0.06] text-primary"
          : muted
            ? "border-dashed border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"
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
          <ChoiceOptions item={item} value={value} onSelect={onSelect} />
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
  const labels = SCALE_LABELS_V2[item.scale];
  // 위에서 아래로 5→1. 긍정이 맨 위에 오면 첫 선택지가 기준점이 되어 읽기 순서가 자연스럽다.
  // 저장값은 그대로 1~5이며 표시 순서만 뒤집는다.
  return (
    <div role="radiogroup" aria-label={item.text} className="space-y-2">
      {[5, 4, 3, 2, 1].map((v) => (
        <OptionRow
          key={v}
          marker={String(v)}
          selected={value === v}
          label={labels[v - 1]}
          ariaLabel={`${v}점: ${labels[v - 1]}`}
          heightClass="min-h-[52px]"
          onSelect={(viaPointer) => onSelect(v, viaPointer)}
        />
      ))}
      {item.allowUnknown && (
        <div className="mt-4 border-t border-border pt-3">
          <OptionRow
            marker="?"
            selected={value === "unknown"}
            label="아직 잘 모르겠음"
            ariaLabel="아직 잘 모르겠음"
            muted
            onSelect={(viaPointer) => onSelect("unknown", viaPointer)}
          />
        </div>
      )}
    </div>
  );
}

/** 상황문항·강제선택 공용. 둘 다 "선택지 하나 고르기"라 표현이 같다. */
function ChoiceOptions({
  item,
  value,
  onSelect,
}: {
  item: ChoiceItem;
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
