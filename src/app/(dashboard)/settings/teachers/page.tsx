import { getTeachers } from "@/lib/actions/settings";
import { TeacherList } from "@/components/settings/teacher-list-client";

export default async function TeachersPage() {
  const teachers = await getTeachers();

  const teacherCount = teachers.filter((t) => t.role !== "clinic").length;
  const clinicCount = teachers.filter((t) => t.role === "clinic").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold" style={{ color: "#0F172A", letterSpacing: "-0.02em", marginBottom: "3px" }}>
          선생님 관리
        </h1>
        <p className="text-[12.5px]" style={{ color: "#64748B" }}>
          담임 {teacherCount}명 · 클리닉 {clinicCount}명
        </p>
      </div>
      <TeacherList teachers={teachers} />
    </div>
  );
}
