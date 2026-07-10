import type { Metadata, Viewport } from "next";
import { CheckCircle2, Link2Off, TimerOff } from "lucide-react";
import { getDripInvitation } from "@/lib/actions/drip-survey";
import { FeedbackFormClient } from "./feedback-form-client";

export const metadata: Metadata = {
  title: "NK 적응 체크",
  description: "NK Academy 등록 후 적응 체크 설문",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

function FeedbackShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f6f8fb] px-4 py-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[480px] flex-col justify-center">
        {children}
      </div>
    </main>
  );
}

function FeedbackState({
  icon: Icon,
  title,
  message,
}: {
  icon: React.ElementType;
  title: string;
  message: string;
}) {
  return (
    <FeedbackShell>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          <Icon className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-black tracking-tight text-slate-900">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p>
      </section>
    </FeedbackShell>
  );
}

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await getDripInvitation(token);

  if (!invitation) {
    return (
      <FeedbackState
        icon={Link2Off}
        title="잘못된 링크"
        message="링크를 다시 확인해 주세요."
      />
    );
  }

  if (invitation.expired) {
    return (
      <FeedbackState
        icon={TimerOff}
        title="만료된 링크"
        message="응답 가능 기간이 지나 제출할 수 없습니다."
      />
    );
  }

  if (invitation.responded) {
    return (
      <FeedbackState
        icon={CheckCircle2}
        title="이미 응답 주셨습니다"
        message="소중한 의견 감사합니다."
      />
    );
  }

  return (
    <FeedbackShell>
      <FeedbackFormClient token={token} wave={invitation.wave ?? "W1"} />
    </FeedbackShell>
  );
}
