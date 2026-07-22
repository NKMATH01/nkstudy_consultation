import Link from "next/link";
import {
  CalendarClock,
  ClipboardCheck,
  FileText,
  History,
  MessageSquareText,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import { getSlotLabel } from "@/lib/booking-slots";
import type { Consultation, ConsultationEvent } from "@/types";

export interface ConsultationJourneyData {
  booking: {
    id: string;
    booking_date: string;
    booking_hour: number;
    status: string;
    rescheduled_at: string | null;
  } | null;
  survey: { id: string; created_at: string } | null;
  analysis: {
    id: string;
    name: string;
    student_type: string | null;
    created_at: string;
  } | null;
  registration: {
    id: string;
    registration_date: string | null;
    created_at: string;
  } | null;
  student: { id: string; name: string; is_active: boolean | null } | null;
  events: ConsultationEvent[];
}

type JourneyStep = {
  label: string;
  detail: string;
  href?: string;
  current?: boolean;
  complete: boolean;
  icon: typeof CalendarClock;
  badges?: { label: string; tone: "rose" | "amber" | "slate" }[];
};

const EVENT_LABELS: Record<ConsultationEvent["event_type"], string> = {
  cancelled: "취소됨",
  rescheduled: "시간변경",
  reactivated: "재활성화",
  status_changed: "상태변경",
  deleted: "삭제",
};

const STATUS_LABELS: Record<string, string> = {
  active: "진행",
  pending: "대기",
  completed: "완료",
  cancelled: "취소됨",
  registered: "등록",
  hold: "보류",
  other: "기타",
  none: "미정",
};

function shortDate(value?: string | null): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${Number(match[2])}/${Number(match[3])}` : value;
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function scheduleValue(value: Record<string, unknown> | null): string {
  if (!value) return "";
  const date = typeof value.date === "string" ? shortDate(value.date) : "";
  const time = typeof value.time === "string" ? value.time.slice(0, 5) : "";
  return [date, time].filter(Boolean).join(" ");
}

function statusValue(value: Record<string, unknown> | null): string {
  if (!value) return "";
  const status = value.status ?? value.value;
  return typeof status === "string" ? STATUS_LABELS[status] ?? status : "";
}

function eventSummary(event: ConsultationEvent): string | null {
  const oldSchedule = scheduleValue(event.old_value);
  const newSchedule = scheduleValue(event.new_value);
  if (oldSchedule || newSchedule) {
    return `${oldSchedule || "-"} → ${newSchedule || "-"}`;
  }

  const oldStatus = statusValue(event.old_value);
  const newStatus = statusValue(event.new_value);
  if (oldStatus || newStatus) {
    return `${oldStatus || "-"} → ${newStatus || "-"}`;
  }
  return null;
}

function JourneyChip({ step, index }: { step: JourneyStep; index: number }) {
  const Icon = step.icon;
  const content = (
    <div
      className={`group relative h-full min-h-[108px] min-w-[126px] rounded-xl border px-3 py-3 transition-all ${
        step.current
          ? "border-blue-700 bg-blue-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]"
          : step.complete
            ? "border-slate-200 bg-white text-slate-800 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
            : "border-dashed border-slate-200 bg-slate-50/80 text-slate-400"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${
            step.current
              ? "bg-white/15 text-amber-300"
              : step.complete
                ? "bg-blue-50 text-blue-700"
                : "bg-slate-100 text-slate-400"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className={`text-[9px] font-black tracking-[0.16em] ${step.current ? "text-white/45" : "text-slate-300"}`}>
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <p className="mt-2 text-[12px] font-extrabold tracking-tight">{step.label}</p>
      <p className={`mt-0.5 text-[10px] leading-4 ${step.current ? "text-white/65" : "text-slate-500"}`}>
        {step.complete ? step.detail : "미진행"}
      </p>
      {step.badges && step.badges.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {step.badges.map((badge) => (
            <span
              key={badge.label}
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                badge.tone === "rose"
                  ? "bg-rose-100 text-rose-700"
                  : badge.tone === "amber"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {badge.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return step.href ? (
    <Link href={step.href} className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
      {content}
    </Link>
  ) : (
    content
  );
}

export function ConsultationJourneyPanel({
  consultation,
  journey,
}: {
  consultation: Consultation;
  journey: ConsultationJourneyData;
}) {
  const bookingBadges: JourneyStep["badges"] = [];
  if (journey.booking?.status === "cancelled") {
    bookingBadges.push({ label: "취소됨", tone: "rose" });
  } else if (journey.booking) {
    bookingBadges.push({ label: "진행", tone: "slate" });
  }
  if (journey.booking?.rescheduled_at) {
    bookingBadges.push({ label: "시간변경", tone: "amber" });
  }

  const steps: JourneyStep[] = [
    {
      label: "예약",
      detail: journey.booking
        ? `${shortDate(journey.booking.booking_date)} ${getSlotLabel(journey.booking.booking_hour)}`
        : "",
      complete: Boolean(journey.booking),
      icon: CalendarClock,
      badges: bookingBadges,
    },
    {
      label: "상담",
      detail: `${shortDate(consultation.consult_date)} ${consultation.consult_time?.slice(0, 5) ?? ""}`.trim(),
      complete: true,
      current: true,
      icon: MessageSquareText,
    },
    {
      label: "설문",
      detail: journey.survey ? `${shortDate(journey.survey.created_at)} 제출` : "",
      href: journey.survey ? `/surveys/${journey.survey.id}` : undefined,
      complete: Boolean(journey.survey),
      icon: ClipboardCheck,
    },
    {
      label: "분석",
      detail: journey.analysis?.student_type || (journey.analysis ? `${shortDate(journey.analysis.created_at)} 생성` : ""),
      href: journey.analysis ? `/analyses/${journey.analysis.id}` : undefined,
      complete: Boolean(journey.analysis),
      icon: Sparkles,
    },
    {
      label: "등록안내",
      detail: journey.registration
        ? `${shortDate(journey.registration.registration_date || journey.registration.created_at)} 생성`
        : "",
      href: journey.registration ? `/registrations/${journey.registration.id}` : undefined,
      complete: Boolean(journey.registration),
      icon: FileText,
    },
    {
      label: "학생등록",
      detail: journey.student?.name || "",
      href: journey.student ? "/settings/students" : undefined,
      complete: Boolean(journey.student),
      icon: UserRoundCheck,
      badges:
        journey.student && journey.student.is_active === false
          ? [{ label: "비활성", tone: "slate" }]
          : undefined,
    },
  ];

  const events = [...journey.events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  return (
    <section className="space-y-4" aria-label="학생 여정과 변경 이력">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-[10px] font-black tracking-[0.18em] text-blue-700">STUDENT JOURNEY</p>
            <h2 className="mt-0.5 text-[15px] font-extrabold text-slate-900">학생 여정</h2>
          </div>
          <p className="text-[10px] font-medium text-slate-400">완료된 단계를 눌러 바로 이동</p>
        </div>
        <div className="overflow-x-auto px-5 py-5">
          <div className="flex min-w-max items-stretch gap-2.5">
            {steps.map((step, index) => (
              <JourneyChip key={step.label} step={step} index={index} />
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-amber-300">
            <History className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[14px] font-extrabold text-slate-900">변경 이력</h2>
            <p className="text-[10px] text-slate-400">상담 일정과 상태의 운영 기록</p>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-[12px] text-slate-400">
            변경 이력이 없습니다
          </div>
        ) : (
          <ol className="relative ml-2 border-l border-slate-200">
            {events.map((event) => {
              const summary = eventSummary(event);
              return (
                <li key={event.id} className="relative pb-5 pl-6 last:pb-0">
                  <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-600 shadow-[0_0_0_1px_#cbd5e1]" />
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-[12px] font-extrabold text-slate-800">
                      {EVENT_LABELS[event.event_type]}
                    </p>
                    <time className="text-[10px] font-medium tabular-nums text-slate-400">
                      {formatTimestamp(event.created_at)}
                    </time>
                  </div>
                  {summary && (
                    <p className="mt-1 font-mono text-[11px] font-semibold text-blue-800">{summary}</p>
                  )}
                  {event.reason && (
                    <p className="mt-1 text-[11px] leading-4 text-slate-600">사유 · {event.reason}</p>
                  )}
                  {event.created_by_label && (
                    <p className="mt-1 text-[10px] text-slate-400">처리 · {event.created_by_label}</p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
