// design-preview 전용 레이아웃: Pretendard(CDN) + 코럴 토큰 CSS를 이 라우트에서만 로드한다.
// Next.js app router는 라우트 세그먼트별로 CSS를 코드 스플리팅하므로 운영 (dashboard) 폰트·색은 불변.

import type { ReactNode } from "react";
import "./coral-theme.css";

const PRETENDARD_CDN =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css";

export default function DesignPreviewLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href={PRETENDARD_CDN} />
      {children}
    </>
  );
}
