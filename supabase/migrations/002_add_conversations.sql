-- Migration 002: Conversation logging (Phase 5 — Inbox)
-- Run this in the Supabase SQL Editor after schema.sql (or 001_add_embeddings.sql).
-- Safe to run multiple times (IF NOT EXISTS / CREATE OR REPLACE throughout).

-- Stores one row per chat session started through the widget (or any channel)
CREATE TABLE IF NOT EXISTS conversations (
  id           TEXT PRIMARY KEY,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  channel      TEXT NOT NULL DEFAULT 'widget',   -- widget | whatsapp | messenger | instagram
  status       TEXT NOT NULL DEFAULT 'active',   -- active | handed_off | closed
  user_name    TEXT,
  user_email   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conversations_assistant_idx ON conversations(assistant_id);
CREATE INDEX IF NOT EXISTS conversations_updated_idx   ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS conversations_status_idx    ON conversations(status);

-- Stores every individual message in a conversation
CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,   -- user | assistant | human (agent who took over)
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS messages_created_idx      ON messages(created_at);

-- View used by the Inbox list — one row per conversation, pre-joined with
-- the assistant name and the last message for quick rendering.
CREATE OR REPLACE VIEW conversation_summaries AS
SELECT
  c.id,
  c.assistant_id,
  c.channel,
  c.status,
  c.user_name,
  c.created_at,
  c.updated_at,
  a.name         AS assistant_name,
  a.primary_color AS assistant_color,
  (
    SELECT content FROM messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) AS last_message,
  (
    SELECT role FROM messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) AS last_message_role,
  (
    SELECT COUNT(*) FROM messages
    WHERE conversation_id = c.id
  ) AS message_count
FROM conversations c
JOIN assistants a ON a.id = c.assistant_id;
