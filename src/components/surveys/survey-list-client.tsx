"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Plus, ClipboardList, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { SurveyFormDialog } from "@/components/surveys/survey-form";
import type { Survey } from "@/types";
import { FACTOR_LABELS } from "@/types";
import Link from "next/link";

interface Props {
  initialData: Survey[];
  initialPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function FactorScore({ value, label }: { value: number | null; label: string }) {
  if (value == null) return null;
  const color =
    value >= 4 ? "text-emerald-600 bg-emerald-50" : value >= 3 ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50";
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${color}`} title={label}>
      {value.toFixed(1)}
    </span>
  );
}

export function SurveyListClient({ initialData, initialPagination }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [searchValue, setSearchValue] = useState(searchParams.get("search") || "");
  const [showForm, setShowForm] = useState(false);

  const updateFilters = useCallback(
    (updates: Record<string, string | undefined>) => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());
        Object.entries(updates).forEach(([key, value]) => {
          if (value) {
            params.set(key, value);
          } else {
            params.delete(key);
          }
        });
        params.delete("page");
        router.push(`/surveys?${params.toString()}`);
      });
    },
    [router, searchParams, startTransition]
  );

  const handleSearchSubmit = () => {
    updateFilters({ search: searchValue || undefined });
  };

  const handlePageChange = (page: number) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(page));
      router.push(`/surveys?${params.toString()}`);
    });
  };

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div className="flex justify-between items-end mb-1">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "#0F172A", letterSpacing: "-0.02em", marginBottom: "3px" }}>
            설문 현황
          </h1>
          <p className="text-[12.5px]" style={{ color: "#64748B" }}>
            총 {initialPagination.total}건
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[7px] text-white text-[12.5px] font-semibold transition-all"
          style={{
            background: "linear-gradient(135deg, #D4A853, #C49B3D)",
            boxShadow: "0 2px 8px rgba(212,168,83,0.3)",
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          설문 입력
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="이름, 학교 검색..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
          className="pl-9 rounded-xl border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
        />
      </div>

      {/* Data Table */}
      {initialData.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="등록된 설문이 없습니다"
          description="새로운 설문을 등록해보세요"
          action={
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[7px] text-white text-[12.5px] font-semibold"
              style={{ background: "linear-gradient(135deg, #D4A853, #C49B3D)", boxShadow: "0 2px 8px rgba(212,168,83,0.3)" }}
            >
              <Plus className="h-4 w-4" />
              설문 입력
            </button>
          }
        />
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-[#f1f5f9] overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.02)" }}>
            <Table>
              <TableHeader>
                <TableRow className="bg-[#f8fafc] hover:bg-[#f8fafc]">
                  <TableHead className="w-[90px] px-4 py-3 text-xs font-semibold text-slate-500">등록일</TableHead>
                  <TableHead className="px-4 py-3 text-xs font-semibold text-slate-500">이름</TableHead>
                  <TableHead className="hidden sm:table-cell px-4 py-3 text-xs font-semibold text-slate-500">학교/학년</TableHead>
                  <TableHead className="hidden md:table-cell px-4 py-3 text-xs font-semibold text-slate-500">6-Factor</TableHead>
                  <TableHead className="px-4 py-3 text-xs font-semibold text-slate-500">분석</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialData.map((item) => (
                  <TableRow
                    key={item.id}
                    className={`cursor-pointer hover:bg-[#F8FAFC] transition-colors ${isPending ? "opacity-50" : ""}`}
                  >
                    <TableCell className="text-xs text-slate-500">
                      <Link href={`/surveys/${item.id}`} className="block py-1">
                        {format(new Date(item.created_at), "MM-dd")}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/surveys/${item.id}`} className="font-semibold text-sm text-slate-800 block py-1">
                        {item.name}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-slate-500">
                      <Link href={`/surveys/${item.id}`} className="block py-1">
                        {[item.school, item.grade].filter(Boolean).join(" ") || "-"}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Link href={`/surveys/${item.id}`} className="flex gap-1.5 py-1">
                        {(["attitude", "self_directed", "assignment", "willingness", "social", "management"] as const).map((key) => (
                          <FactorScore
                            key={key}
                            value={item[`factor_${key}` as keyof Survey] as number | null}
                            label={FACTOR_LABELS[key]}
                          />
                        ))}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/surveys/${item.id}`} className="block py-1">
                        {item.analysis_id ? (
                          <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">완료</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">미분석</Badge>
                        )}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {initialPagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                disabled={initialPagination.page <= 1}
                onClick={() => handlePageChange(initialPagination.page - 1)}
              >
                이전
              </Button>
              <span className="text-sm font-medium text-slate-500">
                {initialPagination.page} / {initialPagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                disabled={initialPagination.page >= initialPagination.totalPages}
                onClick={() => handlePageChange(initialPagination.page + 1)}
              >
                다음
              </Button>
            </div>
          )}
        </>
      )}

      <SurveyFormDialog open={showForm} onOpenChange={setShowForm} />
    </div>
  );
}
