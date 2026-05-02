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
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-500/20";

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm dark:bg-black/70"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 dark:shadow-black/40">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {mode === "create" ? "新增 SKU" : "编辑 SKU"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-md p-1 text-xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-sm">
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

          <Field label="卖点" hint="每行一条">
            <textarea
              value={sellingPointsText}
              onChange={(e) => setSellingPointsText(e.target.value)}
              placeholder={"凉感\n显瘦\n高弹"}
              rows={3}
              className={inputClass}
            />
          </Field>

          <Field label="禁说词" hint="每行一条">
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
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-sm transition hover:bg-blue-700"
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
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline gap-2 font-medium text-slate-700 dark:text-slate-200">
        {label}
        {required && <span className="text-rose-600 dark:text-rose-400">*</span>}
        {hint && (
          <span className="text-xs font-normal text-slate-400 dark:text-slate-500">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
