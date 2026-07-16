"use client";

import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { roundTimeTo10 } from "@/lib/time-utils";

export type TimeField10Props = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "step"
>;

export const TimeField10 = forwardRef<HTMLInputElement, TimeField10Props>(
  function TimeField10({ onBlur, onChange, ...props }, ref) {
    return (
      <Input
        {...props}
        ref={ref}
        type="time"
        step={600}
        onChange={onChange}
        onBlur={(event) => {
          const rounded = roundTimeTo10(event.currentTarget.value);
          if (rounded !== event.currentTarget.value) {
            event.currentTarget.value = rounded;
            onChange?.(event);
          }
          onBlur?.(event);
        }}
      />
    );
  },
);

TimeField10.displayName = "TimeField10";
