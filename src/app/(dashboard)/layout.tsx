import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { NkGnb } from "@/components/layout/nk-gnb";
import { getCurrentTeacher } from "@/lib/actions/settings";
import { ChatWrapper } from "@/components/chat/chat-wrapper";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentTeacher = await getCurrentTeacher();
  const isExecutive = ["director", "principal", "admin"].includes(currentTeacher?.role ?? "");

  return (
    <>
      {/* 본문 폰트 Pretendard. 직원 화면에만 로드한다(공개 설문·V2 결과지 영향 없음).
          색 토큰(nk-shared.css)은 로그인·포털도 써야 해서 루트 레이아웃으로 옮겼다. */}
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css"
      />
      {/* 대시보드에서 V2 결과지 PDF 저장 시 사이드바·헤더·overflow 클리핑을 제거한다(§13). */}
      <style
        dangerouslySetInnerHTML={{
          __html:
            "@media print { .app-chrome{height:auto!important;overflow:visible!important} .app-chrome aside{display:none!important} .app-chrome header{display:none!important} .app-chrome .page-shell{overflow:visible!important;height:auto!important} }",
        }}
      />
    <div className="flex h-screen flex-col overflow-hidden app-chrome">
      {/* NK 공통 상단 바 — 프로그램 전환은 모든 NK 앱이 같은 자리에서 한다. */}
      <NkGnb userName={currentTeacher?.name ?? ""} />
      {/* 사이드바+본문. 인쇄에서는 이 래퍼가 높이를 잘라내지 않도록 풀어 준다. */}
      <div className="flex min-h-0 flex-1 overflow-hidden print:block print:h-auto print:overflow-visible">
        <Sidebar currentTeacher={currentTeacher} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header currentTeacher={currentTeacher} />
          <main className="flex-1 overflow-y-auto page-enter page-shell">
            {children}
          </main>
        </div>
      </div>
      {isExecutive && <ChatWrapper userName={currentTeacher?.name ?? "관리자"} />}
    </div>
    </>
  );
}
