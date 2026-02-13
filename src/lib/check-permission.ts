import { getCurrentTeacher } from "@/lib/actions/settings";
import { redirect } from "next/navigation";

/** 서버 컴포넌트에서 페이지 접근 권한 확인. admin은 항상 통과. */
export async function checkPagePermission(pathname: string) {
  const currentTeacher = await getCurrentTeacher();

  // 선생님 레코드 없으면 허용 (레거시 호환)
  if (!currentTeacher) return currentTeacher;

  // admin은 항상 접근 가능
  if (currentTeacher.role === "admin") return currentTeacher;

  // allowed_menus가 null이면 권한 미설정 → 대시보드만 허용
  if (!currentTeacher.allowed_menus) {
    if (pathname !== "/") redirect("/");
    return currentTeacher;
  }

  // allowed_menus에 없으면 대시보드로 리다이렉트
  if (!currentTeacher.allowed_menus.includes(pathname)) {
    redirect("/");
  }

  return currentTeacher;
}
