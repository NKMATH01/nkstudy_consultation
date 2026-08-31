"use client";

// 상단 바(GNB)에서 이 PC 의 Claude Code CLI 를 여는 버튼.
// 기준 구현: 업무보고 저장소 design-system/nk-gnb.html 의 .nk-gnb__claude 블록
//
// ★ 어떻게 되는 건가
//   브라우저는 보안상 로컬 프로그램을 직접 실행할 수 없다. 대신 Windows 에 등록된
//   URL 프로토콜을 여는 것은 된다 — vscode:// · zoommtg:// 와 같은 방식이다.
//   tools/claude-launcher/register.ps1 을 그 PC 에서 한 번 실행해 두면 작동한다.
//
// ★ 프로토콜 이름은 앱마다 다르다
//   등록·퇴원은 claudecode-consult 다. NK 프로그램이 전부 claudecode 를 쓰면 HKCU 의
//   같은 자리를 놓고 다투게 되어, 마지막에 등록한 저장소가 이기고 어느 프로그램에서
//   눌러도 같은 저장소가 열린다.
//
// ★ 서버에는 아무것도 열리지 않는다
//   Vercel 은 서버리스라 터미널을 띄울 수 없고, 띄운다면 그 화면에 들어온 사람이
//   Supabase 키와 학생 데이터를 다 만지게 된다. 실행은 그 PC 안에서만 일어나고,
//   웹 앱은 "이 프로토콜을 열어 달라"고 Windows 에 요청할 뿐 셸 권한을 갖지 않는다.
//
// ★ 등록 안 된 PC 에서는 아무 일도 일어나지 않는다
//   브라우저가 조용히 무시한다. 그래서 버튼 옆에 설치 안내를 함께 둔다.

import { useCallback, useState } from "react";
import { HelpCircle, TerminalSquare } from "lucide-react";

/** 런처가 등록돼 있으면 Windows 가 이 URL 을 받아 CLI 를 띄운다. */
const PROTOCOL_URL = "claudecode-consult://open";

const SETUP_COMMAND =
  'powershell -ExecutionPolicy Bypass -File ".\\tools\\claude-launcher\\register.ps1"';

export function ClaudeCodeButton() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const open = useCallback(() => {
    // location.href 로 열어야 팝업 차단에 걸리지 않는다(사용자 클릭 안에서 실행된다).
    window.location.href = PROTOCOL_URL;
  }, []);

  const copySetup = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(SETUP_COMMAND);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드가 막힌 환경도 있다 — 명령은 화면에 그대로 보이므로 손으로 복사하면 된다.
    }
  }, []);

  return (
    <div className="nk-gnb__claude" data-nk-protocol="claudecode-consult">
      <button
        type="button"
        onClick={open}
        title="이 PC 에서 Claude Code 를 엽니다"
        // 우측 유틸은 테두리 알약(.nk-gnb__util)이다. 전환 탭(.nk-gnb__app)은 테두리
        // 없는 납작한 탭이라, 그 클래스를 쓰면 도구가 '갈 곳'처럼 읽힌다.
        className="nk-gnb__util"
      >
        <TerminalSquare className="h-3.5 w-3.5" strokeWidth={2} />
        Claude Code
      </button>
      <button
        type="button"
        onClick={() => setHelpOpen((previous) => !previous)}
        aria-label="Claude Code 버튼 설정 방법"
        aria-expanded={helpOpen}
        className="nk-gnb__icon-btn w-6"
      >
        <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} />
      </button>

      {helpOpen ? (
        <div className="nk-gnb__help">
          <p className="nk-gnb__help-title">처음 한 번만 설정하면 됩니다</p>
          <p>
            이 버튼은 <b>이 컴퓨터에 설치된</b> Claude Code 를 엽니다. 쓰시는 PC 마다,
            저장소마다 아래 명령을 한 번씩 실행해 주세요. 등록·퇴원 저장소 폴더에서
            PowerShell 을 열고 붙여넣으면 됩니다.
          </p>
          <code className="wr-num">{SETUP_COMMAND}</code>
          <button
            type="button"
            onClick={copySetup}
            className="mb-2 rounded px-2 py-1 text-[11px] font-medium transition-colors"
            style={{
              border: "1px solid rgb(var(--wr-line))",
              color: "rgb(var(--wr-ink-sub))",
            }}
          >
            {copied ? "복사했습니다" : "명령 복사"}
          </button>
          <p className="nk-gnb__help-note">
            설정 뒤 버튼을 누르면 브라우저가 &quot;Claude Code 를 여시겠습니까?&quot;
            라고 묻습니다. 허용하시면 됩니다. 휴대폰에서는 열리지 않습니다.
          </p>
        </div>
      ) : null}
    </div>
  );
}
