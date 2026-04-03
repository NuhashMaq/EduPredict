import * as React from "react";

import { cn } from "@/lib/cn";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  tone?: "default" | "emerald" | "cyan" | "fuchsia";
  /** Back-compat only (lamp effect removed). */
  lamp?: boolean;
  /**
   * Enables the hover lift + shadow interaction.
   * Per UI requirements this should only be used on the homepage.
   */
  interactive?: boolean;
};

export function GlassCard({ className, tone = "default", lamp, interactive = false, children, ...props }: Props) {
  void lamp;
  void tone;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl text-slate-900",
        "text-base leading-relaxed",
        "bg-transparent",
        "border border-[rgba(20,65,206,0.14)]",
        interactive
          ? "transition will-change-transform hover:-translate-y-0.5"
          : "",
        className
      )}
      {...props}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}
