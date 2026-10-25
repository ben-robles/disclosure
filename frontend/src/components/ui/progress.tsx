"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

type ProgressProps = React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
  /** A segment loops across the track instead of the fill growing. Reduced motion falls back to the fill. */
  indeterminate?: boolean;
};

const Progress = React.forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  ({ className, value, indeterminate, ...props }, ref) => (
    <ProgressPrimitive.Root
      ref={ref}
      value={indeterminate ? null : value}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-primary/20", className)}
      {...props}
    >
      {indeterminate && <div className="loading-slide motion-reduce:hidden" />}
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full rounded-full bg-primary transition-[width] duration-100 motion-reduce:transition-none",
          indeterminate && "hidden motion-reduce:block",
        )}
        style={{ width: `${value || 0}%` }}
      />
    </ProgressPrimitive.Root>
  ),
);
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
