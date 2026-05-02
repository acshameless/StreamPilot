export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }
  const provider = String(body.provider ?? "");
  const apiKey = String(body.apiKey ?? "");
  const baseUrl = String(body.baseUrl ?? "");
  const model = String(body.model ?? "");
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const stream = body.stream;

  if (!apiKey || !baseUrl || !model) {
    return Response.json({ error: "缺少 API Key / Base URL / Model" }, { status: 400 });
  }

  // OpenAI or Custom (OpenAI-compatible)
  if (provider === "openai" || provider === "custom") {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: stream !== false,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => " upstream error");
      return Response.json({ error: `上游错误 ${res.status}${text}` }, { status: 502 });
    }
    return new Response(res.body, {
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
    });
  }

  // Anthropic
  if (provider === "anthropic") {
    const res = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        messages: messages.filter((m: { role: string }) => m.role !== "system"),
        system: messages.find((m: { role: string }) => m.role === "system")?.content,
        max_tokens: 4096,
        stream: true,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => " upstream error");
      return Response.json({ error: `上游错误 ${res.status}${text}` }, { status: 502 });
    }
    return new Response(res.body, {
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
    });
  }

  // Gemini
  if (provider === "gemini") {
    const systemMsg = messages.find((m: { role: string }) => m.role === "system")?.content;
    const userMsg = messages.filter((m: { role: string }) => m.role !== "system").pop()?.content ?? "";
    const geminiBody: Record<string, unknown> = {
      contents: [
        {
          role: "user",
          parts: [{ text: userMsg }],
        },
      ],
    };
    if (systemMsg) {
      geminiBody.systemInstruction = { parts: [{ text: systemMsg }] };
    }
    const res = await fetch(
      `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => " upstream error");
      return Response.json({ error: `上游错误 ${res.status}${text}` }, { status: 502 });
    }
    const data = await res.json();
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return Response.json({ text });
  }

  return Response.json({ error: "未知提供商" }, { status: 400 });
}
