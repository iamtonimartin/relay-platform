-- Migration 009: Fallback tracking on assistant messages
-- Run this in the Supabase SQL Editor.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS is_fallback BOOLEAN NOT NULL DEFAULT FALSE;
