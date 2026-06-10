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

export const progressFormSchema = z
  .object({
    student_count: optionalNonnegativeInt,
    main_textbook: z.string().optional(),
    main_total_pages: optionalPositiveInt,
    current_page: optionalPositiveInt,
    sub_textbook: z.string().optional(),
    next_textbook: z.string().optional(),
    next_start_plan: z.string().optional(),
    current_plan: z.string().optional(),
    note: z.string().optional(),
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

export type ProgressFormValues = z.infer<typeof progressFormSchema>;
