import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Trash2,
  Globe,
  Database,
  Cpu,
  MessageSquare,
  Clock,
  UserCheck,
  FormInput,
  Palette,
  Plus,
  Trash,
  Settings,
  Play,
  Send,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  FileText,
  Link,
  HelpCircle,
  Type,
  X,
  Upload,
  Loader2,
  Copy,
  Check,
  Code2,
  MessageSquarePlus,
  ExternalLink,
  Wifi,
  WifiOff,
  Eye,
  ThumbsDown,
  BarChart2,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { api, getToken } from '../services/api';
import { Assistant, KnowledgeEntry, AnalyticsData } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const tabs = [
  { id: 'general', label: 'General', icon: MessageSquare },
  { id: 'knowledge', label: 'Knowledge Base', icon: Database },
  { id: 'model', label: 'Model Settings', icon: Cpu },
  { id: 'preview', label: 'Preview', icon: Play },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  { id: 'channels', label: 'Channels', icon: Globe },
  { id: 'hours', label: 'Hours of Operation', icon: Clock },
  { id: 'handoff', label: 'Handoff Rules', icon: UserCheck },
  { id: 'lead', label: 'Lead Capture', icon: FormInput },
  { id: 'quickreplies', label: 'Quick Replies', icon: MessageSquarePlus },
  { id: 'appearance', label: 'Appearance', icon: Palette },
];

// Model options per provider — kept in sync with Assistants.tsx creation modal
const MODEL_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  anthropic: [
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Recommended)' },
    { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  google: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  ],
  xai: [
    { value: 'grok-3', label: 'Grok 3' },
    { value: 'grok-3-mini', label: 'Grok 3 Mini' },
    { value: 'grok-2', label: 'Grok 2' },
  ],
};

export default function AssistantSettings() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('general');
  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [globalSettings, setGlobalSettings] = useState<Record<string, string>>({});
  const [previewEntry, setPreviewEntry] = useState<KnowledgeEntry | null>(null);
  const [trainModal, setTrainModal] = useState<{ question: string; answer: string } | null>(null);
  const [trainAnswer, setTrainAnswer] = useState('');
  const [isSavingTraining, setIsSavingTraining] = useState(false);
  const [trainSaved, setTrainSaved] = useState(false);

  // Preview / test chat state
  const [showSources, setShowSources] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  type ChatMessage = { role: 'user' | 'assistant'; content: string; sources?: Array<{ type: string; label: string; snippet: string }>; systemPrompt?: string };
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Analytics tab state
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // Embed code copy state
  const [copied, setCopied] = useState(false);

  // Handoff rules tab — new trigger phrase input
  const [newTrigger, setNewTrigger] = useState('');

  // Quick replies tab — new reply input
  const [newReply, setNewReply] = useState('');

  // Avatar upload state
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Channel connections state
  const [channelConnections, setChannelConnections] = useState<Record<string, any>>({});
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [whatsappForm, setWhatsappForm] = useState({ phone_number_id: '', waba_id: '', access_token: '' });
  const [whatsappSaving, setWhatsappSaving] = useState(false);
  const [metaNotif, setMetaNotif] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [metaPagePicker, setMetaPagePicker] = useState<{ pages: { id: string; name: string; access_token: string }[]; channel: string } | null>(null);

  // Knowledge base modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalTab, setModalTab] = useState<'file' | 'url' | 'qa' | 'text'>('file');
  const [urlInput, setUrlInput] = useState('');
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  // Handle OAuth callback query params — Meta redirects back here after OAuth
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);

    const metaConnected = searchParams.get('meta_connected');
    const metaError = searchParams.get('meta_error');
    const metaPages = searchParams.get('meta_pages');
    const metaChannel = searchParams.get('channel');

    if (metaConnected) {
      setActiveTab('channels');
      setMetaNotif({ type: 'success', msg: `${metaConnected === 'facebook' ? 'Facebook Messenger' : 'Instagram Direct'} connected successfully.` });
      setTimeout(() => setMetaNotif(null), 6000);
    }
    if (metaError) {
      setActiveTab('channels');
      const msgs: Record<string, string> = {
        missing_credentials: 'Meta App ID/Secret not set in Settings > API Keys.',
        no_pages: 'No Facebook Pages found on your account.',
        no_instagram: 'No Instagram Professional account linked to your pages.',
      };
      setMetaNotif({ type: 'error', msg: msgs[metaError] || `OAuth error: ${metaError}` });
    }
    if (metaPages && metaChannel) {
      setActiveTab('channels');
      try {
        // base64url → base64 → JSON (Buffer isn't available in the browser)
        const b64 = metaPages.replace(/-/g, '+').replace(/_/g, '/');
        const pages = JSON.parse(atob(b64));
        setMetaPagePicker({ pages, channel: metaChannel });
      } catch { /* ignore */ }
    }

    if (tab || metaConnected || metaError || metaPages) {
      // Clear all OAuth-related params from the URL without re-rendering the route
      setSearchParams({}, { replace: true });
    }
  }, []);

  // Load channel connections whenever the user switches to the Channels tab
  useEffect(() => {
    if (activeTab === 'channels' && id) {
      loadChannels();
    }
  }, [activeTab, id]);

  // Load analytics whenever the user switches to the Analytics tab
  useEffect(() => {
    if (activeTab === 'analytics' && id && !analyticsData) {
      loadAnalytics();
    }
  }, [activeTab, id]);

  const loadAnalytics = async () => {
    if (!id) return;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const data = await api.getAssistantAnalytics(id);
      setAnalyticsData(data);
    } catch (err: any) {
      setAnalyticsError(err?.message || 'Failed to load analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadChannels = async () => {
    if (!id) return;
    setIsLoadingChannels(true);
    try {
      const token = getToken();
      const resp = await fetch(`/api/channel-connections/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      const map: Record<string, any> = {};
      (data as any[]).forEach(c => { map[c.channel] = c; });
      setChannelConnections(map);
      // Pre-fill WhatsApp form if already saved
      if (map.whatsapp) {
        setWhatsappForm({
          phone_number_id: map.whatsapp.phone_number_id || '',
          waba_id: map.whatsapp.waba_id || '',
          access_token: map.whatsapp.access_token || '',
        });
      }
    } catch (err) {
      console.error('Failed to load channel connections', err);
    } finally {
      setIsLoadingChannels(false);
    }
  };

  const connectMetaChannel = (channel: 'facebook' | 'instagram') => {
    const token = getToken();
    window.location.href = `/api/auth/meta/connect?assistant_id=${id}&channel=${channel}&token=${token}`;
  };

  const disconnectChannel = async (channel: string) => {
    const token = getToken();
    await fetch(`/api/channel-connections/${id}/${channel}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setChannelConnections(prev => ({ ...prev, [channel]: { ...prev[channel], status: 'disconnected' } }));
  };

  const saveWhatsapp = async () => {
    if (!whatsappForm.phone_number_id || !whatsappForm.access_token) return;
    setWhatsappSaving(true);
    try {
      const token = getToken();
      await fetch(`/api/channel-connections/${id}/whatsapp`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          status: 'connected',
          phone_number_id: whatsappForm.phone_number_id,
          waba_id: whatsappForm.waba_id,
          access_token: whatsappForm.access_token,
          connected_at: new Date().toISOString(),
        }),
      });
      await loadChannels();
      setMetaNotif({ type: 'success', msg: 'WhatsApp Business connected.' });
      setTimeout(() => setMetaNotif(null), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setWhatsappSaving(false);
    }
  };

  const selectMetaPage = async (page: { id: string; name: string; access_token: string }, channel: string) => {
    const token = getToken();
    await fetch(`/api/channel-connections/${id}/${channel}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        status: 'connected',
        page_id: page.id,
        page_name: page.name,
        access_token: page.access_token,
        connected_at: new Date().toISOString(),
      }),
    });
    setMetaPagePicker(null);
    await loadChannels();
    setMetaNotif({ type: 'success', msg: `${channel === 'facebook' ? 'Facebook Messenger' : 'Instagram Direct'} connected to ${page.name}.` });
    setTimeout(() => setMetaNotif(null), 4000);
  };

  const loadData = async () => {
    try {
      const [assistantData, knowledgeData, settings] = await Promise.all([
        api.getAssistant(id!),
        api.getKnowledge(id!),
        api.getSettings(),
      ]);
      setAssistant(assistantData);
      setKnowledge(knowledgeData);
      setGlobalSettings(settings);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!assistant) return;
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      await api.updateAssistant(id!, assistant);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error(error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!assistant) return;
    setIsUploadingAvatar(true);
    try {
      const result = await api.uploadAvatar(id!, file);
      setAssistant(prev => prev ? { ...prev, avatar_url: result.avatar_url } : prev);
    } catch (err: any) {
      console.error('Avatar upload failed:', err);
      alert(err?.message || 'Failed to upload avatar');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this assistant? This action cannot be undone.')) return;
    try {
      await api.deleteAssistant(id!);
      navigate('/assistants');
    } catch (error) {
      console.error(error);
    }
  };

  // Scroll to bottom of chat whenever messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatLoading]);

  // Seed the welcome message when the preview tab is first opened
  useEffect(() => {
    if (activeTab === 'preview' && assistant && chatMessages.length === 0 && assistant.welcome_message) {
      setChatMessages([{ role: 'assistant', content: assistant.welcome_message }]);
    }
  }, [activeTab]);

  const handleChatSend = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg = { role: 'user' as const, content: chatInput.trim() };
    const updated = [...chatMessages, userMsg];
    setChatMessages(updated);
    setChatInput('');
    setIsChatLoading(true);
    setChatError(null);
    try {
      const result = await api.chat(id!, updated, { debug: debugMode || showSources });
      const assistantMsg: ChatMessage = { role: 'assistant', content: result.response };
      if (result.sources) assistantMsg.sources = result.sources;
      if (result.systemPrompt) assistantMsg.systemPrompt = result.systemPrompt;
      setChatMessages([...updated, assistantMsg]);
    } catch (err: any) {
      setChatError(err.message || 'Something went wrong.');
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleChatReset = () => {
    const welcome = assistant?.welcome_message
      ? [{ role: 'assistant' as const, content: assistant.welcome_message }]
      : [];
    setChatMessages(welcome);
    setChatError(null);
  };

  const openAddModal = () => {
    setModalTab('file');
    setUrlInput('');
    setQaQuestion('');
    setQaAnswer('');
    setTextTitle('');
    setTextContent('');
    setAddError(null);
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    if (isAdding) return;
    setShowAddModal(false);
  };

  const handleAddSource = async () => {
    if (!id) return;
    setIsAdding(true);
    setAddError(null);
    try {
      let entry: KnowledgeEntry | null = null;

      if (modalTab === 'file') {
        const file = fileInputRef.current?.files?.[0];
        if (!file) throw new Error('Please select a file.');
        entry = await api.uploadKnowledgeFile(id, file);

      } else if (modalTab === 'url') {
        if (!urlInput.trim()) throw new Error('Please enter a URL.');
        entry = await api.scrapeUrl(id, urlInput.trim());

      } else if (modalTab === 'qa') {
        if (!qaQuestion.trim() || !qaAnswer.trim()) throw new Error('Please fill in both the question and answer.');
        entry = await api.addKnowledge(id, {
          type: 'qa',
          content: `Q: ${qaQuestion.trim()}\nA: ${qaAnswer.trim()}`,
          metadata: { question: qaQuestion.trim() },
        } as any);

      } else if (modalTab === 'text') {
        if (!textContent.trim()) throw new Error('Please enter some content.');
        entry = await api.addKnowledge(id, {
          type: 'text',
          content: textContent.trim(),
          metadata: { title: textTitle.trim() || 'Text block' },
        } as any);
      }

      if (entry) {
        setKnowledge(prev => [entry!, ...prev]);
      }
      setShowAddModal(false);
    } catch (err: any) {
      setAddError(err.message || 'Something went wrong.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteKnowledge = async (entryId: string) => {
    try {
      await api.deleteKnowledge(entryId);
      setKnowledge(prev => prev.filter(k => k.id !== entryId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveTraining = async () => {
    if (!id || !trainModal || !trainAnswer.trim()) return;
    setIsSavingTraining(true);
    try {
      const entry = await api.addKnowledge(id, {
        type: 'qa',
        content: `Q: ${trainModal.question}\nA: ${trainAnswer.trim()}`,
        metadata: JSON.stringify({ question: trainModal.question, answer: trainAnswer.trim(), source: 'training_correction' }),
      });
      setKnowledge(prev => [entry, ...prev]);
      setTrainSaved(true);
      setTimeout(() => {
        setTrainModal(null);
        setTrainSaved(false);
      }, 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingTraining(false);
    }
  };

  // Return a label and icon for each knowledge entry type
  const getEntryMeta = (entry: KnowledgeEntry) => {
    let label = '';
    let subtitle = '';
    try {
      const meta = JSON.parse(entry.metadata || '{}');
      if (entry.type === 'file') {
        label = meta.filename || 'Uploaded file';
        subtitle = `File - ${meta.size ? Math.round(meta.size / 1024) + ' KB' : ''}`;
      } else if (entry.type === 'url') {
        label = meta.title || meta.url || 'Web page';
        subtitle = meta.url || '';
      } else if (entry.type === 'qa') {
        label = meta.question || 'Q&A pair';
        subtitle = 'Q&A';
      } else if (entry.type === 'text') {
        label = meta.title || 'Text block';
        subtitle = 'Text block';
      }
    } catch {}
    return { label, subtitle };
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>;
  if (!assistant) return <div>Assistant not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/assistants')}
            className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{assistant.name}</h2>
            <p className="text-slate-500 text-sm">Configure your assistant's behavior and deployment.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle className="w-4 h-4" />
              Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1.5 text-sm text-rose-600">
              <AlertCircle className="w-4 h-4" />
              Save failed
            </span>
          )}
          <button
            onClick={handleDelete}
            className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            title="Delete Assistant"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-all shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Tabs */}
        <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 w-full lg:w-64 shrink-0 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap lg:w-full",
                activeTab === tab.id 
                  ? "bg-white text-teal-600 shadow-sm border border-slate-200" 
                  : "text-slate-500 hover:bg-white/50 hover:text-slate-900"
              )}
            >
              <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-teal-600" : "text-slate-400")} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 lg:p-8">
            {activeTab === 'general' && (
              <div className="space-y-6 max-w-2xl">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">General Configuration</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Assistant Name</label>
                      <input 
                        type="text" 
                        value={assistant.name}
                        onChange={e => setAssistant({...assistant, name: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Personality & Tone</label>
                      <textarea 
                        value={assistant.personality || ''}
                        onChange={e => setAssistant({...assistant, personality: e.target.value})}
                        placeholder="e.g. Professional, friendly, and helpful. Uses concise language."
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none h-24 resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">System Prompt</label>
                      <textarea 
                        value={assistant.system_prompt || ''}
                        onChange={e => setAssistant({...assistant, system_prompt: e.target.value})}
                        placeholder="Core instructions for the AI..."
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none h-48 resize-none font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Welcome Message</label>
                      <input 
                        type="text" 
                        value={assistant.welcome_message || ''}
                        onChange={e => setAssistant({...assistant, welcome_message: e.target.value})}
                        placeholder="Hello! How can I help you today?"
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'knowledge' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Knowledge Base</h3>
                    <p className="text-sm text-slate-500">
                      Train your assistant with files, URLs, Q&A pairs or text blocks.
                      {knowledge.length > 0 && ` ${knowledge.length} source${knowledge.length !== 1 ? 's' : ''} indexed.`}
                    </p>
                  </div>
                  <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Source
                  </button>
                </div>

                {knowledge.length === 0 ? (
                  <div className="text-center py-16 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                    <Database className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-600 mb-1">No knowledge sources yet</p>
                    <p className="text-xs text-slate-400 mb-4">Add files, URLs, Q&A pairs or text to train your assistant.</p>
                    <button
                      onClick={openAddModal}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add your first source
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {knowledge.map((entry) => {
                      const { label, subtitle } = getEntryMeta(entry);
                      const iconMap: Record<string, React.ReactNode> = {
                        file: <FileText className="w-5 h-5 text-teal-600" />,
                        url: <Link className="w-5 h-5 text-indigo-500" />,
                        qa: <HelpCircle className="w-5 h-5 text-amber-500" />,
                        text: <Type className="w-5 h-5 text-slate-500" />,
                      };
                      return (
                        <div key={entry.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 group">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center border border-slate-200 shrink-0">
                              {iconMap[entry.type] || <Database className="w-5 h-5 text-slate-400" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{label}</p>
                              <p className="text-xs text-slate-400 truncate">
                                {subtitle && <span className="mr-2">{subtitle}</span>}
                                Added {new Date(entry.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                              Indexed
                            </span>
                            <button
                              onClick={() => setPreviewEntry(entry)}
                              className="p-1.5 text-slate-300 hover:text-teal-600 transition-colors opacity-0 group-hover:opacity-100"
                              title="View content"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteKnowledge(entry.id)}
                              className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                              title="Remove source"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'model' && (
              <div className="space-y-6 max-w-2xl">
                <h3 className="text-lg font-semibold text-slate-900">Model Configuration</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Provider</label>
                    <select
                      value={assistant.model_provider}
                      onChange={e => {
                        const provider = e.target.value;
                        const firstModel = MODEL_OPTIONS[provider]?.[0]?.value || '';
                        setAssistant({ ...assistant, model_provider: provider, model_name: firstModel });
                      }}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                    >
                      <option value="anthropic">Anthropic</option>
                      <option value="openai">OpenAI</option>
                      <option value="google">Google</option>
                      <option value="xai">xAI</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Model</label>
                    <select
                      value={assistant.model_name}
                      onChange={e => setAssistant({ ...assistant, model_name: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                    >
                      {(MODEL_OPTIONS[assistant.model_provider] || []).map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      API Key Override
                      <span className="ml-2 text-xs font-normal text-slate-400">(optional)</span>
                    </label>
                    <input
                      type="password"
                      value={assistant.api_key || ''}
                      onChange={e => setAssistant({ ...assistant, api_key: e.target.value })}
                      placeholder="Leave blank to use the global key from Settings → API Keys"
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                    />
                    <p className="mt-1 text-xs text-slate-400">Only needed if you want this assistant to use a different key to the one in platform Settings.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Temperature <span className="text-slate-400 font-normal">({assistant.temperature})</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={assistant.temperature}
                      onChange={e => setAssistant({ ...assistant, temperature: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>Precise</span>
                      <span>Creative</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Max Tokens</label>
                    <input
                      type="number"
                      min="256"
                      max="8192"
                      value={assistant.max_tokens}
                      onChange={e => setAssistant({ ...assistant, max_tokens: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'preview' && (
              <div className="flex flex-col h-[600px]">
                {/* Header */}
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Preview</h3>
                    <p className="text-xs text-slate-500">Test your assistant. This conversation is not visible to end users.</p>
                  </div>
                  <button
                    onClick={handleChatReset}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reset
                  </button>
                </div>
                {/* Debug toggles */}
                <div className="flex items-center gap-4 mb-3 shrink-0 pb-3 border-b border-slate-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <button
                      role="switch"
                      aria-checked={showSources}
                      onClick={() => setShowSources(v => !v)}
                      className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', showSources ? 'bg-teal-500' : 'bg-slate-200')}
                    >
                      <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform', showSources ? 'translate-x-4' : 'translate-x-0.5')} />
                    </button>
                    <span className="text-xs text-slate-600">Show data sources</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <button
                      role="switch"
                      aria-checked={debugMode}
                      onClick={() => setDebugMode(v => !v)}
                      className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', debugMode ? 'bg-amber-500' : 'bg-slate-200')}
                    >
                      <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform', debugMode ? 'translate-x-4' : 'translate-x-0.5')} />
                    </button>
                    <span className="text-xs text-slate-600">Debug mode</span>
                  </label>
                </div>

                {/* Warning only if neither per-assistant nor global key is set */}
                {(() => {
                  const globalKeyMap: Record<string, string> = {
                    anthropic: 'anthropic_api_key',
                    openai: 'openai_api_key',
                    google: 'google_api_key',
                    xai: 'xai_api_key',
                  };
                  const hasKey = assistant.api_key || globalSettings[globalKeyMap[assistant.model_provider]];
                  if (hasKey) return null;
                  return (
                    <div className="flex items-start gap-3 p-3 mb-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 shrink-0">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>
                        No API key found for {assistant.model_provider}. Add one in{' '}
                        <a href="/settings" className="font-semibold underline">Settings → API Keys</a>
                        {' '}(global) or in the{' '}
                        <button onClick={() => setActiveTab('model')} className="font-semibold underline">Model Settings</button>
                        {' '}tab (this assistant only).
                      </span>
                    </div>
                  );
                })()}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
                  {chatMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                      <Play className="w-8 h-8 mb-2 text-slate-300" />
                      <p className="text-sm">Send a message to start the conversation.</p>
                    </div>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={cn('flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start')}>
                      <div
                        className={cn(
                          'max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
                          msg.role === 'user'
                            ? 'bg-teal-600 text-white rounded-br-sm'
                            : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                        )}
                      >
                        {msg.content}
                      </div>
                      {msg.role === 'assistant' && (
                        <div className="mt-1 space-y-1.5 w-full max-w-[80%]">
                          {/* Data sources */}
                          {showSources && msg.sources && msg.sources.length > 0 && (
                            <div className="rounded-lg border border-teal-100 bg-teal-50 p-2.5 space-y-1.5">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">Sources used</p>
                              {msg.sources.map((s, si) => (
                                <div key={si} className="text-[11px] text-slate-600">
                                  <span className="font-medium text-teal-700">{s.label}</span>
                                  <p className="text-slate-400 mt-0.5 line-clamp-2">{s.snippet}…</p>
                                </div>
                              ))}
                            </div>
                          )}
                          {showSources && msg.sources && msg.sources.length === 0 && (
                            <div className="rounded-lg border border-amber-100 bg-amber-50 p-2 text-[11px] text-amber-700">
                              No knowledge base sources were used — response is from model's general knowledge.
                            </div>
                          )}
                          {/* Debug: full system prompt */}
                          {debugMode && msg.systemPrompt && (
                            <details className="rounded-lg border border-amber-200 bg-amber-50 text-[11px]">
                              <summary className="px-2.5 py-1.5 font-semibold text-amber-700 cursor-pointer select-none">Debug: system prompt sent to model</summary>
                              <pre className="px-2.5 pb-2.5 text-amber-800 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">{msg.systemPrompt}</pre>
                            </details>
                          )}
                          {/* Train better response */}
                          <button
                            onClick={() => {
                              const question = chatMessages[i - 1]?.content || '';
                              setTrainModal({ question, answer: msg.content });
                              setTrainAnswer(msg.content);
                            }}
                            className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-amber-500 transition-colors px-1"
                            title="Train a better response"
                          >
                            <ThumbsDown className="w-3 h-3" />
                            Train better response
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-bl-sm">
                        <div className="flex gap-1 items-center h-4">
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  {chatError && (
                    <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{chatError}</span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div className="flex gap-2 mt-4 shrink-0">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                    placeholder="Type a message..."
                    disabled={isChatLoading}
                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none disabled:opacity-50"
                  />
                  <button
                    onClick={handleChatSend}
                    disabled={isChatLoading || !chatInput.trim()}
                    className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'channels' && (() => {
              const origin = window.location.origin;
              const embedCode = `<script\n  src="${origin}/widget.js"\n  data-assistant-id="${id}"\n></script>`;

              const handleCopy = () => {
                navigator.clipboard.writeText(embedCode).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2500);
                });
              };

              return (
                <div className="space-y-8 max-w-2xl">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Channels</h3>
                    <p className="text-sm text-slate-500 mt-1">Deploy this assistant on your website using the embeddable chat widget.</p>
                  </div>

                  {/* Web widget section */}
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 border-b border-slate-200">
                      <div className="w-9 h-9 bg-white rounded-lg border border-slate-200 flex items-center justify-center shrink-0">
                        <Globe className="w-4 h-4 text-teal-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Website Chat Widget</p>
                        <p className="text-xs text-slate-500">Embeddable via a single script tag</p>
                      </div>
                      <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">Live</span>
                    </div>

                    <div className="p-5 space-y-4">
                      <p className="text-sm text-slate-600">
                        Add the snippet below to the <code className="px-1 py-0.5 bg-slate-100 rounded text-xs font-mono">&lt;body&gt;</code> of any webpage to embed this assistant as a floating chat button.
                      </p>

                      {/* Code block */}
                      <div className="relative group">
                        <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre">{embedCode}</pre>
                        <button
                          onClick={handleCopy}
                          className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium transition-colors"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          {copied ? 'Copied!' : 'Copy'}
                        </button>
                      </div>

                      {/* Optional attribute */}
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                          <Code2 className="w-4 h-4 text-slate-400" />
                          <p className="text-xs font-semibold text-slate-700">Optional attribute</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <code className="px-2 py-0.5 bg-white border border-slate-200 rounded text-xs font-mono text-slate-700 shrink-0">data-position</code>
                          <p className="text-xs text-slate-500">Set to <code className="font-mono">"bottom-right"</code> (default) or <code className="font-mono">"bottom-left"</code> to control where the chat button appears.</p>
                        </div>
                      </div>

                      <p className="text-xs text-slate-400">
                        The widget inherits this assistant's name, welcome message and colour from the General and Appearance settings. No rebuild required — changes take effect immediately.
                      </p>
                    </div>
                  </div>

                  {/* Meta OAuth notification */}
                  {metaNotif && (
                    <div className={cn(
                      'flex items-start gap-2 p-3 rounded-xl text-sm',
                      metaNotif.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100',
                    )}>
                      {metaNotif.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                      <span>{metaNotif.msg}</span>
                    </div>
                  )}

                  {/* Page picker modal — shown when OAuth returns multiple pages */}
                  {metaPagePicker && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <h4 className="font-bold text-slate-900 mb-1">Choose a page</h4>
                        <p className="text-sm text-slate-500 mb-4">Select which Facebook Page to connect to this assistant.</p>
                        <div className="space-y-2">
                          {metaPagePicker.pages.map(page => (
                            <button
                              key={page.id}
                              onClick={() => selectMetaPage(page, metaPagePicker.channel)}
                              className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50 transition-colors"
                            >
                              <p className="text-sm font-semibold text-slate-900">{page.name}</p>
                              <p className="text-xs text-slate-400">{page.id}</p>
                            </button>
                          ))}
                        </div>
                        <button onClick={() => setMetaPagePicker(null)} className="w-full mt-4 text-sm text-slate-400 hover:text-slate-600">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Facebook Messenger */}
                  {(() => {
                    const conn = channelConnections.facebook;
                    const connected = conn?.status === 'connected';
                    return (
                      <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 border-b border-slate-200">
                          <div className="w-9 h-9 bg-white rounded-lg border border-slate-200 flex items-center justify-center shrink-0 text-base">💬</div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Facebook Messenger</p>
                            <p className="text-xs text-slate-500">Connect via the Meta Graph API</p>
                          </div>
                          <div className="ml-auto flex items-center gap-2">
                            {isLoadingChannels ? (
                              <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />
                            ) : connected ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                                <Wifi className="w-3 h-3" />Connected
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-slate-200 text-slate-500 rounded-full">
                                <WifiOff className="w-3 h-3" />Disconnected
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="p-5 space-y-3">
                          {connected ? (
                            <>
                              <p className="text-sm text-slate-600">Connected to <span className="font-semibold">{conn.page_name}</span> (Page ID: {conn.page_id}).</p>
                              <button
                                onClick={() => disconnectChannel('facebook')}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 text-rose-600 rounded-lg text-xs font-semibold hover:bg-rose-50 transition-colors"
                              >
                                <WifiOff className="w-3.5 h-3.5" />Disconnect
                              </button>
                            </>
                          ) : (
                            <>
                              <p className="text-xs text-slate-500">
                                Clicking Connect will open a Meta OAuth window. You'll need to grant permission to manage your Facebook Pages and their messages.
                                Make sure your <span className="font-semibold">Meta App ID and Secret are set</span> in Settings &rsaquo; API Keys first.
                              </p>
                              <button
                                onClick={() => connectMetaChannel('facebook')}
                                className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />Connect via Meta OAuth
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Instagram Direct */}
                  {(() => {
                    const conn = channelConnections.instagram;
                    const connected = conn?.status === 'connected';
                    return (
                      <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 border-b border-slate-200">
                          <div className="w-9 h-9 bg-white rounded-lg border border-slate-200 flex items-center justify-center shrink-0 text-base">📸</div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Instagram Direct</p>
                            <p className="text-xs text-slate-500">Connect via the Meta Graph API</p>
                          </div>
                          <div className="ml-auto flex items-center gap-2">
                            {isLoadingChannels ? (
                              <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />
                            ) : connected ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                                <Wifi className="w-3 h-3" />Connected
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-slate-200 text-slate-500 rounded-full">
                                <WifiOff className="w-3 h-3" />Disconnected
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="p-5 space-y-3">
                          {connected ? (
                            <>
                              <p className="text-sm text-slate-600">Connected to <span className="font-semibold">{conn.page_name}</span>.</p>
                              <button
                                onClick={() => disconnectChannel('instagram')}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 text-rose-600 rounded-lg text-xs font-semibold hover:bg-rose-50 transition-colors"
                              >
                                <WifiOff className="w-3.5 h-3.5" />Disconnect
                              </button>
                            </>
                          ) : (
                            <>
                              <p className="text-xs text-slate-500">
                                Requires an Instagram Professional account (Business or Creator) linked to a Facebook Page. Uses the same Meta OAuth as Facebook — both can be connected with one authorisation.
                              </p>
                              <button
                                onClick={() => connectMetaChannel('instagram')}
                                className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />Connect via Meta OAuth
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* WhatsApp Business */}
                  {(() => {
                    const conn = channelConnections.whatsapp;
                    const connected = conn?.status === 'connected';
                    return (
                      <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 border-b border-slate-200">
                          <div className="w-9 h-9 bg-white rounded-lg border border-slate-200 flex items-center justify-center shrink-0 text-base">📱</div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">WhatsApp Business</p>
                            <p className="text-xs text-slate-500">Connect via WhatsApp Cloud API</p>
                          </div>
                          <div className="ml-auto">
                            {isLoadingChannels ? (
                              <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />
                            ) : connected ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                                <Wifi className="w-3 h-3" />Connected
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-slate-200 text-slate-500 rounded-full">
                                <WifiOff className="w-3 h-3" />Disconnected
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="p-5 space-y-4">
                          <p className="text-xs text-slate-500">
                            WhatsApp requires manual setup via the{' '}
                            <a href="https://business.facebook.com" target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">
                              Meta Business Manager
                            </a>
                            . Register a phone number, then paste your credentials below.
                          </p>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number ID <span className="text-rose-500">*</span></label>
                              <input
                                type="text"
                                value={whatsappForm.phone_number_id}
                                onChange={e => setWhatsappForm(f => ({ ...f, phone_number_id: e.target.value }))}
                                placeholder="e.g. 123456789012345"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">WhatsApp Business Account ID</label>
                              <input
                                type="text"
                                value={whatsappForm.waba_id}
                                onChange={e => setWhatsappForm(f => ({ ...f, waba_id: e.target.value }))}
                                placeholder="e.g. 987654321098765"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Access Token <span className="text-rose-500">*</span></label>
                              <input
                                type="password"
                                value={whatsappForm.access_token}
                                onChange={e => setWhatsappForm(f => ({ ...f, access_token: e.target.value }))}
                                placeholder="System User or permanent token"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={saveWhatsapp}
                              disabled={whatsappSaving || !whatsappForm.phone_number_id || !whatsappForm.access_token}
                              className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors disabled:opacity-40"
                            >
                              {whatsappSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                              {connected ? 'Update' : 'Save and Connect'}
                            </button>
                            {connected && (
                              <button
                                onClick={() => disconnectChannel('whatsapp')}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 text-rose-600 rounded-lg text-xs font-semibold hover:bg-rose-50 transition-colors"
                              >
                                <WifiOff className="w-3.5 h-3.5" />Disconnect
                              </button>
                            )}
                          </div>
                          {/* Webhook reference */}
                          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 space-y-1">
                            <p className="font-semibold text-slate-700">Configure in Meta App dashboard:</p>
                            <p>Webhook URL: <span className="font-mono break-all">{window.location.protocol}//{window.location.host}/api/webhooks/meta</span></p>
                            <p>Subscribe to the <span className="font-mono">messages</span> field under <span className="font-mono">whatsapp_business_account</span>.</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* Hours of Operation */}
            {activeTab === 'hours' && assistant && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Hours of Operation</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Set when your assistant is active. Outside these hours, visitors will see your offline message instead of speaking to the AI.
                  </p>
                </div>

                {/* Enable toggle */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-800">Restrict to active hours</p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      When off, the assistant responds at any time of day.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setAssistant(prev => prev ? {
                        ...prev,
                        active_hours_start: prev.active_hours_start ? null : '09:00',
                        active_hours_end: prev.active_hours_end ? null : '17:00',
                      } as Assistant : prev)
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      assistant.active_hours_start ? 'bg-teal-500' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        assistant.active_hours_start ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Time pickers — only shown when hours are enabled */}
                {assistant.active_hours_start && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Opening time
                        </label>
                        <input
                          type="time"
                          value={assistant.active_hours_start || '09:00'}
                          onChange={e =>
                            setAssistant(prev => prev ? { ...prev, active_hours_start: e.target.value } : prev)
                          }
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Closing time
                        </label>
                        <input
                          type="time"
                          value={assistant.active_hours_end || '17:00'}
                          onChange={e =>
                            setAssistant(prev => prev ? { ...prev, active_hours_end: e.target.value } : prev)
                          }
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Timezone
                      </label>
                      <select
                        value={assistant.timezone || 'Europe/London'}
                        onChange={e =>
                          setAssistant(prev => prev ? { ...prev, timezone: e.target.value } : prev)
                        }
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white"
                      >
                        <optgroup label="United Kingdom">
                          <option value="Europe/London">Europe/London (GMT/BST)</option>
                        </optgroup>
                        <optgroup label="Europe">
                          <option value="Europe/Paris">Europe/Paris (CET)</option>
                          <option value="Europe/Berlin">Europe/Berlin (CET)</option>
                          <option value="Europe/Amsterdam">Europe/Amsterdam (CET)</option>
                          <option value="Europe/Madrid">Europe/Madrid (CET)</option>
                          <option value="Europe/Rome">Europe/Rome (CET)</option>
                          <option value="Europe/Dublin">Europe/Dublin (GMT)</option>
                        </optgroup>
                        <optgroup label="North America">
                          <option value="America/New_York">America/New_York (ET)</option>
                          <option value="America/Chicago">America/Chicago (CT)</option>
                          <option value="America/Denver">America/Denver (MT)</option>
                          <option value="America/Los_Angeles">America/Los_Angeles (PT)</option>
                          <option value="America/Toronto">America/Toronto (ET)</option>
                          <option value="America/Vancouver">America/Vancouver (PT)</option>
                        </optgroup>
                        <optgroup label="Asia Pacific">
                          <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                          <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                          <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                          <option value="Australia/Sydney">Australia/Sydney (AEDT)</option>
                        </optgroup>
                        <optgroup label="Other">
                          <option value="UTC">UTC</option>
                        </optgroup>
                      </select>
                      <p className="text-xs text-slate-400 mt-1.5">
                        All times are interpreted in this timezone.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Offline message
                      </label>
                      <textarea
                        rows={3}
                        value={assistant.offline_message || ''}
                        onChange={e =>
                          setAssistant(prev => prev ? { ...prev, offline_message: e.target.value } : prev)
                        }
                        placeholder="e.g. We're currently closed. Our team is available Monday to Friday, 9am to 5pm GMT. Leave a message and we'll get back to you."
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none resize-none"
                      />
                      <p className="text-xs text-slate-400 mt-1.5">
                        Shown to visitors who message outside your active hours.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Lead Capture */}
            {activeTab === 'lead' && assistant && (() => {
              const defaultFields = [
                { field: 'name',  label: 'Your name',     enabled: true,  required: true  },
                { field: 'email', label: 'Email address', enabled: true,  required: true  },
                { field: 'phone', label: 'Phone number',  enabled: false, required: false },
              ];
              const fields = assistant.lead_capture_fields?.length
                ? assistant.lead_capture_fields
                : defaultFields;

              const updateField = (index: number, key: string, value: boolean) => {
                const updated = fields.map((f, i) => i === index ? { ...f, [key]: value } : f);
                setAssistant(prev => prev ? { ...prev, lead_capture_fields: updated } : prev);
              };

              return (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Lead Capture</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Show a short form before the conversation begins to collect visitor details. Captured data is stored against each conversation in the Inbox.
                    </p>
                  </div>

                  {/* Enable toggle */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-800">Enable lead capture form</p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        When on, visitors will see a form before they can start chatting.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAssistant(prev => prev ? { ...prev, lead_capture_enabled: !prev.lead_capture_enabled } : prev)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        assistant.lead_capture_enabled ? 'bg-teal-500' : 'bg-slate-200'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        assistant.lead_capture_enabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  {/* Field configuration */}
                  {assistant.lead_capture_enabled && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-slate-700">Configure fields</p>
                      {fields.map((f, i) => (
                        <div key={f.field} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-800 capitalize">{f.label}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{f.field}</p>
                          </div>
                          <div className="flex items-center gap-6">
                            {/* Show toggle */}
                            <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                              <button
                                type="button"
                                onClick={() => updateField(i, 'enabled', !f.enabled)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${f.enabled ? 'bg-teal-500' : 'bg-slate-200'}`}
                              >
                                <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${f.enabled ? 'translate-x-5' : 'translate-x-1'}`} />
                              </button>
                              Show
                            </label>
                            {/* Required toggle */}
                            <label className={`flex items-center gap-2 text-xs cursor-pointer ${f.enabled ? 'text-slate-500' : 'text-slate-300'}`}>
                              <button
                                type="button"
                                disabled={!f.enabled}
                                onClick={() => f.enabled && updateField(i, 'required', !f.required)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${f.required && f.enabled ? 'bg-teal-500' : 'bg-slate-200'} ${!f.enabled ? 'opacity-40' : ''}`}
                              >
                                <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${f.required && f.enabled ? 'translate-x-5' : 'translate-x-1'}`} />
                              </button>
                              Required
                            </label>
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-slate-400">
                        Fields that are hidden will not appear in the form. Disabled required toggles automatically when a field is hidden.
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Handoff Rules */}
            {activeTab === 'handoff' && assistant && (() => {
              const DEFAULT_TRIGGERS = [
                'speak to a human', 'talk to a human', 'talk to a person',
                'want a human', 'need a human', 'human agent', 'real person',
                'live agent', 'speak to an agent', 'transfer me',
              ];
              const triggers: string[] = assistant.handoff_triggers?.length
                ? assistant.handoff_triggers
                : DEFAULT_TRIGGERS;

              const addTrigger = () => {
                const val = newTrigger.trim().toLowerCase();
                if (!val || triggers.includes(val)) { setNewTrigger(''); return; }
                setAssistant(prev => prev ? { ...prev, handoff_triggers: [...triggers, val] } : prev);
                setNewTrigger('');
              };

              const removeTrigger = (phrase: string) => {
                setAssistant(prev => prev ? { ...prev, handoff_triggers: triggers.filter(t => t !== phrase) } : prev);
              };

              return (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Handoff Rules</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Configure when the assistant hands a conversation to a human agent. Triggered conversations are flagged in the Inbox for your team to pick up.
                    </p>
                  </div>

                  {/* Trigger phrases */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                    <div>
                      <p className="font-medium text-slate-800">Trigger phrases</p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        When a visitor's message contains any of these phrases, the conversation is immediately passed to a human agent.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {triggers.map((phrase) => (
                        <span key={phrase} className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-sm px-3 py-1.5 rounded-lg">
                          {phrase}
                          <button
                            type="button"
                            onClick={() => removeTrigger(phrase)}
                            className="text-slate-400 hover:text-rose-500 transition-colors ml-0.5"
                            aria-label={`Remove "${phrase}"`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTrigger}
                        onChange={e => setNewTrigger(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTrigger(); } }}
                        placeholder="Add a phrase, e.g. speak to a manager"
                        className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={addTrigger}
                        className="flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add
                      </button>
                    </div>
                    <p className="text-xs text-slate-400">
                      Phrase matching is case-insensitive and checks if the phrase appears anywhere in the message.
                    </p>
                  </div>

                  {/* Custom handoff message */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                    <div>
                      <p className="font-medium text-slate-800">Handoff message</p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        The message sent to the visitor when a handoff is triggered.
                      </p>
                    </div>
                    <textarea
                      rows={3}
                      value={assistant.handoff_message || ''}
                      onChange={e => setAssistant(prev => prev ? { ...prev, handoff_message: e.target.value } : prev)}
                      placeholder="I'm connecting you with a member of our team now. Please hold on — someone will be with you shortly."
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none resize-none"
                    />
                    <p className="text-xs text-slate-400">
                      Leave blank to use the default message.
                    </p>
                  </div>

                  {/* Auto-handoff after N consecutive fallbacks */}
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-slate-800">Auto-handoff on consecutive fallbacks</p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Automatically escalate to a human if the assistant fails to answer this many times in a row. Set to 0 to disable.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={assistant.fallback_handoff_count ?? 0}
                        onChange={e => setAssistant(prev => prev ? { ...prev, fallback_handoff_count: Math.max(0, parseInt(e.target.value) || 0) } : prev)}
                        className="w-24 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                      />
                      <span className="text-sm text-slate-500">
                        {(assistant.fallback_handoff_count ?? 0) === 0
                          ? 'Disabled — will not auto-escalate'
                          : `Handoff triggered after ${assistant.fallback_handoff_count} consecutive unanswered message${(assistant.fallback_handoff_count ?? 0) === 1 ? '' : 's'}`
                        }
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Appearance */}
            {activeTab === 'appearance' && assistant && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Appearance</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Customise how the chat widget looks to your visitors.
                  </p>
                </div>

                {/* Avatar / logo */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <div>
                    <p className="font-medium text-slate-800">Avatar / logo</p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Shown in the widget header. Accepts JPEG, PNG, WebP or SVG up to 2 MB.
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    {/* Preview */}
                    <div className="w-16 h-16 rounded-full border-2 border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0">
                      {assistant.avatar_url ? (
                        <img
                          src={assistant.avatar_url}
                          alt="Avatar preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl font-bold text-slate-400 select-none">
                          {(assistant.display_name || assistant.name).charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleAvatarUpload(file);
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                      >
                        {isUploadingAvatar ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        {isUploadingAvatar ? 'Uploading...' : 'Upload image'}
                      </button>
                      {assistant.avatar_url && (
                        <button
                          type="button"
                          onClick={() => setAssistant(prev => prev ? { ...prev, avatar_url: '' } : prev)}
                          className="text-xs text-rose-500 hover:text-rose-600 transition-colors text-left"
                        >
                          Remove avatar
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Display name */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <div>
                    <p className="font-medium text-slate-800">Display name</p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      The name shown in the widget header. Defaults to the assistant's internal name if left blank.
                    </p>
                  </div>
                  <input
                    type="text"
                    value={assistant.display_name || ''}
                    onChange={e => setAssistant(prev => prev ? { ...prev, display_name: e.target.value } : prev)}
                    placeholder={assistant.name}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                  />
                </div>

                {/* Primary colour */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <div>
                    <p className="font-medium text-slate-800">Primary colour</p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Used for the chat header, toggle button and user message bubbles.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={assistant.primary_color || '#10b981'}
                      onChange={e => setAssistant(prev => prev ? { ...prev, primary_color: e.target.value } : prev)}
                      className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={assistant.primary_color || '#10b981'}
                      onChange={e => setAssistant(prev => prev ? { ...prev, primary_color: e.target.value } : prev)}
                      placeholder="#10b981"
                      maxLength={7}
                      className="w-32 px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none font-mono"
                    />
                    <div
                      className="w-10 h-10 rounded-lg border border-slate-200"
                      style={{ background: assistant.primary_color || '#10b981' }}
                    />
                  </div>
                </div>

                {/* Widget position */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <div>
                    <p className="font-medium text-slate-800">Widget position</p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Where the chat button sits on the page.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    {(['bottom-right', 'bottom-left'] as const).map(pos => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => setAssistant(prev => prev ? { ...prev, widget_position: pos } : prev)}
                        className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-colors ${
                          (assistant.widget_position || 'bottom-right') === pos
                            ? 'border-teal-500 bg-teal-50 text-teal-700'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {pos === 'bottom-right' ? 'Bottom right' : 'Bottom left'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cookie consent */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-800">Cookie consent banner</p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Show a consent notice before the widget opens, with an Accept button. Consent is stored in the visitor's browser. Required for GDPR compliance on EU-facing sites.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={assistant.cookie_consent_enabled ?? false}
                      onClick={() => setAssistant(prev => prev ? { ...prev, cookie_consent_enabled: !(prev.cookie_consent_enabled ?? false) } : prev)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                        assistant.cookie_consent_enabled ? 'bg-teal-500' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                          assistant.cookie_consent_enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Replies */}
            {activeTab === 'quickreplies' && assistant && (() => {
              const replies: string[] = assistant.quick_replies || [];

              const addReply = () => {
                const val = newReply.trim();
                if (!val || replies.includes(val)) { setNewReply(''); return; }
                setAssistant(prev => prev ? { ...prev, quick_replies: [...replies, val] } : prev);
                setNewReply('');
              };

              const removeReply = (text: string) => {
                setAssistant(prev => prev ? { ...prev, quick_replies: replies.filter(r => r !== text) } : prev);
              };

              return (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Quick Replies</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Add suggested reply buttons that appear in the chat widget. Visitors can tap them instead of typing, making it easy to start common conversations.
                    </p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                    {replies.length > 0 ? (
                      <div className="space-y-2">
                        {replies.map((reply, i) => (
                          <div key={i} className="flex items-center gap-3 py-2.5 px-4 bg-slate-50 rounded-lg group">
                            <MessageSquarePlus className="w-4 h-4 text-teal-500 flex-shrink-0" />
                            <span className="flex-1 text-sm text-slate-700">{reply}</span>
                            <button
                              type="button"
                              onClick={() => removeReply(reply)}
                              className="p-1 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                              aria-label={`Remove "${reply}"`}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 text-center py-4">
                        No quick replies yet. Add your first one below.
                      </p>
                    )}

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newReply}
                        onChange={e => setNewReply(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addReply(); } }}
                        placeholder="e.g. What are your opening hours?"
                        className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={addReply}
                        className="flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add
                      </button>
                    </div>
                    <p className="text-xs text-slate-400">
                      Quick replies appear as tap buttons at the start of the conversation. Limit to 4-5 for the best experience.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Analytics tab */}
            {activeTab === 'analytics' && (() => {
              const data = analyticsData;
              const chartData = (data?.conversationsOverTime ?? []).map(d => ({
                date: new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
                count: d.count,
              }));
              const topQuestions = data?.topQuestions ?? [];
              const maxQ = topQuestions[0]?.count ?? 1;
              const stats = data
                ? [
                    { label: 'Total Conversations', value: data.totalConversations.toLocaleString('en-GB') },
                    { label: 'Messages Sent', value: data.messagesSent.toLocaleString('en-GB') },
                    { label: 'Handoff Rate', value: `${data.handoffRate}%` },
                    { label: 'Fallback Rate', value: `${data.fallbackRate}%` },
                    { label: 'Lead Capture Rate', value: `${data.leadCaptureRate ?? 0}%` },
                  ]
                : [];

              return (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Analytics</h3>
                      <p className="text-sm text-slate-500 mt-1">Performance data for this assistant over the last 30 days.</p>
                    </div>
                    <button
                      onClick={() => { setAnalyticsData(null); loadAnalytics(); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${analyticsLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>

                  {analyticsError && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm">
                      {analyticsError}
                    </div>
                  )}

                  {/* Stat cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {analyticsLoading
                      ? Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="bg-slate-50 p-4 rounded-xl border border-slate-200 animate-pulse">
                            <div className="h-2.5 bg-slate-200 rounded w-2/3 mb-3" />
                            <div className="h-7 bg-slate-200 rounded w-1/2" />
                          </div>
                        ))
                      : stats.map(stat => (
                          <div key={stat.label} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-tight">{stat.label}</p>
                            <p className="text-2xl font-bold text-slate-900 mt-2">{stat.value}</p>
                          </div>
                        ))}
                  </div>

                  {/* Conversations over time */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6">
                    <h4 className="text-sm font-semibold text-slate-700 mb-4">Conversations Over Time</h4>
                    <div className="h-56">
                      {analyticsLoading ? (
                        <div className="h-full bg-slate-50 rounded-xl animate-pulse" />
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} dy={8} interval={4} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Line type="monotone" dataKey="count" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 2.5, fill: '#0d9488', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 4, strokeWidth: 0 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top questions */}
                    <div className="bg-white border border-slate-200 rounded-xl p-6">
                      <h4 className="text-sm font-semibold text-slate-700 mb-4">Top Questions</h4>
                      {analyticsLoading ? (
                        <div className="space-y-4">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="space-y-1.5 animate-pulse">
                              <div className="h-3 bg-slate-100 rounded w-full" />
                              <div className="h-1.5 bg-slate-100 rounded w-full" />
                            </div>
                          ))}
                        </div>
                      ) : topQuestions.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-6">No questions yet. Start a conversation to see data here.</p>
                      ) : (
                        <div className="space-y-4">
                          {topQuestions.map((item, idx) => (
                            <div key={idx} className="space-y-1.5">
                              <div className="flex items-start justify-between text-sm gap-3">
                                <span className="font-medium text-slate-700 leading-snug line-clamp-2">{item.question}</span>
                                <span className="text-slate-400 font-bold shrink-0">{item.count}</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-teal-500 rounded-full" style={{ width: `${(item.count / maxQ) * 100}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Busiest hours */}
                    <div className="bg-white border border-slate-200 rounded-xl p-6">
                      <h4 className="text-sm font-semibold text-slate-700 mb-4">Busiest Hours</h4>
                      <div className="h-48">
                        {analyticsLoading ? (
                          <div className="h-full bg-slate-50 rounded-xl animate-pulse" />
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.busiestHours ?? []} barSize={6}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} interval={2} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                              <Bar dataKey="count" fill="#0d9488" radius={[3, 3, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Add Source Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={closeAddModal}>
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Add Knowledge Source</h3>
              <button onClick={closeAddModal} disabled={isAdding} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Source type tabs */}
            <div className="flex border-b border-slate-100 px-6">
              {([
                { id: 'file', label: 'File Upload', icon: FileText },
                { id: 'url', label: 'URL', icon: Link },
                { id: 'qa', label: 'Q&A', icon: HelpCircle },
                { id: 'text', label: 'Text', icon: Type },
              ] as const).map(({ id: tabId, label, icon: Icon }) => (
                <button
                  key={tabId}
                  onClick={() => { setModalTab(tabId); setAddError(null); }}
                  disabled={isAdding}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                    modalTab === tabId
                      ? 'border-teal-600 text-teal-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-4">
              {modalTab === 'file' && (
                <div>
                  <p className="text-xs text-slate-500 mb-3">Upload a PDF, Word document (.docx), plain text or CSV file. Text will be extracted and indexed automatically.</p>
                  <div
                    className="relative flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-8 h-8 text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">Click to select a file</p>
                    <p className="text-xs text-slate-400">PDF, DOCX, TXT or CSV — up to 20 MB</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.docx,.txt,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/csv"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const label = document.getElementById('kb-filename-label');
                          if (label) label.textContent = file.name;
                        }
                      }}
                    />
                  </div>
                  <p id="kb-filename-label" className="mt-2 text-xs text-slate-500 text-center" />
                </div>
              )}

              {modalTab === 'url' && (
                <div>
                  <p className="text-xs text-slate-500 mb-3">Paste a public URL. The page content will be fetched and indexed.</p>
                  <input
                    type="url"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    placeholder="https://example.com/about"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                    disabled={isAdding}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddSource(); }}
                  />
                </div>
              )}

              {modalTab === 'qa' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">Add a specific question and the ideal answer your assistant should give.</p>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Question</label>
                    <input
                      type="text"
                      value={qaQuestion}
                      onChange={e => setQaQuestion(e.target.value)}
                      placeholder="e.g. What are your opening hours?"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                      disabled={isAdding}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Answer</label>
                    <textarea
                      value={qaAnswer}
                      onChange={e => setQaAnswer(e.target.value)}
                      placeholder="e.g. We are open Monday to Friday, 9am to 6pm."
                      rows={4}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none resize-none"
                      disabled={isAdding}
                    />
                  </div>
                </div>
              )}

              {modalTab === 'text' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">Paste any free-form content — company info, product details, policies, etc.</p>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Title <span className="font-normal text-slate-400">(optional)</span></label>
                    <input
                      type="text"
                      value={textTitle}
                      onChange={e => setTextTitle(e.target.value)}
                      placeholder="e.g. About Ascendz"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                      disabled={isAdding}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Content</label>
                    <textarea
                      value={textContent}
                      onChange={e => setTextContent(e.target.value)}
                      placeholder="Paste your content here..."
                      rows={6}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none resize-none font-mono text-xs"
                      disabled={isAdding}
                    />
                  </div>
                </div>
              )}

              {addError && (
                <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{addError}</span>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button
                onClick={closeAddModal}
                disabled={isAdding}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSource}
                disabled={isAdding}
                className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm disabled:opacity-60"
              >
                {isAdding ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {modalTab === 'url' ? 'Fetching...' : modalTab === 'file' ? 'Processing...' : 'Adding...'}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add Source
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Train better response modal */}
      {trainModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setTrainModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div>
                <p className="font-semibold text-slate-900">Train a better response</p>
                <p className="text-xs text-slate-400 mt-0.5">Your corrected answer will be saved as a Q&A pair in the knowledge base.</p>
              </div>
              <button onClick={() => setTrainModal(null)} className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors ml-4 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Question</label>
                <p className="text-sm text-slate-800 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">{trainModal.question || '(no question captured)'}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Ideal answer</label>
                <textarea
                  value={trainAnswer}
                  onChange={e => setTrainAnswer(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none resize-none"
                  placeholder="Write the ideal response the assistant should give..."
                />
              </div>
            </div>
            <div className="px-5 pb-5 flex justify-end gap-3">
              <button onClick={() => setTrainModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
              <button
                onClick={handleSaveTraining}
                disabled={isSavingTraining || !trainAnswer.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {trainSaved ? (
                  <><CheckCircle className="w-4 h-4" /> Saved!</>
                ) : isSavingTraining ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  'Save to knowledge base'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Knowledge entry content preview modal */}
      {previewEntry && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreviewEntry(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">
                  {(() => {
                    try { return JSON.parse(previewEntry.metadata || '{}').title || JSON.parse(previewEntry.metadata || '{}').url || JSON.parse(previewEntry.metadata || '{}').filename || 'Content preview'; } catch { return 'Content preview'; }
                  })()}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {previewEntry.content ? `${previewEntry.content.length.toLocaleString()} characters indexed` : 'No content'}
                </p>
              </div>
              <button onClick={() => setPreviewEntry(null)} className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors ml-4 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {previewEntry.content ? (
                <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">{previewEntry.content}</pre>
              ) : (
                <p className="text-sm text-slate-400 italic">No content stored for this entry.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
