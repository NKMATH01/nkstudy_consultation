"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Shield, Check, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateTeacherPermissions } from "@/lib/actions/settings";
import { ALL_MENU_ITEMS } from "@/types";
import type { Teacher } from "@/types";

interface Props {
  teachers: Teacher[];
}

// 권한 설정 가능한 메뉴 (선생님 권한 메뉴는 admin 전용이므로 제외)
const ASSIGNABLE_MENUS = ALL_MENU_ITEMS.filter(
  (m) => m.href !== "/settings/permissions"
);

// 사이드바 그룹 구조에 맞춘 메뉴 그룹
const MENU_GROUPS = [
  {
    label: "상담관리",
    color: "#EFF6FF",
    borderColor: "#BFDBFE",
    hrefs: ["/", "/consultations", "/bookings"],
  },
  {
    label: "설문현황",
    color: "#F0FDF4",
    borderColor: "#BBF7D0",
    hrefs: ["/surveys", "/analyses", "/registrations", "/onboarding"],
  },
  {
    label: "퇴원생",
    color: "#FFF7ED",
    borderColor: "#FED7AA",
    hrefs: ["/withdrawals", "/withdrawals/dashboard"],
  },
  {
    label: "학생관리",
    color: "#FAF5FF",
    borderColor: "#E9D5FF",
    hrefs: ["/settings/students", "/settings/classes", "/settings/teachers"],
  },
];

// href → group 매핑
const HREF_TO_GROUP = new Map<string, number>();
MENU_GROUPS.forEach((g, gi) => {
  g.hrefs.forEach((h) => HREF_TO_GROUP.set(h, gi));
});

export function PermissionsClient({ teachers }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [permState, setPermState] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    teachers.forEach((t) => {
      initial[t.id] = [...(t.allowed_menus || [])];
    });
    return initial;
  });

  const [savedState, setSavedState] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    teachers.forEach((t) => {
      initial[t.id] = [...(t.allowed_menus || [])];
    });
    return initial;
  });

  const hasChanges = useMemo(() => {
    return teachers.some((t) => {
      const current = (permState[t.id] || []).slice().sort();
      const saved = (savedState[t.id] || []).slice().sort();
      if (current.length !== saved.length) return true;
      return current.some((h, i) => h !== saved[i]);
    });
  }, [permState, savedState, teachers]);

  const toggleMenu = (teacherId: string, href: string) => {
    setPermState((prev) => {
      const current = prev[teacherId] || [];
      const next = current.includes(href)
        ? current.filter((h) => h !== href)
        : [...current, href];
      return { ...prev, [teacherId]: next };
    });
  };

  const toggleAll = (teacherId: string, checked: boolean) => {
    setPermState((prev) => ({
      ...prev,
      [teacherId]: checked ? ASSIGNABLE_MENUS.map((m) => m.href) : [],
    }));
  };

  // 그룹 전체 토글 (특정 선생님)
  const toggleGroupForTeacher = (teacherId: string, groupHrefs: string[]) => {
    setPermState((prev) => {
      const current = prev[teacherId] || [];
      const allChecked = groupHrefs.every((h) => current.includes(h));
      if (allChecked) {
        return {
          ...prev,
          [teacherId]: current.filter((h) => !groupHrefs.includes(h)),
        };
      } else {
        return { ...prev, [teacherId]: [...new Set([...current, ...groupHrefs])] };
      }
    });
  };

  // 그룹 전체 토글 (모든 선생님)
  const toggleGroupForAll = (groupHrefs: string[]) => {
    setPermState((prev) => {
      // 모든 선생님이 해당 그룹을 전부 가지고 있으면 → 전체 해제, 아니면 → 전체 선택
      const allTeachersAllChecked = teachers.every((t) => {
        const current = prev[t.id] || [];
        return groupHrefs.every((h) => current.includes(h));
      });

      const next = { ...prev };
      teachers.forEach((t) => {
        const current = next[t.id] || [];
        if (allTeachersAllChecked) {
          next[t.id] = current.filter((h) => !groupHrefs.includes(h));
        } else {
          next[t.id] = [...new Set([...current, ...groupHrefs])];
        }
      });
      return next;
    });
  };

  const saveAllPermissions = () => {
    startTransition(async () => {
      const changedTeachers = teachers.filter((t) => {
        const current = (permState[t.id] || []).slice().sort();
        const saved = (savedState[t.id] || []).slice().sort();
        if (current.length !== saved.length) return true;
        return current.some((h, i) => h !== saved[i]);
      });

      if (changedTeachers.length === 0) {
        toast.info("변경된 내용이 없습니다");
        return;
      }

      let successCount = 0;
      let errorMsg = "";

      for (const teacher of changedTeachers) {
        const result = await updateTeacherPermissions(
          teacher.id,
          permState[teacher.id] || []
        );
        if (result.success) {
          successCount++;
        } else {
          errorMsg = result.error || "권한 저장 실패";
        }
      }

      if (successCount === changedTeachers.length) {
        toast.success(`${successCount}명의 권한이 저장되었습니다`);
        setSavedState({ ...permState });
        router.refresh();
      } else if (successCount > 0) {
        toast.warning(`${successCount}명 저장 성공, 일부 실패: ${errorMsg}`);
        router.refresh();
      } else {
        toast.error(errorMsg || "권한 저장 실패");
      }
    });
  };

  if (teachers.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <Shield className="h-10 w-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">권한을 설정할 선생님이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 전체 저장 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={saveAllPermissions}
          disabled={isPending || !hasChanges}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isPending ? "저장 중..." : "전체 저장"}
          {hasChanges && !isPending && (
            <span className="w-2 h-2 rounded-full bg-yellow-300 animate-pulse" />
          )}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: "800px" }}>
            <thead>
              {/* 그룹 헤더 행 */}
              <tr>
                <th
                  rowSpan={2}
                  className="text-left px-4 py-3 text-xs font-bold text-slate-500 border-b border-r border-slate-200 sticky left-0 bg-[#F8FAFC] z-10"
                  style={{ minWidth: "140px" }}
                >
                  선생님
                </th>
                {MENU_GROUPS.map((group) => {
                  // 헤더에서 그룹 전체 토글 상태 계산
                  const allTeachersAllChecked = teachers.every((t) => {
                    const perms = permState[t.id] || [];
                    return group.hrefs.every((h) => perms.includes(h));
                  });
                  const someChecked = teachers.some((t) => {
                    const perms = permState[t.id] || [];
                    return group.hrefs.some((h) => perms.includes(h));
                  });

                  return (
                    <th
                      key={group.label}
                      colSpan={group.hrefs.length}
                      className="px-2 py-2 text-[11px] font-bold border-b border-slate-200 text-center cursor-pointer hover:opacity-80 transition-opacity"
                      style={{
                        background: group.color,
                        borderLeft: `2px solid ${group.borderColor}`,
                        borderRight: `2px solid ${group.borderColor}`,
                      }}
                      onClick={() => toggleGroupForAll(group.hrefs)}
                      title={`${group.label} 전체 ${allTeachersAllChecked ? "해제" : "선택"}`}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <div
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                            allTeachersAllChecked
                              ? "bg-blue-500 border-blue-500"
                              : someChecked
                                ? "bg-blue-200 border-blue-400"
                                : "border-slate-300 bg-white"
                          }`}
                        >
                          {allTeachersAllChecked && (
                            <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                          )}
                          {someChecked && !allTeachersAllChecked && (
                            <div className="w-1.5 h-0.5 bg-blue-600 rounded" />
                          )}
                        </div>
                        <span className="text-slate-600">{group.label}</span>
                      </div>
                    </th>
                  );
                })}
                <th
                  rowSpan={2}
                  className="px-3 py-3 text-xs font-bold text-slate-500 border-b border-slate-200 text-center"
                  style={{ minWidth: "70px" }}
                >
                  전체
                </th>
              </tr>
              {/* 개별 메뉴 헤더 행 */}
              <tr style={{ background: "#F8FAFC" }}>
                {ASSIGNABLE_MENUS.map((m) => {
                  const gi = HREF_TO_GROUP.get(m.href) ?? -1;
                  const group = MENU_GROUPS[gi];
                  return (
                    <th
                      key={m.href}
                      className="px-2 py-2 text-[10px] font-semibold text-slate-400 border-b border-slate-200 text-center whitespace-nowrap"
                      style={
                        group
                          ? {
                              borderLeft:
                                m.href === group.hrefs[0]
                                  ? `2px solid ${group.borderColor}`
                                  : undefined,
                              borderRight:
                                m.href === group.hrefs[group.hrefs.length - 1]
                                  ? `2px solid ${group.borderColor}`
                                  : undefined,
                            }
                          : undefined
                      }
                    >
                      {m.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {teachers.map((teacher) => {
                const perms = permState[teacher.id] || [];
                const allChecked = ASSIGNABLE_MENUS.every((m) =>
                  perms.includes(m.href)
                );

                return (
                  <tr
                    key={teacher.id}
                    className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-4 py-3 border-r border-slate-100 sticky left-0 bg-white z-10">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{
                            background: "rgba(15,43,91,0.08)",
                            color: "#0F2B5B",
                          }}
                        >
                          {teacher.name[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-slate-800 truncate">
                            {teacher.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {teacher.subject || "담임"}
                          </div>
                        </div>
                      </div>
                    </td>
                    {ASSIGNABLE_MENUS.map((m) => {
                      const checked = perms.includes(m.href);
                      const gi = HREF_TO_GROUP.get(m.href) ?? -1;
                      const group = MENU_GROUPS[gi];
                      const isFirstInGroup =
                        group && m.href === group.hrefs[0];
                      const isLastInGroup =
                        group &&
                        m.href === group.hrefs[group.hrefs.length - 1];

                      return (
                        <td
                          key={m.href}
                          className="px-1 py-3 text-center"
                          style={{
                            borderLeft: isFirstInGroup
                              ? `2px solid ${group!.borderColor}`
                              : undefined,
                            borderRight: isLastInGroup
                              ? `2px solid ${group!.borderColor}`
                              : undefined,
                          }}
                        >
                          <button
                            onClick={() => toggleMenu(teacher.id, m.href)}
                            className={`w-7 h-7 rounded-md flex items-center justify-center mx-auto transition-all ${
                              checked
                                ? "bg-blue-500 text-white shadow-sm"
                                : "bg-slate-100 text-slate-300 hover:bg-slate-200"
                            }`}
                          >
                            {checked && (
                              <Check
                                className="h-3.5 w-3.5"
                                strokeWidth={3}
                              />
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-2 py-3 text-center">
                      <button
                        onClick={() => toggleAll(teacher.id, !allChecked)}
                        className={`text-[10px] px-2 py-1 rounded transition-colors ${
                          allChecked
                            ? "text-red-500 hover:bg-red-50"
                            : "text-blue-500 hover:bg-blue-50"
                        }`}
                      >
                        {allChecked ? "해제" : "전체"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
