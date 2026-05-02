"use client";

import { useEffect } from "react";
import { useHasHydrated, useSkuStore } from "@/lib/store";
import { applyTheme, subscribeSystem } from "@/lib/theme";

export default function ThemeBootstrap() {
  const theme = useSkuStore((s) => s.theme);
  const hydrated = useHasHydrated();

  useEffect(() => {
    if (!hydrated) return;
    applyTheme(theme);
    if (theme !== "system") return;
    return subscribeSystem(() => applyTheme("system"));
  }, [theme, hydrated]);

  return null;
}
