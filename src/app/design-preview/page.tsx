// 코럴 리디자인 미리보기 라우트(비프로덕션 전용).
// 운영 (dashboard) 레이아웃·사이드바를 건드리지 않고 새 쉘 뼈대만 확인하는 용도.
// production 빌드에서는 notFound()로 404(미들웨어 우회도 비프로덕션 한정) — 공개 노출 금지.

import { notFound } from "next/navigation";
import { DesignPreviewShell } from "@/components/design-preview/preview-shell";

export const dynamic = "force-dynamic";

export default function DesignPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <DesignPreviewShell />;
}
