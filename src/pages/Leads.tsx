import React, { useEffect, useState } from 'react';
import { Users, Search, Download, Mail, Phone, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

interface Lead {
  id: string;
  user_name?: string;
  user_email?: string;
  user_phone?: string;
  assistant_name: string;
  channel: string;
  status: 'active' | 'handed_off' | 'closed';
  created_at: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; class: string }> = {
    active:      { label: 'Active',      class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    handed_off:  { label: 'Handed off',  class: 'bg-amber-50 text-amber-700 border-amber-200' },
    closed:      { label: 'Closed',      class: 'bg-slate-100 text-slate-500 border-slate-200' },
  };
  const s = map[status] || map.closed;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${s.class}`}>
      {s.label}
    </span>
  );
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.getLeads()
      .then(data => setLeads(data))
      .catch(() => setError('Failed to load leads'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = leads.filter(l => {
    const q = search.toLowerCase();
    return (
      l.user_name?.toLowerCase().includes(q) ||
      l.user_email?.toLowerCase().includes(q) ||
      l.user_phone?.toLowerCase().includes(q) ||
      l.assistant_name?.toLowerCase().includes(q)
    );
  });

  // Export to CSV
  const exportCsv = () => {
    const headers = ['Name', 'Email', 'Phone', 'Assistant', 'Channel', 'Status', 'Date'];
    const rows = filtered.map(l => [
      l.user_name || '',
      l.user_email || '',
      l.user_phone || '',
      l.assistant_name,
      l.channel,
      l.status,
      new Date(l.created_at).toLocaleDateString('en-GB'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Leads</h2>
          <p className="text-slate-500 text-sm">Contact details captured from widget conversations.</p>
        </div>
        <div className="flex items-center gap-3">
          {filtered.length > 0 && (
            <button
              onClick={exportCsv}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, email or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-48 text-rose-600 text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-6">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
              <Users className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">
              {search ? 'No leads match your search.' : 'No leads captured yet.'}
            </p>
            {!search && (
              <p className="text-slate-400 text-sm mt-1">
                Enable lead capture on an assistant to start collecting visitor details.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assistant</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {lead.user_name || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {lead.user_email ? (
                        <a
                          href={`mailto:${lead.user_email}`}
                          className="flex items-center gap-1.5 hover:text-teal-600 transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          {lead.user_email}
                        </a>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {lead.user_phone ? (
                        <a
                          href={`tel:${lead.user_phone}`}
                          className="flex items-center gap-1.5 hover:text-teal-600 transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          {lead.user_phone}
                        </a>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{lead.assistant_name}</td>
                    <td className="px-6 py-4">{statusBadge(lead.status)}</td>
                    <td className="px-6 py-4 text-slate-400 text-xs whitespace-nowrap">
                      {relativeTime(lead.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => navigate('/inbox')}
                        className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                        title="View conversation in Inbox"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-6 py-3 border-t border-slate-100 text-xs text-slate-400">
              {filtered.length} lead{filtered.length !== 1 ? 's' : ''}
              {search && ` matching "${search}"`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
