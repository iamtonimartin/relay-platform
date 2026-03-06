# Relay Platform — Claude Code Project Reference

## What Is This?

Relay is a bespoke AI chatbot management platform built for internal use and sold as a done-for-you deployment to business clients. It is **not a SaaS product**. There is no multi-tenancy. Each instance is deployed once, for one business, on infrastructure they control.

The platform allows a business to create, train, manage and deploy AI-powered chat assistants across multiple channels from a single dashboard — similar in feature set to Chatbase and Stammer.ai, but fully owned by the client with no ongoing platform subscription.

This is built by Toni Martin of Ascendz, a digital growth consultancy. The first deployment is for Ascendz itself, which serves as the proof of concept and live demo for future client sales.

---

## Business Context

- **Owner:** Toni Martin, Ascendz
- **Primary use:** Internal tool first, then sold as bespoke client deployments
- **Target clients:** Founder-led service businesses (£2M–£7M revenue, 10–40 staff) with no internal digital leadership
- **Pricing model:** One-off project fee per deployment (£3k–£8k range), optional light-touch support retainer
- **Not:** A SaaS, a subscription product, or a multi-tenant platform

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Tailwind CSS |
| Backend | Node.js with Express |
| Database | PostgreSQL (or Supabase) for structured data |
| Vector DB | pgvector or Pinecone for knowledge base embeddings |
| Auth | Single-user authentication (no multi-tenancy) |
| Hosting | Deployable to Railway, Render, or self-hosted VPS |
| AI Models | Anthropic Claude (primary), OpenAI, Google Gemini, xAI Grok |

---

## Design System

- **Layout:** Dark navy/charcoal sidebar, light grey content area
- **Accent colour:** Teal (#10b981 or equivalent)
- **Typography:** Inter or DM Sans, clean sans-serif throughout
- **Components:** Rounded corners, subtle shadows, clear visual hierarchy
- **Tables** for data, **cards** for assistant overviews
- **Modals** for configuration rather than separate pages where possible
- The UI already exists as a prototype from Google AI Studio — maintain visual consistency with that design

---

## Navigation Structure

```
Sidebar:
├── Dashboard        (analytics overview)
├── Assistants       (list and management of all assistants)
├── Inbox            (conversation logs + human handoff queue)
├── Integrations     (channel connections + webhooks)
└── Settings         (API keys, general, security, notifications, data & GDPR)
```

---

## Core Features to Build

### 1. Assistant Creation and Management
- Create multiple named AI assistants
- Each assistant is independently configured
- Per-assistant settings: name, avatar/logo, primary colour, welcome message, purpose, tone
- Each assistant has its own settings page with tabbed navigation:
  `General | Knowledge Base | Model Settings | Channels | Hours of Operation | Handoff Rules | Lead Capture | Quick Replies | Appearance`

### 2. Knowledge Base Training
Each assistant is trainable via:
- File uploads (PDF, Word, CSV, TXT) — indexing status shown
- URL scraping — paste a URL, system crawls and indexes content
- Manual Q&A pairs — user inputs question + ideal answer
- Free-text content blocks

Knowledge base entries should be deletable and updatable individually.

### 3. AI Model Configuration
- Support multiple AI model providers
- User inputs their own API key per provider
- Configurable per assistant:
  - Provider (Anthropic, OpenAI, xAI, Google)
  - Model selection (e.g. Claude Sonnet 4.6, GPT-4o, Gemini Flash, Grok)
  - System prompt
  - Temperature
  - Max tokens
- Global API keys stored in Settings as defaults, overridable per assistant

### 4. Channel Deployment
Each assistant deployable across:
- **Website chat widget** — embeddable via script tag, fully brandable, embed code generator included
- **WhatsApp** — via WhatsApp Business API
- **Facebook Messenger** — via Meta Graph API
- **Instagram Direct Messages** — via Meta Graph API

Each channel is configured independently. The assistant can behave differently per channel if needed.

### 5. Hours of Operation
- Set active hours per assistant with timezone selection
- Outside active hours: display configurable offline message
- Optional: assistant can still operate outside hours but flag that responses may be delayed

### 6. Human Handoff
Handoff triggered by:
- End user explicitly requesting a human
- Keyword or phrase match (configurable list)
- Sentiment detection (negative or frustrated tone)
- Assistant unable to answer after a configurable number of attempts

On handoff:
- Conversation flagged in dedicated Inbox view with status indicator
- Notification routing to specified email address or webhook (Slack/Teams)
- Full conversation transcript visible to the human agent picking it up
- "Take Over" button in the Inbox to claim the conversation

### 7. Integrations and Webhooks
Outbound webhooks for:
- New conversation started
- Lead captured
- Handoff triggered
- Conversation ended

Per webhook:
- Configurable URL
- Custom headers
- JSON payload format

Inbound webhook support so external automations (Make.com, Zapier) can push data back into a conversation.

### 8. Lead Capture
- Optional pre-chat form before conversation begins
- Configurable fields: name, email, phone number
- Each field individually marked as required or optional

### 9. Conversation Inbox and Logs
- Full conversation log across all assistants and all channels
- Filterable by: assistant, channel, date range, status (active, handed off, closed)
- Searchable
- Conversations taggable for review and follow-up
- Human agents can type directly into the conversation view after taking over

### 10. Analytics Dashboard
Metrics shown:
- Total conversations over time (line chart, daily/weekly toggle)
- Messages sent and received
- Handoff rate
- Unanswered/fallback rate
- Busiest hours and days
- Top questions asked
- Lead capture rate (if form enabled)

### 11. Fallback Configuration
- Custom fallback message when assistant cannot find a confident answer
- Option to auto-trigger handoff after configurable number of consecutive fallback responses

### 12. Quick Replies and Suggested Actions
- Configurable quick reply buttons in the chat widget
- Appear at conversation start or at defined points
- Allow end user to select common options rather than typing freeform

### 13. GDPR and Data Settings
- Configurable data retention period (30/60/90 days)
- Optional cookie consent notice on web widget
- Ability to delete individual conversations or all data for a specific user

### 14. Preview and Test Mode
- Simulate the assistant in a test chat window inside the dashboard
- Not live to end users during preview mode

### 15. Appearance and Branding
Per assistant:
- Display name (what the end user sees, separate from internal name)
- Avatar / logo upload
- Primary colour picker
- Chat widget position (bottom right / bottom left)
- Custom CSS option for advanced deployments

---

## Authentication

- Single user authentication — this is an internal tool, not a multi-user platform
- Email + password login
- Magic link option
- Google OAuth and Facebook OAuth (as shown in the UI prototype)
- Two-factor authentication toggle in Security settings
- Session timeout configurable (default 30 minutes)
- IP whitelisting option

---

## Settings Structure

```
Settings:
├── API Keys        (global defaults: OpenAI, Anthropic, Google, xAI + Vector DB config)
├── General         (platform name, support email, default language, timezone)
├── Security        (2FA, session timeout, IP whitelisting)
├── Notifications   (new lead, handoff requested, system alerts, weekly analytics report)
└── Data & GDPR     (conversation retention, export platform data, delete instance)
```

---

## Build Priority Order

Build in this sequence — each phase is a working, testable increment:

**Phase 1 — Foundation**
- Project scaffold (React frontend + Node/Express backend)
- Authentication (single user, email/password)
- Database schema (PostgreSQL)
- Basic dashboard shell with sidebar navigation

**Phase 2 — Core Assistant Flow**
- Assistant creation modal and list view
- Per-assistant settings page with tabbed navigation
- AI model configuration (API key input, provider/model selection)
- Basic system prompt configuration

**Phase 3 — Knowledge Base**
- File upload and indexing (PDF, TXT, CSV)
- URL scraping and indexing
- Manual Q&A entry
- Vector database integration (pgvector or Pinecone)
- Knowledge base management UI (view, delete, update entries)

**Phase 4 — Live Chat**
- Web chat widget (embeddable)
- RAG pipeline connecting knowledge base to assistant responses
- Fallback message handling
- Preview/test mode inside the dashboard

**Phase 5 — Inbox and Handoff**
- Conversation log and inbox view
- Handoff trigger logic (keyword, sentiment, user request, fallback count)
- Human takeover UI (Take Over button, type directly into conversation)
- Notification routing (email + webhook)

**Phase 6 — Channels**
- WhatsApp Business API integration
- Facebook Messenger integration
- Instagram Direct integration
- Per-channel configuration in assistant settings

**Phase 7 — Integrations and Webhooks**
- Outbound webhook configuration UI
- Webhook firing logic for all event types
- Inbound webhook support

**Phase 8 — Analytics**
- Dashboard metrics and charts
- Top questions tracking
- Handoff and fallback rate calculations

**Phase 9 — Polish**
- Lead capture pre-chat form
- Quick reply buttons
- GDPR settings and data export
- Appearance/branding customisation per assistant
- Widget embed code generator

---

## What This Is NOT

- Not a SaaS — no subscription billing, no multi-tenant user management
- Not a ManyChat replacement for comment-triggered DMs (Meta API review required — out of scope)
- Not a flow builder with decision trees — conversations are AI-driven, not scripted

---

## Notes for Claude Code

- British English spelling throughout (e.g. "customise" not "customize", "colour" not "color") — this applies to all UI copy and documentation
- No Oxford commas in UI copy
- No em dashes in UI copy — use a regular dash or restructure the sentence
- Keep code modular — each feature should be self-contained and independently deployable
- Comment code clearly — this will be handed to clients and may be maintained by non-developers
- The UI prototype already exists (built in Google AI Studio) — when in doubt about layout or design decisions, maintain consistency with that prototype
- Prioritise getting something working and testable at each phase over building everything at once
- The first real deployment is for Ascendz — train the assistant on Ascendz content, frameworks (ICI Framework), services, and pricing
