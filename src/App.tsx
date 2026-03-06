import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Assistants from './pages/Assistants';
import AssistantSettings from './pages/AssistantSettings';
import Inbox from './pages/Inbox';
import Leads from './pages/Leads';
import Integrations from './pages/Integrations';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { api } from './services/api';
import { AnalyticsData } from './types';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// Format a YYYY-MM-DD string to a short label like "Mar 01"
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

// Format large numbers with commas
function formatNumber(n: number): string {
  return n.toLocaleString('en-GB');
}

const Dashboard = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAnalytics = async () => {
    try {
      const data = await api.getAnalytics();
      setAnalytics(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

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
        <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm w-fit">
          <span className="font-medium text-slate-700">Last 30 days</span>
          {updatedLabel && (
            <>
              <div className="w-1 h-1 rounded-full bg-slate-300"></div>
              <span>{updatedLabel}</span>
            </>
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
            <span className="text-xs text-slate-400">Last 30 days</span>
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

        {/* Top questions */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Top Questions</h3>
          {loading ? (
            <div className="space-y-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2 animate-pulse">
                  <div className="h-3 bg-slate-100 rounded w-full"></div>
                  <div className="h-2 bg-slate-100 rounded w-full"></div>
                </div>
              ))}
            </div>
          ) : topQuestions.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              No questions yet. Conversations will appear here once users start chatting.
            </p>
          ) : (
            <div className="space-y-5">
              {topQuestions.map((item, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-start justify-between text-sm gap-3">
                    <span className="font-medium text-slate-700 leading-snug line-clamp-2">{item.question}</span>
                    <span className="text-slate-400 font-bold shrink-0">{item.count}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded-full"
                      style={{ width: `${(item.count / maxQuestionCount) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Busiest hours chart */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Busiest Hours</h3>
          <span className="text-xs text-slate-400">Last 30 days — user messages by hour of day</span>
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
