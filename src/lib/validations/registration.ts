import { z } from "zod";

export const registrationAdminSchema = z.object({
  registration_date: z.string().min(1, "등록일을 입력하세요"),
  assigned_class: z.string().min(1, "배정반을 선택하세요"),
  teacher: z.string().min(1, "담임을 선택하세요"),
  use_vehicle: z.string().optional(),
  test_score: z.string().optional(),
  test_note: z.string().optional(),
  location: z.string().optional(),
  consult_date: z.string().optional(),
  additional_note: z.string().optional(),
  tuition_fee: z.coerce.number().optional(),
});

export type RegistrationAdminFormData = z.infer<typeof registrationAdminSchema>;
