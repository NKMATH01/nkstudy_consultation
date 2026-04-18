import fs from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path = ".env.local") {
  const entries = fs
    .readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx), line.slice(idx + 1)];
    });

  for (const [key, value] of entries) {
    if (!process.env[key]) process.env[key] = value;
  }
}

function normalizeClassName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[-‐‑‒–—―]/g, "")
    .replace(/[（(]?\s*2관\s*[)）]?/gi, "")
    .trim()
    .toUpperCase();
}

function unique(values) {
  return [...new Set(values)];
}

function toStudentRow(row) {
  return {
    id: String(row.id ?? ""),
    name: row.name != null ? String(row.name) : null,
    class_name: row.class_name != null ? String(row.class_name) : null,
    teacher_id: row.teacher_id != null ? String(row.teacher_id) : null,
    is_active: row.is_active !== false,
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
  };
}

function toClassRow(row) {
  return {
    id: String(row.id ?? ""),
    name: row.name != null ? String(row.name) : null,
    teacher_id: row.teacher_id != null ? String(row.teacher_id) : null,
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
  };
}

function resolveTeacherId(studentClassName, classes) {
  const exactMatches = classes.filter((row) => row.name === studentClassName);
  if (exactMatches.length === 1) {
    return {
      teacherId: exactMatches[0].teacher_id,
      matchedClasses: exactMatches,
      strategy: "exact",
    };
  }

  if (exactMatches.length > 1) {
    const exactTeacherIds = unique(exactMatches.map((row) => row.teacher_id));
    if (exactTeacherIds.length === 1) {
      return {
        teacherId: exactTeacherIds[0],
        matchedClasses: exactMatches,
        strategy: "exact-duplicate-same-teacher",
      };
    }
    return {
      teacherId: null,
      matchedClasses: exactMatches,
      strategy: "exact-ambiguous",
      ambiguous: true,
    };
  }

  const normalizedKey = normalizeClassName(studentClassName);
  if (!normalizedKey) {
    return {
      teacherId: null,
      matchedClasses: [],
      strategy: "empty",
      missing: true,
    };
  }

  const normalizedMatches = classes.filter(
    (row) => normalizeClassName(row.name) === normalizedKey
  );

  if (normalizedMatches.length === 0) {
    return {
      teacherId: null,
      matchedClasses: [],
      strategy: "normalized-miss",
      missing: true,
    };
  }

  const normalizedTeacherIds = unique(
    normalizedMatches.map((row) => row.teacher_id)
  );

  if (normalizedTeacherIds.length === 1) {
    return {
      teacherId: normalizedTeacherIds[0],
      matchedClasses: normalizedMatches,
      strategy: "normalized",
    };
  }

  return {
    teacherId: null,
    matchedClasses: normalizedMatches,
    strategy: "normalized-ambiguous",
    ambiguous: true,
  };
}

async function main() {
  loadEnvFile();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("SUPABASE URL 또는 SERVICE ROLE KEY가 없습니다.");
  }

  const apply = process.argv.includes("--apply");
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: classRows, error: classError } = await supabase
    .from("classes")
    .select("id, name, teacher_id, updated_at");
  if (classError) throw classError;

  const { data: studentRows, error: studentError } = await supabase
    .from("students")
    .select("id, name, class_name, teacher_id, is_active, updated_at");
  if (studentError) throw studentError;

  const classes = (classRows ?? []).map(toClassRow);
  const students = (studentRows ?? []).map(toStudentRow);

  const updates = [];
  const skipped = [];

  for (const student of students) {
    const resolved = resolveTeacherId(student.class_name, classes);

    if (resolved.ambiguous || resolved.missing) {
      skipped.push({
        id: student.id,
        name: student.name,
        class_name: student.class_name,
        current_teacher_id: student.teacher_id,
        strategy: resolved.strategy,
        matchedClasses: resolved.matchedClasses.map((row) => ({
          id: row.id,
          name: row.name,
          teacher_id: row.teacher_id,
        })),
      });
      continue;
    }

    if (resolved.teacherId !== student.teacher_id) {
      updates.push({
        id: student.id,
        name: student.name,
        class_name: student.class_name,
        before_teacher_id: student.teacher_id,
        after_teacher_id: resolved.teacherId,
        strategy: resolved.strategy,
        matchedClasses: resolved.matchedClasses.map((row) => ({
          id: row.id,
          name: row.name,
          teacher_id: row.teacher_id,
        })),
      });
    }
  }

  const grouped = new Map();
  for (const row of updates) {
    const key = row.after_teacher_id ?? "__NULL__";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row.id);
  }

  const applied = [];
  if (apply) {
    for (const [teacherKey, ids] of grouped.entries()) {
      const teacherId = teacherKey === "__NULL__" ? null : teacherKey;
      const { data, error } = await supabase
        .from("students")
        .update({ teacher_id: teacherId })
        .in("id", ids)
        .select("id, name, class_name, teacher_id, is_active, updated_at");

      if (error) {
        throw new Error(
          `teacher_id=${teacherId ?? "null"} 백필 실패: ${error.message}`
        );
      }

      applied.push(...(data ?? []).map(toStudentRow));
    }
  }

  console.log(
    JSON.stringify(
      {
        apply,
        totalClasses: classes.length,
        totalStudents: students.length,
        updateCount: updates.length,
        skippedCount: skipped.length,
        updates,
        skipped,
        applied,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
