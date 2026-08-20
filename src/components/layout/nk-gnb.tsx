// NK 공통 GNB — 모든 NK 프로그램의 맨 위.
// 기준 구현: 업무보고 저장소 design-system/nk-gnb.html
//
// 스타일은 public/nk-shared.css 의 .nk-gnb* 클래스가 전부 갖고 있다.
//
// ★ 2026-08-20 부터 '미니 GNB' 다 (대표 지시, 공통 구조 v2).
//   전에는 여기 가운데에 프로그램 전환 링크 8개가 얹혀 있어서, 옮겨 다닐 때만 쓰는
//   줄이 화면에서 가장 눈에 띄는 자리를 차지했다. 그 줄은 사이드바 맨 위
//   'NK 프로그램' 접이식 섹션으로 내렸다(layout/sidebar 참고).
//   여기 남는 것은 '어느 프로그램인지'와 늘 손 닿아야 하는 것뿐이다.
//
// 바꿔 끼우는 곳은 한 군데뿐이다 — constants/nk-programs 의 CURRENT_PROGRAM_ID.
//
// 서버 컴포넌트로 둔다 — 남은 것 중 상호작용이 있는 버튼만 클라이언트 컴포넌트로
// 따로 분리돼 있다.

import Link from "next/link";

import { ClaudeCodeButton } from "./claude-code-button";
import { ProgramFeedbackButton } from "./program-feedback-button";
import { CURRENT_PROGRAM } from "@/constants/nk-programs";

export function NkGnb({ userName = "" }: { userName?: string }) {
  return (
    <header className="nk-gnb" data-nk-app="consult">
      {/* 워드마크 — "NK" 만 브라스. 이 화면에서 브라스를 쓰는 첫 자리다. */}
      <Link className="nk-gnb__wordmark" href="/">
        <span className="nk-gnb__wordmark-nk">NK</span>
        <span className="nk-gnb__wordmark-name">{CURRENT_PROGRAM.label}</span>
      </Link>

      {/* 가운데는 비워 둔다. 프로그램 전환은 사이드바 맨 위로 옮겼다(구조 v2). */}
      <div className="flex-1" />

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
