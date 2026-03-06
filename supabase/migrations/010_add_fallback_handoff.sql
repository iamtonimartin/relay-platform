-- Migration 010: Auto-handoff after N consecutive fallback responses
-- Run this in the Supabase SQL Editor.
-- fallback_handoff_count: 0 = disabled, N = trigger handoff after N consecutive AI fallbacks

ALTER TABLE assistants
  ADD COLUMN IF NOT EXISTS fallback_handoff_count INT NOT NULL DEFAULT 0;
