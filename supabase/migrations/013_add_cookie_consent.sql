-- Migration 013: Add cookie consent toggle per assistant
-- Run this in the Supabase SQL Editor.

ALTER TABLE assistants
  ADD COLUMN IF NOT EXISTS cookie_consent_enabled BOOLEAN NOT NULL DEFAULT FALSE;
