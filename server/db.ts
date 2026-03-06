import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database('relay.db');

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS assistants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    personality TEXT,
    tone TEXT,
    purpose TEXT,
    system_prompt TEXT,
    welcome_message TEXT,
    avatar_url TEXT,
    primary_color TEXT DEFAULT '#0f172a',
    model_provider TEXT DEFAULT 'google',
    model_name TEXT DEFAULT 'gemini-3-flash-preview',
    api_key TEXT,
    temperature REAL DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 2048,
    active_hours_start TEXT,
    active_hours_end TEXT,
    timezone TEXT DEFAULT 'UTC',
    offline_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS knowledge_base (
    id TEXT PRIMARY KEY,
    assistant_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'file', 'url', 'qa', 'text'
    content TEXT,
    metadata TEXT, -- JSON string for file info or URL
    status TEXT DEFAULT 'indexed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assistant_id) REFERENCES assistants(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    assistant_id TEXT NOT NULL,
    channel TEXT NOT NULL, -- 'web', 'whatsapp', 'messenger', 'instagram'
    status TEXT DEFAULT 'active', -- 'active', 'handed_off', 'closed'
    user_name TEXT,
    user_email TEXT,
    user_phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assistant_id) REFERENCES assistants(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL, -- 'user', 'assistant', 'system', 'human'
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    assistant_id TEXT,
    event_type TEXT NOT NULL,
    url TEXT NOT NULL,
    headers TEXT, -- JSON string
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    assistant_id TEXT NOT NULL,
    name TEXT,
    email TEXT,
    phone TEXT,
    data TEXT, -- JSON string for custom fields
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assistant_id) REFERENCES assistants(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS platform_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

export default db;
