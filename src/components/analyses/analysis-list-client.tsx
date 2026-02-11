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
      ? "text-emerald-600 bg-emerald-50"
      : v >= 3
        ? "text-amber-600 bg-amber-50"
        : "text-red-600 bg-red-50";
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${color}`}>
      {v.toFixed(1)}
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
          <h1 className="text-xl font-extrabold" style={{ color: "#0F172A", letterSpacing: "-0.02em", marginBottom: "3px" }}>
            AI 분석 결과
          </h1>
          <p className="text-[12.5px]" style={{ color: "#64748B" }}>
            {pagination.total}건
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="이름 검색..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="pl-9 rounded-xl border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
        />
      </div>

      {/* Table */}
      {data.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="분석 결과가 없습니다"
          description="설문 상세 페이지에서 AI 분석을 실행해주세요"
        />
      ) : (
        <div className="bg-white rounded-2xl border border-[#f1f5f9] overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.02)" }}>
          <Table>
            <TableHeader>
              <TableRow className="bg-[#f8fafc] hover:bg-[#f8fafc]">
                <TableHead className="px-4 py-3 text-xs font-semibold text-slate-500">분석일</TableHead>
                <TableHead className="px-4 py-3 text-xs font-semibold text-slate-500">이름</TableHead>
                <TableHead className="hidden sm:table-cell px-4 py-3 text-xs font-semibold text-slate-500">학교/학년</TableHead>
                <TableHead className="px-4 py-3 text-xs font-semibold text-slate-500">학생 유형</TableHead>
                <TableHead className="hidden md:table-cell px-4 py-3 text-xs font-semibold text-slate-500 text-center">6-Factor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow key={item.id} className="cursor-pointer hover:bg-[#F8FAFC] transition-colors">
                  <TableCell className="text-xs text-slate-500">
                    <Link href={`/analyses/${item.id}`} className="block py-1">
                      {new Date(item.created_at).toLocaleDateString("ko-KR")}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/analyses/${item.id}`}
                      className="font-semibold text-sm text-slate-800 hover:text-indigo-600 transition-colors block py-1"
                    >
                      {item.name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-slate-500">
                    <Link href={`/analyses/${item.id}`} className="block py-1">
                      {[item.school, item.grade].filter(Boolean).join(" ")}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/analyses/${item.id}`} className="block py-1">
                      {item.student_type && (
                        <Badge className="text-[10px] bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-0">
                          {item.student_type}
                        </Badge>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Link href={`/analyses/${item.id}`} className="flex items-center gap-1.5 justify-center py-1">
                      {(["attitude", "self_directed", "assignment", "willingness", "social", "management"] as const).map((key) => (
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
          <span className="text-sm font-medium text-slate-500">
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
