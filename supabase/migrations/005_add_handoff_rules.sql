-- Migration 005: Handoff rules per assistant
-- Run this in the Supabase SQL Editor before using the Handoff Rules tab.

ALTER TABLE assistants
  ADD COLUMN IF NOT EXISTS handoff_triggers  JSONB    DEFAULT '[]'::jsonb,   -- array of trigger phrases
  ADD COLUMN IF NOT EXISTS handoff_message   TEXT;                            -- custom message sent to user on handoff
