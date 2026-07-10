import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 단위 테스트는 src 하위 *.test.ts(x)만 실행한다.
// Playwright E2E(*.spec.ts)와 충돌하지 않도록 범위를 좁게 유지한다.
export default defineConfig({
  resolve: {
    // tsconfig의 "@/*" → ./src/* 별칭을 테스트에서도 동일하게 해석한다.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
  },
});
