"use client";

import { useMemo, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ApiChatResponse = {
  message: string;
  requestId: string;
  model?: string;
  latencyMs?: number;
};

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "你好，我是一个最小可用的 Chat Demo。" }
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const pendingIdRef = useRef<string | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  async function onSend() {
    const text = input.trim();
    if (!text || isSending) return;

    setInput("");
    setIsSending(true);
    setLastRequestId(null);

    pendingIdRef.current = crypto.randomUUID();
    const pendingId = pendingIdRef.current;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setMessages((prev) => [...prev, { role: "assistant", content: "…" }]);

    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
      const res = await fetch(`${apiBaseUrl.replace(/\/+$/, "")}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: text }],
          temperature: 0.7,
          max_tokens: 512
        })
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const errJson = (await res.json()) as Partial<ApiChatResponse> & {
            code?: string;
            message?: string;
            requestId?: string;
          };
          
          if (typeof errJson.requestId === "string" && errJson.requestId.length > 0) {
            setLastRequestId(errJson.requestId);
          }
          throw new Error(errJson.message || errJson.code || `HTTP ${res.status}`);
        }

        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const data = (await res.json()) as ApiChatResponse;
      setLastRequestId(data.requestId);
      setMessages((prev) => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        if (lastIdx >= 0 && next[lastIdx]?.role === "assistant" && next[lastIdx]?.content === "…") {
          next[lastIdx] = { role: "assistant", content: data.message };
          return next;
        }
        return [...prev, { role: "assistant", content: data.message }];
      });

      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setMessages((prev) => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        if (lastIdx >= 0 && next[lastIdx]?.role === "assistant" && next[lastIdx]?.content === "…") {
          next[lastIdx] = { role: "assistant", content: `请求失败：${msg}` };
          return next;
        }
        return [...prev, { role: "assistant", content: `请求失败：${msg}` }];
      });
    } finally {
      setIsSending(false);
    }
  }

  function onCopyRequestId() {
    if (!lastRequestId) return;
    navigator.clipboard.writeText(lastRequestId).catch(() => {});
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>LLM Chat Starter</h1>
      <div style={{ color: "#555", marginBottom: 12 }}>
        后端默认：<code>http://localhost:4000</code>
        {lastRequestId ? (
          <>
            ，requestId：<code>{lastRequestId}</code>
            <button
              onClick={onCopyRequestId}
              style={{ marginLeft: 8, padding: "2px 8px", border: "1px solid #ddd", borderRadius: 8 }}
            >
              复制
            </button>
          </>
        ) : null}
      </div>

      <div
        ref={listRef}
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          height: 520,
          overflow: "auto",
          padding: 12,
          background: "#fafafa"
        }}
      >
        {messages.map((m, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              marginBottom: 10
            }}
          >
            <div
              style={{
                maxWidth: "75%",
                whiteSpace: "pre-wrap",
                padding: "10px 12px",
                borderRadius: 12,
                background: m.role === "user" ? "#e7f0ff" : "#fff",
                border: "1px solid #e2e2e2"
              }}
            >
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{m.role}</div>
              <div>{m.content}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            const native = e.nativeEvent as KeyboardEvent;
            const isComposing = "isComposing" in native ? native.isComposing : false;
            if (e.key === "Enter" && !e.shiftKey && !isComposing) {
              e.preventDefault();
              onSend();
              return;
            }
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              onSend();
            }
          }}
          placeholder="输入消息（Ctrl/Cmd + Enter 发送）"
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd"
          }}
        />
        <button
          disabled={!canSend}
          onClick={onSend}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: canSend ? "#111" : "#888",
            color: "#fff",
            cursor: canSend ? "pointer" : "not-allowed"
          }}
        >
          {isSending ? "发送中..." : "发送"}
        </button>
      </div>
    </div>
  );
}
