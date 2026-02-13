import { getClasses, getTeachers, getStudents } from "@/lib/actions/settings";
import { ClassList } from "@/components/settings/class-list-client";
import { checkPagePermission } from "@/lib/check-permission";

export default async function ClassesPage() {
  await checkPagePermission("/settings/classes");
  const [classes, teachers, students] = await Promise.all([getClasses(), getTeachers(), getStudents()]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold" style={{ color: "#0F172A", letterSpacing: "-0.02em", marginBottom: "3px" }}>
          반 관리
        </h1>
        <p className="text-[12.5px]" style={{ color: "#64748B" }}>
          {classes.length}개
        </p>
      </div>
      <ClassList classes={classes} teachers={teachers} students={students} />
    </div>
  );
}
