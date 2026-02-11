"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Plus, FileText, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge, ResultBadge } from "@/components/common/status-badge";
import { DateFilter, getDateRange, type DatePreset } from "@/components/common/date-filter";
import { SearchInput } from "@/components/common/search-input";
import { EmptyState } from "@/components/common/empty-state";
import { ConsultationFormDialog } from "@/components/consultations/consultation-form";
import { TextParseModal } from "@/components/consultations/text-parse-modal";
import type { Consultation } from "@/types";
import Link from "next/link";

interface Props {
  initialData: Consultation[];
  initialPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function ConsultationListClient({ initialData, initialPagination }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [searchValue, setSearchValue] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") || "all"
  );
  const [showForm, setShowForm] = useState(false);
  const [showTextParse, setShowTextParse] = useState(false);

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
        router.push(`/consultations?${params.toString()}`);
      });
    },
    [router, searchParams, startTransition]
  );

  const handleDateChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const range = getDateRange(preset);
    updateFilters({ startDate: range.startDate, endDate: range.endDate });
  };

  const handleSearch = (value: string) => {
    setSearchValue(value);
  };

  const handleSearchSubmit = () => {
    updateFilters({ search: searchValue || undefined });
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    updateFilters({ status: value === "all" ? undefined : value });
  };

  const handlePageChange = (page: number) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(page));
      router.push(`/consultations?${params.toString()}`);
    });
  };

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div className="flex justify-between items-end mb-1">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "#0F172A", letterSpacing: "-0.02em", marginBottom: "3px" }}>
            상담 관리
          </h1>
          <p className="text-[12.5px]" style={{ color: "#64748B" }}>
            총 {initialPagination.total}건의 상담 기록
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTextParse(true)}
            className="rounded-[7px] border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
          >
            <FileText className="h-4 w-4 mr-1.5" />
            텍스트 등록
          </Button>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[7px] text-white text-[12.5px] font-semibold transition-all"
            style={{
              background: "linear-gradient(135deg, #D4A853, #C49B3D)",
              boxShadow: "0 2px 8px rgba(212,168,83,0.3)",
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            새 상담
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <DateFilter value={datePreset} onChange={handleDateChange} />

        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[120px] h-9 rounded-lg">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="active">진행중</SelectItem>
            <SelectItem value="completed">완료</SelectItem>
            <SelectItem value="pending">대기</SelectItem>
            <SelectItem value="cancelled">취소</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-1.5">
          <SearchInput
            value={searchValue}
            onChange={handleSearch}
          />
          <Button
            size="sm"
            variant="secondary"
            className="h-9 rounded-lg"
            onClick={handleSearchSubmit}
          >
            검색
          </Button>
        </div>
      </div>

      {/* Data Table */}
      {initialData.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="등록된 상담이 없습니다"
          description="새로운 상담을 등록해보세요"
          action={
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[7px] text-white text-[12.5px] font-semibold"
              style={{ background: "linear-gradient(135deg, #D4A853, #C49B3D)", boxShadow: "0 2px 8px rgba(212,168,83,0.3)" }}
            >
              <Plus className="h-4 w-4" />
              새 상담
            </button>
          }
        />
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-[#f1f5f9] overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.02)" }}>
            <Table>
              <TableHeader>
                <TableRow className="bg-[#f8fafc] hover:bg-[#f8fafc]">
                  <TableHead className="w-[90px] px-4 py-3 text-xs font-semibold text-slate-500">날짜</TableHead>
                  <TableHead className="px-4 py-3 text-xs font-semibold text-slate-500">이름</TableHead>
                  <TableHead className="hidden sm:table-cell px-4 py-3 text-xs font-semibold text-slate-500">학교/학년</TableHead>
                  <TableHead className="hidden md:table-cell px-4 py-3 text-xs font-semibold text-slate-500">상담방식</TableHead>
                  <TableHead className="px-4 py-3 text-xs font-semibold text-slate-500">상태</TableHead>
                  <TableHead className="px-4 py-3 text-xs font-semibold text-slate-500">결과</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialData.map((item) => (
                  <TableRow
                    key={item.id}
                    className={`cursor-pointer hover:bg-[#F8FAFC] transition-colors ${isPending ? "opacity-50" : ""}`}
                  >
                    <TableCell className="text-xs text-slate-500">
                      <Link href={`/consultations/${item.id}`} className="block py-1">
                        {item.consult_date
                          ? format(new Date(item.consult_date), "MM-dd")
                          : "-"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/consultations/${item.id}`} className="font-semibold text-sm text-slate-800 block py-1">
                        {item.name}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-slate-500">
                      <Link href={`/consultations/${item.id}`} className="block py-1">
                        {[item.school, item.grade].filter(Boolean).join(" ") || "-"}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-slate-600">
                      <Link href={`/consultations/${item.id}`} className="block py-1">
                        {item.consult_type}
                        {item.consult_time ? ` ${item.consult_time.slice(0, 5)}` : ""}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/consultations/${item.id}`} className="block py-1">
                        <StatusBadge status={item.status} />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/consultations/${item.id}`} className="block py-1">
                        <ResultBadge status={item.result_status} />
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

      {/* Dialogs */}
      <ConsultationFormDialog open={showForm} onOpenChange={setShowForm} />
      <TextParseModal open={showTextParse} onOpenChange={setShowTextParse} />
    </div>
  );
}
