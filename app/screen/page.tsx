"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useHasHydrated, useSkuStore } from "@/lib/store";
import { buildScriptPrompt, streamLlm } from "@/lib/llm";
import ThemeToggle from "@/components/ThemeToggle";

function parseMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3|`(.+?)`|~~(.+?)~~/g;
  let last = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={m.index}>{m[2]}</strong>);
    else if (m[3]) parts.push(<em key={m.index}>{m[4]}</em>);
    else if (m[5])
      parts.push(
        <code
          key={m.index}
          className="rounded bg-slate-700/50 px-1 py-0.5 text-xs"
        >
          {m[5]}
        </code>,
      );
    else if (m[6]) parts.push(<del key={m.index}>{m[6]}</del>);
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

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
  const updateSku = useSkuStore((s) => s.updateSku);
  const llmConfig = useSkuStore((s) => s.llmConfig);
  const hasHydrated = useHasHydrated();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const gestureRef = useRef<Gesture | null>(null);

  const [script, setScript] = useState("");
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);

  const [isEditingScript, setIsEditingScript] = useState(false);
  const [scriptDraft, setScriptDraft] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeLine, setActiveLine] = useState(0);
  const [lineInterval, setLineInterval] = useState(1500);
  const [autoPlay, setAutoPlay] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scriptRef = useRef(script);
  scriptRef.current = script;
  const lineIntervalRef = useRef(lineInterval);
  lineIntervalRef.current = lineInterval;
  const autoPlayRef = useRef(autoPlay);
  autoPlayRef.current = autoPlay;
  const activeLineRef = useRef(activeLine);
  activeLineRef.current = activeLine;
  const lineStartTimeRef = useRef(Date.now());

  const [telePos, setTelePos] = useState({ x: 0, y: 0 });
  const [teleSize, setTeleSize] = useState({ w: 288, h: 192 });
  const [showTeleprompter, setShowTeleprompter] = useState(true);
  const [highlightProgress, setHighlightProgress] = useState(0);
  const teleDragRef = useRef<{
    type: "drag" | "resize";
    sx: number;
    sy: number;
    px: number;
    py: number;
    pw: number;
    ph: number;
  } | null>(null);

  const index = Math.min(
    Math.max(0, lastIndex),
    Math.max(0, skus.length - 1),
  );

  const scriptLines = script
    .split("\n")
    .filter((l) => l.trim() !== "");

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

  const onTeleDragDown = useCallback(
    (e: React.PointerEvent, type: "drag" | "resize") => {
      e.stopPropagation();
      e.preventDefault();
      teleDragRef.current = {
        type,
        sx: e.clientX,
        sy: e.clientY,
        px: telePos.x,
        py: telePos.y,
        pw: teleSize.w,
        ph: teleSize.h,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [telePos, teleSize],
  );

  const onTeleDragMove = useCallback((e: React.PointerEvent) => {
    const d = teleDragRef.current;
    if (!d) return;
    if (d.type === "drag") {
      setTelePos({
        x: d.px + e.clientX - d.sx,
        y: d.py + e.clientY - d.sy,
      });
    } else {
      setTeleSize({
        w: Math.max(200, d.pw + e.clientX - d.sx),
        h: Math.max(120, d.ph + e.clientY - d.sy),
      });
    }
  }, []);

  const onTeleDragUp = useCallback(() => {
    teleDragRef.current = null;
  }, []);

  const stopPlay = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const advanceLine = useCallback(() => {
    setActiveLine((prev) => {
      const next = prev + 1;
      const lines = scriptRef.current.split("\n").filter((l) => l.trim() !== "");
      return next >= lines.length ? 0 : next;
    });
    lineStartTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      advanceLine();
    }, lineIntervalRef.current);
  }, []);

  const startPlay = useCallback(() => {
    stopPlay();
    setIsPlaying(true);
    const lines = scriptRef.current.split("\n").filter((l) => l.trim() !== "");
    if (lines.length === 0) {
      setIsPlaying(false);
      return;
    }
    setActiveLine((prev) => {
      if (prev >= lines.length - 1) return 0;
      return prev;
    });
    lineStartTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      advanceLine();
    }, lineIntervalRef.current);
  }, [stopPlay, advanceLine]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      stopPlay();
    } else {
      startPlay();
    }
  }, [isPlaying, startPlay, stopPlay]);

  const handleGenerateScript = useCallback(async () => {
    if (!llmConfig.apiKey) {
      setScriptError("尚未配置 API Key");
      return;
    }
    const sku = skus[index];
    if (!sku) return;
    setScriptLoading(true);
    setScript("");
    setScriptError(null);
    setIsEditingScript(false);
    setActiveLine(0);
    stopPlay();

    try {
      const messages = buildScriptPrompt(sku);
      let full = "";
      for await (const chunk of streamLlm(llmConfig, messages)) {
        full += chunk;
        setScript(full);
      }
      updateSku(sku.id, { script: full });
      setActiveLine(0);
    } catch (err) {
      setScriptError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setScriptLoading(false);
    }
  }, [llmConfig, skus, index, updateSku, stopPlay]);

  const beginEditScript = useCallback(() => {
    setScriptDraft(script);
    setIsEditingScript(true);
    stopPlay();
  }, [script, stopPlay]);

  const saveScriptEdit = useCallback(() => {
    const sku = skus[index];
    if (!sku) return;
    const trimmed = scriptDraft.trim();
    setScript(trimmed);
    setActiveLine(0);
    updateSku(sku.id, { script: trimmed });
    setIsEditingScript(false);
  }, [scriptDraft, skus, index, updateSku]);

  const cancelScriptEdit = useCallback(() => {
    setIsEditingScript(false);
    setScriptDraft("");
  }, []);

  useEffect(() => {
    if (!hasHydrated || skus.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        togglePlay();
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
  }, [
    hasHydrated,
    skus.length,
    goNext,
    goPrev,
    router,
    toggleFullscreen,
    togglePlay,
  ]);

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

  useEffect(() => {
    stopPlay();
    setIsEditingScript(false);
    setScriptError(null);
    setActiveLine(0);
    const currentSku = skus[index];
    const hasScript = !!currentSku?.script;
    setScript(currentSku?.script ?? "");
    if (autoPlayRef.current && hasScript) {
      setTimeout(() => {
        startPlay();
      }, 0);
    }
  }, [index, skus, stopPlay, startPlay]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // 逐字高亮
  useEffect(() => {
    if (!isPlaying) return;
    let rafId: number;
    const tick = () => {
      const lines = scriptRef.current.split("\n").filter((l) => l.trim() !== "");
      const currentLine = lines[activeLineRef.current];
      if (!currentLine) return;
      const elapsed = Date.now() - lineStartTimeRef.current;
      const progress = Math.min(1, elapsed / lineIntervalRef.current);
      const idx = Math.floor(progress * currentLine.length);
      setHighlightProgress(idx);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

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

    if (
      Math.abs(dx) > 50 &&
      Math.abs(dx) > Math.abs(dy) * 1.4 &&
      dt < 700
    ) {
      if (dx < 0) goNext();
      else goPrev();
      return;
    }

    if (
      Math.abs(dy) > 50 &&
      Math.abs(dy) > Math.abs(dx) * 1.4 &&
      dt < 700
    ) {
      if (dy < 0) goNext();
      else goPrev();
      return;
    }

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
          <button
            onClick={() => setAutoPlay((p) => !p)}
            title={autoPlay ? "自动播放已开启" : "点击开启自动播放"}
            className={`rounded-lg border px-3 py-1 text-sm font-medium transition ${
              autoPlay
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            🔁
          </button>
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
        className="animate-screen-in relative flex flex-1 cursor-pointer touch-none flex-col gap-3 overflow-hidden px-5 pb-3 sm:flex-row sm:gap-6 sm:px-12 sm:pb-6"
      >
        <div className="flex flex-1 flex-col gap-3 sm:gap-6">
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

        {sku.imageUrl && (
          <div className="flex flex-shrink-0 justify-center sm:w-[35vw] sm:max-w-md">
            <img
              src={sku.imageUrl}
              alt={sku.name}
              className="max-h-[30vh] rounded-xl border border-slate-200 object-contain shadow-lg sm:max-h-full dark:border-slate-700"
            />
          </div>
        )}
      </div>

      {/* 中央歌词提词器 */}
      {scriptLines.length > 0 && !isEditingScript && !scriptError && showTeleprompter && (
        <div
          className="pointer-events-none fixed z-30"
          style={{
            left: `calc(50% + ${telePos.x}px)`,
            top: `calc(50% + ${telePos.y}px)`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div
            className="pointer-events-auto relative overflow-hidden rounded-2xl bg-slate-900/50 shadow-2xl backdrop-blur-md dark:bg-black/40"
            style={{ width: teleSize.w, height: teleSize.h }}
          >
            {/* 关闭按钮 */}
            <button
              onClick={() => setShowTeleprompter(false)}
              className="absolute right-1 top-1 z-30 flex h-5 w-5 items-center justify-center rounded-full text-xs text-white/60 transition hover:bg-white/20 hover:text-white"
              title="关闭提词器"
            >
              ✕
            </button>

            {/* 拖拽手柄 */}
            <div
              className="absolute inset-x-0 top-0 z-20 flex h-5 cursor-move items-center justify-center"
              onPointerDown={(e) => onTeleDragDown(e, "drag")}
              onPointerMove={onTeleDragMove}
              onPointerUp={onTeleDragUp}
            >
              <div className="h-1 w-8 rounded-full bg-white/30" />
            </div>

            {/* 缩放手柄 */}
            <div
              className="absolute bottom-1 right-1 z-20 cursor-nwse-resize"
              onPointerDown={(e) => onTeleDragDown(e, "resize")}
              onPointerMove={onTeleDragMove}
              onPointerUp={onTeleDragUp}
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4 text-white/40">
                <path
                  d="M6 14L14 6M10 14L14 10M14 14V6"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
              </svg>
            </div>

            {/* 顶部渐变遮罩 */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-slate-900/90 to-transparent dark:from-black/90" />
            {/* 底部渐变遮罩 */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-slate-900/90 to-transparent dark:from-black/90" />

            {/* 滚动列表 */}
            <div
              className="flex flex-col items-center transition-transform duration-500 ease-out"
              style={{
                transform: `translateY(${teleSize.h / 2 - (activeLine + 0.5) * 40}px)`,
              }}
            >
              {scriptLines.map((line, i) => {
                const isRead = i < activeLine;
                const isCurrent = i === activeLine;
                return (
                  <div
                    key={i}
                    className={`flex h-10 w-full shrink-0 items-center justify-center px-5 text-center ${
                      isCurrent
                        ? "text-base font-bold sm:text-lg"
                        : isRead
                          ? "text-sm text-slate-400/50 sm:text-base"
                          : "text-sm text-slate-300/30 sm:text-base"
                    }`}
                  >
                    {isCurrent ? (
                      <span className="line-clamp-1">
                        {line.split("").map((char, ci) => (
                          <span
                            key={ci}
                            className={
                              ci <= highlightProgress
                                ? "text-blue-400"
                                : "text-slate-500/30"
                            }
                          >
                            {char}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="line-clamp-1">
                        {parseMarkdown(line)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 底部控制栏 */}
      <div
        className="relative z-20 flex flex-col items-center border-t border-slate-200/60 bg-white/90 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/90 dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)]"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        {isEditingScript ? (
          <div className="flex w-full max-w-3xl flex-col gap-2">
            <textarea
              value={scriptDraft}
              onChange={(e) => setScriptDraft(e.target.value)}
              className="w-full resize-none rounded-lg border border-slate-300 bg-white p-3 text-sm leading-relaxed text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={saveScriptEdit}
                className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-blue-700"
              >
                保存
              </button>
              <button
                onClick={cancelScriptEdit}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                取消
              </button>
            </div>
          </div>
        ) : scriptError ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-rose-600 dark:text-rose-400">
              {scriptError}
            </p>
            <button
              onClick={() => setScriptError(null)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              清除错误
            </button>
          </div>
        ) : scriptLines.length > 0 ? (
          <div className="flex items-center gap-3">
            {!showTeleprompter && (
              <button
                onClick={() => setShowTeleprompter(true)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                title="显示提词器"
              >
                📜 显示
              </button>
            )}
            <button
              onClick={togglePlay}
              className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              title="空格键 播放/暂停"
            >
              {isPlaying ? "⏸ 暂停" : "▶ 播放"}
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                间隔
              </span>
              <input
                type="range"
                min={300}
                max={6000}
                step={100}
                value={lineInterval}
                onChange={(e) => setLineInterval(Number(e.target.value))}
                className="h-1 w-24 cursor-pointer appearance-none rounded bg-slate-200 accent-blue-600 dark:bg-slate-700 sm:w-32"
              />
              <span className="text-xs tabular-nums text-slate-600 dark:text-slate-300">
                {(lineInterval / 1000).toFixed(1)}s
              </span>
            </div>
            <button
              onClick={beginEditScript}
              className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              编辑
            </button>
            <button
              onClick={handleGenerateScript}
              disabled={scriptLoading}
              className="rounded-md border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-900/50 dark:bg-slate-800 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
            >
              {scriptLoading ? "生成中…" : "✨ 重新生成"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              暂无口播逐字稿
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerateScript}
                disabled={scriptLoading}
                className="rounded-md border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-900/50 dark:bg-slate-800 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
              >
                {scriptLoading ? "生成中…" : "✨ AI 生成"}
              </button>
              <button
                onClick={beginEditScript}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                手动输入
              </button>
            </div>
          </div>
        )}
      </div>

      <footer className="hidden flex-shrink-0 items-center justify-between px-8 py-3 text-sm text-slate-500 sm:flex dark:text-slate-400">
        <span>← ↑ 上一个</span>
        <span>空格 播放/暂停 · ESC 退出 · F 全屏</span>
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
