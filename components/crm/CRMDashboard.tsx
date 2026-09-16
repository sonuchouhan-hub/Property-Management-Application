import React, { useState, useMemo } from 'react';
import { Lead, Project, Booking } from '../../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';
import { 
  Users, TrendingUp, DollarSign, Calendar, Filter, Award, 
  Download, ArrowUpRight, BarChart2, Briefcase
} from 'lucide-react';

interface CRMDashboardProps {
  leads: Lead[];
  projects: Project[];
  bookings: Booking[];
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a4de6c'];

export const CRMDashboard: React.FC<CRMDashboardProps> = ({ leads, projects, bookings }) => {
  const [selectedExecutive, setSelectedExecutive] = useState<string>('ALL');
  const [selectedProject, setSelectedProject] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<'all' | '30days' | '90days'>('all');

  // List of unique executives from both leads and projects
  const executives = useMemo(() => {
    const list = new Set<string>();
    leads.forEach(l => { if (l.assignedExecutive) list.add(l.assignedExecutive); });
    bookings.forEach(b => { if (b.salesExecutive) list.add(b.salesExecutive); });
    return Array.from(list);
  }, [leads, bookings]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const execMatch = selectedExecutive === 'ALL' || lead.assignedExecutive === selectedExecutive;
      const projMatch = selectedProject === 'ALL' || lead.interestedProject === selectedProject;
      
      let dateMatch = true;
      if (dateRange === '30days') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        dateMatch = new Date(lead.createdAt) >= thirtyDaysAgo;
      } else if (dateRange === '90days') {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        dateMatch = new Date(lead.createdAt) >= ninetyDaysAgo;
      }

      return execMatch && projMatch && dateMatch;
    });
  }, [leads, selectedExecutive, selectedProject, dateRange]);

  // KPIs
  const totalLeads = filteredLeads.length;
  
  const pipelineValue = useMemo(() => {
    return filteredLeads
      .filter(l => !['Closed Lost', 'Closed Won'].includes(l.status))
      .reduce((sum, l) => sum + (Number(l.budget) || 0), 0);
  }, [filteredLeads]);

  const activeSiteVisitsCount = useMemo(() => {
    return filteredLeads.reduce((acc, lead) => {
      const scheduledOrAttended = (lead.siteVisits || []).filter(sv => 
        ['Scheduled', 'Attended'].includes(sv.attendance)
      ).length;
      return acc + scheduledOrAttended;
    }, 0);
  }, [filteredLeads]);

  const conversionRate = useMemo(() => {
    if (totalLeads === 0) return 0;
    const wonCount = filteredLeads.filter(l => l.status === 'Closed Won').length;
    return Math.round((wonCount / totalLeads) * 100);
  }, [filteredLeads, totalLeads]);

  // Chart Data: Lead Sources
  const leadSourceData = useMemo(() => {
    const counts: { [key: string]: number } = {};
    filteredLeads.forEach(l => {
      const src = l.source || 'Walk-in';
      counts[src] = (counts[src] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredLeads]);

  // Chart Data: Pipeline Stages
  const pipelineStagesData = useMemo(() => {
    const stages = [
      'New Lead', 'Contacted', 'Qualified', 'Site Visit Scheduled', 
      'Site Visit Completed', 'Negotiation', 'Booking', 'Payment', 
      'Registry', 'Closed Won', 'Closed Lost'
    ];
    
    return stages.map(stage => {
      const count = filteredLeads.filter(l => l.status === stage).length;
      return { stage: stage.replace('Site Visit', 'SV'), count };
    });
  }, [filteredLeads]);

  // Chart Data: Monthly Trends
  const monthlySalesTrend = useMemo(() => {
    // Group closed won leads and bookings by month
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    
    return months.map((month, idx) => {
      // Find won leads created in this month
      const leadsCount = filteredLeads.filter(l => {
        const d = new Date(l.createdAt);
        return d.getMonth() === idx && d.getFullYear() === currentYear && l.status === 'Closed Won';
      }).length;

      // Find bookings in this month
      const bookingsCount = bookings.filter(b => {
        const d = new Date(b.bookingDate);
        return d.getMonth() === idx && d.getFullYear() === currentYear && b.status === 'Confirmed';
      }).length;

      return {
        month,
        'Won Leads': leadsCount,
        'Bookings': bookingsCount,
      };
    });
  }, [filteredLeads, bookings]);

  // Performance Leaderboard
  const executiveLeaderboard = useMemo(() => {
    const board: { 
      [key: string]: { 
        name: string; 
        leads: number; 
        siteVisits: number; 
        won: number; 
        salesVolume: number 
      } 
    } = {};

    filteredLeads.forEach(l => {
      const exec = l.assignedExecutive || 'Unassigned';
      if (!board[exec]) {
        board[exec] = { name: exec, leads: 0, siteVisits: 0, won: 0, salesVolume: 0 };
      }
      board[exec].leads += 1;
      board[exec].siteVisits += (l.siteVisits || []).filter(s => s.attendance === 'Attended').length;
      if (l.status === 'Closed Won') {
        board[exec].won += 1;
        board[exec].salesVolume += Number(l.budget) || 0;
      }
    });

    // Sort by salesVolume then by won deals
    return Object.values(board).sort((a, b) => b.salesVolume - a.salesVolume || b.won - a.won);
  }, [filteredLeads]);

  return (
    <div className="space-y-6">
      {/* Visual Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-150 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-gray-800">
          <Filter className="w-4 h-4 text-purple-600" />
          <span className="text-xs font-bold uppercase tracking-wider">Enterprise CRM Analytics</span>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Executive Filter */}
          <div>
            <select
              value={selectedExecutive}
              onChange={(e) => setSelectedExecutive(e.target.value)}
              className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-700 focus:ring-2 focus:ring-purple-500 outline-none"
            >
              <option value="ALL">All Executives</option>
              {executives.map(ex => (
                <option key={ex} value={ex}>{ex}</option>
              ))}
            </select>
          </div>

          {/* Project Filter */}
          <div>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-700 focus:ring-2 focus:ring-purple-500 outline-none"
            >
              <option value="ALL">All Projects</option>
              {projects.map(p => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Date range Toggle */}
          <div className="bg-gray-100 p-0.5 rounded-xl border flex">
            {(['all', '30days', '90days'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  dateRange === r 
                    ? 'bg-white text-purple-800 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {r === 'all' ? 'All-Time' : r === '30days' ? 'Last 30D' : 'Last 90D'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider block">Total Pipeline Leads</span>
            <div className="text-3xl font-black text-gray-950 mt-1">{totalLeads}</div>
            <span className="text-[10px] text-purple-600 font-medium block mt-1">Direct from Facebook, Ads, and Walk-ins</span>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider block">Est. Pipeline Value</span>
            <div className="text-2xl font-black text-gray-950 mt-1">₹{pipelineValue.toLocaleString('en-IN')}</div>
            <span className="text-[10px] text-emerald-600 font-medium block mt-1">Total budget of active negotiations</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider block">Lead Conversion Rate</span>
            <div className="text-3xl font-black text-gray-950 mt-1">{conversionRate}%</div>
            <span className="text-[10px] text-blue-600 font-medium block mt-1">Closed Won ratio of total pipeline</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider block">Active Site Visits</span>
            <div className="text-3xl font-black text-gray-950 mt-1">{activeSiteVisitsCount}</div>
            <span className="text-[10px] text-amber-600 font-medium block mt-1">Scheduled or Attended field runs</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Graphs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Funnel Pipeline Stages */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-purple-600" />
            Lead Funnel Pipeline Stage Distribution
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineStagesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="stage" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" radius={[4, 4, 0, 0]}>
                  {pipelineStagesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Lead Sources distribution */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <Briefcase className="w-4 h-4 text-emerald-600" />
            Lead Acquisition Sources
          </h4>
          <div className="h-64 flex flex-col justify-center">
            {leadSourceData.length > 0 ? (
              <div className="flex items-center justify-between">
                <div className="w-1/2 h-full min-h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={leadSourceData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {leadSourceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Custom Legend */}
                <div className="w-1/2 pl-4 space-y-2">
                  {leadSourceData.map((entry, index) => {
                    const pct = Math.round((entry.value / totalLeads) * 100);
                    return (
                      <div key={entry.name} className="flex items-center justify-between text-xs font-semibold text-gray-700">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className="truncate">{entry.name}</span>
                        </div>
                        <span className="font-mono text-gray-500">{entry.value} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center text-xs text-gray-400">No lead sources logged yet.</div>
            )}
          </div>
        </div>

        {/* Monthly Sales Performance Trends */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            Monthly Sales & conversion Performance Trend ({new Date().getFullYear()})
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlySalesTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Won Leads" stroke="#82ca9d" strokeWidth={2.5} activeDot={{ r: 8 }} />
                <Line type="monotone" dataKey="Bookings" stroke="#0088FE" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Sales Executives Leaderboard */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gray-50 p-4 border-b border-gray-200 flex items-center justify-between">
          <h4 className="text-xs font-extrabold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
            <Award className="w-4.5 h-4.5 text-purple-600 animate-bounce" />
            Executive Performance Leaderboard
          </h4>
          <span className="text-[10px] text-gray-400 font-mono">Ranked by sales volume and closed deals</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-200 font-bold text-gray-500 uppercase">
                <th className="py-3 px-4 text-center">Rank</th>
                <th className="py-3 px-4">Sales Representative</th>
                <th className="py-3 px-4 text-center">Assigned Leads</th>
                <th className="py-3 px-4 text-center">Completed Site Visits</th>
                <th className="py-3 px-4 text-center">Closed Deals (Won)</th>
                <th className="py-3 px-4 text-right">Closed volume (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
              {executiveLeaderboard.map((row, idx) => (
                <tr key={row.name} className="hover:bg-purple-50/10">
                  <td className="py-3.5 px-4 text-center font-black text-gray-500">
                    {idx === 0 ? '👑 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-gray-900">{row.name}</td>
                  <td className="py-3.5 px-4 text-center">{row.leads}</td>
                  <td className="py-3.5 px-4 text-center text-amber-700">{row.siteVisits}</td>
                  <td className="py-3.5 px-4 text-center font-bold text-green-700">{row.won}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900">
                    ₹{row.salesVolume.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
              {executiveLeaderboard.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-gray-400 italic">No executive sales entries tracked yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
