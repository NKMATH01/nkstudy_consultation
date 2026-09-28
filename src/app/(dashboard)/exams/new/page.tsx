import { checkPagePermission } from "@/lib/check-permission";
import { getStudents } from "@/lib/actions/settings";
import { ExamUploadClient } from "./exam-upload-client";

export default async function ExamUploadPage() {
  await checkPagePermission("/exams");
  const students = await getStudents();
  return <ExamUploadClient students={students} />;
}
