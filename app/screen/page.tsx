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
          className="rounded bg-slate-200/80 px-1 py-0.5 text-xs dark:bg-slate-700/50"
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

/* ── Position-aware markdown for karaoke highlighting ── */

type SegType = "plain" | "bold" | "italic" | "code" | "strike";

interface TextSegment {
  type: SegType;
  content: string;
  rawStart: number;
  rawEnd: number;
  markerLen: number;
}

function parseSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3|`(.+?)`|~~(.+?)~~/g;
  let last = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) {
      segments.push({
        type: "plain",
        content: text.slice(last, m.index),
        rawStart: last,
        rawEnd: m.index,
        markerLen: 0,
      });
    }
    const start = m.index;
    const end = regex.lastIndex;
    if (m[1]) {
      segments.push({ type: "bold", content: m[2], rawStart: start, rawEnd: end, markerLen: 2 });
    } else if (m[3]) {
      segments.push({ type: "italic", content: m[4], rawStart: start, rawEnd: end, markerLen: 1 });
    } else if (m[5]) {
      segments.push({ type: "code", content: m[5], rawStart: start, rawEnd: end, markerLen: 1 });
    } else if (m[6]) {
      segments.push({ type: "strike", content: m[6], rawStart: start, rawEnd: end, markerLen: 2 });
    }
    last = regex.lastIndex;
  }
  if (last < text.length) {
    segments.push({
      type: "plain",
      content: text.slice(last),
      rawStart: last,
      rawEnd: text.length,
      markerLen: 0,
    });
  }
  return segments;
}

function wrapSeg(
  type: SegType,
  text: string,
  colorClass: string,
  key: React.Key,
): React.ReactNode {
  switch (type) {
    case "bold":
      return <strong key={key} className={colorClass}>{text}</strong>;
    case "italic":
      return <em key={key} className={colorClass}>{text}</em>;
    case "code":
      return (
        <code key={key} className={`rounded bg-slate-200/80 px-1 py-0.5 text-xs dark:bg-slate-700/50 ${colorClass}`}>
          {text}
        </code>
      );
    case "strike":
      return <del key={key} className={colorClass}>{text}</del>;
    default:
      return <span key={key} className={colorClass}>{text}</span>;
  }
}

function renderHighlightedMarkdown(
  text: string,
  highlightProgress: number,
  readClass: string,
  unreadClass: string,
): React.ReactNode[] {
  const segments = parseSegments(text);
  const result: React.ReactNode[] = [];
  let key = 0;
  const highlightEnd = highlightProgress + 1; // exclusive

  for (const seg of segments) {
    if (seg.rawEnd <= highlightEnd) {
      result.push(wrapSeg(seg.type, seg.content, readClass, key++));
    } else if (seg.rawStart >= highlightEnd) {
      result.push(wrapSeg(seg.type, seg.content, unreadClass, key++));
    } else {
      const offset = highlightEnd - seg.rawStart;
      let readChars: number;
      if (offset <= seg.markerLen) {
        readChars = 0;
      } else if (offset >= seg.rawEnd - seg.rawStart - seg.markerLen) {
        readChars = seg.content.length;
      } else {
        readChars = offset - seg.markerLen;
      }
      readChars = Math.max(0, Math.min(readChars, seg.content.length));
      const unreadChars = seg.content.length - readChars;
      if (readChars > 0) {
        result.push(wrapSeg(seg.type, seg.content.slice(0, readChars), readClass, `${key}-r`));
      }
      if (unreadChars > 0) {
        result.push(wrapSeg(seg.type, seg.content.slice(readChars), unreadClass, `${key}-u`));
      }
      key++;
    }
  }
  return result;
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
  const [lineInterval, setLineInterval] = useState(3000);
  const [autoPlay, setAutoPlay] = useState(false);
  const scriptRef = useRef(script);
  scriptRef.current = script;
  const lineIntervalRef = useRef(lineInterval);
  lineIntervalRef.current = lineInterval;
  const autoPlayRef = useRef(autoPlay);
  autoPlayRef.current = autoPlay;
  const activeLineRef = useRef(activeLine);
  activeLineRef.current = activeLine;

  const [telePos, setTelePos] = useState({ x: 0, y: 0 });
  const [teleSize, setTeleSize] = useState({ w: 320, h: 220 });
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
  const teleContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Marquee continuous scroll refs
  const lastFrameTimeRef = useRef(Date.now());
  const scrollOffsetRef = useRef(0);
  const contentHeightRef = useRef(0);

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
    setIsPlaying(false);
  }, []);

  const startPlay = useCallback(() => {
    stopPlay();
    const inner = scrollContainerRef.current;
    if (!inner) return;
    const lines = scriptRef.current.split("\n").filter((l) => l.trim() !== "");
    if (lines.length === 0) return;

    // 从当前 transform 位置恢复播放
    const match = inner.style.transform.match(/translateY\(([-\d.]+)px\)/);
    const currentOffset = match ? -parseFloat(match[1]) : 0;
    if (currentOffset < 10) {
      // 从开头播放：让第一行从视口下方开始滚动上来
      scrollOffsetRef.current = -Math.round(teleSize.h * 0.6);
    } else {
      scrollOffsetRef.current = currentOffset;
    }
    contentHeightRef.current = 0; // 重新测量

    lastFrameTimeRef.current = Date.now();
    setIsPlaying(true);
  }, [stopPlay]);

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
    if (isPlaying) return;
    const el = lineRefs.current[activeLine];
    if (!el) return;
    const containerH = teleContainerRef.current?.clientHeight ?? teleSize.h;
    const elTop = el.offsetTop;
    const elH = el.clientHeight;
    const target = elTop - containerH / 2 + elH / 2;
    const inner = scrollContainerRef.current;
    if (inner) {
      inner.style.transform = `translateY(${-target}px)`;
    }
    scrollOffsetRef.current = target;
    contentHeightRef.current = 0; // 下次播放前重新测量
  }, [activeLine, isPlaying, teleSize.h]);

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

  // 跑马灯滚动 + Karaoke 高亮
  useEffect(() => {
    if (!isPlaying) return;
    let rafId: number;
    const BASE_HEIGHT = 32;

    const tick = () => {
      const outer = teleContainerRef.current;
      const inner = scrollContainerRef.current;
      if (!outer || !inner) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const now = Date.now();
      const delta = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      // 1. 恒定速度滚动（transform，GPU 加速）
      const speed = BASE_HEIGHT / lineIntervalRef.current;
      scrollOffsetRef.current += delta * speed;

      // 精确测量单份内容高度
      let contentHeight = contentHeightRef.current;
      if (contentHeight === 0) {
        const lastEl = lineRefs.current[scriptLines.length - 1];
        if (lastEl) {
          contentHeight = lastEl.offsetTop + lastEl.clientHeight;
          contentHeightRef.current = contentHeight;
        }
      }
      if (contentHeight > 10 && scrollOffsetRef.current >= contentHeight) {
        scrollOffsetRef.current -= contentHeight;
      }
      inner.style.transform = `translateY(${-scrollOffsetRef.current}px)`;

      // 2. Karaoke 高亮 — 与真实滚动位置严格同步
      const lines = scriptRef.current.split("\n").filter((l) => l.trim() !== "");
      if (lines.length > 0) {
        const readingY = scrollOffsetRef.current + outer.clientHeight / 2;

        // 在双份内容中查找最接近阅读引导线的行
        let closestIdx = 0;
        let minDist = Infinity;
        for (let i = 0; i < lineRefs.current.length; i++) {
          const el = lineRefs.current[i];
          if (!el) continue;
          const center = el.offsetTop + el.clientHeight / 2;
          const dist = Math.abs(center - readingY);
          if (dist < minDist) {
            minDist = dist;
            closestIdx = i;
          }
        }

        const el = lineRefs.current[closestIdx];
        if (el) {
          const lineTop = el.offsetTop;
          const lineH = el.clientHeight;
          const progress = (readingY - lineTop) / lineH;
          const actualIdx = closestIdx % lines.length;
          const lineText = lines[actualIdx] || "";
          const highlightIdx = Math.max(
            0,
            Math.min(lineText.length, Math.floor(progress * lineText.length)),
          );
          setActiveLine(actualIdx);
          setHighlightProgress(highlightIdx);
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    lastFrameTimeRef.current = Date.now();
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, stopPlay]);

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
            className="pointer-events-auto relative overflow-hidden rounded-2xl border border-slate-200/60 bg-slate-100/90 shadow-2xl backdrop-blur-md dark:border-slate-700/40 dark:bg-slate-900/90"
            style={{ width: teleSize.w, height: teleSize.h }}
          >
            {/* 关闭按钮 */}
            <button
              onClick={() => setShowTeleprompter(false)}
              className="absolute right-1 top-1 z-30 flex h-5 w-5 items-center justify-center rounded-full text-xs text-slate-500/60 transition hover:bg-slate-200 hover:text-slate-900 dark:text-white/60 dark:hover:bg-white/20 dark:hover:text-white"
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
              <div className="h-1 w-8 rounded-full bg-slate-400/30 dark:bg-white/30" />
            </div>

            {/* 缩放手柄 */}
            <div
              className="absolute bottom-1 right-1 z-20 cursor-nwse-resize"
              onPointerDown={(e) => onTeleDragDown(e, "resize")}
              onPointerMove={onTeleDragMove}
              onPointerUp={onTeleDragUp}
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4 text-slate-400/40 dark:text-white/40">
                <path
                  d="M6 14L14 6M10 14L14 10M14 14V6"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
              </svg>
            </div>

            {/* 顶部渐变遮罩 */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-slate-100/90 to-transparent dark:from-slate-900/90" />
            {/* 底部渐变遮罩 */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-slate-100/90 to-transparent dark:from-slate-900/90" />
            {/* 阅读引导线 */}
            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 h-px -translate-y-1/2 bg-slate-400/30 dark:bg-white/20" />

            {/* 滚动列表 — 双份渲染 + transform 实现真正无缝循环 */}
            <div
              ref={teleContainerRef}
              className="relative overflow-hidden"
              style={{ height: teleSize.h }}
            >
              <div
                ref={scrollContainerRef}
                className="flex flex-col items-center"
                style={{ willChange: "transform" }}
              >
                {/* 第一份 */}
                {scriptLines.map((line, i) => {
                  const isRead = i < activeLine;
                  const isCurrent = i === activeLine;
                  const lineClass = isPlaying
                    ? isCurrent
                      ? "text-base font-bold text-slate-900 dark:text-white sm:text-lg"
                      : "text-sm text-slate-400/50 dark:text-slate-400/40 sm:text-base"
                    : isCurrent
                      ? "text-lg font-bold text-slate-900 dark:text-white sm:text-xl"
                      : isRead
                        ? "text-sm text-slate-400/40 dark:text-slate-400/30 sm:text-base"
                        : "text-sm text-slate-500/60 dark:text-slate-400/50 sm:text-base";
                  return (
                    <div
                      key={`a-${i}`}
                      ref={(el) => {
                        lineRefs.current[i] = el;
                      }}
                      className={`flex w-full shrink-0 items-center justify-center px-5 py-1.5 text-center ${lineClass}`}
                    >
                      {isCurrent && isPlaying ? (
                        <span>
                          {renderHighlightedMarkdown(
                            line,
                            highlightProgress,
                            "text-blue-600 drop-shadow-[0_0_4px_rgba(37,99,235,0.4)] dark:text-blue-400 dark:drop-shadow-[0_0_5px_rgba(96,165,250,0.7)]",
                            "text-slate-400/50 dark:text-slate-500/30",
                          )}
                        </span>
                      ) : (
                        <span>{parseMarkdown(line)}</span>
                      )}
                    </div>
                  );
                })}
                {/* 第二份（无缝衔接，样式与第一份同步） */}
                {scriptLines.map((line, i) => {
                  const isRead = i < activeLine;
                  const isCurrent = i === activeLine;
                  const lineClass = isPlaying
                    ? isCurrent
                      ? "text-base font-bold text-slate-900 dark:text-white sm:text-lg"
                      : "text-sm text-slate-400/50 dark:text-slate-400/40 sm:text-base"
                    : isCurrent
                      ? "text-lg font-bold text-slate-900 dark:text-white sm:text-xl"
                      : isRead
                        ? "text-sm text-slate-400/40 dark:text-slate-400/30 sm:text-base"
                        : "text-sm text-slate-500/60 dark:text-slate-400/50 sm:text-base";
                  return (
                    <div
                      key={`b-${i}`}
                      ref={(el) => {
                        lineRefs.current[scriptLines.length + i] = el;
                      }}
                      className={`flex w-full shrink-0 items-center justify-center px-5 py-1.5 text-center ${lineClass}`}
                    >
                      {isCurrent && isPlaying ? (
                        <span>
                          {renderHighlightedMarkdown(
                            line,
                            highlightProgress,
                            "text-blue-600 drop-shadow-[0_0_4px_rgba(37,99,235,0.4)] dark:text-blue-400 dark:drop-shadow-[0_0_5px_rgba(96,165,250,0.7)]",
                            "text-slate-400/50 dark:text-slate-500/30",
                          )}
                        </span>
                      ) : (
                        <span>{parseMarkdown(line)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
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
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
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
                速度
              </span>
              <input
                type="range"
                min={500}
                max={30000}
                step={500}
                value={lineInterval}
                onChange={(e) => setLineInterval(Number(e.target.value))}
                className="h-1 w-20 cursor-pointer appearance-none rounded bg-slate-200 accent-blue-600 dark:bg-slate-700 sm:w-28"
              />
              <input
                type="number"
                min={0.5}
                max={60}
                step={0.5}
                value={Number((lineInterval / 1000).toFixed(1))}
                onChange={(e) => {
                  const val = Math.max(0.5, Math.min(60, Number(e.target.value)));
                  setLineInterval(Math.round(val * 1000));
                }}
                className="w-14 rounded border border-slate-300 bg-white px-1 py-0.5 text-center text-xs text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              <span className="text-xs text-slate-500 dark:text-slate-400">s</span>
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
