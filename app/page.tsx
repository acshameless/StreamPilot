"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useHasHydrated, useSkuStore } from "@/lib/store";
import {
  downloadJson,
  exportSkusToJson,
  parseSkusFromJson,
} from "@/lib/io";
import type { SKU } from "@/types/sku";
import SkuFormDialog from "@/components/SkuFormDialog";

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; sku: SKU }
  | null;

const btnPrimary =
  "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 active:bg-blue-800";
const btnGhost =
  "rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100";

export default function Home() {
  const skus = useSkuStore((s) => s.skus);
  const deleteSku = useSkuStore((s) => s.deleteSku);
  const replaceSkus = useSkuStore((s) => s.replaceSkus);
  const hasHydrated = useHasHydrated();

  const [dialogState, setDialogState] = useState<DialogState>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDelete = (sku: SKU) => {
    if (window.confirm(`确定删除「${sku.name}」?`)) {
      deleteSku(sku.id);
    }
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
      <main className="flex flex-1 items-center justify-center text-slate-400">
        加载中...
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="inline-block h-6 w-1.5 rounded-full bg-blue-600" />
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            直播提词助手
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handlePickFile} className={btnGhost}>
            导入 JSON
          </button>
          <button onClick={handleExport} className={btnGhost}>
            导出 JSON
          </button>
          <button
            onClick={() => setDialogState({ mode: "create" })}
            className={btnPrimary}
          >
            + 新增 SKU
          </button>
          <Link
            href="/screen"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
          >
            进入大屏 →
          </Link>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </header>

      <div className="flex-1 px-6 py-8">
        {skus.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-6 py-32 text-center">
            <p className="text-2xl font-medium text-slate-700">
              开始添加你的第一个 SKU
            </p>
            <p className="max-w-sm text-sm text-slate-500">
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
                className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 transition hover:bg-slate-50"
              >
                或加载 6 个示例
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {skus.map((sku) => (
              <article
                key={sku.id}
                className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="truncate text-lg font-semibold text-slate-900">
                    {sku.name}
                  </h3>
                  <span className="shrink-0 text-base font-semibold text-blue-600">
                    ¥{sku.price}
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  <span className="font-medium text-emerald-600">
                    {sku.sellingPoints.length}
                  </span>{" "}
                  卖点 ·{" "}
                  <span className="font-medium text-rose-600">
                    {sku.bannedWords.length}
                  </span>{" "}
                  禁说
                </p>
                <div className="mt-auto flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setDialogState({ mode: "edit", sku })}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(sku)}
                    className="rounded-md border border-rose-200 bg-white px-3 py-1 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                  >
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {dialogState && (
        <SkuFormDialog
          mode={dialogState.mode}
          sku={dialogState.mode === "edit" ? dialogState.sku : undefined}
          onClose={() => setDialogState(null)}
        />
      )}
    </main>
  );
}
