"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  ClipboardList,
  Sparkles,
  FileText,
  Settings,
  ExternalLink,
  LogOut,
} from "lucide-react";
import { TextParseModal } from "@/components/consultations/text-parse-modal";

const navItems = [
  { href: "/", label: "대시보드", icon: Home },
  { href: "/consultations", label: "상담 관리", icon: Users },
  { href: "/surveys", label: "설문 현황", icon: ClipboardList },
  { href: "/analyses", label: "AI 분석", icon: Sparkles },
  { href: "/registrations", label: "등록 안내", icon: FileText },
  { href: "/settings", label: "설정", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [showTextParse, setShowTextParse] = useState(false);

  return (
    <>
      <aside
        className="hidden md:flex w-[224px] flex-col min-h-screen flex-shrink-0"
        style={{ background: "#0A0F1E" }}
      >
        {/* Logo */}
        <div className="px-5 py-6 pb-7 flex items-center gap-2.5">
          <div
            className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center text-sm font-extrabold text-white"
            style={{
              background: "linear-gradient(135deg, #D4A853, #B8892E)",
              boxShadow: "0 2px 8px rgba(212,168,83,0.3)",
            }}
          >
            NK
          </div>
          <div>
            <div className="text-sm font-bold text-white" style={{ letterSpacing: "-0.02em" }}>
              NK Academy
            </div>
            <div className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.3)" }}>
              상담관리 시스템
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2.5">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-[7px] mb-0.5 transition-all duration-150"
                style={{
                  fontSize: "13px",
                  fontWeight: isActive ? 600 : 500,
                  background: isActive ? "rgba(255,255,255,0.04)" : "transparent",
                  color: isActive ? "#ffffff" : "rgba(255,255,255,0.4)",
                  borderLeft: isActive ? "2px solid #D4A853" : "2px solid transparent",
                }}
              >
                <item.icon className="h-[17px] w-[17px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-2.5 pb-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <button
            onClick={() => setShowTextParse(true)}
            className="flex items-center gap-2 w-full px-3.5 py-2 rounded-[7px] mt-2.5 transition-all"
            style={{
              fontSize: "11.5px",
              fontWeight: 500,
              background: "rgba(212,168,83,0.08)",
              color: "#F0D48A",
              border: "none",
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            공개 설문 링크
          </button>
        </div>
        <div
          className="px-4 py-3.5 flex items-center gap-2.5"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div
            className="w-8 h-8 rounded-[10px] flex items-center justify-center text-xs font-bold"
            style={{
              background: "rgba(212,168,83,0.12)",
              color: "#D4A853",
            }}
          >
            N
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
              NK 원장
            </div>
            <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
              admin@nk.com
            </div>
          </div>
          <Link
            href="/login"
            className="p-1 flex"
            style={{ color: "rgba(255,255,255,0.25)" }}
            title="로그아웃"
          >
            <LogOut className="h-4 w-4" />
          </Link>
        </div>
      </aside>

      <TextParseModal open={showTextParse} onOpenChange={setShowTextParse} />
    </>
  );
}
