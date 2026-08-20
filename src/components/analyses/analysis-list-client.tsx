"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Brain, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/empty-state";
import type { Analysis } from "@/types";
import { FACTOR_LABELS } from "@/types";
import Link from "next/link";
import { getV2CoreMetrics } from "@/lib/assessment/v2/display";

interface Props {
  initialData: Analysis[];
  initialPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function MiniScore({ value }: { value: number | null }) {
  const v = value ?? 0;
  const color =
    v >= 4
      ? "text-nk-done bg-nk-done-soft"
      : v >= 3
        ? "text-nk-warn bg-nk-warn-soft"
        : "text-nk-late bg-nk-late-soft";
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${color}`}>
      {v.toFixed(1)}
    </span>
  );
}

function MiniV2Score({ value }: { value: number | null }) {
  const color = value === null
    ? "text-nk-ink-hint bg-nk-sunken"
    : value >= 75
      ? "text-nk-done bg-nk-done-soft"
      : value >= 60
        ? "text-nk-progress bg-nk-progress-soft"
        : value >= 40
          ? "text-nk-warn bg-nk-warn-soft"
          : "text-nk-late bg-nk-late-soft";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${color}`}>
      {value === null ? "-" : Math.round(value)}
    </span>
  );
}

export function AnalysisListClient({ initialData, initialPagination }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");

  const data = initialData;
  const pagination = initialPagination;

  const handleSearch = () => {
    startTransition(() => {
      const params = new URLSearchParams();
      if (searchInput) params.set("search", searchInput);
      router.push(`/analyses?${params.toString()}`);
    });
  };

  const handlePageChange = (page: number) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(page));
      router.push(`/analyses?${params.toString()}`);
    });
  };

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div className="flex justify-between items-end mb-1">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "rgb(var(--wr-ink))", letterSpacing: "-0.02em", marginBottom: "3px" }}>
            성향분석 결과
          </h1>
          <p className="text-[12.5px]" style={{ color: "rgb(var(--wr-ink-sub))" }}>
            {pagination.total}건
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nk-ink-hint" />
        <Input
          placeholder="이름 검색..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="pl-9 rounded-xl border-nk-line-soft focus:ring-2 focus:ring-nk-progress/20 focus:border-nk-progress"
        />
      </div>

      {/* Table */}
      {data.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="분석 결과가 없습니다"
          description="설문 상세 페이지에서 성향분석을 실행해주세요"
        />
      ) : (
        <div className="bg-nk-surface rounded-2xl border border-[rgb(var(--wr-sunken))] overflow-hidden" style={{ boxShadow: "0 1px 3px rgb(var(--wr-navy-strong) / 0.02), 0 4px 12px rgb(var(--wr-navy-strong) / 0.02)" }}>
          <Table>
            <TableHeader>
              <TableRow className="bg-[rgb(var(--wr-sunken))] hover:bg-[rgb(var(--wr-sunken))]">
                <TableHead className="px-4 py-3 text-xs font-semibold text-nk-ink-sub">분석일</TableHead>
                <TableHead className="px-4 py-3 text-xs font-semibold text-nk-ink-sub">이름</TableHead>
                <TableHead className="hidden sm:table-cell px-4 py-3 text-xs font-semibold text-nk-ink-sub">학교/학년</TableHead>
                <TableHead className="px-4 py-3 text-xs font-semibold text-nk-ink-sub">학생 유형</TableHead>
                <TableHead className="hidden md:table-cell px-4 py-3 text-xs font-semibold text-nk-ink-sub text-center">학습 프로필</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow key={item.id} className="cursor-pointer hover:bg-[rgb(var(--wr-sunken))] transition-colors">
                  <TableCell className="text-xs text-nk-ink-sub">
                    <Link href={`/analyses/${item.id}`} className="block py-1">
                      {new Date(item.created_at).toLocaleDateString("ko-KR")}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/analyses/${item.id}`}
                      className="font-semibold text-sm text-nk-ink hover:text-nk-progress transition-colors block py-1"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {item.name}
                        {item.analysis_version === "v2" && (
                          <span className="rounded border border-nk-cat-3 bg-nk-cat-3-soft px-1 py-0.5 text-[8px] font-black text-nk-cat-3">V2</span>
                        )}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-nk-ink-sub">
                    <Link href={`/analyses/${item.id}`} className="block py-1">
                      {[item.school, item.grade].filter(Boolean).join(" ")}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/analyses/${item.id}`} className="block py-1">
                      {item.student_type && (
                        <Badge className="text-[10px] bg-nk-progress-soft text-nk-progress hover:bg-nk-progress-soft border-0">
                          {item.student_type}
                        </Badge>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Link href={`/analyses/${item.id}`} className="flex flex-wrap items-center gap-1.5 justify-center py-1">
                      {item.analysis_version === "v2" && item.result_profile_v2
                        ? getV2CoreMetrics(item.result_profile_v2.scores).slice(0, 4).map((metric) => (
                            <div key={metric.key} title={metric.label}>
                              <MiniV2Score value={metric.score} />
                            </div>
                          ))
                        : (["attitude", "self_directed", "assignment", "willingness", "social", "management"] as const).map((key) => (
                            <div key={key} title={FACTOR_LABELS[key]}>
                              <MiniScore value={item[`score_${key}` as keyof Analysis] as number | null} />
                            </div>
                          ))}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page <= 1 || isPending}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-nk-ink-sub">
            {pagination.page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages || isPending}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
