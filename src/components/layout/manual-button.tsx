// 「사용법」 진입 단추 — GNB 우측, 「오류·개선 제안」 바로 옆자리.
// 기준 구현: 업무보고 저장소 components/manual/manual-button.tsx
//
// ★ 왜 오류·개선 제안 옆인가 (대표 지시 2026-08-31)
//   두 단추는 같은 순간에 필요하다 — 화면 앞에서 막혔을 때다. 먼저 사용법을 보고,
//   그래도 안 되면 오류로 낸다. 자리가 떨어져 있으면 사용법을 못 찾고 바로 제보하거나,
//   아예 카톡으로 물어본다.
//
// ★ 왜 새 탭인가 (전환 탭과 규칙이 다르다)
//   프로그램 전환 탭은 target="_blank" 를 쓰지 않는다 — 같은 창에서 옮겨 다녀야
//   여덟 개가 '하나의 프로그램'으로 느껴지기 때문이다. 사용법은 반대다. 지금 하던
//   화면을 두고 설명서를 곁에 펴 보는 물건이라, 같은 창에서 열면 하던 입력이 날아간다.
//
// ★ 설명서는 업무보고가 갖고 있다
//   여덟 앱의 사용법을 한 곳에서 관리한다. 이 앱에 사본을 두면 반드시 어긋난다.
//
// ★ 색·문법은 옆 단추(.nk-gnb__util)와 같다. 여기가 화면에서 제일 눈에 띄는 자리가
//   되면 안 된다 — 색으로 튀게 하지 않는다.

import { BookOpen } from "lucide-react";

/** 사용법 설명서 — NK 8개 프로그램 공통, 업무보고에 있다. */
const MANUAL_URL = "https://nk-work-report.vercel.app/manual";

export function ManualButton() {
  return (
    <a
      className="nk-gnb__util"
      href={MANUAL_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="프로그램 사용법 설명서 (새 탭)"
    >
      <BookOpen size={14} strokeWidth={2} />
      사용법
    </a>
  );
}
