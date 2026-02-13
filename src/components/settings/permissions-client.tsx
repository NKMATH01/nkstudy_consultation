"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shield, Check, Save } from "lucide-react";
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

export function PermissionsClient({ teachers }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [permState, setPermState] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    teachers.forEach((t) => {
      initial[t.id] = t.allowed_menus || [];
    });
    return initial;
  });

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

  const savePermissions = (teacherId: string) => {
    startTransition(async () => {
      const result = await updateTeacherPermissions(
        teacherId,
        permState[teacherId] || []
      );
      if (result.success) {
        toast.success("권한이 저장되었습니다");
        router.refresh();
      } else {
        toast.error(result.error || "권한 저장 실패");
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
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full" style={{ minWidth: "800px" }}>
          <thead>
            <tr style={{ background: "#F8FAFC" }}>
              <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 border-b border-r border-slate-200 sticky left-0 bg-[#F8FAFC] z-10" style={{ minWidth: "140px" }}>
                선생님
              </th>
              {ASSIGNABLE_MENUS.map((m) => (
                <th
                  key={m.href}
                  className="px-2 py-3 text-[10px] font-semibold text-slate-400 border-b border-slate-200 text-center whitespace-nowrap"
                >
                  {m.label}
                </th>
              ))}
              <th className="px-3 py-3 text-xs font-bold text-slate-500 border-b border-slate-200 text-center" style={{ minWidth: "90px" }}>
                액션
              </th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((teacher) => {
              const perms = permState[teacher.id] || [];
              const allChecked = ASSIGNABLE_MENUS.every((m) =>
                perms.includes(m.href)
              );

              return (
                <tr key={teacher.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 border-r border-slate-100 sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: "rgba(15,43,91,0.08)", color: "#0F2B5B" }}
                      >
                        {teacher.name[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-slate-800 truncate">{teacher.name}</div>
                        <div className="text-[10px] text-slate-400">{teacher.subject || "담임"}</div>
                      </div>
                    </div>
                  </td>
                  {ASSIGNABLE_MENUS.map((m) => {
                    const checked = perms.includes(m.href);
                    return (
                      <td key={m.href} className="px-1 py-3 text-center">
                        <button
                          onClick={() => toggleMenu(teacher.id, m.href)}
                          className={`w-7 h-7 rounded-md flex items-center justify-center mx-auto transition-all ${
                            checked
                              ? "bg-blue-500 text-white shadow-sm"
                              : "bg-slate-100 text-slate-300 hover:bg-slate-200"
                          }`}
                        >
                          {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-2 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => toggleAll(teacher.id, !allChecked)}
                        className={`text-[10px] px-2 py-1 rounded transition-colors ${
                          allChecked ? "text-red-500 hover:bg-red-50" : "text-blue-500 hover:bg-blue-50"
                        }`}
                      >
                        {allChecked ? "해제" : "전체"}
                      </button>
                      <button
                        onClick={() => savePermissions(teacher.id)}
                        disabled={isPending}
                        className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        title="저장"
                      >
                        <Save className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
