import type { LLMConfig } from "./store";
import type { SKU, SkuInput } from "@/types/sku";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function* streamLlm(
  config: LLMConfig,
  messages: ChatMessage[],
): AsyncGenerator<string, void, unknown> {
  if (!config.apiKey) {
    throw new Error("尚未配置 API Key，请先到设置中配置 LLM");
  }

  const res = await fetch("/api/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: config.provider,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      messages,
      stream: true,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "请求失败" }));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }

  // Gemini returns JSON directly (non-streaming)
  if (config.provider === "gemini") {
    const data = await res.json();
    yield data.text ?? "";
    return;
  }

  // OpenAI / Anthropic / Custom → SSE streaming
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    let eventType = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim();
        continue;
      }
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data);
        // Anthropic filter
        if (config.provider === "anthropic" && eventType !== "content_block_delta")
          continue;
        const chunk =
          json.choices?.[0]?.delta?.content ||
          json.delta?.text ||
          "";
        if (chunk) yield chunk;
      } catch {
        // ignore malformed SSE lines
      }
    }
  }
}

// ── Prompt builders ──

export function buildOptimizePrompt(sku: SkuInput): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        '你是一位直播带货文案专家。请根据用户提供的商品信息，优化润色后返回 JSON 格式。要求：1. 商品名称更吸引人但保持真实；2. 卖点每条 15 字以内，突出用户利益；3. 保留所有禁说词；4. 生成一段 100 字左右的口播逐字稿，填入 script 字段；5. 只返回 JSON，不要 markdown 代码块标记。返回字段：name, price, material, sellingPoints, bannedWords, script。',
    },
    {
      role: "user",
      content: JSON.stringify({
        name: sku.name,
        price: sku.price,
        material: sku.material,
        sellingPoints: sku.sellingPoints,
        bannedWords: sku.bannedWords,
        script: sku.script ?? "",
      }),
    },
  ];
}

export function buildGeneratePrompt(description: string): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        '你是一位直播选品专家。请根据用户描述生成一个 SKU 对象，返回严格 JSON 格式：{ "name": string, "price": string, "material": string, "sellingPoints": string[], "bannedWords": string[] }。卖点 3-5 条，每条 15 字以内。只返回 JSON，不要 markdown 代码块标记。',
    },
    {
      role: "user",
      content: description,
    },
  ];
}

export function buildScriptPrompt(sku: SKU): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "你是一位直播带货金牌主播。请为商品写一段 200 字左右的口播逐字稿，要求：自然口语化、包含商品名和价格、突出核心卖点、绝对不能出现禁说词。只返回口播稿正文，不要额外说明。",
    },
    {
      role: "user",
      content: JSON.stringify({
        name: sku.name,
        price: sku.price,
        material: sku.material,
        sellingPoints: sku.sellingPoints,
        bannedWords: sku.bannedWords,
      }),
    },
  ];
}

// ── Helpers ──

export function extractJson<T>(text: string): T | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}
