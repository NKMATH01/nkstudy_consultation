"use client";

import { Check, CircleCheck, Stethoscope, TriangleAlert } from "lucide-react";
import type {
  DataQualityReport,
  Diagnosis,
  DiagnosisType,
  Prescription,
} from "@/lib/withdrawal-analytics";

type AdoptHandler = (actionText: string, diagnosisType: DiagnosisType, title: string) => void;

const NK_PRIMARY = "var(--primary)";
const CARD_BORDER = "#E8ECF1";
const ROW_BG = "#FAFBFD";

const SEVERITY_COLOR: Record<Diagnosis["severity"], string> = {
  "심각": "#DC2626",
  "주의": "#F59E0B",
  "관찰": "#64748B",
};

function DiagnosisRow({
  diagnosis,
  rank,
  actions,
  adoptedActionTexts,
  onAdoptAction,
}: {
  diagnosis: Diagnosis;
  rank: number;
  actions: string[];
  adoptedActionTexts?: Set<string>;
  onAdoptAction?: AdoptHandler;
}) {
  const accent = SEVERITY_COLOR[diagnosis.severity];
  const isTop = rank === 1;

  return (
    <div
      className="flex flex-col md:flex-row rounded-xl overflow-hidden"
      style={{
        background: ROW_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderLeftWidth: "4px",
        borderLeftColor: accent,
      }}
    >
      <div
        className="md:w-[38%] p-4 border-b md:border-b-0 md:border-r"
        style={{ borderColor: CARD_BORDER }}
      >
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[11px] font-extrabold text-white"
            style={{ background: NK_PRIMARY }}
          >
            {rank}
          </span>
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
            style={{ background: accent }}
          >
            {diagnosis.severity}
          </span>
          <span className="text-[15px] font-bold" style={{ color: NK_PRIMARY }}>
            {diagnosis.title}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className="font-extrabold leading-none tracking-tight"
            style={{ fontSize: isTop ? 28 : 22, color: "#0F172A" }}
          >
            {diagnosis.metric}
          </span>
          <span className="text-sm font-bold text-slate-400">{diagnosis.metricUnit}</span>
        </div>
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{diagnosis.evidence}</p>
      </div>

      <div className="flex-1 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
          개선 액션
        </div>
        {actions.length > 0 ? (
          <ul
            className={`grid grid-cols-1 gap-x-4 gap-y-2 ${
              actions.length > 2 ? "sm:grid-cols-2" : ""
            }`}
          >
            {actions.map((action) => {
              const adopted = adoptedActionTexts?.has(action);
              return (
                <li key={action} className="flex items-start gap-2">
                  <Check
                    className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                    style={{ color: "var(--accent-warm-foreground)" }}
                  />
                  <span className="text-xs text-slate-700 leading-relaxed flex-1">{action}</span>
                  {onAdoptAction &&
                    (adopted ? (
                      <span className="text-[10px] font-semibold text-emerald-600 whitespace-nowrap mt-0.5">
                        채택됨 ✓
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAdoptAction(action, diagnosis.type, diagnosis.title)}
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap transition-colors hover:bg-slate-100 mt-0.5"
                        style={{ color: NK_PRIMARY, border: `1px solid ${CARD_BORDER}` }}
                      >
                        + 이달 실행
                      </button>
                    ))}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-slate-400">근거 상세는 아래 섹션 참고</p>
        )}
      </div>
    </div>
  );
}

export function DiagnosisSection({
  diagnoses,
  prescriptions,
  dataQuality,
  periodLabel,
  adoptedActionTexts,
  onAdoptAction,
}: {
  diagnoses: Diagnosis[];
  prescriptions: Prescription[];
  dataQuality: DataQualityReport;
  periodLabel: string;
  adoptedActionTexts?: Set<string>;
  onAdoptAction?: AdoptHandler;
}) {
  const actionsByType = new Map(prescriptions.map((p) => [p.diagnosisType, p.actions]));
  const showQualityStrip = dataQuality.missingReasonPct >= 20;

  return (
    <div
      className="bg-white rounded-2xl p-6"
      style={{
        border: `1px solid ${CARD_BORDER}`,
        boxShadow: "0 1px 3px rgba(15,43,91,0.04), 0 4px 12px rgba(15,43,91,0.03)",
      }}
    >
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-4 h-4" style={{ color: NK_PRIMARY }} />
          <h3 className="text-[15px] font-bold" style={{ color: NK_PRIMARY }}>
            핵심 진단 &amp; 개선 액션
          </h3>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          {periodLabel} · 가장 시급한 문제와 바로 실행할 항목
        </p>
      </div>

      {diagnoses.length > 0 ? (
        <div className="space-y-3">
          {diagnoses.map((d, i) => (
            <DiagnosisRow
              key={d.type}
              diagnosis={d}
              rank={i + 1}
              actions={actionsByType.get(d.type) || []}
              adoptedActionTexts={adoptedActionTexts}
              onAdoptAction={onAdoptAction}
            />
          ))}
        </div>
      ) : (
        <div
          className="flex items-center gap-2.5 rounded-xl px-4 py-3"
          style={{ background: "#ECFDF5", border: "1px solid #A7F3D0" }}
        >
          <CircleCheck className="w-4 h-4 flex-shrink-0" style={{ color: "#059669" }} />
          <span className="text-[13px] font-semibold text-emerald-700">
            이번 기간 특이 문제가 감지되지 않았습니다
          </span>
          <span className="text-xs text-emerald-600/70">총 퇴원 {dataQuality.total}건</span>
        </div>
      )}

      {showQualityStrip && (
        <div
          className="mt-3 flex items-center gap-2 rounded-xl px-4 py-2.5"
          style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}
        >
          <TriangleAlert className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#B45309" }} />
          <span className="text-xs font-semibold text-amber-700">
            사유 미입력 {dataQuality.missingReasonCount}건 ({dataQuality.missingReasonPct}%) — 진단
            정확도에 영향을 줍니다
          </span>
        </div>
      )}
    </div>
  );
}
