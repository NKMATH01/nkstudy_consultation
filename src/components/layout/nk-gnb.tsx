// NK 공통 GNB — 모든 NK 프로그램의 맨 위.
// 기준 구현: 업무보고 저장소 design-system/nk-gnb.html
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
// 서버 컴포넌트로 둔다 — 남은 것 중 상호작용이 있는 버튼만 클라이언트 컴포넌트로
// 따로 분리돼 있다.

import Link from "next/link";

import { ClaudeCodeButton } from "./claude-code-button";
import { ProgramFeedbackButton } from "./program-feedback-button";
import {
  CURRENT_PROGRAM,
  CURRENT_PROGRAM_ID,
  VISIBLE_NK_PROGRAMS,
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
          8개가 넘치는 좁은 화면에서는 줄바꿈 없이 가로로 밀린다(.nk-gnb__apps). */}
      <nav className="nk-gnb__apps" aria-label="NK 프로그램 전환">
        {VISIBLE_NK_PROGRAMS.map((program) => {
          const here = program.id === CURRENT_PROGRAM_ID;
          return (
            <a
              key={program.id}
              href={program.url}
              className={here ? "nk-gnb__app nk-gnb__app--active" : "nk-gnb__app"}
              aria-current={here ? "page" : undefined}
              title={here ? undefined : `${program.label}으로 이동`}
            >
              {program.label}
            </a>
          );
        })}
      </nav>

      <div className="nk-gnb__right">
        {/* 야간 모드 토글은 두지 않는다 — 이 앱은 코럴 라이트 스킨 한 벌뿐이라
            눌러도 상단 바 색만 바뀌고 본문은 그대로다. 앱에 야간 팔레트가 생기면
            그때 design-system README 3단계대로 붙인다. */}
        {/* 오류·개선 제안 — 전 직원. 작성자는 로그인 강사 이름으로 채운다. */}
        <ProgramFeedbackButton userName={userName} />
        {/* Claude Code — 대표급만. 저장소를 여는 버튼이라 선생님에게는 쓸 일이 없다. */}
        {showClaudeCode ? <ClaudeCodeButton /> : null}
        {/* 로그아웃은 사이드바 하단 사용자 카드에 이미 있다 — 두 곳에 두지 않는다. */}
      </div>
    </header>
  );
}
