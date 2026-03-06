import React, { useState, useEffect } from 'react';
import { Save, Key, Shield, Database, Bell, Globe, CheckCircle, AlertCircle, UserPlus, Trash2, Crown, Copy, RefreshCw } from 'lucide-react';
import { api, getToken } from '../services/api';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function Settings() {
  const [activeSection, setActiveSection] = useState('api-keys');

  const sections = [
    { id: 'api-keys', label: 'API Keys', icon: Key },
    { id: 'general', label: 'General', icon: Globe },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'data', label: 'Data & GDPR', icon: Database },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Platform Settings</h2>
        <p className="text-slate-500 text-sm">Manage global configurations and security for your Relay instance.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 w-full lg:w-64 shrink-0">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap lg:w-full ${
                activeSection === section.id
                  ? 'bg-white text-teal-600 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:bg-white/50 hover:text-slate-900'
              }`}
            >
              <section.icon className={`w-4 h-4 ${activeSection === section.id ? 'text-teal-600' : 'text-slate-400'}`} />
              {section.label}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 lg:p-8">
            {activeSection === 'api-keys' && <ApiKeysSection />}
            {activeSection === 'general' && <GeneralSection />}
            {activeSection === 'security' && <SecuritySection />}
            {activeSection === 'notifications' && <NotificationsSection />}
            {activeSection === 'data' && <DataSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- API Keys Section ---

function ApiKeysSection() {
  const [keys, setKeys] = useState({
    anthropic_api_key: '',
    openai_api_key: '',
    google_api_key: '',
    xai_api_key: '',
    meta_app_id: '',
    meta_app_secret: '',
    meta_webhook_verify_token: '',
  });
  const [vectorProvider, setVectorProvider] = useState('pinecone');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [isLoading, setIsLoading] = useState(true);
  const [verifyTokenCopied, setVerifyTokenCopied] = useState(false);

  useEffect(() => {
    api.getSettings().then(settings => {
      setKeys({
        anthropic_api_key: settings.anthropic_api_key || '',
        openai_api_key: settings.openai_api_key || '',
        google_api_key: settings.google_api_key || '',
        xai_api_key: settings.xai_api_key || '',
        meta_app_id: settings.meta_app_id || '',
        meta_app_secret: settings.meta_app_secret || '',
        meta_webhook_verify_token: settings.meta_webhook_verify_token || '',
      });
      if (settings.vector_db_provider) setVectorProvider(settings.vector_db_provider);
    }).catch(console.error).finally(() => setIsLoading(false));
  }, []);

  const handleSave = async () => {
    setStatus('saving');
    try {
      await api.saveSettings({ ...keys, vector_db_provider: vectorProvider });
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 3000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  const generateVerifyToken = () => {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(20)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    setKeys(k => ({ ...k, meta_webhook_verify_token: token }));
  };

  const copyVerifyToken = async () => {
    if (!keys.meta_webhook_verify_token) return;
    await navigator.clipboard.writeText(keys.meta_webhook_verify_token);
    setVerifyTokenCopied(true);
    setTimeout(() => setVerifyTokenCopied(false), 2000);
  };

  const providers = [
    { key: 'anthropic_api_key' as const, label: 'Anthropic API Key', placeholder: 'sk-ant-...' },
    { key: 'openai_api_key' as const, label: 'OpenAI API Key', placeholder: 'sk-...' },
    { key: 'google_api_key' as const, label: 'Google AI (Gemini) API Key', placeholder: 'AIza...' },
    { key: 'xai_api_key' as const, label: 'xAI API Key', placeholder: 'xai-...' },
  ];

  if (isLoading) {
    return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" /></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Global API Keys</h3>
        <p className="text-sm text-slate-500 mb-6">
          These keys are used as defaults across all assistants. You can override them per assistant in each assistant's Model Settings tab.
        </p>

        <div className="space-y-4 max-w-2xl">
          {providers.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <div className="relative">
                <input
                  type="password"
                  value={keys[key]}
                  onChange={e => setKeys({ ...keys, [key]: e.target.value })}
                  placeholder={placeholder}
                  className="w-full pl-4 pr-10 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                />
                <Key className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              </div>
            </div>
          ))}

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="h-5">
              {status === 'saved' && (
                <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                  <CheckCircle className="w-4 h-4" />
                  Saved successfully
                </span>
              )}
              {status === 'error' && (
                <span className="flex items-center gap-1.5 text-sm text-rose-600">
                  <AlertCircle className="w-4 h-4" />
                  Failed to save — try again
                </span>
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={status === 'saving'}
              className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-all shadow-sm disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {status === 'saving' ? 'Saving...' : 'Save API Keys'}
            </button>
          </div>
        </div>
      </div>

      <div className="pt-8 border-t border-slate-100">
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Vector Database</h3>
        <p className="text-sm text-slate-500 mb-6">Configure storage for knowledge base embeddings (used in Phase 3).</p>
        <div className="max-w-2xl">
          <label className="block text-sm font-medium text-slate-700 mb-1">Provider</label>
          <select
            value={vectorProvider}
            onChange={e => setVectorProvider(e.target.value)}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
          >
            <option value="pinecone">Pinecone</option>
            <option value="pgvector">Supabase (pgvector)</option>
            <option value="weaviate">Weaviate</option>
          </select>
        </div>
      </div>

      {/* Meta / Social Channels */}
      <div className="pt-8 border-t border-slate-100">
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Meta / Social Channels</h3>
        <p className="text-sm text-slate-500 mb-6">
          Required to connect Facebook Messenger, Instagram Direct and WhatsApp Business. Create a Meta Developer App at{' '}
          <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">
            developers.facebook.com
          </a>{' '}
          and paste your credentials below.
        </p>

        <div className="space-y-4 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Meta App ID</label>
            <input
              type="text"
              value={keys.meta_app_id}
              onChange={e => setKeys(k => ({ ...k, meta_app_id: e.target.value }))}
              placeholder="1234567890"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Meta App Secret</label>
            <div className="relative">
              <input
                type="password"
                value={keys.meta_app_secret}
                onChange={e => setKeys(k => ({ ...k, meta_app_secret: e.target.value }))}
                placeholder="••••••••••••••••"
                className="w-full pl-4 pr-10 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
              <Key className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            </div>
          </div>

          {/* Webhook verify token — auto-generated, read-only after generation */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Webhook Verify Token</label>
            <p className="text-xs text-slate-400 mb-2">
              Generate a token once, then paste it into your Meta App's webhook configuration. Do not change it after setting up — Meta will use it to verify your endpoint.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={keys.meta_webhook_verify_token}
                placeholder="Click Generate to create a token"
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 font-mono text-slate-600"
              />
              <button
                onClick={copyVerifyToken}
                disabled={!keys.meta_webhook_verify_token}
                title="Copy token"
                className="px-3 py-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-40"
              >
                {verifyTokenCopied ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={generateVerifyToken}
                title="Generate new token"
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />Generate
              </button>
            </div>
          </div>

          {/* Webhook URL — read-only reference */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700">Webhook URL to paste into Meta App dashboard:</p>
            <p className="font-mono break-all">{window.location.protocol}//{window.location.host}/api/webhooks/meta</p>
            <p className="pt-1">Set the <span className="font-semibold">Callback URL</span> to the above and the <span className="font-semibold">Verify Token</span> to the token you generated above. Subscribe to <span className="font-mono">messages</span> and <span className="font-mono">messaging_postbacks</span> events.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- General Section ---

function GeneralSection() {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">General Settings</h3>
        <p className="text-sm text-slate-500 mb-6">Basic configuration for your Relay platform.</p>
        <div className="space-y-6 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Platform Name</label>
              <input type="text" defaultValue="Relay" className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Support Email</label>
              <input type="email" defaultValue="" placeholder="support@yourcompany.com" className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Default Language</label>
              <select className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none">
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Timezone</label>
              <select className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none">
                <option value="Europe/London">London (GMT/BST)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="Europe/Paris">Central European Time</option>
              </select>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-all shadow-sm">
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Security Section ---

interface TeamUser { id: string; email: string; role: string; created_at: string }

function SecuritySection() {
  // Change password state
  const [pwFields, setPwFields] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwStatus, setPwStatus] = useState<SaveStatus>('idle');
  const [pwError, setPwError] = useState('');

  // Team management state
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'member' });
  const [addStatus, setAddStatus] = useState<SaveStatus>('idle');
  const [addError, setAddError] = useState('');

  // Decode current user's role from JWT
  const currentUserId = (() => {
    try {
      const token = getToken();
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload;
    } catch { return null; }
  })();
  const isAdmin = currentUserId?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/admin/users', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setUsers(data); })
      .catch(console.error)
      .finally(() => setUsersLoading(false));
  }, [isAdmin]);

  const handleChangePassword = async () => {
    setPwError('');
    if (pwFields.newPassword !== pwFields.confirmPassword) { setPwError('New passwords do not match.'); return; }
    if (pwFields.newPassword.length < 8) { setPwError('New password must be at least 8 characters.'); return; }
    setPwStatus('saving');
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() || ''}` },
        body: JSON.stringify({ currentPassword: pwFields.currentPassword, newPassword: pwFields.newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');
      setPwStatus('saved');
      setPwFields({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPwStatus('idle'), 3000);
    } catch (err: any) {
      setPwError(err.message);
      setPwStatus('error');
      setTimeout(() => setPwStatus('idle'), 4000);
    }
  };

  const handleAddUser = async () => {
    setAddError('');
    setAddStatus('saving');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() || ''}` },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add user');
      setUsers(u => [...u, data]);
      setNewUser({ email: '', password: '', role: 'member' });
      setAddStatus('saved');
      setTimeout(() => setAddStatus('idle'), 3000);
    } catch (err: any) {
      setAddError(err.message);
      setAddStatus('error');
      setTimeout(() => setAddStatus('idle'), 4000);
    }
  };

  const handleRemoveUser = async (id: string) => {
    if (!confirm('Remove this user? They will no longer be able to log in.')) return;
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken() || ''}` },
    });
    if (res.ok) setUsers(u => u.filter(x => x.id !== id));
  };

  return (
    <div className="space-y-10 max-w-2xl">

      {/* Change Password */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Change Password</h3>
        <p className="text-sm text-slate-500 mb-5">Update your login password.</p>
        <div className="space-y-4">
          {(['currentPassword', 'newPassword', 'confirmPassword'] as const).map((field, i) => (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {['Current password', 'New password', 'Confirm new password'][i]}
              </label>
              <input
                type="password"
                value={pwFields[field]}
                onChange={e => setPwFields({ ...pwFields, [field]: e.target.value })}
                placeholder={field === 'newPassword' ? 'Min. 8 characters' : '••••••••'}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
            </div>
          ))}
          {pwError && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{pwError}</p>}
          <div className="flex items-center justify-between pt-1">
            <div className="h-5">
              {pwStatus === 'saved' && (
                <span className="flex items-center gap-1.5 text-sm text-emerald-600"><CheckCircle className="w-4 h-4" />Password changed</span>
              )}
            </div>
            <button
              onClick={handleChangePassword}
              disabled={pwStatus === 'saving' || !pwFields.currentPassword || !pwFields.newPassword || !pwFields.confirmPassword}
              className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-all shadow-sm disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {pwStatus === 'saving' ? 'Saving...' : 'Change Password'}
            </button>
          </div>
        </div>
      </div>

      {/* Team Members — admin only */}
      {isAdmin && (
        <div className="pt-6 border-t border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Team Members</h3>
          <p className="text-sm text-slate-500 mb-5">Manage who can log in to this Relay instance.</p>

          {/* User list */}
          {usersLoading ? (
            <div className="flex items-center justify-center h-16"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-teal-600" /></div>
          ) : (
            <div className="space-y-2 mb-6">
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 uppercase">
                      {u.email[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{u.email}</p>
                      <p className="text-xs text-slate-400 capitalize flex items-center gap-1">
                        {u.role === 'admin' && <Crown className="w-3 h-3 text-amber-500" />}
                        {u.role}
                      </p>
                    </div>
                  </div>
                  {u.id !== currentUserId?.id && (
                    <button
                      onClick={() => handleRemoveUser(u.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Remove user"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add new user */}
          <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
            <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-teal-600" />
              Add team member
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Email address</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="colleague@yourcompany.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Temporary password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Min. 8 characters"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                <select
                  value={newUser.role}
                  onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            {addError && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{addError}</p>}
            <div className="flex items-center justify-between">
              <div className="h-5">
                {addStatus === 'saved' && (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-600"><CheckCircle className="w-4 h-4" />User added</span>
                )}
              </div>
              <button
                onClick={handleAddUser}
                disabled={addStatus === 'saving' || !newUser.email || !newUser.password}
                className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-all shadow-sm disabled:opacity-60"
              >
                <UserPlus className="w-4 h-4" />
                {addStatus === 'saving' ? 'Adding...' : 'Add User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Notifications Section ---

function NotificationsSection() {
  const [fields, setFields] = useState({
    notification_email: '',
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_pass: '',
    smtp_from: '',
  });
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [isLoading, setIsLoading] = useState(true);
  const [showSmtp, setShowSmtp] = useState(false);

  useEffect(() => {
    api.getSettings().then(settings => {
      setFields({
        notification_email: settings.notification_email || '',
        smtp_host: settings.smtp_host || '',
        smtp_port: settings.smtp_port || '587',
        smtp_user: settings.smtp_user || '',
        smtp_pass: settings.smtp_pass || '',
        smtp_from: settings.smtp_from || '',
      });
      if (settings.smtp_host) setShowSmtp(true);
    }).catch(console.error).finally(() => setIsLoading(false));
  }, []);

  const handleSave = async () => {
    setStatus('saving');
    try {
      await api.saveSettings(fields);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 3000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" /></div>;
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Notification Preferences</h3>
        <p className="text-sm text-slate-500 mb-6">
          Configure where to send alerts when a human handoff is requested.
        </p>

        {/* Notification email */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notification email
            </label>
            <input
              type="email"
              value={fields.notification_email}
              onChange={e => setFields({ ...fields, notification_email: e.target.value })}
              placeholder="you@yourcompany.com"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
            />
            <p className="text-xs text-slate-400 mt-1">
              An email will be sent to this address whenever a visitor requests a human agent.
            </p>
          </div>

          {/* SMTP config toggle */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowSmtp(v => !v)}
              className="text-sm font-medium text-teal-600 hover:text-teal-700"
            >
              {showSmtp ? 'Hide SMTP settings' : 'Configure SMTP server'}
            </button>
          </div>

          {showSmtp && (
            <div className="space-y-4 p-5 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs text-slate-500">
                Enter your SMTP server details. Works with Gmail, Outlook, SendGrid, Mailgun and any standard SMTP provider.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">SMTP host</label>
                  <input
                    type="text"
                    value={fields.smtp_host}
                    onChange={e => setFields({ ...fields, smtp_host: e.target.value })}
                    placeholder="smtp.gmail.com"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Port</label>
                  <input
                    type="number"
                    value={fields.smtp_port}
                    onChange={e => setFields({ ...fields, smtp_port: e.target.value })}
                    placeholder="587"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">From address</label>
                  <input
                    type="email"
                    value={fields.smtp_from}
                    onChange={e => setFields({ ...fields, smtp_from: e.target.value })}
                    placeholder="relay@yourcompany.com"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={fields.smtp_user}
                    onChange={e => setFields({ ...fields, smtp_user: e.target.value })}
                    placeholder="your@gmail.com"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password / App password</label>
                  <input
                    type="password"
                    value={fields.smtp_pass}
                    onChange={e => setFields({ ...fields, smtp_pass: e.target.value })}
                    placeholder="••••••••••••"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
        <div className="h-5">
          {status === 'saved' && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle className="w-4 h-4" />
              Saved successfully
            </span>
          )}
          {status === 'error' && (
            <span className="flex items-center gap-1.5 text-sm text-rose-600">
              <AlertCircle className="w-4 h-4" />
              Failed to save - try again
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={status === 'saving'}
          className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-all shadow-sm disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {status === 'saving' ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

// --- Data & GDPR Section ---

function DataSection() {
  const [retention, setRetention] = useState('90');
  const [retentionStatus, setRetentionStatus] = useState<SaveStatus>('idle');
  const [isLoading, setIsLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    api.getSettings().then(settings => {
      if (settings.conversation_retention_days) setRetention(settings.conversation_retention_days);
    }).catch(console.error).finally(() => setIsLoading(false));
  }, []);

  const handleSaveRetention = async () => {
    setRetentionStatus('saving');
    try {
      await api.saveSettings({ conversation_retention_days: retention });
      setRetentionStatus('saved');
      setTimeout(() => setRetentionStatus('idle'), 3000);
    } catch {
      setRetentionStatus('error');
      setTimeout(() => setRetentionStatus('idle'), 4000);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = getToken();
      const resp = await fetch('/api/data/export', { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error('Export failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relay-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAll = async () => {
    const first = confirm('This will permanently delete ALL conversations and messages. This cannot be undone.\n\nAre you sure?');
    if (!first) return;
    const second = confirm('Final confirmation: delete all conversation data?');
    if (!second) return;

    setDeleting(true);
    setDeleteError('');
    try {
      const token = getToken();
      const resp = await fetch('/api/data/all', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'X-Confirm': 'delete-all' },
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Delete failed');
      }
      alert('All conversation data has been deleted.');
    } catch (err: any) {
      setDeleteError(err.message || 'Delete failed. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" /></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Data and Privacy</h3>
        <p className="text-sm text-slate-500 mb-6">Manage data retention and compliance for your Relay instance.</p>
        <div className="space-y-6 max-w-2xl">

          {/* Retention */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Conversation Retention</label>
            <select
              value={retention}
              onChange={e => setRetention(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
            >
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
              <option value="indefinite">Indefinite</option>
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Sets the intended retention period. Note: automatic deletion requires a scheduled job to be configured separately.
            </p>
            <div className="flex items-center justify-between mt-3">
              <div className="h-5">
                {retentionStatus === 'saved' && (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-600"><CheckCircle className="w-4 h-4" />Saved</span>
                )}
                {retentionStatus === 'error' && (
                  <span className="flex items-center gap-1.5 text-sm text-rose-600"><AlertCircle className="w-4 h-4" />Failed to save</span>
                )}
              </div>
              <button
                onClick={handleSaveRetention}
                disabled={retentionStatus === 'saving'}
                className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-all shadow-sm disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {retentionStatus === 'saving' ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>

          {/* Export */}
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
            <p className="text-sm font-semibold text-amber-900 mb-1">Export Conversation Data</p>
            <p className="text-xs text-amber-700 mb-4">Download a CSV of all conversations including lead capture data and status.</p>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors disabled:opacity-60"
            >
              {exporting ? 'Preparing...' : 'Export Conversations (.csv)'}
            </button>
          </div>

          {/* Delete all */}
          <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
            <p className="text-sm font-semibold text-rose-900 mb-1">Delete All Conversation Data</p>
            <p className="text-xs text-rose-700 mb-4">Permanently deletes all conversations and messages. Assistants and knowledge bases are not affected. This cannot be undone.</p>
            {deleteError && <p className="text-xs text-rose-700 mb-3 bg-rose-100 px-3 py-2 rounded-lg">{deleteError}</p>}
            <button
              onClick={handleDeleteAll}
              disabled={deleting}
              className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors disabled:opacity-60"
            >
              {deleting ? 'Deleting...' : 'Delete All Conversations'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
