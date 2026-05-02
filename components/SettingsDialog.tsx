"use client";

import { useState } from "react";
import { useSkuStore } from "@/lib/store";
import type { LLMConfig, LLMProvider, R2Config } from "@/lib/store";

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
  const r2Config = useSkuStore((s) => s.r2Config);
  const setR2Config = useSkuStore((s) => s.setR2Config);

  const [tab, setTab] = useState<"llm" | "r2">("llm");

  const [provider, setProvider] = useState<LLMProvider>(llmConfig.provider);
  const [apiKey, setApiKey] = useState(llmConfig.apiKey);
  const [baseUrl, setBaseUrl] = useState(llmConfig.baseUrl);
  const [model, setModel] = useState(llmConfig.model);

  const [accountId, setAccountId] = useState(r2Config.accountId);
  const [accessKeyId, setAccessKeyId] = useState(r2Config.accessKeyId);
  const [secretAccessKey, setSecretAccessKey] = useState(r2Config.secretAccessKey);
  const [bucket, setBucket] = useState(r2Config.bucket);
  const [publicUrl, setPublicUrl] = useState(r2Config.publicUrl);

  const handleProviderChange = (p: LLMProvider) => {
    setProvider(p);
    const preset = PRESETS[p];
    setBaseUrl(preset.baseUrl);
    setModel(preset.model);
  };

  const handleSave = () => {
    setLlmConfig({
      provider,
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
      model: model.trim(),
    });
    setR2Config({
      accountId: accountId.trim(),
      accessKeyId: accessKeyId.trim(),
      secretAccessKey: secretAccessKey.trim(),
      bucket: bucket.trim(),
      publicUrl: publicUrl.trim(),
    });
    onClose();
  };

  const inputCls =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-500/20";

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
            设置
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

        <div className="mb-4 flex gap-2 border-b border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setTab("llm")}
            className={`px-3 py-2 text-sm font-medium transition ${
              tab === "llm"
                ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            LLM 模型
          </button>
          <button
            type="button"
            onClick={() => setTab("r2")}
            className={`px-3 py-2 text-sm font-medium transition ${
              tab === "r2"
                ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            Cloudflare R2
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto text-sm">
          {tab === "llm" ? (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  模型提供商
                </span>
                <select
                  value={provider}
                  onChange={(e) => handleProviderChange(e.target.value as LLMProvider)}
                  className={inputCls}
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
                  className={inputCls}
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
                  className={inputCls}
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
                  className={inputCls}
                />
              </label>
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  Account ID
                </span>
                <input
                  type="text"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="your-cloudflare-account-id"
                  className={inputCls}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  Access Key ID
                </span>
                <input
                  type="password"
                  value={accessKeyId}
                  onChange={(e) => setAccessKeyId(e.target.value)}
                  placeholder="your-r2-access-key-id"
                  className={inputCls}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  Secret Access Key
                </span>
                <input
                  type="password"
                  value={secretAccessKey}
                  onChange={(e) => setSecretAccessKey(e.target.value)}
                  placeholder="your-r2-secret-access-key"
                  className={inputCls}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  Bucket 名称
                </span>
                <input
                  type="text"
                  value={bucket}
                  onChange={(e) => setBucket(e.target.value)}
                  placeholder="your-bucket-name"
                  className={inputCls}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  Public URL 前缀
                </span>
                <input
                  type="text"
                  value={publicUrl}
                  onChange={(e) => setPublicUrl(e.target.value)}
                  placeholder="https://pub-your-id.r2.dev"
                  className={inputCls}
                />
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  用于拼接图片访问地址，如 https://pub-xxx.r2.dev 或自定义域名
                </span>
              </label>
            </>
          )}

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
