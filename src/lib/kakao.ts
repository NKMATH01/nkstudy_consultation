declare global {
  interface Window {
    Kakao: {
      init: (key: string) => void;
      isInitialized: () => boolean;
      Share: {
        sendDefault: (options: Record<string, unknown>) => Promise<unknown>;
      };
    };
  }
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://nkstudy-consultation.vercel.app";

export function initKakao() {
  if (typeof window === "undefined" || !window.Kakao) return false;

  const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  if (!key) {
    console.warn("[Kakao] NEXT_PUBLIC_KAKAO_JS_KEY not set");
    return false;
  }

  if (!window.Kakao.isInitialized()) {
    window.Kakao.init(key);
  }
  return window.Kakao.isInitialized();
}

export async function shareViaKakao({
  title,
  description,
  pageUrl,
}: {
  title: string;
  description: string;
  pageUrl: string;
}) {
  if (typeof window === "undefined" || !window.Kakao) {
    alert("카카오톡 SDK를 불러올 수 없습니다.");
    return;
  }

  if (!initKakao()) {
    alert("카카오톡 SDK 초기화에 실패했습니다.\nNEXT_PUBLIC_KAKAO_JS_KEY를 확인해주세요.");
    return;
  }

  const url = pageUrl.startsWith("http") ? pageUrl : `${BASE_URL}${pageUrl}`;

  console.log("[Kakao] 공유 URL:", url, "| BASE_URL:", BASE_URL);

  try {
    await window.Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title,
        description,
        imageUrl: `${BASE_URL}/og-image.png`,
        link: { webUrl: url, mobileWebUrl: url },
      },
      buttons: [
        {
          title: "보고서 보기",
          link: { webUrl: url, mobileWebUrl: url },
        },
      ],
    });
  } catch (err) {
    console.error("[Kakao] 공유 실패:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("4019") || msg.includes("도메인")) {
      alert(
        `카카오톡 공유 도메인 설정이 필요합니다.\n\n` +
        `현재 도메인: ${BASE_URL}\n\n` +
        `카카오 개발자 콘솔에서 아래 두 곳에 도메인을 등록해주세요:\n` +
        `1. [앱] > [플랫폼] > Web 사이트 도메인\n` +
        `2. [앱] > [카카오톡 공유] > 링크 도메인 (제품 링크 관리)`
      );
    } else {
      alert(`카카오톡 공유에 실패했습니다.\n${msg}`);
    }
  }
}
