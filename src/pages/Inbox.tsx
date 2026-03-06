import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  MessageSquare,
  User,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  RefreshCw,
  X,
  Loader2,
  Globe,
  Bot,
  Send,
  UserCheck,
  Tag,
  Plus,
} from 'lucide-react';
import { api } from '../services/api';
import { ConversationSummary, Message } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

type StatusFilter = 'all' | 'active' | 'handed_off' | 'closed';

export default function Inbox() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [isClosing, setIsClosing] = useState(false);
  const [isTakenOver, setIsTakenOver] = useState(false);
  const [agentInput, setAgentInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const agentInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const data = await api.getConversations();
      setConversations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectConversation = async (id: string) => {
    setSelectedId(id);
    setIsLoadingMessages(true);
    setMessages([]);
    setAgentInput('');
    // Auto-enable takeover if the conversation is already handed off
    const conv = conversations.find(c => c.id === id);
    setIsTakenOver(conv?.status === 'handed_off');
    try {
      const data = await api.getConversationMessages(id);
      setMessages(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Auto-refresh messages for open conversations so the agent sees new user messages
  useEffect(() => {
    if (!selectedId) return;
    const conv = conversations.find(c => c.id === selectedId);
    if (!conv || conv.status === 'closed') return;
    const interval = setInterval(async () => {
      try {
        const data = await api.getConversationMessages(selectedId);
        setMessages(data);
      } catch { /* silent */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedId, conversations]);

  const handleClose = async () => {
    if (!selectedId) return;
    setIsClosing(true);
    try {
      await api.updateConversationStatus(selectedId, 'closed');
      setConversations(prev =>
        prev.map(c => c.id === selectedId ? { ...c, status: 'closed' } : c)
      );
      setIsTakenOver(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsClosing(false);
    }
  };

  const handleTakeOver = async () => {
    if (!selectedId) return;
    try {
      await api.updateConversationStatus(selectedId, 'handed_off');
      setConversations(prev =>
        prev.map(c => c.id === selectedId ? { ...c, status: 'handed_off' } : c)
      );
      setIsTakenOver(true);
      setTimeout(() => agentInputRef.current?.focus(), 100);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendAgentMessage = async () => {
    if (!selectedId || !agentInput.trim() || isSendingMessage) return;
    const content = agentInput.trim();
    setAgentInput('');
    setIsSendingMessage(true);
    try {
      const msg = await api.sendAgentMessage(selectedId, content);
      setMessages(prev => [...prev, msg]);
    } catch (err) {
      console.error(err);
      setAgentInput(content); // restore on failure
    } finally {
      setIsSendingMessage(false);
      agentInputRef.current?.focus();
    }
  };

  // Tag colour — deterministic from tag string so the same tag is always the same colour
  const TAG_COLOURS = [
    'bg-teal-100 text-teal-700',
    'bg-blue-100 text-blue-700',
    'bg-amber-100 text-amber-700',
    'bg-violet-100 text-violet-700',
    'bg-rose-100 text-rose-700',
    'bg-emerald-100 text-emerald-700',
  ];
  function tagColour(tag: string) {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    return TAG_COLOURS[Math.abs(hash) % TAG_COLOURS.length];
  }

  async function updateTags(convId: string, tags: string[]) {
    try {
      const token = localStorage.getItem('relay_token');
      await fetch(`/api/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tags }),
      });
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, tags } : c));
    } catch (err) {
      console.error('Failed to update tags', err);
    }
  }

  function addTag(convId: string, tag: string) {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed) return;
    const existing = conversations.find(c => c.id === convId)?.tags || [];
    if (existing.includes(trimmed)) return;
    updateTags(convId, [...existing, trimmed]);
  }

  function removeTag(convId: string, tag: string) {
    const existing = conversations.find(c => c.id === convId)?.tags || [];
    updateTags(convId, existing.filter(t => t !== tag));
  }

  // Collect all unique tags across all conversations for the filter row
  const allTags = [...new Set(conversations.flatMap(c => c.tags || []))].sort();

  // Client-side filtering: status + tag + search
  const filtered = conversations.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false;
    if (tagFilter && !(c.tags || []).includes(tagFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.assistant_name?.toLowerCase().includes(q) ||
        c.last_message?.toLowerCase().includes(q) ||
        c.user_name?.toLowerCase().includes(q) ||
        c.channel?.toLowerCase().includes(q) ||
        (c.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const activeCount = conversations.filter(c => c.status === 'active').length;
  const selectedConv = conversations.find(c => c.id === selectedId);

  const statusBadge = (status: string) => {
    if (status === 'active') return <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Active</span>;
    if (status === 'handed_off') return <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 uppercase tracking-wider"><AlertCircle className="w-3 h-3" />Handed off</span>;
    return <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider"><CheckCircle2 className="w-3 h-3" />Closed</span>;
  };

  return (
    <div className="h-[calc(100vh-10rem)] lg:h-[calc(100vh-7rem)] flex gap-4 overflow-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* Left panel — conversation list                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className={cn(
        'w-full lg:w-96 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden shrink-0',
        selectedId ? 'hidden lg:flex' : 'flex',
      )}>
        {/* Header */}
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Inbox</h3>
            <div className="flex items-center gap-2">
              {activeCount > 0 && (
                <span className="text-xs font-bold bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
                  {activeCount} active
                </span>
              )}
              <button
                onClick={loadConversations}
                disabled={isLoading}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status filters */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
            {(['all', 'active', 'handed_off', 'closed'] as StatusFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full whitespace-nowrap transition-colors',
                  filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                )}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Tag filters — only shown when tags exist */}
          {allTags.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
              {tagFilter && (
                <button
                  onClick={() => setTagFilter(null)}
                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-900 text-white whitespace-nowrap"
                >
                  <X className="w-2.5 h-2.5" /> Clear tag
                </button>
              )}
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full whitespace-nowrap transition-colors',
                    tagFilter === tag ? tagColour(tag) + ' ring-1 ring-inset ring-current' : tagColour(tag) + ' opacity-70 hover:opacity-100',
                  )}
                >
                  <Tag className="w-2.5 h-2.5" />{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <MessageSquare className="w-8 h-8 text-slate-200 mb-3" />
              <p className="text-sm font-medium text-slate-500 mb-1">
                {search || filter !== 'all' ? 'No conversations match your filter' : 'No conversations yet'}
              </p>
              <p className="text-xs text-slate-400">
                {search || filter !== 'all'
                  ? 'Try adjusting your search or filter.'
                  : 'Conversations started through the widget will appear here.'}
              </p>
            </div>
          ) : (
            filtered.map(conv => (
              <button
                key={conv.id}
                onClick={() => selectConversation(conv.id)}
                className={cn(
                  'w-full p-4 text-left hover:bg-slate-50 transition-colors',
                  selectedId === conv.id && 'bg-teal-50/60 border-r-2 border-teal-500',
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-semibold text-slate-900 text-sm truncate">
                    {conv.user_name || 'Visitor'}
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0">{relativeTime(conv.updated_at)}</span>
                </div>

                {conv.last_message && (
                  <p className="text-xs text-slate-500 truncate mb-2 leading-relaxed">
                    {conv.last_message_role === 'assistant' && <span className="text-slate-400">Bot: </span>}
                    {conv.last_message}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
                      <Globe className="w-2.5 h-2.5" />{conv.channel}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-[10px] font-bold text-slate-400 truncate">{conv.assistant_name}</span>
                  </div>
                  <div className="shrink-0">{statusBadge(conv.status)}</div>
                </div>

                {(conv.tags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(conv.tags || []).map(tag => (
                      <span key={tag} className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-full', tagColour(tag))}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Right panel — conversation transcript                               */}
      {/* ------------------------------------------------------------------ */}
      <div className={cn(
        'flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden',
        selectedId ? 'flex' : 'hidden lg:flex',
      )}>
        {!selectedId ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-7 h-7 text-slate-300" />
            </div>
            <h4 className="font-semibold text-slate-700 mb-1">Select a conversation</h4>
            <p className="text-sm text-slate-400 max-w-xs">
              Click any conversation on the left to read the full transcript.
            </p>
          </div>
        ) : (
          <>
            {/* Transcript header */}
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 shrink-0 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => { setSelectedId(null); setShowTagInput(false); }}
                    className="p-1.5 -ml-1 text-slate-400 hover:text-slate-600 lg:hidden"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {selectedConv?.user_name || 'Visitor'}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-slate-400">
                      <Globe className="w-3 h-3" />
                      <span className="capitalize">{selectedConv?.channel}</span>
                      <span>·</span>
                      <Bot className="w-3 h-3" />
                      <span className="truncate">{selectedConv?.assistant_name}</span>
                      {selectedConv && <><span>·</span>{statusBadge(selectedConv.status)}</>}
                      {selectedConv?.user_email && (
                        <><span>·</span><span className="text-slate-500">{selectedConv.user_email}</span></>
                      )}
                      {selectedConv?.user_phone && (
                        <><span>·</span><span className="text-slate-500">{selectedConv.user_phone}</span></>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                {selectedConv?.status !== 'closed' && !isTakenOver && (
                  <button
                    onClick={handleTakeOver}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600 transition-colors"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Take Over
                  </button>
                )}
                {isTakenOver && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold">
                    <UserCheck className="w-3.5 h-3.5" />
                    You're responding
                  </span>
                )}
                {selectedConv?.status !== 'closed' && (
                  <button
                    onClick={handleClose}
                    disabled={isClosing}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    {isClosing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Close
                  </button>
                )}
              </div>
            </div>

              {/* Tag row */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(selectedConv?.tags || []).map(tag => (
                  <span key={tag} className={cn('flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full', tagColour(tag))}>
                    {tag}
                    <button onClick={() => removeTag(selectedId, tag)} className="hover:opacity-70">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
                {showTagInput ? (
                  <input
                    ref={tagInputRef}
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { addTag(selectedId, tagInput); setTagInput(''); setShowTagInput(false); }
                      if (e.key === 'Escape') { setShowTagInput(false); setTagInput(''); }
                    }}
                    placeholder="Add tag..."
                    className="text-xs px-2 py-0.5 border border-slate-200 rounded-full outline-none focus:border-teal-400 w-24"
                  />
                ) : (
                  <button
                    onClick={() => { setShowTagInput(true); setTimeout(() => tagInputRef.current?.focus(), 50); }}
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-teal-600 transition-colors"
                  >
                    <Plus className="w-3 h-3" />Add tag
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/30">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
                  No messages in this conversation.
                </div>
              ) : (
                <>
                  {/* Date header */}
                  <div className="flex items-center justify-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/30 px-3 py-1 rounded-full">
                      {formatDate(messages[0]?.created_at)}
                    </span>
                  </div>

                  {messages.map((msg, i) => {
                    const isUser = msg.role === 'user';
                    const isHuman = msg.role === 'human';
                    const showDateSep = i > 0 && new Date(msg.created_at).toDateString() !== new Date(messages[i - 1].created_at).toDateString();

                    return (
                      <React.Fragment key={msg.id}>
                        {showDateSep && (
                          <div className="flex items-center justify-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {formatDate(msg.created_at)}
                            </span>
                          </div>
                        )}

                        <div className={cn('flex gap-2.5 max-w-[82%]', isUser ? 'ml-auto flex-row-reverse' : '')}>
                          {/* Avatar */}
                          <div className={cn(
                            'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                            isUser ? 'bg-slate-200' : isHuman ? 'bg-amber-100' : 'bg-teal-100',
                          )}>
                            {isUser
                              ? <User className="w-3.5 h-3.5 text-slate-500" />
                              : isHuman
                                ? <User className="w-3.5 h-3.5 text-amber-600" />
                                : <Bot className="w-3.5 h-3.5 text-teal-600" />
                            }
                          </div>

                          {/* Bubble */}
                          <div>
                            <div className={cn(
                              'px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                              isUser
                                ? 'bg-slate-200 text-slate-800 rounded-tr-sm'
                                : isHuman
                                  ? 'bg-amber-50 text-amber-900 border border-amber-100 rounded-tl-sm'
                                  : 'bg-white text-slate-800 border border-slate-100 shadow-sm rounded-tl-sm',
                            )}>
                              {msg.content}
                            </div>
                            <p className={cn('text-[10px] text-slate-400 mt-1', isUser ? 'text-right' : 'text-left')}>
                              {isHuman && <span className="font-semibold text-amber-600 mr-1">Agent</span>}
                              {formatTime(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Footer — agent reply input */}
            <div className="p-4 border-t border-slate-100 bg-white shrink-0">
              {isTakenOver && selectedConv?.status !== 'closed' ? (
                <div className="flex gap-2">
                  <input
                    ref={agentInputRef}
                    type="text"
                    value={agentInput}
                    onChange={e => setAgentInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendAgentMessage(); } }}
                    placeholder="Type a message as agent..."
                    disabled={isSendingMessage}
                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 disabled:opacity-50"
                  />
                  <button
                    onClick={handleSendAgentMessage}
                    disabled={isSendingMessage || !agentInput.trim()}
                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              ) : selectedConv?.status === 'closed' ? (
                <p className="text-xs text-slate-400 text-center py-1">This conversation is closed.</p>
              ) : (
                <p className="text-xs text-slate-400 text-center py-1">
                  Click <span className="font-semibold text-amber-600">Take Over</span> to reply as a human agent.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
