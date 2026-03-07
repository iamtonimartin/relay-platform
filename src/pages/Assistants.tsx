import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, Filter, MoreVertical, Settings, Play, BarChart2, Trash2, ChevronDown } from 'lucide-react';
import { api } from '../services/api';
import { Assistant } from '../types';
import Modal from '../components/Modal';

// Default system prompt pre-populated when creating a new assistant.
// Lines starting with // are comments — they are stripped before being sent to the AI model.
const DEFAULT_SYSTEM_PROMPT = `// General Prompt Guidelines:
// When a line starts with two slashes like this, it is a comment and will not be read by the AI.
// Replace the content below with your own business information.
// Build your prompt iteratively — make one change, test it, then make another.
// Prompts should be written in English. You can ask the assistant to respond in another language if needed.
// To support all languages, keep the instruction: "Speak to the user in the language they speak to you in."
// To restrict to a specific language, replace that line with e.g. "Always respond in French."
// If a user wants to book a meeting, uncomment and update the line below:
// If a user wants to schedule a meeting or book an appointment, send them to this link: [YOUR_CALENDLY_LINK]
// Replace all placeholders in square brackets [] with your own information.

## Basic Instructions:
- You are a helpful assistant for [YOUR BUSINESS NAME].
- Your job is to answer questions from customers. You have access to a knowledge base to help you do this.
- If you do not have an answer and it is not in the knowledge base, let the user know. You can say something like "Hmm, I'm not sure about that one."
- Keep your answers as concise as possible while still giving the required information.
- Do not break character. Avoid answering questions that are not relevant to the business.
- Speak to the user in the language they speak to you in.


// Lead Data Collection Guidelines:
// Uncomment and customise the section below if you want the assistant to collect contact details.
// Make sure the fields below match what you have enabled in the Lead Capture tab.

// ## Lead Data Collection Instructions:
// - Answer the user's first question, then ask for their [NAME / EMAIL / PHONE NUMBER].
// - Once you have collected their details, use the lead capture function to save them.`;

// Keep in sync with MODEL_OPTIONS in AssistantSettings.tsx
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

export default function Assistants() {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Per-card three-dots menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [newAssistant, setNewAssistant] = useState({
    name: '',
    purpose: '',
    model_provider: 'anthropic',
    model_name: 'claude-sonnet-4-6',
    system_prompt: DEFAULT_SYSTEM_PROMPT,
  });

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    loadAssistants();

    // Check for ?create=true query param
    const params = new URLSearchParams(location.search);
    if (params.get('create') === 'true') {
      setIsModalOpen(true);
      navigate('/assistants', { replace: true });
    }
  }, [location]);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadAssistants = async () => {
    try {
      const data = await api.getAssistants();
      setAssistants(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.createAssistant(newAssistant);
      setAssistants([created, ...assistants]);
      setIsModalOpen(false);
      setNewAssistant({ name: '', purpose: '', model_provider: 'anthropic', model_name: 'claude-sonnet-4-6', system_prompt: DEFAULT_SYSTEM_PROMPT });
      navigate(`/assistants/${created.id}`);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteAssistant(id);
      setAssistants(assistants.filter(a => a.id !== id));
      setDeleteConfirmId(null);
      setOpenMenuId(null);
    } catch (error) {
      console.error(error);
    }
  };

  // Filter assistants by search query and provider
  const filteredAssistants = assistants.filter(a => {
    const matchesSearch =
      searchQuery === '' ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.purpose || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProvider =
      filterProvider === 'all' || a.model_provider === filterProvider;
    return matchesSearch && matchesProvider;
  });

  const providerLabels: Record<string, string> = {
    all: 'All providers',
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    xai: 'xAI',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Assistants</h2>
          <p className="text-slate-500 text-sm">Manage and configure your AI chat agents.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-all shadow-sm hover:shadow-md active:scale-95 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Create New Assistant
        </button>
      </div>

      {/* Search and filter bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search assistants..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
          />
        </div>
        {/* Filter dropdown */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
              filterProvider !== 'all'
                ? 'border-teal-500 text-teal-600 bg-teal-50'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            {providerLabels[filterProvider]}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {filterOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
              {Object.entries(providerLabels).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => { setFilterProvider(value); setFilterOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    filterProvider === value
                      ? 'bg-teal-50 text-teal-700 font-medium'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : assistants.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">No assistants yet</h3>
          <p className="text-slate-500 mb-6">Create your first AI assistant to get started.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            Create Assistant
          </button>
        </div>
      ) : filteredAssistants.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
          <p className="text-slate-500">No assistants match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" ref={menuRef}>
          {filteredAssistants.map((assistant) => (
            <div
              key={assistant.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group flex flex-col"
            >
              <div className="p-6 flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-xl font-bold text-slate-400 border border-slate-200">
                      {assistant.avatar_url ? (
                        <img src={assistant.avatar_url} alt={assistant.name} className="w-full h-full object-cover rounded-xl" referrerPolicy="no-referrer" />
                      ) : (
                        assistant.name[0]
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 group-hover:text-teal-600 transition-colors">{assistant.name}</h4>
                      <p className="text-xs text-slate-500">{assistant.model_name}</p>
                    </div>
                  </div>

                  {/* Three-dots menu */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === assistant.id ? null : assistant.id);
                      }}
                      className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>
                    {openMenuId === assistant.id && (
                      <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
                        <button
                          onClick={() => { navigate(`/assistants/${assistant.id}`); setOpenMenuId(null); }}
                          className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <Settings className="w-4 h-4 text-slate-400" />
                          Configure
                        </button>
                        <button
                          onClick={() => { navigate(`/assistants/${assistant.id}?tab=preview`); setOpenMenuId(null); }}
                          className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <Play className="w-4 h-4 text-slate-400" />
                          Test
                        </button>
                        <button
                          onClick={() => { navigate('/'); setOpenMenuId(null); }}
                          className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <BarChart2 className="w-4 h-4 text-slate-400" />
                          Analytics
                        </button>
                        <div className="border-t border-slate-100 my-1" />
                        <button
                          onClick={() => { setDeleteConfirmId(assistant.id); setOpenMenuId(null); }}
                          className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-sm text-slate-600 line-clamp-2 mb-6 min-h-[2.5rem]">
                  {assistant.purpose || 'No purpose defined yet.'}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <button
                    onClick={() => navigate(`/assistants/${assistant.id}`)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-teal-600 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Configure
                  </button>
                  <button
                    onClick={() => navigate(`/assistants/${assistant.id}?tab=preview`)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-teal-600 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Test
                  </button>
                  <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-teal-600 transition-colors"
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    Analytics
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create assistant modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Assistant"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assistant Name</label>
            <input
              required
              type="text"
              value={newAssistant.name}
              onChange={e => setNewAssistant({...newAssistant, name: e.target.value})}
              placeholder="e.g. Sales Support"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Purpose / Description</label>
            <textarea
              value={newAssistant.purpose}
              onChange={e => setNewAssistant({...newAssistant, purpose: e.target.value})}
              placeholder="What is this assistant's main goal?"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 h-24 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Model Provider</label>
              <select
                value={newAssistant.model_provider}
                onChange={e => {
                  const provider = e.target.value;
                  const firstModel = MODEL_OPTIONS[provider]?.[0]?.value || '';
                  setNewAssistant({ ...newAssistant, model_provider: provider, model_name: firstModel });
                }}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
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
                value={newAssistant.model_name}
                onChange={e => setNewAssistant({ ...newAssistant, model_name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              >
                {(MODEL_OPTIONS[newAssistant.model_provider] || []).map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm"
            >
              Create Assistant
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Assistant"
      >
        <p className="text-sm text-slate-600 mb-6">
          Are you sure you want to delete this assistant? This will permanently remove all its settings, knowledge base and conversation history.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setDeleteConfirmId(null)}
            className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
