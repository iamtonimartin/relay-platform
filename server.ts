import 'dotenv/config'; // Must be first — loads .env before any other imports
import express from "express";
import { createServer as createViteServer } from "vite";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import supabase from "./server/supabase.ts";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import PDFParser from "pdf2json";
import mammoth from "mammoth";
import * as cheerio from "cheerio";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure multer to store uploads in memory (files are processed then discarded)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/csv",
      "application/csv",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(txt|csv|pdf|docx)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Please upload PDF, DOCX, TXT or CSV files."));
    }
  },
});

// Separate multer instance for avatar images — saved to disk so they can be served statically
const avatarsDir = path.join(__dirname, "public", "avatars");
fs.mkdirSync(avatarsDir, { recursive: true }); // ensure directory exists on startup

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, avatarsDir),
    filename: (req, _file, cb) => {
      // Name the file by assistant ID with original extension (e.g. abc123.png)
      // Any previously uploaded avatar with the same ID is overwritten automatically
      const ext = path.extname((_file as Express.Multer.File).originalname).toLowerCase() || ".jpg";
      cb(null, `${(req.params as { id: string }).id}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB limit for images
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are accepted for avatars."));
    }
  },
});

// Extract plain text from an uploaded file buffer
async function extractTextFromFile(buffer: Buffer, mimetype: string, originalname: string): Promise<string> {
  const ext = path.extname(originalname).toLowerCase();

  if (mimetype === "application/pdf" || ext === ".pdf") {
    // pdf2json is a pure Node.js PDF parser — no worker threads or browser APIs needed
    return new Promise<string>((resolve, reject) => {
      const parser = new PDFParser();
      parser.on("pdfParser_dataError", (err: any) => reject(new Error(err?.parserError || "PDF parse error")));
      parser.on("pdfParser_dataReady", (data: any) => {
        const text = (data.Pages ?? [])
          .map((page: any) =>
            (page.Texts ?? [])
              .map((t: any) => decodeURIComponent((t.R ?? []).map((r: any) => r.T ?? "").join("")))
              .join(" ")
          )
          .join("\n\n");
        resolve(text);
      });
      parser.parseBuffer(buffer);
    });
  }

  if (
    mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === ".docx"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // Plain text and CSV — decode buffer directly
  return buffer.toString("utf-8");
}

// Generates a vector embedding for the given text using OpenAI's text-embedding-3-small model.
// Returns null silently if no OpenAI API key is configured or if the call fails,
// so all callers can degrade gracefully (KB entry is still saved, just without a vector).
async function embedText(text: string): Promise<number[] | null> {
  const { data: keyRow } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "openai_api_key")
    .single();
  const apiKey = keyRow?.value;
  if (!apiKey) return null;

  try {
    const client = new OpenAI({ apiKey });
    const res = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: text.slice(0, 30000), // ~7500 tokens — well within the 8191-token model limit
    });
    return res.data[0].embedding;
  } catch (err) {
    console.warn("Embedding generation failed:", err);
    return null;
  }
}

// Typed error thrown inside getAiResponse so callers can forward the right HTTP status
class ChatError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Phrases that indicate a user wants to speak to a human agent
const HANDOFF_TRIGGERS = [
  "speak to a human", "speak to human", "talk to a human", "talk to human",
  "talk to a person", "talk to person", "speak to a person", "speak to person",
  "want a human", "want human", "need a human", "need human",
  "human agent", "real person", "real human",
  "speak to someone", "talk to someone", "live agent", "live support",
  "speak to an agent", "talk to an agent", "speak to agent", "talk to agent",
  "get me a human", "get me a person", "get me an agent",
  "transfer me", "escalate this", "connect me to a human", "connect me to someone",
  "i want help", "i need help from a person",
];

function detectHandoff(message: string, customTriggers?: string[]): boolean {
  const lower = message.toLowerCase();
  // Use per-assistant triggers if configured; otherwise fall back to the global defaults
  const triggers = (customTriggers && customTriggers.length > 0) ? customTriggers : HANDOFF_TRIGGERS;
  return triggers.some(t => lower.includes(t.toLowerCase()));
}

/**
 * Returns true if the current time (in the assistant's timezone) falls within
 * the configured active hours. If no hours are configured, the assistant is
 * always considered active.
 *
 * active_hours_start / active_hours_end are stored as "HH:MM" strings (24-hour).
 */
function isWithinActiveHours(
  activeHoursStart: string | null,
  activeHoursEnd: string | null,
  timezone: string
): boolean {
  // No hours configured — always active
  if (!activeHoursStart || !activeHoursEnd) return true;

  const now = new Date();

  // Get current HH:MM in the assistant's timezone
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone || "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = parts.find(p => p.type === "hour")?.value ?? "00";
  const minute = parts.find(p => p.type === "minute")?.value ?? "00";
  const currentMinutes = parseInt(hour) * 60 + parseInt(minute);

  const [startH, startM] = activeHoursStart.split(":").map(Number);
  const [endH, endM] = activeHoursEnd.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // Handle overnight spans (e.g. 22:00 – 06:00)
  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

/**
 * Sends an email notification when a conversation is handed off to a human agent.
 * Reads SMTP config and the notification email from platform_settings.
 * Silently logs and swallows errors so a misconfigured SMTP never breaks chat.
 */
async function sendHandoffEmail(opts: {
  assistantName: string;
  conversationId: string;
  userMessage: string;
}): Promise<void> {
  try {
    const { data: rows } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", [
        "notification_email",
        "smtp_host",
        "smtp_port",
        "smtp_user",
        "smtp_pass",
        "smtp_from",
      ]);

    if (!rows || rows.length === 0) return;

    const cfg: Record<string, string> = {};
    rows.forEach(r => { cfg[r.key] = r.value; });

    // Require at minimum: a destination address and an SMTP host
    if (!cfg.notification_email || !cfg.smtp_host) return;

    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host,
      port: parseInt(cfg.smtp_port || "587"),
      secure: parseInt(cfg.smtp_port || "587") === 465,
      auth: cfg.smtp_user
        ? { user: cfg.smtp_user, pass: cfg.smtp_pass || "" }
        : undefined,
    });

    const inboxUrl = `http://localhost:3000/inbox`;

    await transporter.sendMail({
      from: cfg.smtp_from || cfg.smtp_user || "relay@yourplatform.com",
      to: cfg.notification_email,
      subject: `Handoff requested - ${opts.assistantName}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
          <h2 style="color:#0f172a;">A user has requested a human agent</h2>
          <p style="color:#475569;"><strong>Assistant:</strong> ${opts.assistantName}</p>
          <p style="color:#475569;"><strong>User's last message:</strong></p>
          <blockquote style="border-left:4px solid #0d9488;padding:8px 16px;margin:8px 0;color:#334155;background:#f8fafc;">
            ${opts.userMessage}
          </blockquote>
          <a href="${inboxUrl}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#0d9488;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
            Open Inbox
          </a>
          <p style="color:#94a3b8;font-size:12px;margin-top:24px;">Conversation ID: ${opts.conversationId}</p>
        </div>
      `,
    });
  } catch (err) {
    // Don't let email errors crash chat — just log them
    console.error("Handoff email failed:", err);
  }
}

// Fires all enabled webhooks for the given event type.
// Sends a JSON POST to each matching URL. If a signing secret is set,
// a HMAC-SHA256 signature of the JSON body is added as X-Relay-Signature.
async function fireWebhooks(eventType: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const { data: hooks } = await supabase
      .from("webhooks")
      .select("id, url, secret")
      .eq("event_type", eventType)
      .eq("enabled", true);

    if (!hooks || hooks.length === 0) return;

    const body = JSON.stringify({ event: eventType, ...payload, timestamp: new Date().toISOString() });

    await Promise.allSettled(
      hooks.map(async (hook: { id: string; url: string; secret?: string }) => {
        const headers: Record<string, string> = { "Content-Type": "application/json" };

        // Sign the payload if a secret is configured
        if (hook.secret) {
          const { createHmac } = await import("crypto");
          const sig = createHmac("sha256", hook.secret).update(body).digest("hex");
          headers["X-Relay-Signature"] = `sha256=${sig}`;
        }

        const resp = await fetch(hook.url, { method: "POST", headers, body });
        if (!resp.ok) {
          console.warn(`Webhook ${hook.id} returned ${resp.status} for event ${eventType}`);
        }
      })
    );
  } catch (err) {
    // Never let webhook errors affect the main chat flow
    console.error("fireWebhooks error:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Capture raw body for Meta webhook signature verification before JSON parsing
  app.use(express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }));

  // ---------------------------------------------------------------------------
  // Auth — multi-user login, JWT middleware, user management
  // ---------------------------------------------------------------------------

  const JWT_SECRET = process.env.JWT_SECRET || "fallback-dev-secret-change-in-production";

  // Seed the initial admin user from .env if the users table is empty
  (async () => {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminHash = process.env.ADMIN_PASSWORD_HASH;
    if (!adminEmail || !adminHash) return;
    const { count, error: countErr } = await supabase.from("users").select("*", { count: "exact", head: true });
    if (countErr) {
      console.warn("Auth seed skipped — users table may not exist yet. Run migration 004_add_users.sql.");
      return;
    }
    if ((count ?? 0) === 0) {
      const { error: insertErr } = await supabase.from("users").insert({
        id: uuidv4(),
        email: adminEmail,
        password_hash: adminHash,
        role: "admin",
      });
      if (insertErr) console.error("Failed to seed admin user:", insertErr.message);
      else console.log(`Initial admin user seeded: ${adminEmail}`);
    }
  })();

  // Helper — extract and verify JWT, returns payload or null
  function verifyToken(req: any): { id: string; email: string; role: string } | null {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return null;
    try {
      return jwt.verify(token, JWT_SECRET) as any;
    } catch {
      return null;
    }
  }

  // POST /api/auth/login — look up user in users table, return JWT
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const { data: user } = await supabase
      .from("users")
      .select("id, email, password_hash, role")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token });
  });

  // POST /api/auth/change-password — any authenticated user can change their own password
  app.post("/api/auth/change-password", async (req, res) => {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: "Unauthorised" });

    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Both current and new password are required" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters" });
    }

    const { data: user } = await supabase
      .from("users")
      .select("password_hash")
      .eq("id", payload.id)
      .single();

    if (!user) return res.status(404).json({ error: "User not found" });

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

    const newHash = await bcrypt.hash(newPassword, 12);
    await supabase.from("users").update({ password_hash: newHash }).eq("id", payload.id);

    res.json({ ok: true });
  });

  // JWT middleware — protects all /api/* routes except public ones
  app.use("/api", (req, res, next) => {
    if (
      req.path.startsWith("/auth/") ||
      req.path.startsWith("/widget") ||
      req.path.startsWith("/inbound") ||
      req.path.startsWith("/webhooks/meta")
    ) {
      return next();
    }
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: "Unauthorised" });
    (req as any).user = payload;
    next();
  });

  // ---------------------------------------------------------------------------
  // User management — admin only
  // ---------------------------------------------------------------------------

  app.get("/api/admin/users", async (req, res) => {
    if ((req as any).user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const { data, error } = await supabase
      .from("users")
      .select("id, email, role, created_at")
      .order("created_at", { ascending: true });
    if (error) return res.status(500).json({ error: "Failed to fetch users" });
    res.json(data);
  });

  app.post("/api/admin/users", async (req, res) => {
    if ((req as any).user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const { email, password, role = "member" } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
    if (!["admin", "member"].includes(role)) return res.status(400).json({ error: "Role must be admin or member" });

    const hash = await bcrypt.hash(password, 12);
    const { data, error } = await supabase
      .from("users")
      .insert({ id: uuidv4(), email: email.toLowerCase().trim(), password_hash: hash, role })
      .select("id, email, role, created_at")
      .single();

    if (error) {
      if (error.code === "23505") return res.status(409).json({ error: "A user with that email already exists" });
      return res.status(500).json({ error: "Failed to create user" });
    }
    res.status(201).json(data);
  });

  app.delete("/api/admin/users/:id", async (req, res) => {
    if ((req as any).user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    // Prevent self-deletion
    if (req.params.id === (req as any).user?.id) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }
    const { error } = await supabase.from("users").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: "Failed to delete user" });
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------------------
  // Assistants
  // ---------------------------------------------------------------------------

  app.get("/api/assistants", async (_req, res) => {
    const { data, error } = await supabase
      .from("assistants")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: "Failed to fetch assistants" });
    res.json(data);
  });

  app.post("/api/assistants", async (req, res) => {
    const { name, personality, tone, purpose, system_prompt, welcome_message, primary_color, model_provider, model_name, api_key } = req.body;
    const id = uuidv4();
    const { data, error } = await supabase
      .from("assistants")
      .insert({ id, name, personality, tone, purpose, system_prompt, welcome_message, primary_color, model_provider, model_name, api_key })
      .select()
      .single();
    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed to create assistant" });
    }
    res.status(201).json(data);
  });

  app.get("/api/assistants/:id", async (req, res) => {
    const { data, error } = await supabase
      .from("assistants")
      .select("*")
      .eq("id", req.params.id)
      .single();
    if (error || !data) return res.status(404).json({ error: "Assistant not found" });
    res.json(data);
  });

  app.patch("/api/assistants/:id", async (req, res) => {
    if (Object.keys(req.body).length === 0) return res.status(400).json({ error: "No fields to update" });
    const { data, error } = await supabase
      .from("assistants")
      .update(req.body)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: "Failed to update assistant" });
    res.json(data);
  });

  // POST /api/assistants/:id/avatar — upload an avatar image (saved to public/avatars/)
  app.post("/api/assistants/:id/avatar", avatarUpload.single("avatar"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No image file uploaded" });
    const avatarUrl = `/avatars/${req.file.filename}`;
    const { error } = await supabase
      .from("assistants")
      .update({ avatar_url: avatarUrl })
      .eq("id", req.params.id);
    if (error) return res.status(500).json({ error: "Failed to save avatar URL" });
    res.json({ avatar_url: avatarUrl });
  });

  app.delete("/api/assistants/:id", async (req, res) => {
    const { error } = await supabase
      .from("assistants")
      .delete()
      .eq("id", req.params.id);
    if (error) return res.status(500).json({ error: "Failed to delete assistant" });
    res.status(204).send();
  });

  // ---------------------------------------------------------------------------
  // Knowledge Base
  // ---------------------------------------------------------------------------

  app.get("/api/assistants/:id/knowledge", async (req, res) => {
    const { data, error } = await supabase
      .from("knowledge_base")
      .select("*")
      .eq("assistant_id", req.params.id)
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: "Failed to fetch knowledge base" });
    res.json(data);
  });

  // Manual Q&A and text block entries
  app.post("/api/assistants/:id/knowledge", async (req, res) => {
    const { type, content, metadata } = req.body;
    const id = uuidv4();
    const { data, error } = await supabase
      .from("knowledge_base")
      .insert({ id, assistant_id: req.params.id, type, content, metadata: JSON.stringify(metadata), status: "indexed" })
      .select()
      .single();
    if (error) return res.status(500).json({ error: "Failed to add knowledge" });

    // Generate and store embedding (non-blocking failure — entry is still usable without it)
    const embedding = await embedText(content);
    if (embedding) {
      await supabase.from("knowledge_base").update({ embedding }).eq("id", id);
    }

    res.status(201).json(data);
  });

  app.delete("/api/knowledge/:id", async (req, res) => {
    const { error } = await supabase
      .from("knowledge_base")
      .delete()
      .eq("id", req.params.id);
    if (error) return res.status(500).json({ error: "Failed to delete knowledge entry" });
    res.status(204).send();
  });

  // Knowledge Base - File Upload
  // Accepts PDF, DOCX, TXT, CSV — extracts text and stores it as a knowledge entry
  app.post("/api/assistants/:id/knowledge/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file provided" });

      const text = await extractTextFromFile(req.file.buffer, req.file.mimetype, req.file.originalname);

      if (!text.trim()) {
        return res.status(422).json({ error: "Could not extract any text from this file." });
      }

      const entryId = uuidv4();
      const metadata = {
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
      };

      const { data, error } = await supabase
        .from("knowledge_base")
        .insert({ id: entryId, assistant_id: req.params.id, type: "file", content: text.trim(), metadata: JSON.stringify(metadata), status: "indexed" })
        .select()
        .single();

      if (error) throw new Error(error.message);

      // Generate and store embedding
      const embedding = await embedText(text.trim());
      if (embedding) {
        await supabase.from("knowledge_base").update({ embedding }).eq("id", entryId);
      }

      res.status(201).json(data);
    } catch (error: any) {
      console.error("File upload error:", error);
      res.status(500).json({ error: error?.message || "Failed to process file" });
    }
  });

  // Knowledge Base - URL Scraping
  // Fetches a URL, strips HTML tags, and stores the plain text as a knowledge entry
  app.post("/api/assistants/:id/knowledge/url", async (req, res) => {
    try {
      const { url } = req.body as { url: string };
      if (!url) return res.status(400).json({ error: "No URL provided" });

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        return res.status(400).json({ error: "Invalid URL" });
      }

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return res.status(400).json({ error: "Only HTTP and HTTPS URLs are supported" });
      }

      const fetchRes = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Relay-Bot/1.0)" },
        signal: AbortSignal.timeout(15000),
      });

      if (!fetchRes.ok) {
        return res.status(422).json({ error: `Could not fetch URL: HTTP ${fetchRes.status}` });
      }

      const html = await fetchRes.text();
      const $ = cheerio.load(html);
      $("script, style, noscript, nav, footer, header, aside, iframe").remove();
      const pageTitle = $("title").first().text().trim();
      const bodyText = $("body").text().replace(/\s+/g, " ").trim();

      if (!bodyText) {
        return res.status(422).json({ error: "Could not extract any content from this URL." });
      }

      const entryId = uuidv4();
      const metadata = { url, title: pageTitle || url };

      const { data, error } = await supabase
        .from("knowledge_base")
        .insert({ id: entryId, assistant_id: req.params.id, type: "url", content: bodyText, metadata: JSON.stringify(metadata), status: "indexed" })
        .select()
        .single();

      if (error) throw new Error(error.message);

      // Generate and store embedding
      const embedding = await embedText(bodyText);
      if (embedding) {
        await supabase.from("knowledge_base").update({ embedding }).eq("id", entryId);
      }

      res.status(201).json(data);
    } catch (error: any) {
      console.error("URL scrape error:", error);
      const message = error?.name === "TimeoutError"
        ? "Request timed out — the URL took too long to respond."
        : error?.message || "Failed to scrape URL";
      res.status(500).json({ error: message });
    }
  });

  // ---------------------------------------------------------------------------
  // Platform Settings
  // ---------------------------------------------------------------------------

  app.get("/api/settings", async (_req, res) => {
    const { data, error } = await supabase
      .from("platform_settings")
      .select("key, value");
    if (error) return res.status(500).json({ error: "Failed to fetch settings" });
    const settings: Record<string, string> = {};
    (data || []).forEach(row => { settings[row.key] = row.value; });
    res.json(settings);
  });

  app.patch("/api/settings", async (req, res) => {
    const entries = Object.entries(req.body as Record<string, string>).map(([key, value]) => ({
      key,
      value: value ?? "",
    }));

    const { error } = await supabase
      .from("platform_settings")
      .upsert(entries, { onConflict: "key" });

    if (error) return res.status(500).json({ error: "Failed to save settings" });

    // Return the full updated settings object
    const { data } = await supabase.from("platform_settings").select("key, value");
    const settings: Record<string, string> = {};
    (data || []).forEach(row => { settings[row.key] = row.value; });
    res.json(settings);
  });

  // ---------------------------------------------------------------------------
  // Chat — core AI response function used by both the dashboard and the widget
  // ---------------------------------------------------------------------------

  interface AiResponseResult {
    response: string;
    sources?: Array<{ type: string; label: string; snippet: string }>;
    systemPrompt?: string;
  }

  // Returns the AI response and optional debug info. Throws ChatError on failure.
  async function getAiResponse(
    assistantId: string,
    messages: Array<{ role: string; content: string }>,
    options: { debug?: boolean } = {},
  ): Promise<AiResponseResult> {
    const { data: assistant, error: assistantError } = await supabase
      .from("assistants")
      .select("*")
      .eq("id", assistantId)
      .single();

    if (assistantError || !assistant) throw new ChatError(404, "Assistant not found");

    // Use per-assistant key if set, otherwise fall back to the global platform key
    const globalKeyMap: Record<string, string> = {
      anthropic: "anthropic_api_key",
      openai: "openai_api_key",
      google: "google_api_key",
      xai: "xai_api_key",
    };

    let apiKey = assistant.api_key;
    if (!apiKey) {
      const { data: keyRow } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", globalKeyMap[assistant.model_provider])
        .single();
      apiKey = keyRow?.value || "";
    }

    if (!apiKey) {
      throw new ChatError(400, "No API key configured. Add one in Settings > API Keys (global) or in this assistant's Model Settings.");
    }

    // Build system prompt — use vector search if embeddings are available, else load all entries
    const userMessage = messages[messages.length - 1]?.content || "";
    const queryEmbedding = await embedText(userMessage);

    let kbEntries: Array<{ type: string; content: string; metadata: string }> = [];

    if (queryEmbedding) {
      // Semantic search — retrieve the top 5 most relevant KB chunks
      const { data: matches } = await supabase.rpc("match_knowledge", {
        query_embedding: queryEmbedding,
        p_assistant_id: assistantId,
        match_count: 5,
        similarity_threshold: 0.3,
      });
      kbEntries = matches || [];
    }

    // If vector search returned nothing (no embedding, no matches, or embeddings not yet stored),
    // fall back to injecting all KB entries as plaintext so the KB is always used
    if (kbEntries.length === 0) {
      const { data } = await supabase
        .from("knowledge_base")
        .select("type, content, metadata")
        .eq("assistant_id", assistantId)
        .order("created_at", { ascending: true });
      kbEntries = data || [];
    }

    // Strip comment lines (starting with //) from the system prompt before sending to the AI
    let systemPrompt = (assistant.system_prompt || "")
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//"))
      .join("\n")
      .trim();

    const sources: Array<{ type: string; label: string; snippet: string }> = [];

    if (kbEntries.length > 0) {
      const kbContext = kbEntries.map((entry) => {
        let label = "Knowledge";
        try {
          const meta = JSON.parse(entry.metadata || "{}");
          if (entry.type === "file") label = `File: ${meta.filename || "uploaded file"}`;
          else if (entry.type === "url") label = `Web page: ${meta.url || meta.title || ""}`;
          else if (entry.type === "qa") label = "Q&A pair";
          else if (entry.type === "text") label = meta.title || "Text block";
        } catch {}
        sources.push({ type: entry.type, label, snippet: entry.content.slice(0, 200) });
        return `--- ${label} ---\n${entry.content}`;
      }).join("\n\n");

      const kbSection = `\n\n--- KNOWLEDGE BASE ---\nThe following is your authoritative source of information. You MUST answer using only what is stated here. Do not add, infer, extrapolate or rephrase beyond what is explicitly written. Quote or closely paraphrase the source material. If a question cannot be answered from the knowledge base, say so — do not guess or fill in gaps from general knowledge.\n\n${kbContext}\n--- END KNOWLEDGE BASE ---`;
      systemPrompt = systemPrompt ? systemPrompt + kbSection : kbSection.trim();
    }

    let response = "";

    if (assistant.model_provider === "anthropic") {
      const client = new Anthropic({ apiKey });
      const result = await client.messages.create({
        model: assistant.model_name,
        max_tokens: assistant.max_tokens || 2048,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: messages.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })) as Anthropic.MessageParam[],
        temperature: assistant.temperature ?? 0.7,
      });
      response = result.content[0]?.type === "text" ? result.content[0].text : "";

    } else if (assistant.model_provider === "openai") {
      const client = new OpenAI({ apiKey });
      const systemMsg = systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : [];
      const result = await client.chat.completions.create({
        model: assistant.model_name,
        messages: [
          ...systemMsg,
          ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ],
        max_tokens: assistant.max_tokens || 2048,
        temperature: assistant.temperature ?? 0.7,
      });
      response = result.choices[0]?.message?.content || "";

    } else if (assistant.model_provider === "google") {
      const client = new GoogleGenAI({ apiKey });
      const contents = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      const result = await client.models.generateContent({
        model: assistant.model_name,
        contents,
        config: {
          ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
          temperature: assistant.temperature ?? 0.7,
          maxOutputTokens: assistant.max_tokens || 2048,
        },
      });
      response = result.text || "";

    } else if (assistant.model_provider === "xai") {
      // xAI uses an OpenAI-compatible API
      const client = new OpenAI({ apiKey, baseURL: "https://api.x.ai/v1" });
      const systemMsg = systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : [];
      const result = await client.chat.completions.create({
        model: assistant.model_name,
        messages: [
          ...systemMsg,
          ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ],
        max_tokens: assistant.max_tokens || 2048,
        temperature: assistant.temperature ?? 0.7,
      });
      response = result.choices[0]?.message?.content || "";

    } else {
      throw new ChatError(400, `Unsupported model provider: ${assistant.model_provider}`);
    }

    const result: AiResponseResult = { response };
    if (options.debug) {
      result.sources = sources;
      result.systemPrompt = systemPrompt;
    } else if (sources.length > 0) {
      result.sources = sources;
    }
    return result;
  }

  // Dashboard preview chat — same origin, no logging (test-mode only)
  app.post("/api/assistants/:id/chat", async (req, res) => {
    try {
      const { messages, debug } = req.body as { messages: Array<{ role: string; content: string }>; debug?: boolean };
      if (!messages || messages.length === 0) return res.status(400).json({ error: "No messages provided" });
      const result = await getAiResponse(req.params.id, messages, { debug: !!debug });
      res.json(result);
    } catch (error: any) {
      console.error("Chat error:", error);
      res.status(error?.status || 500).json({ error: error?.message || "Failed to get a response from the AI provider." });
    }
  });

  // ---------------------------------------------------------------------------
  // Widget API — public endpoints with CORS for cross-origin embeds
  // ---------------------------------------------------------------------------

  // Allow any origin to call widget endpoints (they are embedded on client sites)
  function setWidgetCORS(res: express.Response) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  // Preflight handlers
  app.options("/api/widget/:id/config", (_req, res) => { setWidgetCORS(res); res.sendStatus(204); });
  app.options("/api/widget/:id/chat",   (_req, res) => { setWidgetCORS(res); res.sendStatus(204); });

  // Returns the public config needed to render the widget (name, colour, welcome message, lead capture)
  app.get("/api/widget/:id/config", async (req, res) => {
    setWidgetCORS(res);
    const { data, error } = await supabase
      .from("assistants")
      .select("name, display_name, welcome_message, primary_color, widget_position, avatar_url, lead_capture_enabled, lead_capture_fields, quick_replies, active_hours_start, active_hours_end, timezone, offline_message, cookie_consent_enabled")
      .eq("id", req.params.id)
      .single();
    if (error || !data) return res.status(404).json({ error: "Assistant not found" });

    const isOffline = !isWithinActiveHours(data.active_hours_start, data.active_hours_end, data.timezone);
    res.json({
      name: data.display_name || data.name,
      welcome_message: data.welcome_message,
      primary_color: data.primary_color,
      widget_position: data.widget_position || 'bottom-right',
      avatar_url: data.avatar_url || null,
      lead_capture_enabled: data.lead_capture_enabled,
      lead_capture_fields: data.lead_capture_fields,
      quick_replies: data.quick_replies || [],
      is_offline: isOffline,
      offline_message: data.offline_message || "We're currently outside our support hours. Please leave your details and we'll get back to you as soon as we're available.",
      cookie_consent_enabled: data.cookie_consent_enabled || false,
    });
  });

  // Accepts a contact form submission when the assistant is outside active hours
  app.options("/api/widget/:id/offline-lead", (_req, res) => { setWidgetCORS(res); res.sendStatus(204); });
  app.post("/api/widget/:id/offline-lead", async (req, res) => {
    setWidgetCORS(res);
    try {
      const { name, email, message } = req.body as { name?: string; email?: string; message?: string };
      if (!name && !email) return res.status(400).json({ error: "Please provide at least a name or email address." });

      const convId = uuidv4();
      await supabase.from("conversations").insert({
        id: convId,
        assistant_id: req.params.id,
        channel: "widget",
        status: "closed",
        user_name: name || null,
        user_email: email || null,
      });

      if (message) {
        await supabase.from("messages").insert({
          id: uuidv4(),
          conversation_id: convId,
          role: "user",
          content: message,
        });
      }

      res.json({ ok: true });
    } catch (err: any) {
      console.error("Offline lead error:", err);
      res.status(500).json({ error: "Failed to save your details. Please try again." });
    }
  });

  // Widget chat — logs every exchange to the conversations/messages tables
  // Accepts an optional conversation_id to continue an existing session.
  // Returns the AI response plus the conversation_id (new or existing).
  app.post("/api/widget/:id/chat", async (req, res) => {
    setWidgetCORS(res);
    try {
      const { messages, conversation_id: existingConvId, user_name, user_email, user_phone } = req.body as {
        messages: Array<{ role: string; content: string }>;
        conversation_id?: string;
        user_name?: string;
        user_email?: string;
        user_phone?: string;
      };
      if (!messages || messages.length === 0) return res.status(400).json({ error: "No messages provided" });

      // Resolve or create a conversation record
      let convId = existingConvId || "";
      let isNewConversation = false;
      if (!convId) {
        convId = uuidv4();
        isNewConversation = true;
        await supabase.from("conversations").insert({
          id: convId,
          assistant_id: req.params.id,
          channel: "widget",
          status: "active",
          // Store lead capture data if provided with the first message
          ...(user_name  && { user_name }),
          ...(user_email && { user_email }),
          ...(user_phone && { user_phone }),
        });

        // Fire conversation_started webhook (fire-and-forget)
        fireWebhooks("conversation_started", {
          conversation_id: convId,
          assistant_id: req.params.id,
          channel: "widget",
        });

        // Fire lead_captured webhook if any lead data was collected at conversation start
        if (user_name || user_email || user_phone) {
          fireWebhooks("lead_captured", {
            conversation_id: convId,
            assistant_id: req.params.id,
            user_name: user_name || null,
            user_email: user_email || null,
            user_phone: user_phone || null,
          });
        }
      }

      // Log the incoming user message (last entry in the array)
      const userMsg = messages[messages.length - 1];
      await supabase.from("messages").insert({
        id: uuidv4(),
        conversation_id: convId,
        role: "user",
        content: userMsg.content,
      });

      // Fetch the assistant's hours-of-operation and handoff settings
      const { data: assistantHours } = await supabase
        .from("assistants")
        .select("active_hours_start, active_hours_end, timezone, offline_message, handoff_triggers, handoff_message, fallback_handoff_count, name")
        .eq("id", req.params.id)
        .single();

      // Check if the user is requesting a human handoff (using per-assistant triggers if set)
      const handoffTriggered = detectHandoff(userMsg.content, assistantHours?.handoff_triggers as string[] | undefined);

      let response: string;
      if (
        assistantHours &&
        !isWithinActiveHours(
          assistantHours.active_hours_start,
          assistantHours.active_hours_end,
          assistantHours.timezone
        )
      ) {
        // Outside active hours — return the offline message without calling the AI
        response =
          assistantHours.offline_message ||
          "We're currently outside our support hours. Please leave a message and we'll get back to you as soon as we're available.";
      } else if (handoffTriggered) {
        // Skip the AI — return a fixed acknowledgement and update the conversation status
        response = assistantHours?.handoff_message || "I'm connecting you with a member of our team now. Please hold on — someone will be with you shortly.";
        await supabase
          .from("conversations")
          .update({ status: "handed_off", updated_at: new Date().toISOString() })
          .eq("id", convId);

        // Fire-and-forget email notification (errors are caught inside sendHandoffEmail)
        sendHandoffEmail({
          assistantName: assistantHours?.name || "Unknown assistant",
          conversationId: convId,
          userMessage: userMsg.content,
        });

        // Fire handoff_triggered webhook
        fireWebhooks("handoff_triggered", {
          conversation_id: convId,
          assistant_id: req.params.id,
          assistant_name: assistantHours?.name || null,
          trigger_message: userMsg.content,
        });
      } else {
        // Get the AI response — catch errors so we can log a fallback and return a graceful message
        let isFallback = false;
        try {
          response = (await getAiResponse(req.params.id, messages)).response;
          // An empty response from the model is treated as a fallback
          if (!response) {
            response = "I wasn't able to generate a response. Please try again.";
            isFallback = true;
          }
        } catch (aiErr: any) {
          // Log the error but don't propagate — return a user-friendly fallback message instead
          console.error("AI response error (fallback):", aiErr?.message);
          response = "I'm having trouble responding right now. Please try again in a moment, or contact us directly for assistance.";
          isFallback = true;
        }

        // Bump updated_at so the conversation surfaces at the top of the Inbox
        await supabase
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", convId);

        // Log the assistant response, marking it as a fallback if applicable
        await supabase.from("messages").insert({
          id: uuidv4(),
          conversation_id: convId,
          role: "assistant",
          content: response,
          is_fallback: isFallback,
        });

        // Auto-handoff after N consecutive fallbacks (if configured on the assistant)
        const fallbackThreshold = assistantHours?.fallback_handoff_count ?? 0;
        let autoHandoffTriggered = false;

        if (isFallback && fallbackThreshold > 0) {
          // Count the most recent assistant messages — if the last N are all fallbacks, trigger handoff
          const { data: recentMsgs } = await supabase
            .from("messages")
            .select("is_fallback")
            .eq("conversation_id", convId)
            .eq("role", "assistant")
            .order("created_at", { ascending: false })
            .limit(fallbackThreshold);

          const allFallbacks =
            recentMsgs &&
            recentMsgs.length >= fallbackThreshold &&
            recentMsgs.every(m => m.is_fallback === true);

          if (allFallbacks) {
            autoHandoffTriggered = true;
            const handoffMsg = assistantHours?.handoff_message ||
              "I've been unable to help with your question. Let me connect you with a member of our team who can assist you directly.";

            // Update conversation to handed_off and add a handoff message
            await supabase
              .from("conversations")
              .update({ status: "handed_off", updated_at: new Date().toISOString() })
              .eq("id", convId);

            await supabase.from("messages").insert({
              id: uuidv4(),
              conversation_id: convId,
              role: "assistant",
              content: handoffMsg,
            });

            // Notify via email and webhook (fire-and-forget)
            sendHandoffEmail({
              assistantName: assistantHours?.name || "Unknown assistant",
              conversationId: convId,
              userMessage: `[Auto-handoff after ${fallbackThreshold} consecutive fallback${fallbackThreshold === 1 ? "" : "s"}]`,
            });
            fireWebhooks("handoff_triggered", {
              conversation_id: convId,
              assistant_id: req.params.id,
              assistant_name: assistantHours?.name || null,
              trigger_message: `auto_fallback_threshold:${fallbackThreshold}`,
            });

            // Override the response so the widget shows the handoff message
            response = handoffMsg;
          }
        }

        res.json({ response, conversation_id: convId, handoff_triggered: autoHandoffTriggered, is_fallback: isFallback });
        return;
      }

      // Log the assistant response for non-AI paths (handoff / offline)
      await supabase.from("messages").insert({
        id: uuidv4(),
        conversation_id: convId,
        role: "assistant",
        content: response,
      });

      res.json({ response, conversation_id: convId, handoff_triggered: handoffTriggered });
    } catch (error: any) {
      console.error("Widget chat error:", error);
      res.status(error?.status || 500).json({ error: error?.message || "Failed to get a response from the AI provider." });
    }
  });

  // ---------------------------------------------------------------------------
  // Conversations (Inbox)
  // ---------------------------------------------------------------------------

  // List all conversations with assistant name and last message preview
  app.get("/api/conversations", async (_req, res) => {
    const { data, error } = await supabase
      .from("conversation_summaries")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) return res.status(500).json({ error: "Failed to fetch conversations" });
    res.json(data || []);
  });

  // Full message transcript for a conversation
  app.get("/api/conversations/:id/messages", async (req, res) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", req.params.id)
      .order("created_at", { ascending: true });
    if (error) return res.status(500).json({ error: "Failed to fetch messages" });
    res.json(data || []);
  });

  // Update conversation status (close, mark as handed off, etc.)
  app.patch("/api/conversations/:id", async (req, res) => {
    const { status } = req.body as { status: string };
    if (!status) return res.status(400).json({ error: "status is required" });
    const { data, error } = await supabase
      .from("conversations")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: "Failed to update conversation" });

    // Fire conversation_closed webhook when a conversation is explicitly closed
    if (status === "closed") {
      fireWebhooks("conversation_closed", {
        conversation_id: req.params.id,
        assistant_id: data?.assistant_id || null,
      });
    }

    res.json(data);
  });

  // Send a message from a human agent into a conversation
  app.post("/api/conversations/:id/messages", async (req, res) => {
    const { content } = req.body as { content: string };
    if (!content?.trim()) return res.status(400).json({ error: "content is required" });
    const msgId = uuidv4();
    const { data, error } = await supabase
      .from("messages")
      .insert({ id: msgId, conversation_id: req.params.id, role: "human", content: content.trim() })
      .select()
      .single();
    if (error) return res.status(500).json({ error: "Failed to send message" });
    // Bump updated_at so the conversation moves to the top of the Inbox
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", req.params.id);
    res.status(201).json(data);
  });

  // Widget poll — returns any human-agent messages added since a given timestamp.
  // Called by the widget every few seconds once a handoff has been triggered,
  // so the end user sees replies from the human agent in real time.
  app.options("/api/widget/conversation/:convId/poll", (_req, res) => { setWidgetCORS(res); res.sendStatus(204); });
  app.get("/api/widget/conversation/:convId/poll", async (req, res) => {
    setWidgetCORS(res);
    const { since } = req.query as { since?: string };
    let query = supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", req.params.convId)
      .eq("role", "human")
      .order("created_at", { ascending: true });
    if (since) {
      query = query.gt("created_at", since);
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: "Failed to poll messages" });
    res.json(data || []);
  });

  // ---------------------------------------------------------------------------
  // Leads — conversations where at least one lead field was captured
  // ---------------------------------------------------------------------------

  app.get("/api/leads", async (_req, res) => {
    try {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, user_name, user_email, user_phone, channel, status, created_at, assistants(name)")
        .or("user_name.not.is.null,user_email.not.is.null,user_phone.not.is.null")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Flatten the joined assistant name
      const leads = (data || []).map((row: any) => ({
        ...row,
        assistant_name: row.assistants?.name || '',
        assistants: undefined,
      }));
      res.json(leads);
    } catch (err: any) {
      console.error("Leads error:", err);
      res.status(500).json({ error: err?.message || "Failed to fetch leads" });
    }
  });

  // ---------------------------------------------------------------------------
  // Inbound Webhook — lets external automations (Zapier, Make, etc.) inject
  // messages into conversations without a dashboard JWT.
  // Auth: X-Relay-Key header must match the inbound_webhook_key in platform_settings.
  // ---------------------------------------------------------------------------

  app.post("/api/inbound", async (req, res) => {
    try {
      // Validate the inbound key
      const providedKey = req.headers["x-relay-key"] as string | undefined;
      if (!providedKey) return res.status(401).json({ error: "Missing X-Relay-Key header" });

      const { data: keyRow } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "inbound_webhook_key")
        .single();

      if (!keyRow?.value || keyRow.value !== providedKey) {
        return res.status(401).json({ error: "Invalid API key" });
      }

      const { assistant_id, conversation_id: existingConvId, content, role } = req.body as {
        assistant_id?: string;
        conversation_id?: string;
        content?: string;
        role?: string;
      };

      if (!content?.trim()) return res.status(400).json({ error: "content is required" });

      const msgRole = role === "system" ? "system" : "human";

      let convId = existingConvId || "";

      if (!convId) {
        // No conversation ID — create a new conversation
        if (!assistant_id) return res.status(400).json({ error: "assistant_id is required when no conversation_id is provided" });

        // Verify the assistant exists
        const { data: asst } = await supabase.from("assistants").select("id").eq("id", assistant_id).single();
        if (!asst) return res.status(404).json({ error: "Assistant not found" });

        convId = uuidv4();
        await supabase.from("conversations").insert({
          id: convId,
          assistant_id,
          channel: "inbound",
          status: "active",
        });
      } else {
        // Verify the conversation exists
        const { data: conv } = await supabase.from("conversations").select("id").eq("id", convId).single();
        if (!conv) return res.status(404).json({ error: "Conversation not found" });
      }

      // Insert the message
      const msgId = uuidv4();
      await supabase.from("messages").insert({
        id: msgId,
        conversation_id: convId,
        role: msgRole,
        content: content.trim(),
      });

      // Bump updated_at so the conversation surfaces at the top of the Inbox
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", convId);

      res.status(201).json({ conversation_id: convId, message_id: msgId });
    } catch (err: any) {
      console.error("Inbound webhook error:", err);
      res.status(500).json({ error: err?.message || "Failed to process inbound message" });
    }
  });

  // ---------------------------------------------------------------------------
  // Data & GDPR
  // ---------------------------------------------------------------------------

  // Export all conversations as CSV — streams a download to the browser
  app.get("/api/data/export", async (_req, res) => {
    try {
      const { data: convs, error } = await supabase
        .from("conversations")
        .select("id, assistant_id, channel, status, user_name, user_email, user_phone, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = convs || [];
      const header = ["id", "assistant_id", "channel", "status", "user_name", "user_email", "user_phone", "created_at", "updated_at"];

      const escape = (v: unknown) => {
        const s = v === null || v === undefined ? "" : String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      };

      const csv = [
        header.join(","),
        ...rows.map(r => header.map(k => escape((r as Record<string, unknown>)[k])).join(",")),
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="relay-export-${new Date().toISOString().split("T")[0]}.csv"`);
      res.send(csv);
    } catch (err: any) {
      console.error("Export error:", err);
      res.status(500).json({ error: err?.message || "Export failed" });
    }
  });

  // Delete all conversation data — permanently removes all messages and conversations
  // Requires the header X-Confirm: delete-all to prevent accidental calls
  app.delete("/api/data/all", async (req, res) => {
    if (req.headers["x-confirm"] !== "delete-all") {
      return res.status(400).json({ error: "Missing confirmation header" });
    }
    try {
      // Delete messages first (FK constraint), then conversations
      await supabase.from("messages").delete().neq("id", "");
      await supabase.from("conversations").delete().neq("id", "");
      res.json({ message: "All conversation data deleted" });
    } catch (err: any) {
      console.error("Delete all error:", err);
      res.status(500).json({ error: err?.message || "Delete failed" });
    }
  });

  // ---------------------------------------------------------------------------
  // Webhooks — CRUD for outbound webhook configurations
  // ---------------------------------------------------------------------------

  // List all webhooks
  app.get("/api/webhooks", async (_req, res) => {
    const { data, error } = await supabase
      .from("webhooks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: "Failed to fetch webhooks" });
    res.json(data || []);
  });

  // Create a new webhook
  app.post("/api/webhooks", async (req, res) => {
    const { event_type, url, secret } = req.body as { event_type: string; url: string; secret?: string };
    if (!event_type || !url) return res.status(400).json({ error: "event_type and url are required" });

    const validEvents = ["conversation_started", "lead_captured", "handoff_triggered", "conversation_closed"];
    if (!validEvents.includes(event_type)) {
      return res.status(400).json({ error: `event_type must be one of: ${validEvents.join(", ")}` });
    }

    const newHook = { id: uuidv4(), event_type, url, secret: secret || null, enabled: true };
    const { data, error } = await supabase.from("webhooks").insert(newHook).select().single();
    if (error) return res.status(500).json({ error: "Failed to create webhook" });
    res.status(201).json(data);
  });

  // Toggle enabled / update URL or secret
  app.patch("/api/webhooks/:id", async (req, res) => {
    const { url, secret, enabled } = req.body as { url?: string; secret?: string; enabled?: boolean };
    const updates: Record<string, unknown> = {};
    if (url !== undefined) updates.url = url;
    if (secret !== undefined) updates.secret = secret || null;
    if (enabled !== undefined) updates.enabled = enabled;

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update" });

    const { data, error } = await supabase
      .from("webhooks")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: "Failed to update webhook" });
    res.json(data);
  });

  // Delete a webhook
  app.delete("/api/webhooks/:id", async (req, res) => {
    const { error } = await supabase.from("webhooks").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: "Failed to delete webhook" });
    res.sendStatus(204);
  });

  // ---------------------------------------------------------------------------
  // Analytics — real data from Supabase (Phase 8)
  // ---------------------------------------------------------------------------

  app.get("/api/analytics", async (_req, res) => {
    try {
      // Total conversations (all time)
      const { count: totalConversations } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true });

      // Total messages sent (user + assistant roles only)
      const { count: messagesSent } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("role", ["user", "assistant"]);

      // Handoff rate — conversations ever marked handed_off / total
      const { count: handoffCount } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("status", "handed_off");

      // Fallback rate — assistant messages flagged as fallbacks / total assistant messages
      const { count: totalAssistantMessages } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("role", "assistant");

      const { count: fallbackCount } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("role", "assistant")
        .eq("is_fallback", true);

      const total = totalConversations ?? 0;
      const handoffRate =
        total > 0
          ? Math.round(((handoffCount ?? 0) / total) * 1000) / 10
          : 0;

      const totalAsst = totalAssistantMessages ?? 0;
      const fallbackRate =
        totalAsst > 0
          ? Math.round(((fallbackCount ?? 0) / totalAsst) * 1000) / 10
          : 0;

      // Top questions — most frequent user messages (verbatim, last 1000 messages)
      const { data: userMessages } = await supabase
        .from("messages")
        .select("content")
        .eq("role", "user")
        .order("created_at", { ascending: false })
        .limit(1000);

      const questionCounts: Record<string, number> = {};
      for (const msg of userMessages ?? []) {
        const q = msg.content.trim();
        if (q.length < 200) { // Ignore very long messages — unlikely to be repeated questions
          questionCounts[q] = (questionCounts[q] || 0) + 1;
        }
      }
      const topQuestions = Object.entries(questionCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([question, count]) => ({ question, count }));

      // Conversations over time — last 30 days, grouped by date
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

      const { data: recentConvs } = await supabase
        .from("conversations")
        .select("created_at")
        .gte("created_at", thirtyDaysAgo.toISOString());

      // Build a map of date -> count
      const dateCounts: Record<string, number> = {};
      for (const conv of recentConvs ?? []) {
        const date = conv.created_at.split("T")[0];
        dateCounts[date] = (dateCounts[date] || 0) + 1;
      }

      // Fill all 30 days so the chart has no gaps
      const conversationsOverTime: { date: string; count: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        conversationsOverTime.push({ date: dateStr, count: dateCounts[dateStr] || 0 });
      }

      // Lead capture rate — conversations where a lead was captured (name or email present) / total
      const { count: leadCount } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .or("user_name.not.is.null,user_email.not.is.null");

      const leadCaptureRate =
        total > 0
          ? Math.round(((leadCount ?? 0) / total) * 1000) / 10
          : 0;

      // Busiest hours — message volume by hour of day (last 30 days)
      const { data: recentMessages } = await supabase
        .from("messages")
        .select("created_at")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .in("role", ["user"]);

      const hourCounts: Record<number, number> = {};
      for (let h = 0; h < 24; h++) hourCounts[h] = 0;
      for (const msg of recentMessages ?? []) {
        const hour = new Date(msg.created_at).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
      const busiestHours = Object.entries(hourCounts).map(([hour, count]) => ({
        hour: parseInt(hour),
        label: `${String(parseInt(hour)).padStart(2, "0")}:00`,
        count,
      }));

      res.json({
        totalConversations: total,
        messagesSent: messagesSent ?? 0,
        handoffRate,
        fallbackRate,
        leadCaptureRate,
        topQuestions,
        conversationsOverTime,
        busiestHours,
      });
    } catch (err: any) {
      console.error("Analytics error:", err);
      res.status(500).json({ error: err?.message || "Failed to fetch analytics" });
    }
  });

  // ---------------------------------------------------------------------------
  // Channel connections (Facebook Messenger, Instagram Direct, WhatsApp)
  // ---------------------------------------------------------------------------

  // GET /api/channel-connections/:assistantId — list all channel connections for an assistant
  app.get("/api/channel-connections/:assistantId", async (req, res) => {
    const { data, error } = await supabase
      .from("channel_connections")
      .select("*")
      .eq("assistant_id", req.params.assistantId)
      .order("channel");
    if (error) return void res.status(500).json({ error: error.message });
    res.json(data ?? []);
  });

  // PATCH /api/channel-connections/:assistantId/:channel — upsert a connection (used for WhatsApp manual config + post-OAuth page selection)
  app.patch("/api/channel-connections/:assistantId/:channel", async (req, res) => {
    const { assistantId, channel } = req.params;
    const allowed = ["facebook", "instagram", "whatsapp"];
    if (!allowed.includes(channel)) return void res.status(400).json({ error: "Invalid channel" });

    const { error } = await supabase
      .from("channel_connections")
      .upsert({
        assistant_id: assistantId,
        channel,
        updated_at: new Date().toISOString(),
        ...req.body,
      }, { onConflict: "assistant_id,channel" });
    if (error) return void res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // DELETE /api/channel-connections/:assistantId/:channel — disconnect a channel
  app.delete("/api/channel-connections/:assistantId/:channel", async (req, res) => {
    const { assistantId, channel } = req.params;
    const { error } = await supabase
      .from("channel_connections")
      .update({ status: "disconnected", page_id: null, page_name: null, access_token: null, phone_number_id: null, waba_id: null, connected_at: null, updated_at: new Date().toISOString() })
      .eq("assistant_id", assistantId)
      .eq("channel", channel);
    if (error) return void res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------------------
  // Meta OAuth — Facebook Messenger + Instagram
  // ---------------------------------------------------------------------------
  // The same Meta App covers both channels. The `channel` param in state tells
  // us which one to finalise after the user grants permission.
  //
  // Required platform_settings keys:
  //   meta_app_id      — your Meta App ID
  //   meta_app_secret  — your Meta App Secret
  //   meta_webhook_verify_token — auto-generated; used to verify the webhook in Meta dashboard

  // GET /api/auth/meta/connect?assistant_id=X&channel=facebook|instagram&token=JWT
  // Redirects the browser to the Meta OAuth consent screen.
  // Token is passed as a query param because this is a browser redirect (no Authorization header).
  app.get("/api/auth/meta/connect", async (req, res) => {
    const { assistant_id, channel, token: queryToken } = req.query as Record<string, string>;
    if (!assistant_id || !["facebook", "instagram"].includes(channel)) {
      // Redirect back rather than returning JSON — browser navigations can't show JSON usefully
      return void res.redirect(`/?meta_error=invalid_params`);
    }
    // Validate JWT from query param
    try { jwt.verify(queryToken || "", JWT_SECRET); } catch {
      return void res.redirect(`/login?error=session_expired`);
    }

    const state = Buffer.from(JSON.stringify({ assistantId: assistant_id, channel })).toString("base64url");
    const protocol = (req.headers["x-forwarded-proto"] as string) || req.protocol;
    const redirectUri = encodeURIComponent(`${protocol}://${req.get("host")}/api/auth/meta/callback`);

    if (channel === "instagram") {
      // Instagram Business Login — uses a separate Instagram App ID, different OAuth endpoint
      const { data: igSettings } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", ["instagram_app_id"]);
      const igMap = Object.fromEntries((igSettings ?? []).map((s: any) => [s.key, s.value]));
      if (!igMap.instagram_app_id) {
        return void res.redirect(`/assistants/${assistant_id}?tab=channels&meta_error=missing_instagram_credentials`);
      }
      return void res.redirect(
        `https://api.instagram.com/oauth/authorize?client_id=${igMap.instagram_app_id}&redirect_uri=${redirectUri}&response_type=code&scope=instagram_business_basic,instagram_business_manage_messages&state=${state}`
      );
    }

    // Facebook — standard Facebook Login OAuth
    const { data: fbSettings } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["meta_app_id"]);
    const fbMap = Object.fromEntries((fbSettings ?? []).map((s: any) => [s.key, s.value]));
    if (!fbMap.meta_app_id) {
      return void res.redirect(`/assistants/${assistant_id}?tab=channels&meta_error=missing_credentials`);
    }
    res.redirect(
      `https://www.facebook.com/v19.0/dialog/oauth?client_id=${fbMap.meta_app_id}&redirect_uri=${redirectUri}&scope=pages_messaging,pages_show_list,business_management&state=${state}&response_type=code`
    );
  });

  // GET /api/auth/meta/callback — Meta redirects here after OAuth consent.
  // Exchanges the code for a long-lived page access token and stores the connection.
  app.get("/api/auth/meta/callback", async (req, res) => {
    const { code, state, error: oauthError } = req.query as Record<string, string>;

    if (oauthError || !code || !state) {
      return void res.redirect(`/?meta_error=${encodeURIComponent(oauthError || "missing_code")}`);
    }

    let assistantId: string, channel: string;
    try {
      const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
      assistantId = parsed.assistantId;
      channel = parsed.channel;
    } catch {
      return void res.redirect("/?meta_error=invalid_state");
    }

    const protocol = (req.headers["x-forwarded-proto"] as string) || req.protocol;
    const redirectUri = `${protocol}://${req.get("host")}/api/auth/meta/callback`;

    try {
      if (channel === "instagram") {
        // ---------------------------------------------------------------------------
        // Instagram Business Login token exchange
        // ---------------------------------------------------------------------------
        const { data: igSettings } = await supabase
          .from("platform_settings")
          .select("key, value")
          .in("key", ["instagram_app_id", "instagram_app_secret"]);
        const igs = Object.fromEntries((igSettings ?? []).map((s: any) => [s.key, s.value]));
        if (!igs.instagram_app_id || !igs.instagram_app_secret) {
          return void res.redirect(`/assistants/${assistantId}?tab=channels&meta_error=missing_instagram_credentials`);
        }

        // Exchange authorisation code for short-lived Instagram token
        const tokenResp = await fetch("https://api.instagram.com/oauth/access_token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: igs.instagram_app_id,
            client_secret: igs.instagram_app_secret,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
            code,
          }).toString(),
        });
        const tokenData: any = await tokenResp.json();
        if (tokenData.error_type) throw new Error(tokenData.error_message || tokenData.error_type);

        // Exchange short-lived token for long-lived token (60-day expiry)
        const longResp = await fetch(
          `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${igs.instagram_app_secret}&access_token=${tokenData.access_token}`
        );
        const longData: any = await longResp.json();
        if (longData.error) throw new Error(longData.error.message);

        // Get the Instagram Business Account info
        const meResp = await fetch(
          `https://graph.instagram.com/me?fields=id,name,username&access_token=${longData.access_token}`
        );
        const meData: any = await meResp.json();
        console.log("[ig/callback] me:", JSON.stringify(meData));
        if (meData.error) throw new Error(meData.error.message);

        // Store the connection — page_id holds the Instagram Business Account ID
        await supabase.from("channel_connections").upsert({
          assistant_id: assistantId,
          channel: "instagram",
          status: "connected",
          page_id: meData.id,
          page_name: meData.name || meData.username || "Instagram Account",
          access_token: longData.access_token,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "assistant_id,channel" });

        return void res.redirect(`/assistants/${assistantId}?tab=channels&meta_connected=instagram`);
      }

      // ---------------------------------------------------------------------------
      // Facebook Login token exchange (Messenger)
      // ---------------------------------------------------------------------------
      const { data: fbSettings } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", ["meta_app_id", "meta_app_secret"]);
      const sm = Object.fromEntries((fbSettings ?? []).map((s: any) => [s.key, s.value]));
      if (!sm.meta_app_id || !sm.meta_app_secret) {
        return void res.redirect(`/assistants/${assistantId}?tab=channels&meta_error=missing_credentials`);
      }

      // Exchange code for short-lived user token
      const tokenResp = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${sm.meta_app_id}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${sm.meta_app_secret}&code=${code}`
      );
      const tokenData: any = await tokenResp.json();
      if (tokenData.error) throw new Error(tokenData.error.message);

      // Exchange for long-lived user token (60 days)
      const longResp = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${sm.meta_app_id}&client_secret=${sm.meta_app_secret}&fb_exchange_token=${tokenData.access_token}`
      );
      const longData: any = await longResp.json();
      if (longData.error) throw new Error(longData.error.message);

      // Get all pages this user manages directly
      const pagesResp = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?access_token=${longData.access_token}&fields=id,name,access_token`
      );
      const pagesData: any = await pagesResp.json();
      if (pagesData.error) throw new Error(pagesData.error.message);
      let pages: { id: string; name: string; access_token: string }[] = pagesData.data ?? [];

      // Fallback: pages managed through Business Manager don't appear in me/accounts
      if (pages.length === 0) {
        const bizResp = await fetch(
          `https://graph.facebook.com/v19.0/me/businesses?access_token=${longData.access_token}&fields=id,name`
        );
        const bizData: any = await bizResp.json();
        if (!bizData.error && bizData.data?.length > 0) {
          for (const biz of bizData.data) {
            const bpResp = await fetch(
              `https://graph.facebook.com/v19.0/${biz.id}/owned_pages?access_token=${longData.access_token}&fields=id,name,access_token`
            );
            const bpData: any = await bpResp.json();
            if (!bpData.error && bpData.data?.length > 0) pages = [...pages, ...bpData.data];
          }
        }
      }

      if (pages.length === 0) {
        return void res.redirect(`/assistants/${assistantId}?tab=channels&meta_error=no_pages`);
      }

      // If multiple pages, let the user pick
      if (pages.length > 1) {
        const encoded = Buffer.from(JSON.stringify(pages.map(p => ({ id: p.id, name: p.name, access_token: p.access_token })))).toString("base64url");
        return void res.redirect(`/assistants/${assistantId}?tab=channels&meta_pages=${encoded}&channel=${channel}`);
      }

      // Single page — store immediately
      await supabase.from("channel_connections").upsert({
        assistant_id: assistantId,
        channel,
        status: "connected",
        page_id: pages[0].id,
        page_name: pages[0].name,
        access_token: pages[0].access_token,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "assistant_id,channel" });

      res.redirect(`/assistants/${assistantId}?tab=channels&meta_connected=${channel}`);
    } catch (err: any) {
      console.error("Meta OAuth callback error:", err);
      res.redirect(`/assistants/${assistantId}?tab=channels&meta_error=${encodeURIComponent(err.message)}`);
    }
  });

  // ---------------------------------------------------------------------------
  // Meta Webhook — receives messages from Facebook Messenger, Instagram, WhatsApp
  // ---------------------------------------------------------------------------

  // GET /api/webhooks/meta — Meta calls this to verify the webhook endpoint.
  // Must respond with hub.challenge when hub.verify_token matches our stored token.
  app.get("/api/webhooks/meta", async (req, res) => {
    const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query as Record<string, string>;
    if (mode !== "subscribe") return void res.sendStatus(400);

    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "meta_webhook_verify_token")
      .single();

    if (token === (data?.value ?? "")) {
      res.send(challenge);
    } else {
      res.sendStatus(403);
    }
  });

  // POST /api/webhooks/meta — Meta sends inbound messages here.
  // Signature is verified against the app secret before processing.
  app.post("/api/webhooks/meta", async (req: any, res) => {
    // Always respond 200 quickly — Meta will retry if we don't
    res.sendStatus(200);

    try {
      // Verify X-Hub-Signature-256 header using the raw body captured before JSON parsing.
      // Facebook webhooks are signed with meta_app_secret; Instagram webhooks with instagram_app_secret.
      const sig = (req.headers["x-hub-signature-256"] as string) ?? "";
      if (sig && req.rawBody) {
        const { data: secrets } = await supabase
          .from("platform_settings")
          .select("key, value")
          .in("key", ["meta_app_secret", "instagram_app_secret"]);
        const secretMap = Object.fromEntries((secrets ?? []).map((s: any) => [s.key, s.value]));
        const { createHmac } = await import("crypto");
        const validSecrets = [secretMap.meta_app_secret, secretMap.instagram_app_secret].filter(Boolean);
        const signatureValid = validSecrets.some(
          secret => "sha256=" + createHmac("sha256", secret).update(req.rawBody).digest("hex") === sig
        );
        if (!signatureValid) {
          console.warn("Meta webhook signature mismatch — ignoring");
          return;
        }
      }

      const payload = req.body;
      const object: string = payload.object; // "page" | "instagram" | "whatsapp_business_account"

      for (const entry of payload.entry ?? []) {
        if (object === "page" || object === "instagram") {
          // Facebook Messenger and Instagram share the same structure
          const channel = object === "instagram" ? "instagram" : "facebook";
          const pageId: string = entry.id;

          for (const event of entry.messaging ?? []) {
            const senderId: string = event.sender?.id;
            const text: string | undefined = event.message?.text;
            if (!text || !senderId || senderId === pageId) continue; // ignore echo messages

            await handleMetaMessage({ channel, pageId, senderId, text });
          }
        } else if (object === "whatsapp_business_account") {
          for (const change of entry.changes ?? []) {
            const value = change.value;
            const phoneNumberId: string = value?.metadata?.phone_number_id;
            for (const msg of value?.messages ?? []) {
              const text = msg.text?.body;
              const from: string = msg.from; // sender's phone number
              if (!text) continue;
              await handleMetaMessage({ channel: "whatsapp", pageId: phoneNumberId, senderId: from, text });
            }
          }
        }
      }
    } catch (err) {
      console.error("Meta webhook processing error:", err);
    }
  });

  // ---------------------------------------------------------------------------
  // handleMetaMessage — shared logic for routing an inbound social message
  // ---------------------------------------------------------------------------
  async function handleMetaMessage(opts: {
    channel: string;
    pageId: string;    // Page ID (FB/IG) or Phone Number ID (WhatsApp)
    senderId: string;  // PSID (FB/IG) or phone number (WhatsApp)
    text: string;
  }) {
    const { channel, pageId, senderId, text } = opts;

    // Find the channel connection and its assistant
    const lookupField = channel === "whatsapp" ? "phone_number_id" : "page_id";
    const { data: conn } = await supabase
      .from("channel_connections")
      .select("assistant_id, access_token, page_id, phone_number_id")
      .eq("channel", channel)
      .eq(lookupField, pageId)
      .eq("status", "connected")
      .single();
    if (!conn) return;

    const { assistant_id, access_token } = conn;

    // Find or create a conversation for this sender
    let { data: conv } = await supabase
      .from("conversations")
      .select("id, status")
      .eq("assistant_id", assistant_id)
      .eq("channel", channel)
      .eq("channel_user_id", senderId)
      .neq("status", "closed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!conv) {
      const convId = uuidv4();
      await supabase.from("conversations").insert({
        id: convId,
        assistant_id,
        channel,
        channel_user_id: senderId,
        status: "active",
      });
      conv = { id: convId, status: "active" };

      // Fire conversation_started webhook
      fireWebhooks("conversation_started", { conversation_id: convId, assistant_id, channel, sender_id: senderId });
    }

    const convId = conv.id;

    // If handed off to human, do not send an AI reply — the agent handles it in the inbox
    if (conv.status === "handed_off") {
      await supabase.from("messages").insert({ id: uuidv4(), conversation_id: convId, role: "user", content: text });
      return;
    }

    // Fetch assistant settings to check hours, handoff triggers, etc.
    const { data: asst } = await supabase
      .from("assistants")
      .select("name, active_hours_start, active_hours_end, timezone, offline_message, handoff_triggers, handoff_message, fallback_handoff_count")
      .eq("id", assistant_id)
      .single();
    if (!asst) return;

    // Check hours of operation
    const online = isWithinActiveHours(asst.active_hours_start, asst.active_hours_end, asst.timezone);
    if (!online) {
      const reply = asst.offline_message || "We're currently offline. Please try again during business hours.";
      await supabase.from("messages").insert([
        { id: uuidv4(), conversation_id: convId, role: "user", content: text },
        { id: uuidv4(), conversation_id: convId, role: "assistant", content: reply },
      ]);
      await sendMetaReply({ channel, senderId, text: reply, accessToken: access_token, pageId: conn.page_id, phoneNumberId: conn.phone_number_id });
      return;
    }

    // Check handoff triggers
    if (detectHandoff(text, asst.handoff_triggers)) {
      const reply = asst.handoff_message || "I'll connect you with a human agent shortly.";
      await supabase.from("messages").insert([
        { id: uuidv4(), conversation_id: convId, role: "user", content: text },
        { id: uuidv4(), conversation_id: convId, role: "assistant", content: reply },
      ]);
      await supabase.from("conversations").update({ status: "handed_off", updated_at: new Date().toISOString() }).eq("id", convId);
      await sendMetaReply({ channel, senderId, text: reply, accessToken: access_token, pageId: conn.page_id, phoneNumberId: conn.phone_number_id });
      sendHandoffEmail({ assistantName: asst.name, conversationId: convId, userMessage: text });
      fireWebhooks("handoff_triggered", { conversation_id: convId, assistant_id, channel, user_message: text });
      return;
    }

    // Get existing messages for context
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(40);

    const contextMessages = [
      ...(history ?? []).map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: text },
    ];

    // Store user message
    await supabase.from("messages").insert({ id: uuidv4(), conversation_id: convId, role: "user", content: text });

    // Get AI response
    let reply: string;
    let isFallback = false;
    try {
      reply = (await getAiResponse(assistant_id, contextMessages)).response || "I wasn't able to generate a response. Please try again.";
    } catch (err: any) {
      reply = "I'm having trouble responding right now. Please try again in a moment.";
      isFallback = true;
    }

    // Store assistant reply
    await supabase.from("messages").insert({ id: uuidv4(), conversation_id: convId, role: "assistant", content: reply, is_fallback: isFallback });
    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);

    // Send reply back via Meta
    await sendMetaReply({ channel, senderId, text: reply, accessToken: access_token, pageId: conn.page_id, phoneNumberId: conn.phone_number_id });

    // Auto-handoff after N consecutive fallbacks
    const fallbackThreshold = asst.fallback_handoff_count ?? 0;
    if (isFallback && fallbackThreshold > 0) {
      const { data: recentMsgs } = await supabase
        .from("messages")
        .select("is_fallback")
        .eq("conversation_id", convId)
        .eq("role", "assistant")
        .order("created_at", { ascending: false })
        .limit(fallbackThreshold);
      if (recentMsgs && recentMsgs.length >= fallbackThreshold && recentMsgs.every((m: any) => m.is_fallback === true)) {
        await supabase.from("conversations").update({ status: "handed_off", updated_at: new Date().toISOString() }).eq("id", convId);
        sendHandoffEmail({ assistantName: asst.name, conversationId: convId, userMessage: text });
        fireWebhooks("handoff_triggered", { conversation_id: convId, assistant_id, channel, reason: "auto_fallback" });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // sendMetaReply — sends a message back via the Graph API
  // ---------------------------------------------------------------------------
  async function sendMetaReply(opts: {
    channel: string;
    senderId: string;
    text: string;
    accessToken: string;
    pageId?: string;       // Instagram Business Account ID (required for Instagram)
    phoneNumberId?: string; // WhatsApp phone number ID
  }) {
    const { channel, senderId, text, accessToken, pageId, phoneNumberId } = opts;
    try {
      if (channel === "whatsapp") {
        await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: senderId,
            type: "text",
            text: { body: text },
          }),
        });
      } else if (channel === "instagram") {
        // Instagram Business Login: send via the Instagram account's own endpoint
        await fetch(`https://graph.facebook.com/v20.0/${pageId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: { id: senderId },
            message: { text },
            messaging_type: "RESPONSE",
            access_token: accessToken,
          }),
        });
      } else {
        // Facebook Messenger
        await fetch("https://graph.facebook.com/v19.0/me/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: { id: senderId },
            message: { text },
            messaging_type: "RESPONSE",
            access_token: accessToken,
          }),
        });
      }
    } catch (err) {
      console.error(`sendMetaReply error (${channel}):`, err);
    }
  }

  // ---------------------------------------------------------------------------
  // Vite middleware (dev) / static files (production)
  // ---------------------------------------------------------------------------

  // Serve the public/ folder (widget.js lives here) — works in both dev and production
  app.use(express.static(path.join(__dirname, "public")));

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    // Catch-all: serve index.html for all non-API, non-static routes so React Router works
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  // Global error handler — catches unhandled errors from all routes and returns JSON
  // Must be defined after all routes and must have 4 parameters for Express to treat it as an error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled route error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message || "Internal server error" });
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
