# Relay Platform Project Tasks

## Revised Build Order
Adjusted to prioritise a working end-to-end AI chat demo early — the core value proposition for client demos.

---

- [x] **Phase 1 — Foundation**
  - [x] Project scaffold (React frontend + Node/Express backend)
  - [x] Authentication (single user, email/password) — JWT-based, bcrypt hashed, change password via Settings > Security
  - [x] Database schema (migrated from SQLite → Supabase/PostgreSQL; schema in supabase/schema.sql)
  - [x] Basic dashboard shell with sidebar navigation

- [x] **Phase 2 — Core Assistant Flow**
  - [x] Assistant creation modal and list view
  - [x] Per-assistant settings page with tabbed navigation (General, Knowledge Base, Model Settings + placeholder tabs)
  - [x] AI model configuration UI (provider, model, API key, temperature, max tokens — saves to DB)
  - [x] Basic system prompt configuration
  - [x] Fix model lists — corrected Gemini names, added Anthropic (Claude 4.x) and xAI options, set Anthropic as default provider

- [x] **Phase 4a — Live AI Chat (Preview/Test Mode)**
  - [x] Chat API endpoint on the backend — routes message to the correct provider using the assistant's stored API key and model
  - [x] Support Anthropic Claude (primary), OpenAI, Google Gemini, xAI Grok
  - [x] Preview/test chat window inside the assistant settings page
  - [x] Fallback message when the AI cannot respond or API key is missing

- [x] **Phase 3 — Knowledge Base**
  - [x] File upload and indexing (PDF, DOCX, TXT, CSV — text extracted via pdf-parse, mammoth, raw read)
  - [x] URL scraping and indexing (cheerio — strips nav/footer, extracts body text)
  - [x] Manual Q&A entry
  - [x] Free-text content blocks
  - [x] KB context injected into system prompt at chat time (plaintext, pre-RAG)
  - [x] Knowledge base management UI (view, delete entries; type icons, metadata display)
  - [x] Supabase migration — all data now in Supabase/PostgreSQL; pgvector extension enabled for Phase 4b

- [x] **Phase 4b — RAG + Embeddable Widget**
  - [x] Generate embeddings for KB entries on ingest (OpenAI text-embedding-3-small)
  - [x] Store embeddings in pgvector (embedding vector(1536) column on knowledge_base)
  - [x] Semantic search at chat time — match_knowledge() RPC, top 5 results, 0.3 similarity threshold
  - [x] Graceful fallback — if no OpenAI key or embedding fails, loads all KB entries as plaintext
  - [x] Migration SQL in supabase/migrations/001_add_embeddings.sql
  - [x] Embeddable web chat widget (via script tag, fully brandable) — public/widget.js, served at /widget.js
  - [x] Embed code generator in assistant settings (Channels tab)

- [x] **Phase 5 — Inbox and Handoff**
  - [x] Conversation log and inbox view (real data from Supabase, search + status filter)
  - [x] Handoff trigger logic (keyword/phrase match via HANDOFF_TRIGGERS list; skips AI on trigger)
  - [x] Human takeover UI (Take Over button, agent reply input, 5s auto-refresh)
  - [x] Conversation logging — all widget messages stored in messages table with conversation_id
  - [x] Widget polling for human agent messages (/api/widget/conversation/:id/poll)
  - [x] Supabase migration — supabase/migrations/002_add_conversations.sql
  - [~] Notification routing — email on handoff built (nodemailer + SMTP config in Settings > Notifications) but not yet tested/confirmed working. Revisit in refinements.

- [x] **Phase 8 — Analytics (real data)**
  - [x] Replace mock analytics endpoint with real DB queries
  - [x] Dashboard metrics and charts wired to live data
  - [x] Top questions tracking (verbatim user message frequency)
  - [x] Handoff rate calculation (handed_off / total conversations)
  - [x] Fallback rate — logged via is_fallback column on messages; migration 009_add_fallback_tracking.sql; AI errors return graceful message instead of 500

- [~] **Phase 6 — Channels**
  - [x] Scaffolding complete — channel_connections table (migration 012), Meta OAuth flow, unified webhook endpoint, send helpers, per-channel connect/disconnect UI in assistant settings
  - [~] Facebook Messenger — backend + UI built; requires Meta App setup + App Review for pages_messaging permission
  - [~] Instagram Direct — backend + UI built; requires Instagram Professional account + App Review
  - [~] WhatsApp Business — backend + UI built; requires Meta Cloud API access + phone number registration
  - [x] Per-channel configuration in assistant settings (Channels tab)

- [x] Auto-handoff after N consecutive fallbacks — migration 010_add_fallback_handoff.sql; configurable in Handoff Rules tab; fires email + webhook on trigger

- [~] **Phase 7 — Integrations and Webhooks**
  - [x] Outbound webhook configuration UI (Integrations > Webhooks tab - real CRUD, add/toggle/delete)
  - [x] Webhook firing logic for all event types (conversation_started, lead_captured, handoff_triggered, conversation_closed)
  - [x] Inbound webhook support — POST /api/inbound, X-Relay-Key auth, inject messages into conversations; key managed in Integrations > Inbound tab

- [x] **Phase 9 — Polish**
  - [x] Lead capture pre-chat form (name, email, phone — configurable fields, required/optional per field; stored on conversation, displayed in dedicated Leads page)
  - [x] Leads page — table view with search, CSV export, mailto/tel links
  - [x] Outside-hours lead capture — when assistant is offline, widget shows a contact form instead of a static message (build after lead capture)
  - [x] Quick reply buttons — configurable per assistant, rendered in widget at conversation start; migration 007_add_quick_replies.sql
  - [x] GDPR settings and data export (retention setting stored in platform_settings; CSV export; delete all conversations)
  - [x] Appearance/branding customisation per assistant — display name, primary colour picker, widget position; migration 006_add_appearance.sql
  - [x] Handoff rules configuration UI — per-assistant trigger phrases + custom handoff message; migration 005_add_handoff_rules.sql
  - [x] Avatar/logo upload per assistant — image upload to public/avatars/, displayed in widget header; Appearance tab
  - [x] Cookie consent banner on widget — configurable toggle per assistant (Appearance tab); stores consent in localStorage; migration 013_add_cookie_consent.sql
  - [x] Busiest hours analytics chart — bar chart on dashboard showing message volume by hour (last 30 days)
  - [x] Lead capture rate metric — percentage of conversations with captured lead data, shown as stat card on dashboard

---

## Notes
- Auth complete — JWT-based login (bcrypt password hash), token stored as relay_token. Default credentials in .env (ADMIN_EMAIL / ADMIN_PASSWORD_HASH). Password changeable via Settings > Security UI.
- Supabase migration complete — server.ts fully async, schema.sql must be run once in Supabase SQL Editor before server starts
- Phase 4a (live AI chat) is the first major milestone — nothing else matters until an assistant can actually respond
- Vector RAG live — embeddings generated via OpenAI text-embedding-3-small on KB ingest; semantic search via pgvector match_knowledge() RPC at chat time; falls back to plaintext injection if no OpenAI key
