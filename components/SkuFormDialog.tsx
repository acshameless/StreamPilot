"use client";

import { useState } from "react";
import { useSkuStore } from "@/lib/store";
import { arrayToLines, linesToArray } from "@/lib/format";
import { buildOptimizePrompt, streamLlm, extractJson } from "@/lib/llm";
import type { SKU, SkuInput } from "@/types/sku";

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
  const llmConfig = useSkuStore((s) => s.llmConfig);

  const [name, setName] = useState(sku?.name ?? "");
  const [price, setPrice] = useState(sku?.price ?? "");
  const [material, setMaterial] = useState(sku?.material ?? "");
  const [sellingPointsText, setSellingPointsText] = useState(
    sku ? arrayToLines(sku.sellingPoints) : "",
  );
  const [bannedWordsText, setBannedWordsText] = useState(
    sku ? arrayToLines(sku.bannedWords) : "",
  );

  const [imageUrl, setImageUrl] = useState(sku?.imageUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [script, setScript] = useState(sku?.script ?? "");

  const [optimizing, setOptimizing] = useState(false);
  const [optimizePreview, setOptimizePreview] = useState("");
  const [optimizeError, setOptimizeError] = useState<string | null>(null);

  const r2Config = useSkuStore((s) => s.r2Config);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!r2Config.accessKeyId || !r2Config.secretAccessKey || !r2Config.bucket) {
      setUploadError("尚未配置 R2，请先到设置中填写");
      return;
    }
    setUploading(true);
    setUploadError(null);

    const form = new FormData();
    form.append("file", file);
    form.append("accountId", r2Config.accountId);
    form.append("accessKeyId", r2Config.accessKeyId);
    form.append("secretAccessKey", r2Config.secretAccessKey);
    form.append("bucket", r2Config.bucket);
    form.append("publicUrl", r2Config.publicUrl);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "上传失败");
      setImageUrl(data.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  };

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
      imageUrl,
      script: script.trim(),
    };

    if (mode === "create") {
      addSku(input);
    } else if (sku) {
      updateSku(sku.id, input);
    }
    onClose();
  };

  const handleOptimize = async () => {
    if (!llmConfig.apiKey) {
      setOptimizeError("尚未配置 API Key，请先到设置中配置 LLM");
      return;
    }
    setOptimizing(true);
    setOptimizePreview("");
    setOptimizeError(null);

    const input: SkuInput = {
      name,
      price,
      material,
      sellingPoints: linesToArray(sellingPointsText),
      bannedWords: linesToArray(bannedWordsText),
    };

    try {
      const messages = buildOptimizePrompt(input);
      let full = "";
      for await (const chunk of streamLlm(llmConfig, messages)) {
        full += chunk;
        setOptimizePreview(full);
      }
    } catch (err) {
      setOptimizeError(err instanceof Error ? err.message : "优化失败");
    } finally {
      setOptimizing(false);
    }
  };

  const applyOptimize = () => {
    const parsed = extractJson<SkuInput>(optimizePreview);
    if (!parsed) {
      setOptimizeError("无法解析 AI 返回结果");
      return;
    }
    if (parsed.name) setName(parsed.name);
    if (parsed.price) setPrice(parsed.price);
    if (parsed.material !== undefined) setMaterial(parsed.material);
    if (parsed.sellingPoints) setSellingPointsText(arrayToLines(parsed.sellingPoints));
    if (parsed.bannedWords) setBannedWordsText(arrayToLines(parsed.bannedWords));
    if (parsed.script !== undefined) setScript(parsed.script);
    setOptimizePreview("");
    setOptimizeError(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm dark:bg-black/70"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 dark:shadow-black/40 max-h-[90vh] flex flex-col">
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-sm overflow-y-auto">
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

          <div className="flex flex-col gap-1.5">
            <span className="font-medium text-slate-700 dark:text-slate-200">商品图片</span>
            {imageUrl ? (
              <div className="relative inline-block w-fit">
                <img
                  src={imageUrl}
                  alt="商品预览"
                  className="h-32 w-auto rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-xs text-white shadow"
                >
                  ✕
                </button>
              </div>
            ) : (
              <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-slate-200">
                <span>{uploading ? "上传中…" : "📷 选择图片"}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
            {uploadError && (
              <div className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-900/20 dark:text-rose-400">
                {uploadError}
              </div>
            )}
          </div>

          <Field label="口播稿" hint="可在大屏生成或手动编辑">
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="输入口播逐字稿，支持多行..."
              rows={3}
              className={inputClass}
            />
          </Field>

          {optimizePreview && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
              <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                AI 优化预览
              </p>
              <pre className="whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-200">
                {optimizePreview}
              </pre>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOptimizePreview("");
                    setOptimizeError(null);
                  }}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={applyOptimize}
                  className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-blue-700"
                >
                  应用
                </button>
              </div>
            </div>
          )}

          {optimizeError && (
            <p className="text-xs text-rose-600 dark:text-rose-400">
              {optimizeError}
            </p>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleOptimize}
              disabled={optimizing}
              className="rounded-lg border border-emerald-200 bg-white px-4 py-2 font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-900/50 dark:bg-slate-800 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
            >
              {optimizing ? "优化中…" : "✨ AI 优化"}
            </button>
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
