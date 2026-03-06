import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, X, Eye, EyeOff, Copy, RefreshCw, Check } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Webhook {
  id: string;
  event_type: string;
  url: string;
  secret?: string | null;
  enabled: boolean;
  created_at: string;
}

// Human-readable labels for each event type
const EVENT_LABELS: Record<string, string> = {
  conversation_started: 'Conversation Started',
  lead_captured:        'Lead Captured',
  handoff_triggered:    'Handoff Triggered',
  conversation_closed:  'Conversation Closed',
};

// ─── Add Webhook Modal ────────────────────────────────────────────────────────

interface AddWebhookModalProps {
  onClose: () => void;
  onSaved: (hook: Webhook) => void;
}

function AddWebhookModal({ onClose, onSaved }: AddWebhookModalProps) {
  const [eventType, setEventType] = useState('conversation_started');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!url.trim()) { setError('URL is required'); return; }
    try { new URL(url.trim()); } catch { setError('Please enter a valid URL'); return; }

    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('relay_token');
      const resp = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ event_type: eventType, url: url.trim(), secret: secret.trim() || undefined }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Failed to create webhook');
      }
      const hook = await resp.json();
      onSaved(hook);
    } catch (err: any) {
      setError(err.message || 'Failed to create webhook');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900">Add Webhook</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Event Type</label>
            <select
              value={eventType}
              onChange={e => setEventType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            >
              {Object.entries(EVENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">A POST request will be sent to your URL each time this event occurs.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Endpoint URL</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://hooks.zapier.com/..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Signing Secret <span className="text-slate-400 font-normal">(optional)</span></label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={secret}
                onChange={e => setSecret(e.target.value)}
                placeholder="Leave blank to skip request signing"
                className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="button"
                onClick={() => setShowSecret(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">If set, each request includes an <code className="bg-slate-100 px-1 rounded">X-Relay-Signature</code> header (HMAC-SHA256).</p>
          </div>

          {error && <p className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Webhook'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Integrations() {
  const [activeTab, setActiveTab] = useState('webhooks');

  // Webhook state
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loadingHooks, setLoadingHooks] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Inbound webhook key state
  const [inboundKey, setInboundKey] = useState('');
  const [inboundKeyVisible, setInboundKeyVisible] = useState(false);
  const [inboundKeySaving, setInboundKeySaving] = useState(false);
  const [inboundKeyCopied, setInboundKeyCopied] = useState(false);

  // Load webhooks / inbound key whenever the relevant tab is opened
  useEffect(() => {
    if (activeTab === 'webhooks') fetchWebhooks();
    if (activeTab === 'inbound') fetchInboundKey();
  }, [activeTab]);

  async function fetchWebhooks() {
    setLoadingHooks(true);
    try {
      const token = localStorage.getItem('relay_token');
      const resp = await fetch('/api/webhooks', { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error('Failed to load');
      setWebhooks(await resp.json());
    } catch {
      // Silently fail — empty list shown
    } finally {
      setLoadingHooks(false);
    }
  }

  async function deleteWebhook(id: string) {
    if (!confirm('Delete this webhook? This cannot be undone.')) return;
    try {
      const token = localStorage.getItem('relay_token');
      await fetch(`/api/webhooks/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setWebhooks(prev => prev.filter(h => h.id !== id));
    } catch {
      alert('Failed to delete webhook. Please try again.');
    }
  }

  async function toggleWebhook(hook: Webhook) {
    try {
      const token = localStorage.getItem('relay_token');
      const resp = await fetch(`/api/webhooks/${hook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: !hook.enabled }),
      });
      if (!resp.ok) throw new Error();
      const updated = await resp.json();
      setWebhooks(prev => prev.map(h => h.id === hook.id ? updated : h));
    } catch {
      alert('Failed to update webhook. Please try again.');
    }
  }

  async function fetchInboundKey() {
    try {
      const token = localStorage.getItem('relay_token');
      const resp = await fetch('/api/settings', { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) return;
      const settings = await resp.json();
      setInboundKey(settings.inbound_webhook_key || '');
    } catch { /* silently ignore */ }
  }

  async function saveInboundKey(key: string) {
    setInboundKeySaving(true);
    try {
      const token = localStorage.getItem('relay_token');
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ inbound_webhook_key: key }),
      });
      setInboundKey(key);
    } catch {
      alert('Failed to save key. Please try again.');
    } finally {
      setInboundKeySaving(false);
    }
  }

  function generateKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const key = Array.from({ length: 40 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    saveInboundKey(key);
  }

  function copyInboundKey() {
    navigator.clipboard.writeText(inboundKey).then(() => {
      setInboundKeyCopied(true);
      setTimeout(() => setInboundKeyCopied(false), 2000);
    });
  }

  // Derive the inbound endpoint URL from the current window location
  const inboundEndpoint = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}/api/inbound`
    : '/api/inbound';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Integrations</h2>
        <p className="text-slate-500 text-sm">Connect Relay to external tools and automate workflows with webhooks.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-4 border-b border-slate-200">
        {[{ id: 'webhooks', label: 'Outbound Webhooks' }, { id: 'inbound', label: 'Inbound Webhook' }].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.id ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Webhooks tab */}
      {activeTab === 'webhooks' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Outbound Webhooks</h3>
              <p className="text-sm text-slate-500 mt-0.5">Send real-time event data to external tools like Zapier, Make or your own API.</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Webhook
            </button>
          </div>

          {/* Info box */}
          <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 text-sm text-teal-800">
            <strong>How it works:</strong> When an event occurs, Relay sends a POST request with a JSON payload to your endpoint.
            Optionally set a signing secret to verify requests using the <code className="bg-teal-100 px-1 rounded">X-Relay-Signature</code> header (HMAC-SHA256).
          </div>

          {/* Webhooks table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loadingHooks ? (
              <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Loading...</div>
            ) : webhooks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                  <Plus className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium text-slate-600">No webhooks configured</p>
                <p className="text-xs text-slate-400 mt-1">Add a webhook above to start receiving event notifications.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Event</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Endpoint URL</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Signing</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {webhooks.map(hook => (
                    <tr key={hook.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-900">{EVENT_LABELS[hook.event_type] || hook.event_type}</span>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <span className="text-sm text-slate-500 font-mono truncate block">{hook.url}</span>
                      </td>
                      <td className="px-6 py-4">
                        {hook.secret ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-teal-50 text-teal-700 rounded-full">Signed</span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-slate-100 text-slate-500 rounded-full">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                          hook.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {hook.enabled ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {/* Toggle enabled */}
                          <button
                            onClick={() => toggleWebhook(hook)}
                            title={hook.enabled ? 'Pause webhook' : 'Enable webhook'}
                            className="text-slate-400 hover:text-teal-600 transition-colors"
                          >
                            {hook.enabled
                              ? <ToggleRight className="w-5 h-5 text-teal-500" />
                              : <ToggleLeft className="w-5 h-5" />
                            }
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => deleteWebhook(hook.id)}
                            title="Delete webhook"
                            className="text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Event reference */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h4 className="text-sm font-bold text-slate-700 mb-4">Event Reference</h4>
            <div className="space-y-3">
              {Object.entries(EVENT_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-mono">{key}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{label}</p>
                    <p className="text-xs text-slate-400">{EVENT_DESCRIPTIONS[key]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Inbound tab */}
      {activeTab === 'inbound' && (
        <div className="space-y-6 max-w-2xl">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Inbound Webhook</h3>
            <p className="text-sm text-slate-500 mt-0.5">Let external tools like Zapier or Make inject messages directly into conversations.</p>
          </div>

          {/* Info box */}
          <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 text-sm text-teal-800">
            <strong>How it works:</strong> Send a POST request to the endpoint below with your API key in the <code className="bg-teal-100 px-1 rounded">X-Relay-Key</code> header.
            Relay will inject the message into the specified conversation — or create a new one if no ID is provided.
          </div>

          {/* Endpoint URL */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Endpoint</label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
                <code className="text-sm text-slate-700 flex-1 break-all font-mono">POST {inboundEndpoint}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(`POST ${inboundEndpoint}`); }}
                  className="text-slate-400 hover:text-teal-600 transition-colors shrink-0"
                  title="Copy URL"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* API key */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">API Key</label>
              {inboundKey ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
                    <code className="text-sm text-slate-700 flex-1 break-all font-mono">
                      {inboundKeyVisible ? inboundKey : '•'.repeat(Math.min(inboundKey.length, 32))}
                    </code>
                    <button onClick={() => setInboundKeyVisible(v => !v)} className="text-slate-400 hover:text-slate-600 transition-colors shrink-0">
                      {inboundKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={copyInboundKey} className="text-slate-400 hover:text-teal-600 transition-colors shrink-0" title="Copy key">
                      {inboundKeyCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    onClick={() => { if (confirm('Regenerate the API key? Any existing integrations using the old key will stop working.')) generateKey(); }}
                    disabled={inboundKeySaving}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {inboundKeySaving ? 'Regenerating...' : 'Regenerate key'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">No API key set. Generate one to enable inbound webhooks.</p>
                  <button
                    onClick={generateKey}
                    disabled={inboundKeySaving}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {inboundKeySaving ? 'Generating...' : 'Generate API Key'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Payload reference */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h4 className="text-sm font-bold text-slate-700">Payload Reference</h4>
            <p className="text-xs text-slate-500">Send a JSON body with the following fields:</p>

            <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
              <pre className="text-xs text-slate-100 font-mono leading-relaxed">{`POST ${inboundEndpoint}
X-Relay-Key: YOUR_API_KEY
Content-Type: application/json

{
  "assistant_id": "...",       // required if no conversation_id
  "conversation_id": "...",    // optional — appends to existing conv
  "content": "Your message",   // required
  "role": "human"              // optional — "human" (default) or "system"
}`}</pre>
            </div>

            <div className="space-y-2 pt-2">
              <h5 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Response</h5>
              <div className="bg-slate-900 rounded-xl p-4">
                <pre className="text-xs text-slate-100 font-mono">{`{ "conversation_id": "...", "message_id": "..." }`}</pre>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <h5 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Use cases</h5>
              <ul className="space-y-1 text-xs text-slate-500 list-disc list-inside">
                <li>Inject a CRM note or status update into an active conversation</li>
                <li>Trigger a message from a Zapier/Make automation based on a form submission or calendar event</li>
                <li>Send a follow-up message to a conversation after a booking is confirmed</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <AddWebhookModal
          onClose={() => setShowAddModal(false)}
          onSaved={hook => {
            setWebhooks(prev => [hook, ...prev]);
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}

const EVENT_DESCRIPTIONS: Record<string, string> = {
  conversation_started: 'Fires when a new widget conversation is created.',
  lead_captured:        'Fires when a conversation is started with lead capture data (name, email or phone).',
  handoff_triggered:    'Fires when the assistant detects a handoff request and marks the conversation as handed off.',
  conversation_closed:  'Fires when a conversation is manually closed from the Inbox.',
};
