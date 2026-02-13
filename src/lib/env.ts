import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash"),
  ANTHROPIC_API_KEY: z.string().min(1),
  CLAUDE_MODEL: z.string().default("claude-haiku-4-5-20251001"),
  NK_ACADEMY_VEHICLE_FEE: z.string().optional().default("20000"),
  NK_ACADEMY_BANK_INFO: z.string().optional().default(""),
  NK_ACADEMY_BANK_OWNER: z.string().optional().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(""),
});

function validateEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(`[ENV] 환경변수 검증 실패:\n${missing}`);
    // 개발 환경에서는 경고만, 프로덕션에서는 에러
    if (process.env.NODE_ENV === "production") {
      throw new Error("필수 환경변수가 설정되지 않았습니다.");
    }
    return process.env as unknown as z.infer<typeof envSchema>;
  }
  return parsed.data;
}

export const env = validateEnv();
