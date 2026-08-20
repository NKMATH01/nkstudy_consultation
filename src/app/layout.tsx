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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
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
