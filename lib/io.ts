import type { SKU } from "@/types/sku";

interface ExportShape {
  version: 1;
  exportedAt: string;
  skus: SKU[];
}

export function exportSkusToJson(skus: SKU[]): string {
  const data: ExportShape = {
    version: 1,
    exportedAt: new Date().toISOString(),
    skus,
  };
  return JSON.stringify(data, null, 2);
}

export function downloadJson(filename: string, content: string): void {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export type ImportResult =
  | { ok: true; skus: SKU[] }
  | { ok: false; error: string };

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function asNumber(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function parseSkusFromJson(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return {
      ok: false,
      error: `JSON 解析失败: ${e instanceof Error ? e.message : "未知错误"}`,
    };
  }

  let arr: unknown;
  if (Array.isArray(parsed)) {
    arr = parsed;
  } else if (parsed && typeof parsed === "object" && "skus" in parsed) {
    arr = (parsed as { skus: unknown }).skus;
  } else {
    return { ok: false, error: "格式错误：根需是数组或包含 skus 字段的对象" };
  }

  if (!Array.isArray(arr)) {
    return { ok: false, error: "格式错误：skus 必须是数组" };
  }

  const skus: SKU[] = [];
  for (const [i, item] of arr.entries()) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: `第 ${i + 1} 项不是对象` };
    }
    const raw = item as Record<string, unknown>;
    const name = asString(raw.name).trim();
    const price = asString(raw.price).trim();
    if (!name || !price) {
      return {
        ok: false,
        error: `第 ${i + 1} 项缺少 name 或 price`,
      };
    }
    const now = Date.now();
    skus.push({
      id: asString(raw.id) || newId(),
      name,
      price,
      material: asString(raw.material),
      sellingPoints: asStringArray(raw.sellingPoints),
      bannedWords: asStringArray(raw.bannedWords),
      imageUrl: asString(raw.imageUrl),
      script: asString(raw.script),
      createdAt: asNumber(raw.createdAt, now),
      updatedAt: asNumber(raw.updatedAt, now),
    });
  }

  return { ok: true, skus };
}
