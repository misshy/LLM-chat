import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import Database from "better-sqlite3";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const app = express();

const dbPath = process.env.RAG_DB_PATH
  ? path.resolve(process.env.RAG_DB_PATH)
  : path.join(__dirname, "..", "rag.sqlite");

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS rag_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_rag_chunks_source ON rag_chunks(source);
`);

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful assistant. Answer clearly and concisely. If you are unsure, say you are unsure.";

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
  ),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().max(8192).optional(),
  use_rag: z.boolean().optional(),
  top_k: z.number().int().positive().max(10).optional()
});

const RagIngestSchema = z.object({
  source: z.string().min(1),
  text: z.string().min(1)
});

function chunkText(text) {
  const normalized = text.replace(/\r\n/g, "\n");
  const parts = normalized
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const chunks = [];
  const maxLen = Number(process.env.RAG_CHUNK_MAX_CHARS ?? 800);
  const overlap = Number(process.env.RAG_CHUNK_OVERLAP_CHARS ?? 120);

  for (const part of parts) {
    if (part.length <= maxLen) {
      chunks.push(part);
      continue;
    }
    let start = 0;
    while (start < part.length) {
      const end = Math.min(part.length, start + maxLen);
      chunks.push(part.slice(start, end));
      if (end >= part.length) break;
      start = Math.max(0, end - overlap);
    }
  }

  return chunks;
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(a) {
  return Math.sqrt(dot(a, a));
}

function cosineSim(a, b) {
  const denom = norm(a) * norm(b);
  if (denom === 0) return 0;
  return dot(a, b) / denom;
}

async function embedText({ apiKey, baseUrl, input, requestId }) {
  const embeddingBaseUrl = (process.env.EMBEDDING_BASE_URL ?? baseUrl).replace(/\/+$/, "");
  const embeddingModel = process.env.EMBEDDING_MODEL ?? "BAAI/bge-m3";

  const res = await fetch(`${embeddingBaseUrl}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: embeddingModel,
      input
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[${requestId}] embedding upstream error`, res.status, errText);
    throw new Error(errText || `Embedding upstream HTTP ${res.status}`);
  }

  const data = await res.json();
  const vec = data?.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length === 0 || typeof vec[0] !== "number") {
    console.error(`[${requestId}] embedding invalid response`, data);
    throw new Error("Embedding upstream returned an invalid response");
  }

  return vec;
}

app.post("/rag/ingest", async (req, res) => {
  const requestId = crypto.randomUUID();

  try {
    const parsed = RagIngestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: "BAD_REQUEST",
        message: "Invalid request body",
        requestId
      });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY?.trim().replace(/^['"]|['"]$/g, "");
    if (!apiKey) {
      return res.status(500).json({
        code: "MISSING_API_KEY",
        message: "Missing DEEPSEEK_API_KEY",
        requestId
      });
    }

    const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/+$/, "");
    const chunks = chunkText(parsed.data.text);

    const insertStmt = db.prepare(
      "INSERT INTO rag_chunks (source, chunk_index, content, embedding_json, created_at) VALUES (?, ?, ?, ?, ?)"
    );
    const now = Date.now();

    const inserted = db.transaction((rows) => {
      let count = 0;
      for (const row of rows) {
        insertStmt.run(row.source, row.chunk_index, row.content, row.embedding_json, row.created_at);
        count++;
      }
      return count;
    });

    const rows = [];
    for (let i = 0; i < chunks.length; i++) {
      const content = chunks[i];
      const embedding = await embedText({ apiKey, baseUrl, input: content, requestId });
      rows.push({
        source: parsed.data.source,
        chunk_index: i,
        content,
        embedding_json: JSON.stringify(embedding),
        created_at: now
      });
    }

    const count = inserted(rows);
    res.setHeader("x-request-id", requestId);
    return res.json({ requestId, chunks: count });
  } catch (err) {
    console.error(`[${requestId}] /rag/ingest error`, err);
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Internal server error",
      requestId
    });
  }
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

    const apiKey = process.env.DEEPSEEK_API_KEY?.trim().replace(/^['"]|['"]$/g, "");
    if (!apiKey) {
      return res.status(500).json({
        code: "MISSING_API_KEY",
        message: "Missing DEEPSEEK_API_KEY",
        requestId
      });
    }

    const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/+$/, "");
    const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

    const useRag = parsed.data.use_rag === true;
    const topK = parsed.data.top_k ?? Number(process.env.RAG_TOP_K ?? 4);

    let ragContext = "";
    let citations = [];

    if (useRag) {
      const lastUser = [...parsed.data.messages].reverse().find((m) => m.role === "user")?.content;
      if (typeof lastUser === "string" && lastUser.length > 0) {
        const queryEmbedding = await embedText({ apiKey, baseUrl, input: lastUser, requestId });
        const rows = db
          .prepare("SELECT id, source, chunk_index, content, embedding_json FROM rag_chunks")
          .all();

        const scored = rows
          .map((row) => {
            let vec;
            try {
              vec = JSON.parse(row.embedding_json);
            } catch {
              vec = null;
            }
            const score = Array.isArray(vec) ? cosineSim(queryEmbedding, vec) : -1;
            return { row, score };
          })
          .filter((x) => x.score >= 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, topK);

        citations = scored.map((x) => ({
          id: x.row.id,
          source: x.row.source,
          chunkIndex: x.row.chunk_index,
          score: x.score
        }));

        ragContext = scored
          .map(
            (x) =>
              `Source: ${x.row.source}#${x.row.chunk_index}\n${x.row.content}`
          )
          .join("\n\n");
      }
    }

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
        model,
        stream: false,
        temperature: parsed.data.temperature,
        max_tokens: parsed.data.max_tokens,
        messages: [
          {
            role: "system",
            content: process.env.SYSTEM_PROMPT ?? DEFAULT_SYSTEM_PROMPT
          },
          ...(useRag && ragContext.length > 0
            ? [
                {
                  role: "system",
                  content: `Use the following context to answer the user. If the context is insufficient, say you are unsure.\n\n${ragContext}`
                }
              ]
            : []),
          ...parsed.data.messages
        ]
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
    res.setHeader("x-model", model);

    return res.json({ message, requestId, model, latencyMs, citations });
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
