"use client";

import { useHasHydrated, useSkuStore } from "@/lib/store";
import { resolveSystem } from "@/lib/theme";

const BTN_CLASS =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-base text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";

export default function ThemeToggle() {
  const theme = useSkuStore((s) => s.theme);
  const setTheme = useSkuStore((s) => s.setTheme);
  const hydrated = useHasHydrated();

  if (!hydrated) {
    return (
      <button
        type="button"
        aria-label="切换主题"
        className={BTN_CLASS}
        suppressHydrationWarning
      >
        <span aria-hidden />
      </button>
    );
  }

  const resolved = theme === "system" ? resolveSystem() : theme;
  const isDark = resolved === "dark";

  const handleClick = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={isDark ? "切换到浅色" : "切换到深色"}
      aria-label={isDark ? "切换到浅色主题" : "切换到深色主题"}
      className={BTN_CLASS}
    >
      <span aria-hidden>{isDark ? "🌙" : "☀"}</span>
    </button>
  );
}
