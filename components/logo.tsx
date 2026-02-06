"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function Logo({ className }: { className?: string }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Simple "A4O" text logo – works in light and dark without external assets
  return (
    <div
      className={`flex items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold leading-none shrink-0 ${className ?? ""}`}
      style={{ fontSize: "clamp(0.75rem, 50%, 1.25rem)" }}
      suppressHydrationWarning
    >
      {mounted ? "A4O" : "…"}
    </div>
  );
}
