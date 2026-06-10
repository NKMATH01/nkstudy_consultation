import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/providers/query-provider";
import "./globals.css";

const notoSansKR = Noto_Sans_KR({
  variable: "--font-noto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
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
      <body className={`${pretendard.variable} ${notoSansKR.variable} antialiased`}>
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
