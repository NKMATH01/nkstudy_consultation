import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
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
      {/* 코럴 스킨 폰트: Pretendard를 (dashboard) 영역에만 로드(공개 설문·V2 결과지 영향 없음). */}
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css"
      />
      {/* 대시보드에서 V2 결과지 PDF 저장 시 사이드바·헤더·overflow 클리핑을 제거한다(§13). */}
      <style
        dangerouslySetInnerHTML={{
          __html:
            "@media print { .app-chrome{height:auto!important;overflow:visible!important} .app-chrome>:first-child{display:none!important} .app-chrome header{display:none!important} .app-chrome .page-shell{overflow:visible!important;height:auto!important} }",
        }}
      />
    <div className="flex h-screen overflow-hidden app-chrome">
      <Sidebar currentTeacher={currentTeacher} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header currentTeacher={currentTeacher} />
        <main className="flex-1 overflow-y-auto page-enter page-shell">
          {children}
        </main>
      </div>
      {isExecutive && <ChatWrapper userName={currentTeacher?.name ?? "관리자"} />}
    </div>
    </>
  );
}
