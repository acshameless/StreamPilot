"use client";

import { useState } from "react";
import { useSkuStore } from "@/lib/store";
import type { LLMConfig, LLMProvider } from "@/lib/store";

interface Props {
  onClose: () => void;
}

const PRESETS: Record<
  LLMProvider,
  { baseUrl: string; model: string; label: string }
> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    label: "OpenAI",
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-3-5-sonnet-20241022",
    label: "Anthropic",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-1.5-flash",
    label: "Gemini",
  },
  custom: {
    baseUrl: "",
    model: "",
    label: "自定义 (OpenAI 兼容)",
  },
};

export default function SettingsDialog({ onClose }: Props) {
  const llmConfig = useSkuStore((s) => s.llmConfig);
  const setLlmConfig = useSkuStore((s) => s.setLlmConfig);

  const [provider, setProvider] = useState<LLMProvider>(llmConfig.provider);
  const [apiKey, setApiKey] = useState(llmConfig.apiKey);
  const [baseUrl, setBaseUrl] = useState(llmConfig.baseUrl);
  const [model, setModel] = useState(llmConfig.model);

  const handleProviderChange = (p: LLMProvider) => {
    setProvider(p);
    const preset = PRESETS[p];
    setBaseUrl(preset.baseUrl);
    setModel(preset.model);
  };

  const handleSave = () => {
    setLlmConfig({ provider, apiKey: apiKey.trim(), baseUrl: baseUrl.trim(), model: model.trim() });
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
            LLM 设置 (BYOK)
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

        <div className="flex flex-col gap-4 text-sm">
          <label className="flex flex-col gap-1.5">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              模型提供商
            </span>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as LLMProvider)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
            >
              {(Object.keys(PRESETS) as LLMProvider[]).map((k) => (
                <option key={k} value={k}>
                  {PRESETS[k].label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              API Key
            </span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                provider === "gemini"
                  ? "Gemini API Key"
                  : provider === "anthropic"
                    ? "sk-ant-api03-..."
                    : "sk-..."
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Base URL
            </span>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              模型名称
            </span>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gpt-4o-mini"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
            />
          </label>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-sm transition hover:bg-blue-700"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
