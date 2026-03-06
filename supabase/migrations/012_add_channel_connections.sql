-- Migration 012: Social channel connections (Facebook Messenger, Instagram Direct, WhatsApp)
-- Run this in the Supabase SQL Editor.

-- Stores one row per assistant per connected social channel.
CREATE TABLE IF NOT EXISTS channel_connections (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  assistant_id    TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL CHECK (channel IN ('facebook', 'instagram', 'whatsapp')),
  status          TEXT NOT NULL DEFAULT 'disconnected',
  -- Facebook / Instagram
  page_id         TEXT,   -- Facebook Page ID or Instagram Business Account ID
  page_name       TEXT,   -- Human-readable name shown in the UI
  access_token    TEXT,   -- Long-lived Page Access Token
  -- WhatsApp Cloud API
  phone_number_id TEXT,   -- WhatsApp Phone Number ID (from Meta Business dashboard)
  waba_id         TEXT,   -- WhatsApp Business Account ID
  -- Shared
  config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  connected_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assistant_id, channel)
);

-- Add channel_user_id to conversations so we can look up existing conversations
-- by platform-specific sender ID (PSID for FB/IG, phone number for WhatsApp).
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS channel_user_id TEXT;

-- Index for fast lookup when routing inbound messages
CREATE INDEX IF NOT EXISTS idx_conversations_channel_user
  ON conversations (assistant_id, channel, channel_user_id);
