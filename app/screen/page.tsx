"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSkuStore } from "@/lib/store";

export default function ScreenPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const skus = useSkuStore((s) => s.skus);
  const lastIndex = useSkuStore((s) => s.lastIndex);
  const setLastIndex = useSkuStore((s) => s.setLastIndex);
  const hasHydrated = useSkuStore((s) => s.hasHydrated);

  const [index, setIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // restore last index after hydration
  useEffect(() => {
    if (!hasHydrated) return;
    const safe = Math.min(lastIndex, Math.max(0, skus.length - 1));
    setIndex(safe);
  }, [hasHydrated, lastIndex, skus.length]);

  // persist current index
  useEffect(() => {
    if (hasHydrated && skus.length > 0) setLastIndex(index);
  }, [index, hasHydrated, skus.length, setLastIndex]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await containerRef.current?.requestFullscreen();
      }
    } catch {
      // Safari / no user gesture — silently ignore
    }
  }, []);

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(skus.length - 1, i + 1));
  }, [skus.length]);

  // keyboard
  useEffect(() => {
    if (!hasHydrated || skus.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
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

  // fullscreen state tracking
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-tap]")) return;
    if (e.clientX < window.innerWidth / 2) {
      goPrev();
    } else {
      goNext();
    }
  };

  if (!hasHydrated) {
    return (
      <main className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        加载中...
      </main>
    );
  }

  if (skus.length === 0) {
    return (
      <main className="flex h-screen flex-col items-center justify-center gap-4 bg-zinc-950 text-zinc-100">
        <p className="text-2xl">请先在主页添加 SKU</p>
        <button
          onClick={() => router.push("/")}
          className="rounded-md border border-zinc-700 px-6 py-3 text-lg hover:bg-zinc-800"
        >
          ← 返回主页
        </button>
      </main>
    );
  }

  const sku = skus[index];

  return (
    <main
      ref={containerRef}
      onClick={handleClick}
      className="flex h-screen w-screen cursor-pointer flex-col bg-zinc-950 text-zinc-50 select-none"
    >
      <header
        className="flex items-center justify-between px-8 py-4"
        data-no-tap
      >
        <div className="flex items-center gap-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push("/");
            }}
            data-no-tap
            className="text-2xl text-zinc-500 transition-opacity hover:text-zinc-100"
            aria-label="返回主页"
          >
            ←
          </button>
          <span className="text-xl tabular-nums text-zinc-500">
            {index + 1} / {skus.length}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFullscreen();
          }}
          data-no-tap
          className="rounded border border-zinc-700 px-3 py-1 text-base text-zinc-400 transition-opacity hover:bg-zinc-800 hover:text-zinc-100"
        >
          {isFullscreen ? "退出全屏" : "全屏"}
        </button>
      </header>

      <div
        key={sku.id}
        className="animate-screen-in flex-1 overflow-y-auto px-12 pb-8"
      >
        <div className="mb-10 flex flex-wrap items-baseline gap-x-10 gap-y-2 border-b border-zinc-800 pb-6">
          <h1 className="text-7xl font-bold tracking-wide">{sku.name}</h1>
          <span className="text-7xl font-semibold text-amber-300">
            ¥ {sku.price}
          </span>
        </div>

        {sku.material && (
          <Section title="材质">
            <p className="text-5xl leading-relaxed">{sku.material}</p>
          </Section>
        )}

        {sku.sellingPoints.length > 0 && (
          <Section title="卖点">
            <ul className="space-y-3">
              {sku.sellingPoints.map((pt, i) => (
                <li key={i} className="text-5xl leading-relaxed">
                  • {pt}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {sku.bannedWords.length > 0 && (
          <Section title="⚠ 禁说">
            <p className="text-5xl font-bold leading-relaxed text-rose-400">
              {sku.bannedWords.join("   /   ")}
            </p>
          </Section>
        )}
      </div>

      <footer
        className="flex items-center justify-between px-8 py-4 text-base text-zinc-600"
        data-no-tap
      >
        <span>← 上一个</span>
        <span>空格 / 点击 切换 · ESC 退出 · F 全屏</span>
        <span>下一个 →</span>
      </footer>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h3 className="mb-3 text-2xl text-zinc-500">{title}</h3>
      {children}
    </section>
  );
}
