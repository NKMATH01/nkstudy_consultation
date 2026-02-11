"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
} from "date-fns";

export type DatePreset = "today" | "week" | "month" | "all";

interface DateFilterProps {
  value: DatePreset;
  onChange: (preset: DatePreset) => void;
}

const presets: { value: DatePreset; label: string }[] = [
  { value: "today", label: "오늘" },
  { value: "week", label: "이번주" },
  { value: "month", label: "이번달" },
  { value: "all", label: "전체" },
];

export function getDateRange(preset: DatePreset) {
  const now = new Date();
  switch (preset) {
    case "today":
      return {
        startDate: format(startOfDay(now), "yyyy-MM-dd"),
        endDate: format(endOfDay(now), "yyyy-MM-dd"),
      };
    case "week":
      return {
        startDate: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        endDate: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    case "month":
      return {
        startDate: format(startOfMonth(now), "yyyy-MM-dd"),
        endDate: format(endOfMonth(now), "yyyy-MM-dd"),
      };
    case "all":
      return { startDate: undefined, endDate: undefined };
  }
}

export function DateFilter({ value, onChange }: DateFilterProps) {
  return (
    <div className="flex gap-1">
      {presets.map((preset) => (
        <Button
          key={preset.value}
          variant={value === preset.value ? "default" : "outline"}
          size="sm"
          className={cn("text-xs")}
          onClick={() => onChange(preset.value)}
        >
          {preset.label}
        </Button>
      ))}
    </div>
  );
}
