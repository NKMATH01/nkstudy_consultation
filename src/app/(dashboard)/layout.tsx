import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { getCurrentTeacher } from "@/lib/actions/settings";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentTeacher = await getCurrentTeacher();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#F8F9FC" }}>
      <Sidebar currentTeacher={currentTeacher} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header currentTeacher={currentTeacher} />
        <main className="flex-1 overflow-y-auto" style={{ padding: "24px 28px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
