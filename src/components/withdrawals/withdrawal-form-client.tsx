"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Wand2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createWithdrawal } from "@/lib/actions/withdrawal";
import { WITHDRAWAL_REASONS } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Normalize date string: dots/slashes → hyphens */
function normalizeDate(d: string): string {
  return d.trim().replace(/[./]/g, "-");
}

/** Parse the NK withdrawal text template (supports multiple formats) */
function parseWithdrawalText(text: string) {
  const result: Record<string, string> = {};

  // Helper: match first captured group
  const grab = (re: RegExp): string | null => {
    const m = text.match(re);
    return m ? m[1].trim() : null;
  };

  // Basic info — support 이름/학생명/성명
  result.name = grab(/(?:학생명|이름|성명)\s*[:：]\s*(.+)/) ?? "";
  result.subject = grab(/과목\s*[:：]\s*(.+)/) ?? "";
  result.class_name = grab(/반(?:명)?\s*[:：]\s*(.+)/) ?? "";
  result.school = grab(/학교\s*[:：]\s*(.+)/) ?? "";

  // Teacher — support 담당/담당 강사/담당 선생님
  const teacher = grab(/담당\s*(?:강사|선생님?)?\s*[:：]\s*(.+)/);
  if (teacher) result.teacher = teacher.replace(/T$/, "");

  // Grade — direct field or extracted from class name
  const directGrade = grab(/학년\s*[:：]\s*(.+)/);
  if (directGrade) result.grade = directGrade;

  // Duration — compound format: 2024.03.01 ~ 2025.01.15 (10개월)
  const durationMatch = text.match(/재원\s*기간\s*[:：]\s*(\S+)\s*~\s*(\S+)\s*\((\d+)개월\)/);
  if (durationMatch) {
    result.enrollment_start = normalizeDate(durationMatch[1]);
    result.enrollment_end = normalizeDate(durationMatch[2]);
    result.duration_months = durationMatch[3];
  }
  // Separate field: 수업 시작일 / 등록일
  if (!result.enrollment_start) {
    const start = grab(/(?:수업\s*시작일|등록일)\s*[:：]\s*(.+)/);
    if (start) result.enrollment_start = normalizeDate(start);
  }
  // 수업 기간 (N개월)
  if (!result.duration_months) {
    const dur = grab(/(?:수업\s*기간|재원\s*기간)\s*[:：]\s*(\d+)/);
    if (dur) result.duration_months = dur;
  }

  // Withdrawal date
  const wDate = grab(/퇴원일\s*[:：]\s*(.+)/);
  if (wDate) result.withdrawal_date = normalizeDate(wDate);

  // Learning status
  const attMap: Record<string, string> = { 보통: "중", 좋음: "중상", 우수: "상", 나쁨: "중하", 매우나쁨: "하" };
  const normalizeAtt = (v: string) => attMap[v] ?? v;

  const att = grab(/수업\s*태도\s*[:：]\s*(.+)/);
  if (att) result.class_attitude = normalizeAtt(att);

  const hw = grab(/숙제\s*제출\s*[:：]\s*(.+)/);
  if (hw) result.homework_submission = normalizeAtt(hw);

  const atd = grab(/출결\s*상태\s*[:：]\s*(.+)/);
  if (atd) result.attendance = normalizeAtt(atd);

  const gc = grab(/성적\s*변화\s*[:：]\s*(.+)/);
  if (gc) result.grade_change = gc;

  const rg = grab(/최근\s*성적\s*[:：]\s*(.+)/);
  if (rg) result.recent_grade = rg;

  // Withdrawal reasons — multi-line
  const studentOpMatch = text.match(/학생\s*의견\s*[:：]\s*\n?([\s\S]*?)(?=▫|■|──|\n[^\s]|$)/);
  if (studentOpMatch) result.student_opinion = studentOpMatch[1].trim();

  const parentOpMatch = text.match(/학부모님?\s*의견\s*[:：]\s*\n?([\s\S]*?)(?=▫|■|──|\n[^\s]|$)/);
  if (parentOpMatch) result.parent_opinion = parentOpMatch[1].trim();

  // Combined format: 학생/학부모 의견
  if (!result.student_opinion && !result.parent_opinion) {
    const combined = grab(/학생\/학부모\s*의견\s*[:：]\s*(.+)/);
    if (combined) result.student_opinion = combined;
  }

  const teacherOpMatch = text.match(/(?:담당선생님\s*추측|학원\s*소견)\s*[:：]\s*\n?([\s\S]*?)(?=──|■|\n[^\s]|$)/);
  if (teacherOpMatch) result.teacher_opinion = teacherOpMatch[1].trim();

  // Direct reason field: 퇴원사유/퇴원 사유
  const directReason = grab(/퇴원\s*사유\s*[:：]\s*(.+)/);

  // Final consultation
  const consultDate = grab(/(?:최종\s*)?상담\s*일(?:시)?\s*[:：]\s*(.+)/);
  if (consultDate) result.final_consult_date = consultDate;

  const counselor = grab(/상담자\s*[:：]\s*(.+)/);
  if (counselor) result.final_counselor = counselor.replace(/T$/, "");

  const summary = grab(/요약\s*[:：]\s*(.+)/);
  if (summary) result.final_consult_summary = summary;

  // Follow-up
  const thanks = grab(/감사\s*인사\s*[:：]\s*(.+)/);
  if (thanks) result.parent_thanks = thanks === "O" ? "true" : "false";

  const comeback = grab(/(?:복귀|복원)\s*가능성\s*[:：]\s*(.+)/);
  if (comeback) result.comeback_possibility = comeback;

  const comebackDate = grab(/예상\s*복귀\s*시기\s*[:：]\s*(.+)/);
  if (comebackDate) result.expected_comeback_date = comebackDate;

  const notes = grab(/(?:특이사항|비고)\s*[:：]\s*(.+)/);
  if (notes) result.special_notes = notes;

  // Reason category detection — use direct field first, then infer from opinions
  if (directReason) {
    const r = directReason;
    if (r.includes("이사") || r.includes("전학")) result.reason_category = "개인 사유";
    else if (r.includes("성적")) result.reason_category = "성적 부진";
    else if (r.includes("태도") || r.includes("의지")) result.reason_category = "학습 의지 및 태도";
    else if (r.includes("학습량") || r.includes("부담")) result.reason_category = "학습량 부담";
    else if (r.includes("시스템") || r.includes("관리")) result.reason_category = "학습 관리 및 시스템";
    else if (r.includes("수업") || r.includes("방식")) result.reason_category = "수업 내용 및 방식";
    else if (r.includes("강사") || r.includes("소통")) result.reason_category = "강사 역량 및 소통";
    else if (r.includes("타 학원") || r.includes("과외")) result.reason_category = "타 학원/과외로 이동";
    else if (r.includes("친구")) result.reason_category = "친구 문제";
    else if (r.includes("스케줄") || r.includes("시간")) result.reason_category = "스케줄 변동";
    else result.reason_category = "개인 사유";
  }
  if (!result.reason_category) {
    const allText = `${result.student_opinion || ""} ${result.parent_opinion || ""} ${result.teacher_opinion || ""}`.toLowerCase();
    if (allText.includes("성적") || allText.includes("점수")) result.reason_category = "성적 부진";
    else if (allText.includes("태도") || allText.includes("의지") || allText.includes("숙제")) result.reason_category = "학습 의지 및 태도";
    else if (allText.includes("학습량") || allText.includes("부담") || allText.includes("힘들")) result.reason_category = "학습량 부담";
    else if (allText.includes("시스템") || allText.includes("관리")) result.reason_category = "학습 관리 및 시스템";
    else if (allText.includes("수업") || allText.includes("방식")) result.reason_category = "수업 내용 및 방식";
    else if (allText.includes("강사") || allText.includes("소통") || allText.includes("선생님")) result.reason_category = "강사 역량 및 소통";
    else if (allText.includes("타 학원") || allText.includes("과외") || allText.includes("이동")) result.reason_category = "타 학원/과외로 이동";
    else if (allText.includes("친구")) result.reason_category = "친구 문제";
    else if (allText.includes("스케줄") || allText.includes("시간")) result.reason_category = "스케줄 변동";
    else result.reason_category = "개인 사유";
  }

  // Extract grade from class name if not set directly
  if (!result.grade && result.class_name) {
    const gradeFromClass = result.class_name.match(/^(초[3-6]|중[1-3]|고[1-3])/);
    if (gradeFromClass) result.grade = gradeFromClass[1];
  }

  // Clean empty values
  Object.keys(result).forEach((k) => {
    if (!result[k]) delete result[k];
  });

  return result;
}

const ATTITUDES = ["상", "중상", "중", "중하", "하"];
const GRADE_CHANGES = ["상승", "유지", "하락"];
const COMEBACKS = ["상", "중상", "중", "중하", "하", "최하"];

export function WithdrawalFormDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rawText, setRawText] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setRawText("");
      setFields({});
    }
  }, [open]);

  const handleParse = () => {
    if (!rawText.trim()) {
      toast.error("텍스트를 입력해주세요");
      return;
    }
    const parsed = parseWithdrawalText(rawText);
    setFields({ ...fields, ...parsed });
    toast.success("텍스트 분석이 완료되었습니다");
  };

  const updateField = (key: string, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    if (!fields.name?.trim()) {
      toast.error("이름을 입력해주세요");
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      Object.entries(fields).forEach(([key, value]) => {
        if (value) formData.set(key, value);
      });
      formData.set("raw_text", rawText);

      const result = await createWithdrawal(formData);
      if (result.success) {
        toast.success("퇴원생이 등록되었습니다");
        onOpenChange(false);
        setRawText("");
        setFields({});
        router.refresh();
      } else {
        toast.error(result.error || "등록 실패");
      }
    });
  };

  const inputCls = "w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const selectCls = "w-full h-9 rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelCls = "text-xs font-semibold text-slate-500 mb-1 block";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            퇴원생 등록
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Text paste area */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-blue-700">퇴원 기록 텍스트 붙여넣기</span>
              <Button
                type="button"
                size="sm"
                onClick={handleParse}
                className="h-7 px-3 rounded-lg text-xs font-bold"
                style={{ background: "#0F2B5B" }}
              >
                <Wand2 className="h-3 w-3 mr-1" />
                텍스트 분석
              </Button>
            </div>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="NK학원 퇴원 기록 텍스트를 여기에 붙여넣으세요..."
              className="w-full h-32 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Basic Info */}
          <div>
            <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              기본 정보
            </h4>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>이름 *</label>
                <input className={inputCls} placeholder="학생 이름" value={fields.name || ""} onChange={(e) => updateField("name", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>학교</label>
                <input className={inputCls} placeholder="학교명" value={fields.school || ""} onChange={(e) => updateField("school", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>과목</label>
                <input className={inputCls} placeholder="수학" value={fields.subject || ""} onChange={(e) => updateField("subject", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>반명</label>
                <input className={inputCls} placeholder="반 이름" value={fields.class_name || ""} onChange={(e) => updateField("class_name", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <label className={labelCls}>담당</label>
                <input className={inputCls} placeholder="선생님" value={fields.teacher || ""} onChange={(e) => updateField("teacher", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>학년</label>
                <input className={inputCls} placeholder="고2" value={fields.grade || ""} onChange={(e) => updateField("grade", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>퇴원일</label>
                <input className={inputCls} type="date" value={fields.withdrawal_date || ""} onChange={(e) => updateField("withdrawal_date", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <label className={labelCls}>등록일</label>
                <input className={inputCls} type="date" value={fields.enrollment_start || ""} onChange={(e) => updateField("enrollment_start", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>퇴원인지일</label>
                <input className={inputCls} type="date" value={fields.enrollment_end || ""} onChange={(e) => updateField("enrollment_end", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>재원기간(개월)</label>
                <input className={inputCls} type="number" placeholder="5" value={fields.duration_months || ""} onChange={(e) => updateField("duration_months", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Learning Status */}
          <div>
            <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              학습 상태
            </h4>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>수업 태도</label>
                <select className={selectCls} value={fields.class_attitude || ""} onChange={(e) => updateField("class_attitude", e.target.value)}>
                  <option value="">선택</option>
                  {ATTITUDES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>숙제 제출</label>
                <select className={selectCls} value={fields.homework_submission || ""} onChange={(e) => updateField("homework_submission", e.target.value)}>
                  <option value="">선택</option>
                  {ATTITUDES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>출결 상태</label>
                <select className={selectCls} value={fields.attendance || ""} onChange={(e) => updateField("attendance", e.target.value)}>
                  <option value="">선택</option>
                  {ATTITUDES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>성적 변화</label>
                <select className={selectCls} value={fields.grade_change || ""} onChange={(e) => updateField("grade_change", e.target.value)}>
                  <option value="">선택</option>
                  {GRADE_CHANGES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-3">
              <label className={labelCls}>최근 성적</label>
              <input className={inputCls} placeholder="2학기 기말고사 60점" value={fields.recent_grade || ""} onChange={(e) => updateField("recent_grade", e.target.value)} />
            </div>
          </div>

          {/* Withdrawal Reasons */}
          <div>
            <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              퇴원 사유
            </h4>
            <div className="mb-3">
              <label className={labelCls}>퇴원 사유 분류</label>
              <select className={selectCls} value={fields.reason_category || ""} onChange={(e) => updateField("reason_category", e.target.value)}>
                <option value="">선택</option>
                {WITHDRAWAL_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>학생 의견</label>
                <textarea className="w-full h-16 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="학생의 퇴원 의견" value={fields.student_opinion || ""} onChange={(e) => updateField("student_opinion", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>학부모 의견</label>
                <textarea className="w-full h-16 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="학부모의 퇴원 의견" value={fields.parent_opinion || ""} onChange={(e) => updateField("parent_opinion", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>담당선생님 추측</label>
                <textarea className="w-full h-20 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="담당 선생님의 추측" value={fields.teacher_opinion || ""} onChange={(e) => updateField("teacher_opinion", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Final Consultation */}
          <div>
            <h4 className="text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              최종 상담
            </h4>
            <p className="text-xs text-slate-400 mb-3">퇴원 상담 직전에 진행한 마지막 정기 상담 내용을 기록합니다</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>상담 일시</label>
                <input className={inputCls} placeholder="01.29" value={fields.final_consult_date || ""} onChange={(e) => updateField("final_consult_date", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>상담자</label>
                <input className={inputCls} placeholder="선생님" value={fields.final_counselor || ""} onChange={(e) => updateField("final_counselor", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>상담 요약</label>
                <input className={inputCls} placeholder="요약" value={fields.final_consult_summary || ""} onChange={(e) => updateField("final_consult_summary", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Follow-up */}
          <div>
            <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              향후 관리
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>학부모 감사 인사</label>
                <select className={selectCls} value={fields.parent_thanks || "false"} onChange={(e) => updateField("parent_thanks", e.target.value)}>
                  <option value="false">X</option>
                  <option value="true">O</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>복귀 가능성</label>
                <select className={selectCls} value={fields.comeback_possibility || ""} onChange={(e) => updateField("comeback_possibility", e.target.value)}>
                  <option value="">선택</option>
                  {COMEBACKS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>예상 복귀 시기</label>
                <input className={inputCls} placeholder="없음" value={fields.expected_comeback_date || ""} onChange={(e) => updateField("expected_comeback_date", e.target.value)} />
              </div>
            </div>
            <div className="mt-3">
              <label className={labelCls}>특이사항</label>
              <input className={inputCls} placeholder="특이사항" value={fields.special_notes || ""} onChange={(e) => updateField("special_notes", e.target.value)} />
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
            <Button onClick={handleSubmit} disabled={isPending} style={{ background: "#0F2B5B" }}>
              {isPending ? "등록 중..." : "퇴원생 등록"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
