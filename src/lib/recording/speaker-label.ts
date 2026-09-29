// 조각별 화자 라벨을 전체에서 구분되게 만든다(분석 프롬프트·화면 공용, 순수 함수).
export function speakerLabel(seq: number, speaker: string): string {
  return `S${seq}-${speaker}`;
}
