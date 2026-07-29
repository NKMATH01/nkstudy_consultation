/**
 * HTML 텍스트 노드/속성값에 안전하게 넣기 위한 escape.
 * 결과지·안내문 HTML 생성과 프롬프트 신뢰불가 구간이 같은 규칙을 쓴다.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
