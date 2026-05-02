import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { SKU, SkuInput } from "@/types/sku";

interface State {
  skus: SKU[];
  lastIndex: number;
}

interface Actions {
  addSku: (input: SkuInput) => string;
  updateSku: (id: string, input: SkuInput) => void;
  deleteSku: (id: string) => void;
  setLastIndex: (i: number) => void;
  replaceSkus: (skus: SKU[]) => void;
  reorderSkus: (activeId: string, overId: string) => void;
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
      addSku: (input) => {
        const id = newId();
        set((s) => ({
          skus: [
            ...s.skus,
            {
              ...input,
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
            sku.id === id ? { ...sku, ...input, updatedAt: Date.now() } : sku,
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
    }),
    {
      name: "zhibo:state:v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ skus: s.skus, lastIndex: s.lastIndex }),
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
