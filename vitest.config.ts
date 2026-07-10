import { defineConfig } from "vitest/config";

// 단위 테스트는 src 하위 *.test.ts만 실행한다.
// Playwright E2E(*.spec.ts)와 충돌하지 않도록 범위를 좁게 유지한다.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
