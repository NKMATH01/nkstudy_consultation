import { Settings } from "lucide-react";
import { getClasses, getTeachers } from "@/lib/actions/settings";
import { ClassList } from "@/components/settings/class-list";
import { TeacherList } from "@/components/settings/teacher-list";

export default async function SettingsPage() {
  const [classes, teachers] = await Promise.all([getClasses(), getTeachers()]);

  return (
    <div className="space-y-6">
      {/* Section Banner */}
      <div className="bg-slate-100 border border-slate-300 rounded-xl p-4 flex items-center gap-3">
        <div className="p-3 bg-slate-200 text-slate-600 rounded-lg">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">설정</h2>
          <p className="text-sm text-slate-600">반/선생님 관리</p>
        </div>
      </div>

      {/* Side-by-side grid like original */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ClassList classes={classes} />
        <TeacherList teachers={teachers} />
      </div>
    </div>
  );
}
