import { getCurrentTeacher } from "@/lib/actions/settings";
import { redirect } from "next/navigation";
import {
  canViewRestrictedAnalytics,
  RESTRICTED_ANALYTICS_PATHS,
} from "@/lib/menu-sectors";

/** 권한 설정(allowed_menus)과 무관하게 모든 로그인 사용자에게 열린 페이지 */
const ALWAYS_ALLOWED_PATHS = new Set(["/progress"]);

/** 서버 컴포넌트에서 페이지 접근 권한 확인. admin은 항상 통과. */
export async function checkPagePermission(pathname: string) {
  const currentTeacher = await getCurrentTeacher();

  // 제한 경로는 role 게이트를 먼저 통과해야 한다(레코드 없음 = 차단).
  if (RESTRICTED_ANALYTICS_PATHS.has(pathname)) {
    if (!canViewRestrictedAnalytics(currentTeacher?.role)) {
      redirect("/");
    }
    return currentTeacher;
  }

  // 선생님 레코드 없으면 허용 (레거시 호환)
  if (!currentTeacher) return currentTeacher;

  // admin은 항상 접근 가능
  if (currentTeacher.role === "admin") return currentTeacher;

  // 전원 공개 페이지 (진도현황 — 모든 강사 조회 가능, 편집은 서버 액션에서 별도 제한)
  if (ALWAYS_ALLOWED_PATHS.has(pathname)) return currentTeacher;

  // allowed_menus가 null이거나 빈 배열이면 권한 미설정 → 전체 허용
  if (!currentTeacher.allowed_menus || currentTeacher.allowed_menus.length === 0) {
    return currentTeacher;
  }

  // allowed_menus에 없으면 대시보드로 리다이렉트
  if (!currentTeacher.allowed_menus.includes(pathname)) {
    redirect("/");
  }

  return currentTeacher;
}
