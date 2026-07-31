// 권한 fail-open 전면 제거 시뮬레이션 (읽기 전용 — 아무것도 쓰지 않는다).
//
// 현재 checkPagePermission에는 fail-open 분기가 3개 있다:
//   ① teachers 레코드 없음  ② allowed_menus가 null  ③ allowed_menus가 빈 배열
// 이 셋을 전부 제거하면 계정별로 어떤 메뉴가 잠기는지 미리 본다.
// 0일차에서는 퇴원 분석 3개 경로만 deny-by-default로 바꿨고, 전면 제거는 아직이다.
//
// 사용법: node scripts/simulate-permission-lockdown.mjs

import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim();

if (!url || !key) {
  console.error("[중단] .env.local에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  process.exit(1);
}

// src/lib/menu-sectors.ts와 같은 목록을 복제한다(mjs라 TS import 불가).
// 원본이 바뀌면 이 파일도 함께 고쳐야 한다.
const ALL_MENUS = [
  "/",
  "/consultations",
  "/bookings",
  "/surveys",
  "/drip-responses",
  "/onboarding",
  "/withdrawals",
  "/withdrawals/dashboard",
  "/withdrawals/review",
  "/withdrawals/teachers",
  "/settings/students",
  "/settings/classes",
  "/settings/teachers",
  "/settings/permissions",
];

const ALWAYS_VISIBLE_MENUS = new Set(["/progress", "/drip-responses"]);

// W1에서 도입한 deny-by-default 경로·role (src/lib/menu-sectors.ts와 동일)
const RESTRICTED_ANALYTICS_PATHS = new Set([
  "/withdrawals/dashboard",
  "/withdrawals/review",
  "/withdrawals/teachers",
]);
const ANALYTICS_ALLOWED_ROLES = new Set(["principal", "admin"]);

const res = await fetch(
  `${url}/rest/v1/teachers?select=id,name,role,allowed_menus&order=role,name`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } },
);

if (!res.ok) {
  console.error(`[중단] teachers 조회 실패: HTTP ${res.status} ${await res.text()}`);
  process.exit(1);
}

const teachers = await res.json();
console.log(`teachers ${teachers.length}명 로드\n`);

// ── role 분포 ────────────────────────────────────────────────────────
const byRole = {};
for (const t of teachers) {
  const role = t.role ?? "(null)";
  byRole[role] = (byRole[role] ?? 0) + 1;
}
console.log("=== role 분포 ===");
console.table(
  Object.entries(byRole)
    .sort((a, b) => b[1] - a[1])
    .map(([role, count]) => ({ role, 인원: count })),
);

// ── 현재(0일차 적용 후) 퇴원 분석 접근 가능자 ─────────────────────────
const analyticsViewers = teachers.filter((t) => ANALYTICS_ALLOWED_ROLES.has(t.role ?? ""));
console.log(`\n=== 퇴원 분석 3개 경로 접근 가능 계정: ${analyticsViewers.length}명 ===`);
if (analyticsViewers.length === 0) {
  console.log("  ⚠ 0명입니다 — 원장 계정 role이 'principal'인지 확인이 필요합니다.");
} else {
  console.table(analyticsViewers.map((t) => ({ 이름: t.name, role: t.role })));
}

// ── fail-open 전면 제거 시 잠기는 메뉴 ───────────────────────────────
const rows = [];
for (const t of teachers) {
  const role = t.role ?? "(null)";
  const allowed = Array.isArray(t.allowed_menus) ? t.allowed_menus : null;

  // fail-open을 없앤 뒤의 판정: admin은 전체 통과, 그 외는 allowed_menus에 있어야 통과.
  const locked = ALL_MENUS.filter((menu) => {
    if (role === "admin") return false;
    if (ALWAYS_VISIBLE_MENUS.has(menu)) return false;
    if (RESTRICTED_ANALYTICS_PATHS.has(menu)) return !ANALYTICS_ALLOWED_ROLES.has(role);
    return !allowed || !allowed.includes(menu);
  });

  rows.push({
    이름: t.name,
    role,
    allowed_menus: allowed === null ? "(null)" : allowed.length === 0 ? "(빈 배열)" : `${allowed.length}개`,
    잠기는메뉴수: locked.length,
    잠기는메뉴: locked.join(" "),
  });
}

const affected = rows.filter((r) => r.잠기는메뉴수 > 0);
console.log(`\n=== fail-open 전면 제거 시 영향받는 계정: ${affected.length} / ${rows.length}명 ===`);
console.log("(0일차에서는 아직 적용하지 않았습니다 — 전환 판단용 사전 조회입니다)\n");

// 잠기는 메뉴가 많은 순으로 본다.
for (const r of affected.sort((a, b) => b.잠기는메뉴수 - a.잠기는메뉴수)) {
  console.log(`[${r.role}] ${r.이름} — allowed_menus ${r.allowed_menus} → ${r.잠기는메뉴수}개 잠김`);
  console.log(`    ${r.잠기는메뉴}`);
}

const untouched = rows.length - affected.length;
console.log(`\n영향 없음: ${untouched}명`);
console.log("\n변경 없음(읽기 전용 스크립트).");
