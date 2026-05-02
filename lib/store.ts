import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { SKU, SkuInput } from "@/types/sku";
import { STORAGE_KEY, type ThemePref } from "./theme";

export type { ThemePref } from "./theme";

export type LLMProvider = "openai" | "anthropic" | "gemini" | "custom";

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

const DEFAULT_LLM: LLMConfig = {
  provider: "openai",
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
};

const DEFAULT_R2: R2Config = {
  accountId: "",
  accessKeyId: "",
  secretAccessKey: "",
  bucket: "",
  publicUrl: "",
};

interface State {
  skus: SKU[];
  lastIndex: number;
  theme: ThemePref;
  llmConfig: LLMConfig;
  r2Config: R2Config;
}

interface Actions {
  addSku: (input: SkuInput) => string;
  updateSku: (id: string, input: SkuInput) => void;
  deleteSku: (id: string) => void;
  setLastIndex: (i: number) => void;
  replaceSkus: (skus: SKU[]) => void;
  reorderSkus: (activeId: string, overId: string) => void;
  setTheme: (theme: ThemePref) => void;
  setLlmConfig: (cfg: LLMConfig) => void;
  setR2Config: (cfg: R2Config) => void;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const useSkuStore = create<State & Actions>()(
  persist(
    (set) => ({
      skus: [],
      lastIndex: 0,
      theme: "system" as ThemePref,
      llmConfig: DEFAULT_LLM,
      r2Config: DEFAULT_R2,
      addSku: (input) => {
        const id = newId();
        set((s) => ({
          skus: [
            ...s.skus,
            {
              ...input,
              imageUrl: input.imageUrl ?? "",
              id,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ],
        }));
        return id;
      },
      updateSku: (id, input) =>
        set((s) => ({
          skus: s.skus.map((sku) =>
            sku.id === id
              ? {
                  ...sku,
                  ...input,
                  imageUrl: input.imageUrl ?? sku.imageUrl,
                  updatedAt: Date.now(),
                }
              : sku,
          ),
        })),
      deleteSku: (id) =>
        set((s) => {
          const next = s.skus.filter((sku) => sku.id !== id);
          return {
            skus: next,
            lastIndex: Math.min(s.lastIndex, Math.max(0, next.length - 1)),
          };
        }),
      setLastIndex: (i) => set({ lastIndex: i }),
      replaceSkus: (skus) => set({ skus, lastIndex: 0 }),
      reorderSkus: (activeId, overId) =>
        set((s) => {
          if (activeId === overId) return {};
          const oldIndex = s.skus.findIndex((sku) => sku.id === activeId);
          const newIndex = s.skus.findIndex((sku) => sku.id === overId);
          if (oldIndex === -1 || newIndex === -1) return {};
          const next = [...s.skus];
          const [moved] = next.splice(oldIndex, 1);
          next.splice(newIndex, 0, moved);
          return { skus: next };
        }),
      setTheme: (theme) => set({ theme }),
      setLlmConfig: (llmConfig) => set({ llmConfig }),
      setR2Config: (r2Config) => set({ r2Config }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        skus: s.skus,
        lastIndex: s.lastIndex,
        theme: s.theme,
        llmConfig: s.llmConfig,
        r2Config: s.r2Config,
      }),
    },
  ),
);

export function useHasHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsub = useSkuStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    if (useSkuStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return () => {
      unsub();
    };
  }, []);

  return hydrated;
}
