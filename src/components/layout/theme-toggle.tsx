"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

/*
  야간 모드 토글 — 전 직원 공용.

  ★ 이 컴포넌트는 화면 색만 바꾼다. 서버에 아무것도 보내지 않고, 저장은 localStorage 뿐이다.
    (계정 설정으로 올리려면 DB 스키마가 필요한데, 이번 작업은 스위치를 다는 범위다.)

  ★ 어떻게 두 테마가 한 벌 코드로 성립하는가
    documentElement 에 data-theme="night" 를 찍는 것이 전부다. 색은 public/nk-shared.css 의
    --wr-* 변수만 재정의되고(팔레트는 이미 그 파일에 있다), 컴포넌트의 클래스는 한 글자도
    달라지지 않는다. 그래서 "야간에 맞춰" 고칠 화면이 없다.

  ★ 업무보고와 저장 키(nk:wr-theme)를 공유한다
    NK 8개 프로그램 공용 키다. 이름을 바꾸면 프로그램을 오갈 때 테마가 따로 논다.
    (다만 브라우저 저장소는 도메인별로 분리되므로 도메인이 다르면 각각 한 번씩 켜야 한다.)

  ★ 업무보고 구현에서 야간 시간대 자동 제안 팝업은 뺐다 (대표 결정)
    "토글만 단순하게" — 시간을 보고 먼저 말을 거는 동작은 이 앱에 두지 않는다.

  ★ 왜 useState + useEffect 복원이 아니라 useSyncExternalStore 인가
    저장값은 React 밖(localStorage)에 있다. 이걸 useState 초기값으로 읽으면 서버 렌더와
    어긋나고, 대신 effect 안에서 setState 로 복원하면 렌더가 한 번 더 도는 패턴이라
    이 저장소의 React Compiler 린트(set-state-in-effect)가 error 로 막는다.
    useSyncExternalStore 는 서버 스냅샷을 'day' 로 고정해 하이드레이션을 맞추고,
    그 뒤 클라이언트 스냅샷으로 갈아끼운다 — 같은 결과를 규칙 안에서 얻는다.
*/

const STORAGE_KEY = "nk:wr-theme";

type Theme = "day" | "night";

function applyTheme(theme: Theme) {
  if (theme === "night") {
    document.documentElement.setAttribute("data-theme", "night");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

/* 같은 문서 안에서의 변경은 storage 이벤트가 오지 않는다(다른 탭에서 바뀔 때만 온다).
   그래서 우리 쪽 변경은 이 구독자 목록으로 직접 알린다. */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // 다른 탭에서 켜고 끄면 이 탭도 따라간다.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/* 사생활 보호 모드 등에서 localStorage 가 통째로 막힐 수 있다. 그때는 이 세션 동안만
   기억한다 — 새로고침하면 라이트로 돌아가지만, 최소한 켠 상태와 아이콘이 어긋나진 않는다. */
let sessionTheme: Theme = "day";

function getSnapshot(): Theme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "night"
      ? "night"
      : "day";
  } catch {
    return sessionTheme;
  }
}

/* 서버에는 저장값이 없다. 첫 페인트 전 <head> 부트스트랩 스크립트가 이미 DOM 을
   어둡게 만들어 두므로, 여기서 'day' 를 돌려줘도 화면이 번쩍이지 않는다. */
function getServerSnapshot(): Theme {
  return "day";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // 저장값 → DOM 동기화. 첫 렌더에서는 부트스트랩이 이미 해 둔 상태라 사실상 무의미하고,
  // 토글했을 때와 다른 탭에서 바뀌었을 때 실제로 일한다.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    const next: Theme = getSnapshot() === "night" ? "day" : "night";
    sessionTheme = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 저장이 막혀도 이번 세션 동안은 sessionTheme 로 적용된 채로 둔다.
    }
    listeners.forEach((notify) => notify());
  }, []);

  const isNight = theme === "night";
  const label = isNight ? "주간 모드로 전환" : "야간 모드로 전환";

  return (
    <button
      type="button"
      className="nk-gnb__icon-btn"
      onClick={toggle}
      aria-label={label}
      aria-pressed={isNight}
      title={label}
    >
      {isNight ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
