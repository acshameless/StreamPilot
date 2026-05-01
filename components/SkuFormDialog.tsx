"use client";

import { useState } from "react";
import { useSkuStore } from "@/lib/store";
import { arrayToLines, linesToArray } from "@/lib/format";
import type { SKU } from "@/types/sku";

interface Props {
  mode: "create" | "edit";
  sku?: SKU;
  onClose: () => void;
}

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950";

export default function SkuFormDialog({ mode, sku, onClose }: Props) {
  const addSku = useSkuStore((s) => s.addSku);
  const updateSku = useSkuStore((s) => s.updateSku);

  const [name, setName] = useState(sku?.name ?? "");
  const [price, setPrice] = useState(sku?.price ?? "");
  const [material, setMaterial] = useState(sku?.material ?? "");
  const [sellingPointsText, setSellingPointsText] = useState(
    sku ? arrayToLines(sku.sellingPoints) : "",
  );
  const [bannedWordsText, setBannedWordsText] = useState(
    sku ? arrayToLines(sku.bannedWords) : "",
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedPrice = price.trim();
    if (!trimmedName || !trimmedPrice) return;

    const input = {
      name: trimmedName,
      price: trimmedPrice,
      material: material.trim(),
      sellingPoints: linesToArray(sellingPointsText),
      bannedWords: linesToArray(bannedWordsText),
    };

    if (mode === "create") {
      addSku(input);
    } else if (sku) {
      updateSku(sku.id, input);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {mode === "create" ? "新增 SKU" : "编辑 SKU"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="text-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-sm">
          <Field label="商品名称" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              autoFocus
              required
            />
          </Field>

          <Field label="价格" required>
            <input
              type="text"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="129"
              className={inputClass}
              required
            />
          </Field>

          <Field label="材质">
            <textarea
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="65% 棉  35% 聚酯纤维"
              rows={2}
              className={inputClass}
            />
          </Field>

          <Field label="卖点（每行一条）">
            <textarea
              value={sellingPointsText}
              onChange={(e) => setSellingPointsText(e.target.value)}
              placeholder={"凉感\n显瘦\n高弹"}
              rows={3}
              className={inputClass}
            />
          </Field>

          <Field label="禁说词（每行一条）">
            <textarea
              value={bannedWordsText}
              onChange={(e) => setBannedWordsText(e.target.value)}
              placeholder={"纯棉\n真丝\n100%"}
              rows={3}
              className={inputClass}
            />
          </Field>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 px-4 py-2 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {mode === "create" ? "新增" : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-medium">
        {label}
        {required && <span className="text-rose-600"> *</span>}
      </span>
      {children}
    </label>
  );
}
