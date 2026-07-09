import { z } from "zod";

const optionalPositiveInt = z
  .preprocess((value) => {
    if (value === "" || value == null) return undefined;
    if (typeof value === "string") return Number(value);
    return value;
  }, z.number().int("정수로 입력해주세요").positive("양의 정수로 입력해주세요").optional());

const optionalNonnegativeInt = z
  .preprocess((value) => {
    if (value === "" || value == null) return undefined;
    if (typeof value === "string") return Number(value);
    return value;
  }, z.number().int("정수로 입력해주세요").min(0, "0 이상의 정수로 입력해주세요").optional());

const optionalLevel = z.enum(["상", "중", "하"]).optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v));
const optionalPace = z.enum(["빠름", "보통", "느림"]).optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v));

export const progressFormSchema = z
  .object({
    main_textbook: z.string().optional(),
    main_total_pages: optionalPositiveInt,
    current_page: optionalPositiveInt,
    sub_textbook: z.string().optional(),
    next_textbook: z.string().optional(),
    next_start_date: z.string().optional(),
    expected_months: optionalNonnegativeInt,
    expected_weeks: optionalNonnegativeInt,
    target_end_date: z.string().optional(),
    current_plan: z.string().optional(),
    current_major_unit: z.string().optional(),
    current_minor_unit: z.string().optional(),
    note: z.string().optional(),
    ability_level: optionalLevel,
    study_intensity: optionalLevel,
    homework_volume: optionalLevel,
    class_pace: optionalPace,
  })
  .refine(
    (data) =>
      data.current_page == null ||
      data.main_total_pages == null ||
      data.current_page <= data.main_total_pages,
    {
      message: "현재 페이지는 전체 페이지보다 클 수 없습니다",
      path: ["current_page"],
    }
  );

export const currentPageSchema = z.object({
  page: optionalPositiveInt.refine((value) => value != null, {
    message: "현재 페이지를 입력해주세요",
  }),
});

export const currentUnitsSchema = z.object({
  current_major_unit: z.string().optional(),
  current_minor_unit: z.string().optional(),
});

export const textbookHistorySchema = z.object({
  textbook: z.string().min(1, "교재명을 입력해주세요"),
  started_on: z.string().optional(),
  finished_on: z.string().optional(),
  note: z.string().optional(),
});

const optionalCurriculumLevel = z
  .enum(["기본", "응용", "심화"])
  .optional()
  .or(z.literal(""))
  .transform((v) => (v === "" ? undefined : v));

export const curriculumProgressSchema = z.object({
  unit: z.string().min(1, "단원을 선택해주세요"),
  level: optionalCurriculumLevel,
  status: z.enum(["진행중", "완료"]).default("진행중"),
  note: z.string().optional(),
});

export type ProgressFormValues = z.infer<typeof progressFormSchema>;
export type CurrentUnitsFormValues = z.infer<typeof currentUnitsSchema>;
export type TextbookHistoryFormValues = z.infer<typeof textbookHistorySchema>;
export type CurriculumProgressFormValues = z.infer<typeof curriculumProgressSchema>;
