"use client";

import { Check, CircleCheck, Stethoscope, TriangleAlert } from "lucide-react";
import type {
  DataQualityReport,
  Diagnosis,
  Prescription,
} from "@/lib/withdrawal-analytics";

const NK_PRIMARY = "var(--primary)";

const SEVERITY_BG: Record<Diagnosis["severity"], string> = {
  "심각": "#DC2626",
  "주의": "#F59E0B",
  "관찰": "#64748B",
};

function SeverityBadge({ severity }: { severity: Diagnosis["severity"] }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold text-white"
      style={{ background: SEVERITY_BG[severity] }}
    >
      {severity}
    </span>
  );
}

function RankBadge({ rank, large }: { rank: number; large?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg font-extrabold text-white ${
        large ? "w-7 h-7 text-sm" : "w-5 h-5 text-[11px]"
      }`}
      style={{ background: "rgba(255,255,255,0.18)" }}
    >
      {rank}
    </span>
  );
}

export function DiagnosisHero({
  diagnoses,
  dataQuality,
  periodLabel,
}: {
  diagnoses: Diagnosis[];
  dataQuality: DataQualityReport;
  periodLabel: string;
}) {
  const [primary, ...rest] = diagnoses;
  const showQualityStrip = dataQuality.missingReasonPct >= 20;

  return (
    <div
      className="rounded-2xl p-6 text-white"
      style={{
        background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-soft) 100%)",
        boxShadow: "0 4px 18px rgba(15,43,91,0.22)",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Stethoscope className="w-4 h-4" style={{ color: "var(--accent-warm)" }} />
        <span className="text-[13px] font-bold">핵심 진단</span>
        <span className="text-[11px] text-white/60">{periodLabel}</span>
      </div>

      {primary ? (
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <RankBadge rank={1} large />
              <SeverityBadge severity={primary.severity} />
              <span className="text-base font-bold">{primary.title}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[32px] font-extrabold leading-none tracking-tight">
                {primary.metric}
              </span>
              <span className="text-base font-bold text-white/70">{primary.metricUnit}</span>
            </div>
            <p className="text-[13px] text-white/75 mt-1.5">{primary.evidence}</p>
          </div>

          {rest.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rest.map((d, i) => (
                <div
                  key={d.type}
                  className="rounded-xl px-4 py-3"
                  style={{ background: "rgba(255,255,255,0.10)" }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <RankBadge rank={i + 2} />
                    <SeverityBadge severity={d.severity} />
                    <span className="text-[13px] font-bold truncate">{d.title}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-extrabold leading-none">{d.metric}</span>
                    <span className="text-xs font-bold text-white/70">{d.metricUnit}</span>
                  </div>
                  <p className="text-[11px] text-white/70 mt-1">{d.evidence}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 py-2">
          <CircleCheck className="w-8 h-8 flex-shrink-0" style={{ color: "#6EE7B7" }} />
          <div>
            <p className="text-[15px] font-bold">이번 기간 특이 문제가 감지되지 않았습니다</p>
            <p className="text-[12px] text-white/70 mt-0.5">
              총 퇴원 {dataQuality.total}건 기준
            </p>
          </div>
        </div>
      )}

      {showQualityStrip && (
        <div
          className="mt-4 flex items-center gap-2 rounded-xl px-4 py-2.5"
          style={{ background: "rgba(245,158,11,0.20)", border: "1px solid rgba(252,211,77,0.45)" }}
        >
          <TriangleAlert className="w-4 h-4 flex-shrink-0" style={{ color: "#FCD34D" }} />
          <span className="text-[12px] font-semibold" style={{ color: "#FDE68A" }}>
            사유 미입력 {dataQuality.missingReasonCount}건 ({dataQuality.missingReasonPct}%) — 진단
            정확도에 영향을 줍니다
          </span>
        </div>
      )}
    </div>
  );
}

export function PrescriptionSection({ prescriptions }: { prescriptions: Prescription[] }) {
  if (prescriptions.length === 0) return null;

  return (
    <div
      className="bg-white rounded-2xl p-6"
      style={{
        border: "1px solid #E8ECF1",
        boxShadow: "0 1px 3px rgba(15,43,91,0.04), 0 4px 12px rgba(15,43,91,0.03)",
      }}
    >
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4" style={{ color: NK_PRIMARY }} />
          <h3 className="text-[15px] font-bold" style={{ color: NK_PRIMARY }}>
            이번 기간 개선 액션
          </h3>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">핵심 진단에 대응하는 실행 항목</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {prescriptions.map((p) => (
          <div
            key={p.diagnosisType}
            className="rounded-xl p-4"
            style={{ border: "1px solid #E8ECF1", background: "#FAFBFD" }}
          >
            <div className="text-sm font-bold mb-3" style={{ color: NK_PRIMARY }}>
              {p.title}
            </div>
            <ul className="space-y-2">
              {p.actions.map((action) => (
                <li key={action} className="flex items-start gap-2">
                  <Check
                    className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                    style={{ color: "var(--accent-warm-foreground)" }}
                  />
                  <span className="text-xs text-slate-700 leading-relaxed">{action}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
