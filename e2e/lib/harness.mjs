// 경량 E2E 하네스 (playwright 코어 API 사용, @playwright/test 미설치).
// - Next dev 서버를 자동 기동/종료(또는 E2E_BASE_URL로 외부 서버 재사용).
// - 최소 assert 헬퍼와 순차 러너를 제공한다.
// 운영 DB에 V2 컬럼이 없어 "제출 성공" 흐름은 검증하지 않는다(제출 직전까지만).

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const IS_WIN = process.platform === "win32";

export function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

export function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || "assertEqual"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

/** dev 서버를 기동하고 준비될 때까지 대기한다. E2E_BASE_URL이 있으면 그것을 재사용. */
export async function startServer({ port = 3210, timeoutMs = 120000 } = {}) {
  if (process.env.E2E_BASE_URL) {
    const baseURL = process.env.E2E_BASE_URL.replace(/\/$/, "");
    await waitForReady(`${baseURL}/survey`, timeoutMs);
    return { baseURL, close: async () => {} };
  }

  const baseURL = `http://localhost:${port}`;
  const cmd = IS_WIN ? "npx.cmd" : "npx";
  const child = spawn(cmd, ["next", "dev", "-p", String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "development" },
    stdio: ["ignore", "pipe", "pipe"],
    shell: IS_WIN,
  });
  child.stdout.on("data", () => {});
  child.stderr.on("data", (d) => {
    const s = String(d);
    if (/error/i.test(s) && !/Warning/i.test(s)) process.stderr.write(`[next] ${s}`);
  });

  await waitForReady(`${baseURL}/survey`, timeoutMs);

  const close = async () => {
    if (!child.pid) return;
    if (IS_WIN) {
      await new Promise((res) => {
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { shell: true }).on("exit", res);
      });
    } else {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    }
  };
  return { baseURL, close };
}

async function waitForReady(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = "";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      // dev 컴파일 완료 후 200(또는 3xx 리다이렉트가 아닌 실제 페이지). /survey는 공개 200.
      if (res.status === 200) return;
      lastErr = `status ${res.status}`;
    } catch (e) {
      lastErr = String(e?.message || e);
    }
    await sleep(1000);
  }
  throw new Error(`server not ready at ${url} within ${timeoutMs}ms (last: ${lastErr})`);
}

/** 순차 러너. tests: [{name, fn}]. fn(ctx) 는 예외를 던지면 실패. */
export async function runTests(tests, ctx) {
  const results = [];
  for (const t of tests) {
    const started = Date.now();
    try {
      await t.fn(ctx);
      results.push({ name: t.name, ok: true, ms: Date.now() - started });
      console.log(`  PASS  ${t.name} (${Date.now() - started}ms)`);
    } catch (e) {
      results.push({ name: t.name, ok: false, ms: Date.now() - started, error: String(e?.stack || e) });
      console.log(`  FAIL  ${t.name} (${Date.now() - started}ms)`);
      console.log(`        ${String(e?.message || e)}`);
    }
  }
  return results;
}

/** 에러 수집기가 붙은 새 page를 만든다. */
export async function newPage(browser, { viewport } = {}) {
  const context = await browser.newContext(viewport ? { viewport } : undefined);
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  return { context, page, consoleErrors, pageErrors };
}
