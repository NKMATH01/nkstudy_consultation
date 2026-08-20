import { getClasses, getTeachers, getStudents } from "@/lib/actions/settings";
import { ClassList } from "@/components/settings/class-list-client";
import { checkPagePermission } from "@/lib/check-permission";

export default async function ClassesPage() {
  await checkPagePermission("/settings/classes");
  const [classes, teachers, students] = await Promise.all([getClasses(), getTeachers(), getStudents()]);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between border-b border-nk-line-soft/70 pb-4">
        <div>
        <h1 className="text-xl font-extrabold" style={{ color: "rgb(var(--wr-ink))", letterSpacing: "-0.02em", marginBottom: "3px" }}>
          반 관리
        </h1>
        <p className="text-[12.5px]" style={{ color: "rgb(var(--wr-ink-sub))" }}>
          {classes.length}개
        </p>
        </div>
      </div>
      <ClassList classes={classes} teachers={teachers} students={students} />
    </div>
  );
}
