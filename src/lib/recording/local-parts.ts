// 녹음 마무리 경로에서 IndexedDB 읽기를 안전하게 감싼다(재작업2-3).
// 읽기가 예외여도 멈추지 않고 "남은 파트 없음 + 읽기 실패"로 돌려 메모리 기준 마무리·잠금 해제로 이어가게 한다.

export async function readLeftoverParts<T>(
  read: () => Promise<T[]>,
): Promise<{ parts: T[]; readFailed: boolean }> {
  try {
    return { parts: await read(), readFailed: false };
  } catch {
    return { parts: [], readFailed: true };
  }
}
