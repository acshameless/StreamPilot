"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useHasHydrated, useSkuStore } from "@/lib/store";
import {
  downloadJson,
  exportSkusToJson,
  parseSkusFromJson,
} from "@/lib/io";
import type { SKU } from "@/types/sku";
import SkuFormDialog from "@/components/SkuFormDialog";
import SettingsDialog from "@/components/SettingsDialog";
import AiGenerateDialog from "@/components/AiGenerateDialog";
import ThemeToggle from "@/components/ThemeToggle";

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; sku: SKU }
  | null;

const btnPrimary =
  "shrink-0 snap-start rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 active:bg-blue-800";
const btnGhost =
  "shrink-0 snap-start rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";
const btnDark =
  "shrink-0 snap-start rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white";

const cardClass =
  "group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/60";

interface CardActions {
  onEdit: () => void;
  onDelete: () => void;
}

function SkuCardBody({
  sku,
  index,
  onEdit,
  onDelete,
}: { sku: SKU; index: number } & CardActions) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            #{index + 1}
          </span>
          <h3 className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">
            {sku.name}
          </h3>
        </div>
        <span className="shrink-0 text-base font-semibold text-blue-600 dark:text-blue-400">
          ¥{sku.price}
        </span>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        <span className="font-medium text-emerald-600 dark:text-emerald-400">
          {sku.sellingPoints.length}
        </span>{" "}
        卖点 ·{" "}
        <span className="font-medium text-rose-600 dark:text-rose-400">
          {sku.bannedWords.length}
        </span>{" "}
        禁说
      </p>
      <div className="mt-auto flex justify-end gap-2 pt-2">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onEdit}
          className="rounded-md border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          编辑
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onDelete}
          className="rounded-md border border-rose-200 bg-white px-3 py-1 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/50 dark:bg-slate-800 dark:text-rose-400 dark:hover:bg-rose-900/30"
        >
          删除
        </button>
      </div>
    </>
  );
}

function SortableSkuCard({
  sku,
  index,
  onEdit,
  onDelete,
}: { sku: SKU; index: number } & CardActions) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sku.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
    cursor: isDragging ? "grabbing" : "grab",
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`${cardClass} touch-none`}
    >
      <SkuCardBody
        sku={sku}
        index={index}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </article>
  );
}

export default function Home() {
  const skus = useSkuStore((s) => s.skus);
  const deleteSku = useSkuStore((s) => s.deleteSku);
  const replaceSkus = useSkuStore((s) => s.replaceSkus);
  const reorderSkus = useSkuStore((s) => s.reorderSkus);
  const hasHydrated = useHasHydrated();

  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [query, setQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const trimmedQuery = query.trim().toLowerCase();
  const visibleSkus = useMemo(() => {
    if (!trimmedQuery) return skus;
    return skus.filter((sku) => {
      if (sku.name.toLowerCase().includes(trimmedQuery)) return true;
      return sku.sellingPoints.some((pt) =>
        pt.toLowerCase().includes(trimmedQuery),
      );
    });
  }, [skus, trimmedQuery]);

  const indexOf = useMemo(() => {
    const m = new Map<string, number>();
    skus.forEach((s, i) => m.set(s.id, i));
    return m;
  }, [skus]);

  const isFiltering = trimmedQuery.length > 0;

  const handleDelete = (sku: SKU) => {
    if (window.confirm(`确定删除「${sku.name}」?`)) {
      deleteSku(sku.id);
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    reorderSkus(String(active.id), String(over.id));
  };

  const handleExport = () => {
    if (skus.length === 0) {
      alert("当前没有 SKU 可导出");
      return;
    }
    const json = exportSkusToJson(skus);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJson(`zhibo-skus-${stamp}.json`, json);
  };

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    let text: string;
    try {
      text = await file.text();
    } catch {
      alert("读取文件失败");
      return;
    }

    const result = parseSkusFromJson(text);
    if (!result.ok) {
      alert(`导入失败：${result.error}`);
      return;
    }
    if (
      skus.length > 0 &&
      !window.confirm(
        `导入会替换当前 ${skus.length} 个 SKU 为 ${result.skus.length} 个，继续？`,
      )
    ) {
      return;
    }
    replaceSkus(result.skus);
    alert(`导入成功：共 ${result.skus.length} 个 SKU`);
  };

  const handleLoadSamples = async () => {
    if (
      skus.length > 0 &&
      !window.confirm(`加载示例会替换当前 ${skus.length} 个 SKU，继续？`)
    ) {
      return;
    }
    try {
      const res = await fetch("/samples.json");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const result = parseSkusFromJson(text);
      if (!result.ok) {
        alert(`加载示例失败：${result.error}`);
        return;
      }
      replaceSkus(result.skus);
    } catch (e) {
      alert(`加载示例失败：${e instanceof Error ? e.message : "未知错误"}`);
    }
  };

  if (!hasHydrated) {
    return (
      <main className="flex flex-1 items-center justify-center text-slate-400 dark:text-slate-500">
        加载中...
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2 sm:justify-start sm:gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-6 w-1.5 rounded-full bg-blue-600" />
            <h1 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl dark:text-slate-100">
              直播提词助手
            </h1>
          </div>
          <ThemeToggle />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 snap-x sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 sm:snap-none">
          <button onClick={handlePickFile} className={btnGhost}>
            导入<span className="hidden sm:inline"> JSON</span>
          </button>
          <button onClick={handleExport} className={btnGhost}>
            导出<span className="hidden sm:inline"> JSON</span>
          </button>
          <button
            onClick={() => setDialogState({ mode: "create" })}
            className={btnPrimary}
          >
            + 新增<span className="hidden sm:inline"> SKU</span>
          </button>
          <button
            onClick={() => setShowGenerate(true)}
            className={btnGhost}
          >
            🪄<span className="hidden sm:inline"> AI 生成</span>
          </button>
          <Link href="/screen" className={btnDark}>
            进入大屏 →
          </Link>
          <button
            onClick={() => setShowSettings(true)}
            className={btnGhost}
            title="LLM 设置"
          >
            ⚙<span className="hidden sm:inline"> 设置</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </header>

      <div className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {skus.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-6 py-32 text-center">
            <p className="text-2xl font-medium text-slate-700 dark:text-slate-200">
              开始添加你的第一个 SKU
            </p>
            <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
              所有数据保存在你的浏览器里，不上传任何服务器
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setDialogState({ mode: "create" })}
                className="rounded-lg bg-blue-600 px-6 py-3 text-base font-medium text-white shadow-sm transition hover:bg-blue-700"
              >
                + 新增 SKU
              </button>
              <button
                onClick={handleLoadSamples}
                className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                或加载 6 个示例
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="relative flex-1 sm:max-w-md">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  🔍
                </span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索 SKU 名称或卖点..."
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
                />
              </div>
              <span className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
                {trimmedQuery
                  ? `${visibleSkus.length} / ${skus.length}`
                  : `共 ${skus.length} 个`}
              </span>
            </div>
            {visibleSkus.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
                <p className="text-lg font-medium text-slate-600 dark:text-slate-300">
                  没有匹配「{query.trim()}」的 SKU
                </p>
                <button
                  onClick={() => setQuery("")}
                  className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  清除搜索
                </button>
              </div>
            ) : isFiltering ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleSkus.map((sku) => (
                  <article key={sku.id} className={cardClass}>
                    <SkuCardBody
                      sku={sku}
                      index={indexOf.get(sku.id) ?? 0}
                      onEdit={() => setDialogState({ mode: "edit", sku })}
                      onDelete={() => handleDelete(sku)}
                    />
                  </article>
                ))}
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={skus.map((s) => s.id)}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {skus.map((sku, i) => (
                      <SortableSkuCard
                        key={sku.id}
                        sku={sku}
                        index={i}
                        onEdit={() => setDialogState({ mode: "edit", sku })}
                        onDelete={() => handleDelete(sku)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </>
        )}
      </div>

      {dialogState && (
        <SkuFormDialog
          mode={dialogState.mode}
          sku={dialogState.mode === "edit" ? dialogState.sku : undefined}
          onClose={() => setDialogState(null)}
        />
      )}
      {showSettings && (
        <SettingsDialog onClose={() => setShowSettings(false)} />
      )}
      {showGenerate && (
        <AiGenerateDialog onClose={() => setShowGenerate(false)} />
      )}
    </main>
  );
}
