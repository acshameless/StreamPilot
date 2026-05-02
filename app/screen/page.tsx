"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useHasHydrated, useSkuStore } from "@/lib/store";
import ThemeToggle from "@/components/ThemeToggle";

type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

interface Gesture {
  x: number;
  y: number;
  t: number;
  id: number;
}

export default function ScreenPage() {
  const router = useRouter();

  const skus = useSkuStore((s) => s.skus);
  const lastIndex = useSkuStore((s) => s.lastIndex);
  const setLastIndex = useSkuStore((s) => s.setLastIndex);
  const hasHydrated = useHasHydrated();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const gestureRef = useRef<Gesture | null>(null);

  const index = Math.min(
    Math.max(0, lastIndex),
    Math.max(0, skus.length - 1),
  );

  const goPrev = useCallback(() => {
    setLastIndex(Math.max(0, index - 1));
  }, [index, setLastIndex]);

  const goNext = useCallback(() => {
    if (skus.length === 0) return;
    setLastIndex(Math.min(skus.length - 1, index + 1));
  }, [index, skus.length, setLastIndex]);

  const toggleFullscreen = useCallback(() => {
    const doc = document as FsDocument;
    const isFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement);

    let result: unknown;
    if (isFs) {
      result = doc.exitFullscreen
        ? doc.exitFullscreen()
        : doc.webkitExitFullscreen?.();
    } else {
      const el = document.documentElement as FsElement;
      result = el.requestFullscreen
        ? el.requestFullscreen()
        : el.webkitRequestFullscreen?.();
    }

    if (result && typeof (result as Promise<void>).catch === "function") {
      (result as Promise<void>).catch((err) => {
        console.warn("[fullscreen]", err);
      });
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated || skus.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === "ArrowRight" ||
        e.key === "ArrowDown" ||
        e.key === " " ||
        e.key === "Spacebar"
      ) {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Escape") {
        e.preventDefault();
        router.push("/");
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasHydrated, skus.length, goNext, goPrev, router, toggleFullscreen]);

  useEffect(() => {
    const onChange = () => {
      const doc = document as FsDocument;
      setIsFullscreen(
        !!(doc.fullscreenElement || doc.webkitFullscreenElement),
      );
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    gestureRef.current = {
      x: e.clientX,
      y: e.clientY,
      t: Date.now(),
      id: e.pointerId,
    };
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = gestureRef.current;
    gestureRef.current = null;
    if (!start || start.id !== e.pointerId) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dist = Math.hypot(dx, dy);
    const dt = Date.now() - start.t;

    // Horizontal swipe: > 50px, mostly horizontal, faster than 700ms.
    if (
      Math.abs(dx) > 50 &&
      Math.abs(dx) > Math.abs(dy) * 1.4 &&
      dt < 700
    ) {
      if (dx < 0) goNext();
      else goPrev();
      return;
    }

    // Vertical swipe: swipe up = next, swipe down = prev.
    if (
      Math.abs(dy) > 50 &&
      Math.abs(dy) > Math.abs(dx) * 1.4 &&
      dt < 700
    ) {
      if (dy < 0) goNext();
      else goPrev();
      return;
    }

    // Tap (barely moved): split-screen prev / next.
    if (dist < 12) {
      if (e.clientX < window.innerWidth / 2) goPrev();
      else goNext();
    }
  };

  const onPointerCancel = () => {
    gestureRef.current = null;
  };

  if (!hasHydrated) {
    return (
      <main className="flex h-dvh items-center justify-center bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-400">
        加载中...
      </main>
    );
  }

  if (skus.length === 0) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <p className="text-2xl">请先在主页添加 SKU</p>
        <button
          onClick={() => router.push("/")}
          className="rounded-lg border border-slate-300 px-6 py-3 text-lg transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          ← 返回主页
        </button>
      </main>
    );
  }

  const sku = skus[index];

  return (
    <main
      className="flex h-dvh w-screen flex-col bg-white text-slate-900 select-none dark:bg-slate-900 dark:text-slate-50"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <header className="flex flex-shrink-0 items-center justify-between px-4 py-2 sm:px-8 sm:py-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => router.push("/")}
            className="text-2xl text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            aria-label="返回主页"
          >
            ←
          </button>
          <span className="text-base tabular-nums text-slate-500 sm:text-xl dark:text-slate-400">
            {index + 1} / {skus.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={toggleFullscreen}
            className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 sm:text-base dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            {isFullscreen ? "退出全屏" : "全屏"}
          </button>
        </div>
      </header>

      <div
        key={sku.id}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        className="animate-screen-in flex flex-1 cursor-pointer touch-none flex-col gap-3 overflow-hidden px-5 pb-3 sm:gap-6 sm:px-12 sm:pb-6"
      >
        <div className="flex flex-shrink-0 flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-slate-200 pb-3 sm:gap-x-10 sm:pb-5 dark:border-slate-700">
          <h1 className="text-[clamp(1.35rem,7vmin,5.5rem)] font-bold tracking-wide">
            {sku.name}
          </h1>
          <span className="text-[clamp(1.35rem,7vmin,5.5rem)] font-semibold text-amber-600 dark:text-yellow-300">
            ¥ {sku.price}
          </span>
        </div>

        {sku.material && (
          <Section title="材质">
            <p className="text-[clamp(0.95rem,3.2vmin,2.75rem)] leading-snug text-slate-700 dark:text-slate-100">
              {sku.material}
            </p>
          </Section>
        )}

        {sku.sellingPoints.length > 0 && (
          <Section title="卖点" className="min-h-0 flex-1 overflow-hidden">
            <ul className="space-y-1 sm:space-y-2">
              {sku.sellingPoints.map((pt, i) => (
                <li
                  key={i}
                  className="text-[clamp(0.95rem,3.2vmin,2.75rem)] leading-snug text-slate-700 dark:text-slate-100"
                >
                  <span className="text-emerald-600 dark:text-emerald-400">
                    •
                  </span>{" "}
                  {pt}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {sku.bannedWords.length > 0 && (
          <Section title="⚠ 禁说">
            <p className="text-[clamp(1.05rem,3.6vmin,3.25rem)] font-bold leading-snug text-red-600 dark:text-red-400">
              {sku.bannedWords.join("   /   ")}
            </p>
          </Section>
        )}
      </div>

      <footer className="hidden flex-shrink-0 items-center justify-between px-8 py-3 text-sm text-slate-500 sm:flex dark:text-slate-400">
        <span>← ↑ 上一个</span>
        <span>空格 / 点击 / 滑动 切换 · ESC 退出 · F 全屏</span>
        <span>下一个 → ↓</span>
      </footer>
    </main>
  );
}

function Section({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex flex-col gap-1 sm:gap-2 ${className}`}>
      <h3 className="text-[clamp(0.7rem,1.4vmin,1.25rem)] uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      {children}
    </section>
  );
}
