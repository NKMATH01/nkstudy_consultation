import type { Metadata } from "next";
import { Noto_Sans_KR, DM_Sans } from "next/font/google";
import Script from "next/script";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/providers/query-provider";
import "./globals.css";

const notoSansKR = Noto_Sans_KR({
  variable: "--font-noto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-dm",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "NK 상담관리",
  description: "NK Education 상담 관리 시스템",
};

/*
  야간 모드 선택을 첫 페인트 '전에' 적용하는 스크립트.

  ★ 왜 인라인 blocking 인가
    테마 적용을 next/script 나 React 의 useEffect 에 맡기면 하이드레이션이 끝난 뒤에야
    어두워진다. 야간을 켜 둔 사람은 화면을 열 때마다 흰 화면이 한 번 번쩍인 뒤 어두워진다.
    업무보고에서 실제로 겪고 고친 문제다. 수백 바이트라 렌더를 붙잡는 비용보다
    깜빡임을 없애는 이득이 훨씬 크다.

  ★ 반드시 nk-shared.css <link> 앞이다 — 토큰이 깔리기 전에 플래그가 서 있어야 한다.

  ★ 저장 키 nk:wr-theme 은 NK 8개 프로그램 공용이다. 이름을 바꾸지 않는다.
    localStorage 만 읽는다. 네트워크도, 서버도 건드리지 않는다.
*/
const THEME_BOOTSTRAP = `(function(){try{if(localStorage.getItem('nk:wr-theme')==='night'){document.documentElement.setAttribute('data-theme','night')}}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    /* suppressHydrationWarning — 부트스트랩 스크립트가 <html> 에 data-theme 를 서버 렌더
       결과에 없던 속성으로 얹기 때문이다. 이 한 속성 말고는 서버·클라이언트가 같다. */
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        {/* NK 공통 색 토큰(--wr-*) + 공통 GNB. 업무보고 design-system/nk-shared.css 의
            복제본이며 값이 바뀌면 그쪽을 먼저 고치고 옮긴다.
            토큰만 여기서 전역으로 깐다 — 로그인 화면과 포털(다이얼로그·시트)도 같은 토큰을
            써야 하기 때문이다. 학부모가 보는 화면은 토큰만 있고 쓰지 않으므로 그대로다. */}
        <link rel="stylesheet" href="/nk-shared.css" />
      </head>
      <body className={`${dmSans.variable} ${notoSansKR.variable} antialiased`}>
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
          strategy="beforeInteractive"
          crossOrigin="anonymous"
        />
        <QueryProvider>
          {children}
          <Toaster position="top-right" />
        </QueryProvider>
      </body>
    </html>
  );
}
