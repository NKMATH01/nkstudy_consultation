/**
 * V2 학습 프로필 운영 데이터 품질 감사(집계 전용).
 *
 * 조회 필드에는 이름·연락처·학교·서술형 응답이 없다. 출력도 문항 ID와 집계값만
 * 포함한다. 표본이 작을 때 내적 일관성을 확정적 타당성 근거로 오해하지 않도록
 * 표본 수와 해석 상태를 함께 표시한다.
 *
 * 실행:
 *   node --experimental-strip-types scripts/audit-v2-psychometrics.mjs
 *   node --experimental-strip-types scripts/audit-v2-psychometrics.mjs --json
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  ALL_ITEMS,
  INSTRUMENT_REVISION,
  isLikert,
} from "../src/lib/assessment/v2/definition.ts";

function revisionOf(row) {
  return row.responses_v2?.instrument_revision ||
    row.score_profile_v2?.instrumentRevision ||
    "legacy-v2-unversioned";
}

function readLocalEnv() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[match[1]] = value;
  }
  return out;
}

function numeric(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 5;
}

function aligned(item, value) {
  return item.direction === "reverse" ? 6 - value : value;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function sampleVariance(values) {
  if (values.length < 2) return null;
  const avg = mean(values);
  return values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
}

function standardDeviation(values) {
  const variance = sampleVariance(values);
  return variance === null ? null : Math.sqrt(variance);
}

function correlation(xs, ys) {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const xMean = mean(xs);
  const yMean = mean(ys);
  let numerator = 0;
  let xSum = 0;
  let ySum = 0;
  for (let index = 0; index < xs.length; index += 1) {
    const x = xs[index] - xMean;
    const y = ys[index] - yMean;
    numerator += x * y;
    xSum += x ** 2;
    ySum += y ** 2;
  }
  const denominator = Math.sqrt(xSum * ySum);
  return denominator > 0 ? numerator / denominator : null;
}

function cronbachAlpha(rows) {
  if (rows.length < 3 || rows[0]?.length < 2) return null;
  const itemCount = rows[0].length;
  const itemVariances = Array.from({ length: itemCount }, (_, index) =>
    sampleVariance(rows.map((row) => row[index]))
  );
  if (itemVariances.some((value) => value === null)) return null;
  const totalVariance = sampleVariance(rows.map((row) => row.reduce((sum, value) => sum + value, 0)));
  if (totalVariance === null || totalVariance === 0) return null;
  return (itemCount / (itemCount - 1)) *
    (1 - itemVariances.reduce((sum, value) => sum + value, 0) / totalVariance);
}

function round(value, digits = 3) {
  if (value === null || !Number.isFinite(value)) return null;
  const power = 10 ** digits;
  return Math.round(value * power) / power;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function interpretationForSample(n) {
  if (n < 30) return "탐색 전용 — 표본이 너무 작아 문항 수정 근거로 단독 사용 금지";
  if (n < 100) return "예비 점검 — 인지면접·교사 관찰·추가 표본과 함께 해석";
  if (n < 200) return "초기 검증 — 요인구조 검증 전까지 내부 운영용으로 제한";
  return "구조 검증 가능 표본 — 별도 CFA/불변성/준거타당도 분석 필요";
}

function responsesOf(row) {
  const stored = row.responses_v2;
  if (!stored || typeof stored !== "object") return {};
  const responses = stored.responses;
  return responses && typeof responses === "object" ? responses : {};
}

function isEligibleForItem(row, item) {
  if (item.subject === "common") return true;
  if (row.subject_selection === "both") return true;
  return row.subject_selection === item.subject;
}

function audit(rows) {
  const likertItems = ALL_ITEMS.filter(isLikert);
  const byConstruct = new Map();
  for (const item of likertItems) {
    const items = byConstruct.get(item.construct) ?? [];
    items.push(item);
    byConstruct.set(item.construct, items);
  }

  const itemStats = likertItems.map((item) => {
    const eligibleRows = rows.filter((row) => isEligibleForItem(row, item));
    const values = eligibleRows
      .map((row) => responsesOf(row)[item.id])
      .filter(numeric);
    const keyed = values.map((value) => aligned(item, value));
    return {
      id: item.id,
      construct: item.construct,
      subject: item.subject,
      eligibleN: eligibleRows.length,
      n: values.length,
      missingRate: round(1 - values.length / Math.max(eligibleRows.length, 1)),
      rawMean: round(mean(values)),
      sd: round(standardDeviation(values)),
      favorableTop2Rate: round(
        keyed.length ? keyed.filter((value) => value >= 4).length / keyed.length : null
      ),
      unfavorableBottom2Rate: round(
        keyed.length ? keyed.filter((value) => value <= 2).length / keyed.length : null
      ),
    };
  });

  const constructs = [...byConstruct.entries()].map(([construct, items]) => {
    const complete = rows
      .map((row) => {
        const responses = responsesOf(row);
        const values = items.map((item) => responses[item.id]);
        if (!values.every(numeric)) return null;
        return values.map((value, index) => aligned(items[index], value));
      })
      .filter(Boolean);

    const itemRest = items.map((item, itemIndex) => {
      if (items.length < 2) return { id: item.id, correctedItemTotal: null };
      const xs = complete.map((row) => row[itemIndex]);
      const rest = complete.map((row) =>
        row.reduce((sum, value, index) => sum + (index === itemIndex ? 0 : value), 0)
      );
      return { id: item.id, correctedItemTotal: round(correlation(xs, rest)) };
    });

    return {
      construct,
      items: items.map((item) => item.id),
      itemCount: items.length,
      completeN: complete.length,
      alpha: round(cronbachAlpha(complete)),
      itemRest,
    };
  });

  const subjects = rows.reduce((acc, row) => {
    const key = row.subject_selection || "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const activeSeconds = rows
    .map((row) => row.response_meta_v2?.activeSeconds)
    .filter((value) => typeof value === "number" && Number.isFinite(value));
  const reviewCount = rows.filter(
    (row) => row.score_profile_v2?.responseQuality?.status === "review"
  ).length;

  return {
    generatedAt: new Date().toISOString(),
    privacy: "집계 전용: PII·서술 원문 미조회",
    cohort: {
      n: rows.length,
      interpretation: interpretationForSample(rows.length),
      subjects,
      medianActiveSeconds: round(median(activeSeconds), 1),
      responseReviewRate: round(rows.length ? reviewCount / rows.length : null),
    },
    constructs,
    itemStats,
    flags: itemStats
      .filter(
        (item) =>
          item.eligibleN >= 5 &&
          ((item.favorableTop2Rate ?? 0) >= 0.75 ||
            (item.unfavorableBottom2Rate ?? 0) >= 0.75 ||
            (item.missingRate ?? 0) >= 0.15 ||
            (item.n >= 5 && (item.sd ?? 99) < 0.6))
      )
      .map((item) => ({
        id: item.id,
        construct: item.construct,
        reasons: [
          (item.favorableTop2Rate ?? 0) >= 0.75 ? "천장 후보" : null,
          (item.unfavorableBottom2Rate ?? 0) >= 0.75 ? "바닥 후보" : null,
          (item.missingRate ?? 0) >= 0.15 ? "결측 높음" : null,
          (item.sd ?? 99) < 0.6 ? "변별 낮음" : null,
        ].filter(Boolean),
      })),
  };
}

function markdown(result) {
  const lines = [
    "# V2 학습 프로필 운영 데이터 감사",
    "",
    `- 생성: ${result.generatedAt}`,
    `- 개인정보: ${result.privacy}`,
    `- 표본: ${result.cohort.n}명 — ${result.cohort.interpretation}`,
    `- 문항 리비전: ${result.cohort.revision}`,
    `- 저장된 리비전 분포: ${Object.entries(result.cohort.availableRevisions).map(([k, v]) => `${k} ${v}명`).join(", ") || "없음"}`,
    `- 과목: ${Object.entries(result.cohort.subjects).map(([k, v]) => `${k} ${v}`).join(", ") || "없음"}`,
    `- 중앙 활성 응답시간: ${result.cohort.medianActiveSeconds ?? "확인 불가"}초`,
    `- 응답 재확인 비율: ${result.cohort.responseReviewRate === null ? "확인 불가" : `${Math.round(result.cohort.responseReviewRate * 100)}%`}`,
    "",
    "## 구인별 내적 일관성(탐색)",
    "",
    "| 구인 | 문항 | 완전응답 n | alpha |",
    "|---|---:|---:|---:|",
    ...result.constructs.map((entry) =>
      `| ${entry.construct} | ${entry.items.join(", ")} | ${entry.completeN} | ${entry.alpha ?? "단일/계산불가"} |`
    ),
    "",
    "## 우선 확인 문항",
    "",
    ...(result.flags.length
      ? result.flags.map((flag) => `- ${flag.id} (${flag.construct}): ${flag.reasons.join(", ")}`)
      : ["- 자동 플래그 없음"]),
    "",
    "> alpha는 일차원성의 증거가 아닙니다. 인지면접, 내용타당도, 요인구조, 재검사 신뢰도, 교사 관찰 및 성취 변화와의 준거타당도를 별도로 확인해야 합니다.",
  ];
  return lines.join("\n");
}

const env = readLocalEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  throw new Error(".env.local에서 Supabase URL/키를 찾지 못했습니다.");
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase
  .from("surveys")
  .select("subject_selection,responses_v2,response_meta_v2,score_profile_v2")
  .eq("instrument_version", "v2");

if (error) {
  throw new Error(`V2 설문 집계 조회 실패: ${error.message}`);
}

const allRows = data ?? [];
const revisionCounts = allRows.reduce((acc, row) => {
  const revision = revisionOf(row);
  acc[revision] = (acc[revision] ?? 0) + 1;
  return acc;
}, {});
const currentRows = allRows.filter((row) => revisionOf(row) === INSTRUMENT_REVISION);
const result = audit(currentRows);
result.cohort.revision = INSTRUMENT_REVISION;
result.cohort.availableRevisions = revisionCounts;
process.stdout.write(process.argv.includes("--json") ? `${JSON.stringify(result, null, 2)}\n` : `${markdown(result)}\n`);
