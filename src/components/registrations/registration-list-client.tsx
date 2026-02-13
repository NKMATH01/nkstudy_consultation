"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, FileText, ChevronLeft, ChevronRight, Sparkles, ClipboardList } from "lucide-react";
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
import { EmptyState } from "@/components/common/empty-state";
import type { Registration } from "@/types";
import Link from "next/link";

interface Props {
  initialData: Registration[];
  initialPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** HTML 태그 제거 후 텍스트 추출 */
function stripHtml(html: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** 텍스트 truncate */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

export function RegistrationListClient({ initialData, initialPagination }: Props) {
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
      router.push(`/registrations?${params.toString()}`);
    });
  };

  const handlePageChange = (page: number) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(page));
      router.push(`/registrations?${params.toString()}`);
    });
  };

  const formatFee = (fee: number | null) => {
    if (!fee) return "-";
    return `${(fee / 10000).toFixed(0)}만원`;
  };

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div className="flex justify-between items-end mb-1">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "#0F172A", letterSpacing: "-0.02em", marginBottom: "3px" }}>
            등록 안내
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
          icon={FileText}
          title="등록 안내가 없습니다"
          description="분석 결과 상세 페이지에서 등록 안내문을 생성해주세요"
        />
      ) : (
        <div className="bg-white rounded-2xl border border-[#f1f5f9] overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.02)" }}>
          <Table>
            <TableHeader>
              <TableRow className="bg-[#f8fafc] hover:bg-[#f8fafc]">
                <TableHead className="px-4 py-3 text-xs font-semibold text-slate-500">생성일</TableHead>
                <TableHead className="px-4 py-3 text-xs font-semibold text-slate-500">이름</TableHead>
                <TableHead className="hidden sm:table-cell px-4 py-3 text-xs font-semibold text-slate-500">학교/학년</TableHead>
                <TableHead className="hidden md:table-cell px-4 py-3 text-xs font-semibold text-slate-500">과목</TableHead>
                <TableHead className="hidden md:table-cell px-4 py-3 text-xs font-semibold text-slate-500">배정반</TableHead>
                <TableHead className="hidden lg:table-cell px-4 py-3 text-xs font-semibold text-slate-500">담임</TableHead>
                <TableHead className="px-4 py-3 text-xs font-semibold text-slate-500">수업료</TableHead>
                <TableHead className="hidden md:table-cell px-4 py-3 text-xs font-semibold text-slate-500">안내문 / 분석</TableHead>
                <TableHead className="hidden lg:table-cell px-4 py-3 text-xs font-semibold text-slate-500">등록일</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow key={item.id} className="cursor-pointer hover:bg-[#F8FAFC] transition-colors">
                  <TableCell className="text-xs text-slate-500">
                    <Link href={`/registrations/${item.id}`} className="block py-1">
                      {new Date(item.created_at).toLocaleDateString("ko-KR")}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/registrations/${item.id}`}
                      className="font-semibold text-sm text-slate-800 hover:text-indigo-600 transition-colors block py-1"
                    >
                      {item.name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-slate-500">
                    <Link href={`/registrations/${item.id}`} className="block py-1">
                      {[item.school, item.grade].filter(Boolean).join(" ")}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-slate-600">
                    <Link href={`/registrations/${item.id}`} className="block py-1">
                      {item.subject || "-"}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-slate-600">
                    <Link href={`/registrations/${item.id}`} className="block py-1">
                      {item.assigned_class || "-"}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-slate-600">
                    <Link href={`/registrations/${item.id}`} className="block py-1">
                      {item.teacher || "-"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm font-medium text-slate-700">
                    <Link href={`/registrations/${item.id}`} className="block py-1">
                      {formatFee(item.tuition_fee)}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-1.5">
                      {item.report_html ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const win = window.open("", "_blank");
                            if (win) {
                              win.document.write(item.report_html!);
                              win.document.close();
                            }
                          }}
                          className="inline-flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-800 font-bold px-2 py-0.5 rounded-full bg-emerald-50 hover:bg-emerald-100 transition-colors"
                          title="안내문 보기"
                        >
                          <ClipboardList className="h-3 w-3 shrink-0" />
                          안내문
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                      {item.analysis_id && (
                        <Link
                          href={`/analyses/${item.analysis_id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                          title="분석 보기"
                        >
                          <Sparkles className="h-3 w-3" />
                          분석
                        </Link>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-slate-500">
                    <Link href={`/registrations/${item.id}`} className="block py-1">
                      {item.registration_date || "-"}
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
