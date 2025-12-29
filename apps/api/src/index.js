import cors from "cors";
import crypto from "crypto";
import express from "express";
import { z } from "zod";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const ChatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1)
    })
  )
});

app.post("/chat", async (req, res) => {
  const requestId = crypto.randomUUID();

  try {
    const parsed = ChatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: "BAD_REQUEST",
        message: "Invalid request body",
        requestId
      });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        code: "MISSING_API_KEY",
        message: "Missing DEEPSEEK_API_KEY",
        requestId
      });
    }

    const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/+$/, "");

    const controller = new AbortController();
    const timeoutMs = Number(process.env.DEEPSEEK_TIMEOUT_MS ?? 20000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const startedAt = Date.now();
    const upstreamRes = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
        stream: false,
        messages: parsed.data.messages
      }),
      signal: controller.signal
    }).finally(() => {
      clearTimeout(timeout);
    });

    const latencyMs = Date.now() - startedAt;

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text();
      console.error(`[${requestId}] deepseek upstream error`, upstreamRes.status, errText);
      return res.status(502).json({
        code: "UPSTREAM_ERROR",
        message: errText || `Upstream HTTP ${upstreamRes.status}`,
        requestId
      });
    }

    const data = await upstreamRes.json();
    const message = data?.choices?.[0]?.message?.content;
    if (typeof message !== "string" || message.length === 0) {
      console.error(`[${requestId}] deepseek invalid response`, data);
      return res.status(502).json({
        code: "BAD_UPSTREAM_RESPONSE",
        message: "Upstream returned an invalid response",
        requestId
      });
    }

    res.setHeader("x-request-id", requestId);
    res.setHeader("x-latency-ms", String(latencyMs));

    return res.json({ message, requestId });
  } catch (err) {
    console.error(`[${requestId}] /chat error`, err);
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Internal server error",
      requestId
    });
  }
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
