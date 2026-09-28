import { z } from "zod";

/**
 * 입학테스트 답안 분석지 (report_tokens.report_type = 'exam_v1').
 *
 * 내용은 학생 시험지 사진에서 읽어낸 것이라 신뢰할 수 없다.
 * 그래서 HTML 이 아니라 이 데이터로 저장하고 React 가 그린다(자동 이스케이프).
 *
 * ── 강조 표기 규칙 (JSON 을 직접 쓸 때 이 규칙만 쓴다) ─────────────
 *  HTML 태그(<b>, <strong>, <br> 등)는 해석되지 않고 글자 그대로 보인다. 쓰지 말 것.
 *
 *  1) 일반 문장 — summary[] · picks[].read · causes[].body · plan[].body
 *                 · difficultyNote · unitsNote · causesTitle
 *     **굵게**   → 진하게 강조.  예) "접선 단원이 **8문항 중 1문항**만 맞았습니다."
 *     \n         → 줄바꿈(difficultyNote · unitsNote 에서만). 빈 줄은 \n\n.
 *
 *  2) 손풀이 — picks[].hand (고정폭 글꼴, 줄바꿈 \n 그대로 유지)
 *     **맞은 부분** → 초록.  예) "M = **33 ✔**"
 *     !!틀린 부분!! → 빨강.  예) "−64 + 192 !!− 20!! + 5 = 113"
 *
 *  표기는 한 줄 안에서 열고 닫는다. 짝이 맞지 않으면 기호가 글자 그대로 보인다.
 *  퍼센트(me · national · nationalAvg)는 0~100 숫자, 날짜는 "2026-09-28".
 */

const percent = z.number().min(0).max(100);
const numOrText = z.union([z.number(), z.string().min(1)]);

export const examReportV1Schema = z.object({
  version: z.literal("exam_v1"),
  student: z.object({
    name: z.string().min(1),
    school: z.string().optional(),
    grade: numOrText.optional(),
  }),
  exam: z.object({
    title: z.string().min(1),
    date: z.string().min(1),
    subject: z.string().optional(),
    totalQuestions: z.number().int().positive().optional(),
  }),
  score: z.object({
    raw: z.number().min(0),
    max: z.number().positive(),
    grade: numOrText.optional(),
  }),
  tally: z.object({
    correct: z.number().int().min(0),
    wrongWithWork: z.number().int().min(0),
    blank: z.number().int().min(0),
  }),
  difficulty: z.array(
    z.object({
      level: z.string().min(1),
      me: percent,
      national: percent,
    })
  ),
  units: z.array(
    z.object({
      name: z.string().min(1),
      cells: z.array(z.enum(["o", "x"])),
      me: percent,
      national: percent,
    })
  ),
  summary: z.array(z.string()),
  /** 난이도 차트 아래 회색 박스(학생별 해석). 없으면 박스를 그리지 않는다. */
  difficultyNote: z.string().optional(),
  /** 단원 격자 아래 회색 박스(학생별 해석). 없으면 박스를 그리지 않는다. */
  unitsNote: z.string().optional(),
  /** "틀린 이유" 소제목. 없으면 "N 가지로 모입니다". */
  causesTitle: z.string().optional(),
  picks: z.array(
    z.object({
      no: numOrText,
      topic: z.string().min(1),
      verdict: z.enum(["o", "x"]),
      nationalAvg: percent.optional(),
      hand: z.string().optional(),
      read: z.string(),
    })
  ),
  causes: z.array(
    z.object({
      tone: z.enum(["deep", "costly", "procedure"]),
      count: z.number().int().min(0),
      title: z.string().min(1),
      body: z.string(),
    })
  ),
  plan: z.array(
    z.object({
      title: z.string().min(1),
      body: z.string(),
    })
  ),
});

export type ExamReportV1 = z.infer<typeof examReportV1Schema>;

export function parseExamReportV1(raw: unknown): ExamReportV1 | null {
  const result = examReportV1Schema.safeParse(raw);
  return result.success ? result.data : null;
}
