// NK 공통 GNB — 모든 NK 프로그램의 맨 위.
// 기준 구현: 업무보고 저장소 design-system/nk-gnb.html
//
// 스타일은 public/nk-shared.css 의 .nk-gnb* 클래스가 전부 갖고 있다. 여기서 프로그램마다
// 달라지는 것은 워드마크 이름과 활성 표시 두 가지뿐이다.
//
// 서버 컴포넌트로 둔다 — 링크 목록은 정적이고, 상호작용이 있는 Claude Code 버튼만
// 클라이언트 컴포넌트로 따로 분리돼 있다.

import Link from "next/link";

import { ClaudeCodeButton } from "./claude-code-button";
import { ProgramFeedbackButton } from "./program-feedback-button";

/** 전환 목록 — 모든 프로그램이 같은 목록·같은 순서를 갖는다.
 *  순서가 프로그램마다 다르면 쓰는 사람이 매번 눈으로 다시 찾아야 한다. */
const NK_APPS = [
  { label: "업무보고", href: "https://nk-work-report.vercel.app" },
  { label: "보강관리", href: "https://nk-bogang.vercel.app" },
  { label: "학습 관리", href: "https://nk-academy.vercel.app" },
  { label: "숙제 관리", href: "https://nkhomework.vercel.app" },
  { label: "학생 상담", href: "https://nk-counseling-management.vercel.app" },
  { label: "등록·퇴원", href: "https://nkstudy-consultation.vercel.app" },
  { label: "설문조사", href: "https://nk-survey.vercel.app" },
  { label: "클리닉 강사 관리", href: "https://gangsa-clinic.vercel.app" },
] as const;

/** 이 프로그램. 전환 줄에서 활성 필로 표시된다. */
const CURRENT_APP = "등록·퇴원";

export function NkGnb({ userName = "" }: { userName?: string }) {
  return (
    <header className="nk-gnb" data-nk-app="consult">
      {/* 워드마크 — "NK" 만 브라스. 이 화면에서 브라스를 쓰는 첫 자리다. */}
      <Link className="nk-gnb__wordmark" href="/">
        <span className="nk-gnb__wordmark-nk">NK</span>
        <span className="nk-gnb__wordmark-name">등록·퇴원</span>
      </Link>

      {/* 같은 창에서 이동한다 — 새 탭으로 열면 탭이 쌓이고 '여러 프로그램'으로 느껴진다. */}
      <nav className="nk-gnb__apps" aria-label="프로그램 전환">
        {NK_APPS.map((app) => {
          const active = app.label === CURRENT_APP;
          return (
            <a
              key={app.href}
              href={app.href}
              className={active ? "nk-gnb__app nk-gnb__app--active" : "nk-gnb__app"}
              aria-current={active ? "page" : undefined}
              title={active ? undefined : `${app.label}으로 이동`}
            >
              {app.label}
            </a>
          );
        })}
      </nav>

      <div className="nk-gnb__right">
        {/* 야간 모드 토글은 두지 않는다 — 이 앱은 코럴 라이트 스킨 한 벌뿐이라
            눌러도 상단 바 색만 바뀌고 본문은 그대로다. 앱에 야간 팔레트가 생기면
            그때 design-system README 3단계대로 붙인다. */}
        {/* 오류·개선 제안 — 작성자는 로그인 강사 이름으로 채운다. */}
        <ProgramFeedbackButton userName={userName} />
        <ClaudeCodeButton />
        {/* 로그아웃은 사이드바 하단 사용자 카드에 이미 있다 — 두 곳에 두지 않는다. */}
      </div>
    </header>
  );
}
