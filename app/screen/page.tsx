"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useHasHydrated, useSkuStore } from "@/lib/store";

type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export default function ScreenPage() {
  const router = useRouter();

  const skus = useSkuStore((s) => s.skus);
  const lastIndex = useSkuStore((s) => s.lastIndex);
  const setLastIndex = useSkuStore((s) => s.setLastIndex);
  const hasHydrated = useHasHydrated();

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Derive safe index from store — single source of truth, no oscillation.
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
      <main className="flex h-screen items-center justify-center bg-slate-900 text-slate-400">
        加载中...
      </main>
    );
  }

  if (skus.length === 0) {
    return (
      <main className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-900 text-slate-100">
        <p className="text-2xl">请先在主页添加 SKU</p>
        <button
          onClick={() => router.push("/")}
          className="rounded-lg border border-slate-700 px-6 py-3 text-lg transition hover:bg-slate-800"
        >
          ← 返回主页
        </button>
      </main>
    );
  }

  const sku = skus[index];

  return (
    <main
      onClick={handleClick}
      className="flex h-screen w-screen cursor-pointer flex-col bg-slate-900 text-slate-50 select-none"
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
            className="text-2xl text-slate-400 transition hover:text-slate-100"
            aria-label="返回主页"
          >
            ←
          </button>
          <span className="text-xl tabular-nums text-slate-400">
            {index + 1} / {skus.length}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFullscreen();
          }}
          data-no-tap
          className="rounded-lg border border-slate-700 px-3 py-1 text-base text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >
          {isFullscreen ? "退出全屏" : "全屏"}
        </button>
      </header>

      <div
        key={sku.id}
        className="animate-screen-in flex-1 overflow-y-auto px-12 pb-8"
      >
        <div className="mb-10 flex flex-wrap items-baseline gap-x-10 gap-y-2 border-b border-slate-700 pb-6">
          <h1 className="text-7xl font-bold tracking-wide">{sku.name}</h1>
          <span className="text-7xl font-semibold text-yellow-300">
            ¥ {sku.price}
          </span>
        </div>

        {sku.material && (
          <Section title="材质">
            <p className="text-5xl leading-relaxed text-slate-100">
              {sku.material}
            </p>
          </Section>
        )}

        {sku.sellingPoints.length > 0 && (
          <Section title="卖点">
            <ul className="space-y-3">
              {sku.sellingPoints.map((pt, i) => (
                <li
                  key={i}
                  className="text-5xl leading-relaxed text-slate-100"
                >
                  <span className="text-emerald-400">•</span> {pt}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {sku.bannedWords.length > 0 && (
          <Section title="⚠ 禁说">
            <p className="text-5xl font-bold leading-relaxed text-red-400">
              {sku.bannedWords.join("   /   ")}
            </p>
          </Section>
        )}
      </div>

      <footer
        className="flex items-center justify-between px-8 py-4 text-base text-slate-500"
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
      <h3 className="mb-3 text-2xl text-slate-400">{title}</h3>
      {children}
    </section>
  );
}
