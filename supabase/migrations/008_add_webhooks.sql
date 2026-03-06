-- Migration 008: Outbound webhooks
-- Run this in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS webhooks (
  id          TEXT PRIMARY KEY,
  event_type  TEXT NOT NULL,   -- 'conversation_started' | 'lead_captured' | 'handoff_triggered' | 'conversation_closed'
  url         TEXT NOT NULL,
  secret      TEXT,            -- optional signing secret — sent as X-Relay-Signature header
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
