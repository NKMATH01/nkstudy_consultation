import { getTeachers, getCurrentTeacher } from "@/lib/actions/settings";
import { PermissionsClient } from "@/components/settings/permissions-client";
import { redirect } from "next/navigation";

export default async function PermissionsPage() {
  const currentTeacher = await getCurrentTeacher();
  if (!currentTeacher || currentTeacher.role !== "admin") {
    redirect("/");
  }

  const teachers = await getTeachers();
  // 로그인 가능한 선생님만 (clinic 제외)
  const loginableTeachers = teachers.filter((t) => t.role !== "clinic" && t.role !== "admin");

  return (
    <div className="space-y-5">
      <div>
        <h1
          className="text-xl font-extrabold"
          style={{ color: "#0F172A", letterSpacing: "-0.02em", marginBottom: "3px" }}
        >
          선생님 권한 관리
        </h1>
        <p className="text-[12.5px]" style={{ color: "#64748B" }}>
          각 선생님이 볼 수 있는 사이드 메뉴를 설정합니다
        </p>
      </div>
      <PermissionsClient teachers={loginableTeachers} />
    </div>
  );
}
