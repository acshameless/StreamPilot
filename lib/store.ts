import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { SKU, SkuInput } from "@/types/sku";

interface State {
  skus: SKU[];
  lastIndex: number;
  hasHydrated: boolean;
}

interface Actions {
  addSku: (input: SkuInput) => string;
  updateSku: (id: string, input: SkuInput) => void;
  deleteSku: (id: string) => void;
  setLastIndex: (i: number) => void;
  setHasHydrated: (b: boolean) => void;
}

export const useSkuStore = create<State & Actions>()(
  persist(
    (set) => ({
      skus: [],
      lastIndex: 0,
      hasHydrated: false,
      addSku: (input) => {
        const id =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2);
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
      setHasHydrated: (b) => set({ hasHydrated: b }),
    }),
    {
      name: "zhibo:state:v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ skus: s.skus, lastIndex: s.lastIndex }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
