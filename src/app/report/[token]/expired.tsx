import { AlertTriangle } from "lucide-react";

export function ExpiredReport() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ background: "#FEF3C7" }}
      >
        <AlertTriangle className="w-8 h-8" style={{ color: "#D97706" }} />
      </div>
      <h2 className="text-xl font-bold mb-2" style={{ color: "#1F2937" }}>
        만료된 보고서입니다
      </h2>
      <p className="text-sm" style={{ color: "#6B7280" }}>
        이 보고서의 공유 링크가 만료되었습니다.
        <br />
        보고서를 다시 확인하시려면 담당 선생님께 문의해주세요.
      </p>
    </div>
  );
}
