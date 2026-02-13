import { getStudents, getTeachers, getClasses } from "@/lib/actions/settings";
import { StudentList } from "@/components/settings/student-list-client";

export default async function StudentsPage() {
  const [students, teachers, classes] = await Promise.all([getStudents(), getTeachers(), getClasses()]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold" style={{ color: "#0F172A", letterSpacing: "-0.02em", marginBottom: "3px" }}>
          학생 관리
        </h1>
        <p className="text-[12.5px]" style={{ color: "#64748B" }}>
          {students.length}명
        </p>
      </div>
      <StudentList students={students} teachers={teachers} classes={classes} />
    </div>
  );
}
