"use client";

import { useState } from "react";
import { useSkuStore } from "@/lib/store";
import { buildGeneratePrompt, streamLlm, extractJson } from "@/lib/llm";
import type { SkuInput } from "@/types/sku";

interface Props {
  onClose: () => void;
}

export default function AiGenerateDialog({ onClose }: Props) {
  const addSku = useSkuStore((s) => s.addSku);
  const llmConfig = useSkuStore((s) => s.llmConfig);

  const [description, setDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<SkuInput | null>(null);

  const handleGenerate = async () => {
    if (!description.trim()) return;
    if (!llmConfig.apiKey) {
      setError("尚未配置 API Key，请先到设置中配置 LLM");
      return;
    }
    setGenerating(true);
    setPreview("");
    setError(null);
    setParsed(null);

    try {
      const messages = buildGeneratePrompt(description.trim());
      let full = "";
      for await (const chunk of streamLlm(llmConfig, messages)) {
        full += chunk;
        setPreview(full);
      }
      const result = extractJson<SkuInput>(full);
      if (result) {
        setParsed(result);
      } else {
        setError("AI 返回格式不正确，请手动复制粘贴");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = () => {
    if (!parsed) return;
    addSku({ ...parsed, imageUrl: parsed.imageUrl ?? "" });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm dark:bg-black/70"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-lg flex-col rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 dark:shadow-black/40 max-h-[90vh]">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            AI 生成 SKU
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

        <div className="flex flex-col gap-4 text-sm overflow-y-auto">
          <label className="flex flex-col gap-1.5">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              商品描述
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如：一款夏季男士短袖T恤，纯棉材质，透气吸汗，适合运动穿着，价格99元"
              rows={4}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
            />
          </label>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !description.trim()}
            className="self-start rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          >
            {generating ? "生成中…" : "🪄 生成 SKU"}
          </button>

          {preview && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
              <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                AI 生成结果
              </p>
              <pre className="whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-200">
                {preview}
              </pre>
            </div>
          )}

          {parsed && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/40 dark:bg-emerald-900/20">
              <p className="mb-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                已解析，确认后保存
              </p>
              <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-200">
                <li><span className="font-medium">名称：</span> {parsed.name}</li>
                <li><span className="font-medium">价格：</span> {parsed.price}</li>
                <li><span className="font-medium">材质：</span> {parsed.material || "—"}</li>
                <li><span className="font-medium">卖点：</span> {parsed.sellingPoints.join(" / ")}</li>
                <li><span className="font-medium">禁说：</span> {parsed.bannedWords.join(" / ") || "—"}</li>
              </ul>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPreview("");
                    setParsed(null);
                    setError(null);
                  }}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  重新生成
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-blue-700"
                >
                  保存到列表
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
