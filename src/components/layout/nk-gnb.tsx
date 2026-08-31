// NK 공통 GNB — 모든 NK 프로그램의 맨 위.
// 기준 구현: 업무보고 저장소 design-system/nk-gnb.html · components/layout/admin-gnb.tsx
//
// 스타일은 public/nk-shared.css 의 .nk-gnb* 클래스가 전부 갖고 있다.
//
// ★ 가운데는 NK 프로그램 전환 줄이다 (대표 지시, 2026-08-21).
//   2026-08-20 에 이 줄을 사이드바로 내렸다가 되돌렸다. 상단바는 프로그램 사이를 오가는
//   폴더 탭이고, 사이드바는 지금 열려 있는 프로그램의 메뉴만 담는다. 둘을 사이드바에
//   함께 쌓으니 어디까지가 이 앱인지 읽히지 않았다.
//
// 목록·순서·활성 판정은 전부 constants/nk-programs 에서 온다. 다른 앱에 이식할 때
// 바꾸는 곳은 그 파일의 CURRENT_PROGRAM_ID 한 줄뿐이다.
//
// ★ 우측 유틸의 순서도 8개 앱이 같다 — Claude Code → 사용법 → 오류·개선 제안 → 야간 → 계정.
//   앱마다 순서가 다르면 옮겨 다닐 때마다 눈으로 다시 찾아야 한다(전환 탭과 같은 이유다).
//
// 서버 컴포넌트로 둔다 — 남은 것 중 상호작용이 있는 버튼만 클라이언트 컴포넌트로
// 따로 분리돼 있다.

import Link from "next/link";

import { ClaudeCodeButton } from "./claude-code-button";
import { ManualButton } from "./manual-button";
import { ProgramFeedbackButton } from "./program-feedback-button";
import { ThemeToggle } from "./theme-toggle";
import {
  CURRENT_PROGRAM,
  CURRENT_PROGRAM_ID,
  VISIBLE_NK_PROGRAMS,
  programMoveHint,
} from "@/constants/nk-programs";

export function NkGnb({
  userName = "",
  showClaudeCode = false,
}: {
  userName?: string;
  /**
   * Claude Code 버튼 노출 여부 — 대표급(director·principal·admin)에게만 준다
   * (대표 지시, 2026-08-20). 판정은 레이아웃이 하고 여기는 받기만 한다.
   * 기본값 false: 역할을 모르는 자리에서 실수로 새어 나가지 않게.
   */
  showClaudeCode?: boolean;
}) {
  return (
    <header className="nk-gnb" data-nk-app="consult">
      {/* 워드마크 — "NK" 만 브라스. 이 화면에서 브라스를 쓰는 첫 자리다. */}
      <Link className="nk-gnb__wordmark" href="/">
        <span className="nk-gnb__wordmark-nk">NK</span>
        <span className="nk-gnb__wordmark-name">{CURRENT_PROGRAM.label}</span>
      </Link>

      {/* 프로그램 전환 — 같은 창에서 이동한다. 새 탭으로 열면 탭이 쌓이고
          '여러 프로그램'으로 느껴진다.
          활성 표시는 밝은 잉크로 뒤집는 방식이다(.nk-gnb__app--active) — 브라스는
          워드마크 한 곳에만 쓴다.
          ★ 8개가 한 줄에 들어가야 하므로 라벨은 축약형(short)을 쓰고, 지금 보고 있는
            프로그램만 풀네임으로 낸다. 툴팁에는 항상 풀네임이 들어간다.
          ★ 라벨을 줄인 만큼 구분은 14px 아이콘이 맡는다 — 아이콘 종류도 8개 앱이 같다.
          8개가 넘치는 좁은 화면에서는 줄바꿈 없이 가로로 밀린다(.nk-gnb__apps). */}
      <nav className="nk-gnb__apps" aria-label="NK 프로그램 전환">
        {VISIBLE_NK_PROGRAMS.map((program) => {
          const Icon = program.Icon;
          const here = program.id === CURRENT_PROGRAM_ID;
          return (
            <a
              key={program.id}
              href={program.url}
              className={here ? "nk-gnb__app nk-gnb__app--active" : "nk-gnb__app"}
              aria-current={here ? "page" : undefined}
              title={
                here
                  ? `${program.label} (지금 보는 프로그램)`
                  : programMoveHint(program.label)
              }
            >
              <Icon size={14} strokeWidth={2} />
              {here ? program.label : program.short}
            </a>
          );
        })}
      </nav>

      <div className="nk-gnb__right">
        {/* Claude Code — 대표급만. 저장소를 여는 버튼이라 선생님에게는 쓸 일이 없다.
            ★ 데스크톱 전용이다. claudecode-consult:// 는 그 PC 에 등록돼 있어야 열리고
              휴대폰에서는 아무 일도 일어나지 않는다 — 안 되는 버튼은 없는 버튼보다 나쁘다.
              감싸는 div 에는 nk- 클래스를 붙이지 않는다. .nk-gnb__claude 는 nk-shared.css
              가 display 를 잡고 있어 Tailwind 의 hidden 과 같은 자리를 놓고 다툰다. */}
        {showClaudeCode ? (
          <div className="hidden lg:block">
            <ClaudeCodeButton />
          </div>
        ) : null}
        {/* 사용법 — 오류·개선 제안 바로 옆자리 (대표 지시 2026-08-31).
            두 단추는 같은 순간에 필요하다. 화면 앞에서 막혔을 때 먼저 사용법을 보고,
            그래도 안 되면 오류로 낸다. 자리가 떨어지면 사용법을 못 찾고 바로 제보한다. */}
        <ManualButton />
        {/* 오류·개선 제안 — 전 직원. 작성자는 로그인 선생님 이름으로 채운다.
            ★ 좁은 화면에서도 숨기지 않는다. 오류는 화면이 좁을 때도 나고, 그때 신고할
              곳이 없으면 제보는 카톡으로 돌아간다(그게 이 기능을 만든 이유다). */}
        <ProgramFeedbackButton userName={userName} />
        {/* 야간 모드 — 전 직원. Claude Code 버튼과 달리 역할 게이트를 걸지 않는다.
            눈부심은 직급이 아니라 시간의 문제고, 선생님도 밤 수업 뒤에 상담을 기록한다
            (업무보고와 같은 기준). 저장 키 nk:wr-theme 이 8개 프로그램 공용이라
            한 곳에서 켜면 같은 도메인의 다른 화면도 같은 선택을 따른다. */}
        <ThemeToggle />
        {/* 계정 — 지금 누구로 들어와 있는지. 업무보고와 같은 문법(머리글자 원 + 이름)이다.
            좁은 화면에서는 이름을 접고 원만 남긴다(.nk-gnb__user-name).
            로그아웃은 사이드바 하단 사용자 카드에 이미 있다 — 두 곳에 두지 않는다. */}
        {userName ? (
          <div className="nk-gnb__user" title={userName}>
            <span className="nk-gnb__user-avatar" aria-hidden="true">
              {userName.charAt(0)}
            </span>
            <span className="nk-gnb__user-name">{userName}</span>
          </div>
        ) : null}
      </div>
    </header>
  );
}
