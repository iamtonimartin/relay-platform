import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Assistants from './pages/Assistants';
import AssistantSettings from './pages/AssistantSettings';
import Inbox from './pages/Inbox';
import Leads from './pages/Leads';
import Integrations from './pages/Integrations';
import Settings from './pages/Settings';
import Docs from './pages/Docs';
import Login from './pages/Login';
import { api } from './services/api';
import { AnalyticsData } from './types';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// Format a YYYY-MM-DD string to a short label like "Mar 01"
// Time labels (e.g. "09:00") are returned as-is
function formatDate(dateStr: string): string {
  if (dateStr.includes(':')) return dateStr;
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

type DatePreset = 'today' | '7d' | '30d' | '90d' | '1y' | 'custom';

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d',   label: '7 days' },
  { key: '30d',  label: '30 days' },
  { key: '90d',  label: '90 days' },
  { key: '1y',   label: '12 months' },
  { key: 'custom', label: 'Custom' },
];

// Returns ISO date strings for start/end given a preset
function getPresetRange(preset: DatePreset, customStart: string, customEnd: string): { start: string; end: string; label: string } {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const daysAgo = (n: number) => {
    const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0];
  };

  switch (preset) {
    case 'today':   return { start: todayStr,     end: todayStr,    label: 'Today' };
    case '7d':      return { start: daysAgo(6),   end: todayStr,    label: 'Last 7 days' };
    case '30d':     return { start: daysAgo(29),  end: todayStr,    label: 'Last 30 days' };
    case '90d':     return { start: daysAgo(89),  end: todayStr,    label: 'Last 90 days' };
    case '1y':      return { start: daysAgo(364), end: todayStr,    label: 'Last 12 months' };
    case 'custom':  return { start: customStart || daysAgo(29), end: customEnd || todayStr, label: 'Custom range' };
  }
}

// Colours for the conversation outcomes donut chart
const OUTCOME_COLOURS: Record<string, string> = {
  'Active':     '#0d9488',
  'Handed Off': '#f59e0b',
  'Closed':     '#64748b',
  'Archived':   '#cbd5e1',
};

// Format large numbers with commas
function formatNumber(n: number): string {
  return n.toLocaleString('en-GB');
}

const Dashboard = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [preset, setPreset] = useState<DatePreset>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const fetchAnalytics = async (p: DatePreset = preset, cs = customStart, ce = customEnd) => {
    setLoading(true);
    try {
      const range = getPresetRange(p, cs, ce);
      const data = await api.getAnalytics({ start: range.start, end: range.end });
      setAnalytics(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnalytics(); }, []);

  // Format the chart data — convert raw dates to short labels
  const chartData = (analytics?.conversationsOverTime ?? []).map(d => ({
    date: formatDate(d.date),
    count: d.count,
  }));

  // Top questions: max count is used to scale the progress bars
  const topQuestions = analytics?.topQuestions ?? [];
  const maxQuestionCount = topQuestions[0]?.count ?? 1;

  // Build the stat cards from real data
  const stats = analytics
    ? [
        {
          label: 'Total Conversations',
          value: formatNumber(analytics.totalConversations),
        },
        {
          label: 'Messages Sent',
          value: formatNumber(analytics.messagesSent),
        },
        {
          label: 'Handoff Rate',
          value: `${analytics.handoffRate}%`,
        },
        {
          label: 'Fallback Rate',
          value: `${analytics.fallbackRate}%`,
        },
        {
          label: 'Lead Capture Rate',
          value: `${analytics.leadCaptureRate ?? 0}%`,
        },
      ]
    : [];

  // Busiest hours chart data
  const busiestHoursData = analytics?.busiestHours ?? [];

  // Conversation outcomes for donut chart
  const outcomes = analytics?.conversationOutcomes ?? [];
  const outcomeTotal = outcomes.reduce((s, o) => s + o.count, 0);

  // Active date range label for chart headers
  const rangeLabel = getPresetRange(preset, customStart, customEnd).label;

  const updatedLabel = lastUpdated
    ? `Updated ${lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
    : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Overview</h2>
          <p className="text-slate-500 text-sm">Live performance metrics across all assistants.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {/* Preset pill buttons */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
            {DATE_PRESETS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => {
                  setPreset(key);
                  if (key !== 'custom') fetchAnalytics(key, customStart, customEnd);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  preset === key
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Custom date inputs */}
          {preset === 'custom' && (
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="text-xs text-slate-700 border-none outline-none"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="text-xs text-slate-700 border-none outline-none"
              />
              <button
                onClick={() => fetchAnalytics('custom', customStart, customEnd)}
                disabled={!customStart || !customEnd}
                className="ml-1 px-2.5 py-1 bg-teal-600 text-white text-xs rounded-md disabled:opacity-40 hover:bg-teal-700 transition-colors"
              >
                Apply
              </button>
            </div>
          )}
          {updatedLabel && (
            <span className="text-xs text-slate-400">{updatedLabel}</span>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-pulse">
                <div className="h-3 bg-slate-100 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-slate-100 rounded w-2/3"></div>
              </div>
            ))
          : stats.map((stat) => (
              <div key={stat.label} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-slate-900 tracking-tight">{stat.value}</span>
                </div>
              </div>
            ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Conversations Over Time</h3>
            <span className="text-xs text-slate-400">{rangeLabel}</span>
          </div>
          <div className="h-80 w-full">
            {loading ? (
              <div className="h-full bg-slate-50 rounded-xl animate-pulse"></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    dy={10}
                    interval={4}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#0d9488"
                    strokeWidth={3}
                    dot={{ r: 3, fill: '#0d9488', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Conversation outcomes donut chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Conversation Outcomes</h3>
          <p className="text-xs text-slate-400 mb-4">How conversations resolved in this period</p>
          {loading ? (
            <div className="flex flex-col gap-4 items-center">
              <div className="w-36 h-36 rounded-full bg-slate-100 animate-pulse" />
              <div className="space-y-2 w-full">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-3 bg-slate-100 rounded animate-pulse" />
                ))}
              </div>
            </div>
          ) : outcomes.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              No conversations in this period yet.
            </p>
          ) : (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={outcomes}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={3}
                    >
                      {outcomes.map((entry, i) => (
                        <Cell key={i} fill={OUTCOME_COLOURS[entry.status] ?? '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [`${value} (${outcomeTotal > 0 ? Math.round((value / outcomeTotal) * 100) : 0}%)`, name]}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="space-y-2 mt-2">
                {outcomes.map((o, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: OUTCOME_COLOURS[o.status] ?? '#94a3b8' }} />
                      <span className="text-slate-600">{o.status}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{o.count}</span>
                      <span className="text-slate-400 text-xs w-10 text-right">
                        {outcomeTotal > 0 ? Math.round((o.count / outcomeTotal) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Busiest hours chart */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Busiest Hours</h3>
          <span className="text-xs text-slate-400">{rangeLabel} — user messages by hour of day</span>
        </div>
        <div className="h-56 w-full">
          {loading ? (
            <div className="h-full bg-slate-50 rounded-xl animate-pulse"></div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={busiestHoursData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  dy={8}
                  interval={1}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip
                  formatter={(value: number) => [value, 'Messages']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = !!localStorage.getItem('relay_token');
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route 
          path="/" 
          element={
            <AuthGuard>
              <Layout />
            </AuthGuard>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="assistants" element={<Assistants />} />
          <Route path="assistants/:id" element={<AssistantSettings />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="leads" element={<Leads />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="settings" element={<Settings />} />
          <Route path="docs" element={<Docs />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
