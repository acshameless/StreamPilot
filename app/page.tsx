"use client";

import { useState } from "react";
import Link from "next/link";
import { useSkuStore } from "@/lib/store";
import type { SKU } from "@/types/sku";
import SkuFormDialog from "@/components/SkuFormDialog";

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; sku: SKU }
  | null;

export default function Home() {
  const skus = useSkuStore((s) => s.skus);
  const hasHydrated = useSkuStore((s) => s.hasHydrated);
  const deleteSku = useSkuStore((s) => s.deleteSku);

  const [dialogState, setDialogState] = useState<DialogState>(null);

  const handleDelete = (sku: SKU) => {
    if (typeof window !== "undefined" && window.confirm(`确定删除「${sku.name}」?`)) {
      deleteSku(sku.id);
    }
  };

  if (!hasHydrated) {
    return (
      <main className="flex flex-1 items-center justify-center text-zinc-500">
        加载中...
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-xl font-semibold">直播提词助手</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setDialogState({ mode: "create" })}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + 新增 SKU
          </button>
          <Link
            href="/screen"
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            进入大屏 →
          </Link>
        </div>
      </header>

      <div className="flex-1 px-6 py-6">
        {skus.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-32 text-center">
            <p className="text-lg text-zinc-500">还没有 SKU</p>
            <button
              onClick={() => setDialogState({ mode: "create" })}
              className="rounded-md bg-zinc-900 px-6 py-3 text-base font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              新增第一个商品 →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {skus.map((sku) => (
              <article
                key={sku.id}
                className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="truncate text-lg font-medium">{sku.name}</h3>
                  <span className="shrink-0 text-rose-600 dark:text-rose-400">
                    ¥{sku.price}
                  </span>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  卖点 {sku.sellingPoints.length} · 禁说{" "}
                  {sku.bannedWords.length}
                </p>
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    onClick={() => setDialogState({ mode: "edit", sku })}
                    className="rounded-md border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(sku)}
                    className="rounded-md border border-rose-300 px-3 py-1 text-sm text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950"
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
