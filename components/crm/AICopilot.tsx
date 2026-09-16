import React, { useState, useRef, useEffect } from 'react';
import { Lead, Project, Booking } from '../../types';
import { 
  Sparkles, Send, Bot, User, CornerDownLeft, Terminal,
  HelpCircle, RefreshCw, BarChart2, ShieldAlert
} from 'lucide-react';

interface AICopilotProps {
  leads: Lead[];
  projects: Project[];
  bookings: Booking[];
}

interface Message {
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

const PRESET_CARDS = [
  { label: "Lead Funnel Count", query: "Give me a summary of total lead counts across all 11 stages. Which stage has the highest volume?" },
  { label: "Top Executives", query: "Who are the top performing sales executives based on our database, and how many deals has each closed?" },
  { label: "Overdue Reminders", query: "Identify if we have any overdue follow-ups or critical client site visits that require immediate attention today." },
  { label: "Project Stock Status", query: "Summarize current inventory stock for Shanti Vihar and Maa Ginni Park, including total vs available plots." }
];

export const AICopilot: React.FC<AICopilotProps> = ({ leads, projects, bookings }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'assistant',
      text: "Hello! I am your Dhanshri Properties AI Sales Copilot. I have real-time access to our active CRM database (Leads, Projects, and Booking lifecycles). Tap one of the prompt cards below or ask me any question to analyze sales trends!",
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (queryText: string) => {
    if (!queryText.trim() || loading) return;

    const userMsg: Message = {
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    // Context preparation for Gemini
    const sanitizedProjects = projects.map(p => ({
      name: p.name,
      location: p.location,
      totalPlots: p.totalPlots,
      availablePlots: p.availablePlots,
      premiumRate: p.layout[0]?.premiumRate || 2500
    }));

    const sanitizedBookings = bookings.map(b => ({
      plotNumber: b.plotNumber,
      projectName: b.projectName,
      workflowStage: b.workflowStage,
      customerName: b.customer?.fullName,
      salesExecutive: b.salesExecutive,
      totalAmount: b.totalAmount
    }));

    const sanitizedLeads = leads.map(l => ({
      fullName: l.fullName,
      source: l.source,
      budget: l.budget,
      status: l.status,
      priority: l.priority,
      assignedExecutive: l.assignedExecutive,
      nextFollowUp: l.nextFollowUpDate,
      followupsCount: (l.followups || []).length,
      siteVisitsCount: (l.siteVisits || []).length
    }));

    const context = {
      projectsSummary: sanitizedProjects,
      bookingsSummary: sanitizedBookings,
      leadsSummary: sanitizedLeads,
      metrics: {
        totalLeadsCount: leads.length,
        totalBookingsCount: bookings.length,
        activeProjectsCount: projects.length
      }
    };

    try {
      const res = await fetch('/api/gemini/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: queryText, context })
      });
      const data = await res.json();
      
      const assistantMsg: Message = {
        sender: 'assistant',
        text: data.text || "I was unable to analyze this data at this moment. Let me know if you would like me to refresh.",
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        sender: 'assistant',
        text: "Apologies! There was an issue reaching the server-side AI engine. Please verify that your Gemini API key is configured or retry.",
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend(inputText);
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        sender: 'assistant',
        text: "Chat history cleared. How can I help you analyze the Dhanshri properties database today?",
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 max-h-[600px]">
      {/* Left Sidebar Panel: Prompt cards */}
      <div className="space-y-4 lg:col-span-1">
        <div className="bg-gradient-to-br from-purple-900 to-indigo-950 p-5 rounded-2xl border text-white shadow-md">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-5 h-5 text-amber-300 animate-spin" />
            <span className="text-xs font-black uppercase tracking-widest text-amber-200">AI Sales Agent</span>
          </div>
          <h4 className="font-extrabold text-base mt-2">Enterprise Copilot</h4>
          <p className="text-[11px] text-purple-200/80 mt-1 leading-relaxed">
            Direct real-time query interface to fetch analytics reports, monitor client portfolios, or verify deal stages.
          </p>
        </div>

        {/* Preset Cards Stack */}
        <div className="space-y-2">
          <span className="text-[10px] font-extrabold text-gray-400 uppercase block tracking-wider px-1">Quick Analysis Queries</span>
          {PRESET_CARDS.map((card) => (
            <button
              key={card.label}
              onClick={() => handleSend(card.query)}
              disabled={loading}
              className="w-full text-left bg-white hover:bg-purple-50/40 p-3 rounded-xl border border-gray-150 shadow-sm transition-all text-xs font-semibold text-gray-700 flex items-center justify-between group disabled:opacity-50 cursor-pointer"
            >
              <div className="truncate pr-2">
                <span className="text-purple-600 block text-[9px] uppercase font-black font-mono">PRESET REPORT</span>
                <span className="group-hover:text-purple-800 transition-colors">{card.label}</span>
              </div>
              <CornerDownLeft className="w-4 h-4 text-gray-300 shrink-0 group-hover:text-purple-600 transition-colors" />
            </button>
          ))}
        </div>

        <button
          onClick={handleResetChat}
          className="w-full py-2 px-3 border border-dashed border-gray-300 rounded-xl text-center text-[10px] font-bold text-gray-400 hover:text-purple-600 hover:border-purple-300 transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Clear Conversation History
        </button>
      </div>

      {/* Right Chat Pane */}
      <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[520px] overflow-hidden">
        {/* Chat header */}
        <div className="bg-gray-50 border-b p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-extrabold text-sm shadow-sm">
              🤖
            </div>
            <div>
              <h5 className="text-xs font-black text-gray-800 uppercase tracking-wider">Dhanshri Sales Copilot</h5>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                <span className="text-[9px] text-gray-400 font-bold font-mono uppercase tracking-wider">Real-time Connected</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
            <Terminal className="w-3.5 h-3.5" />
            <span>GEMINI 3.5 FLASH</span>
          </div>
        </div>

        {/* Conversation Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 max-w-[85%] ${
                msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''
              }`}
            >
              {/* Profile Avatar */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.sender === 'user' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-indigo-100 text-indigo-700'
              }`}>
                {msg.sender === 'user' ? <User className="w-4.5 h-4.5" /> : <Bot className="w-4.5 h-4.5" />}
              </div>

              {/* Message Box */}
              <div>
                <div className={`p-3.5 rounded-2xl text-xs shadow-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-purple-600 text-white rounded-tr-none'
                    : 'bg-white text-gray-800 border rounded-tl-none font-medium'
                }`}>
                  <p className="whitespace-pre-line">{msg.text}</p>
                </div>
                <span className={`text-[9px] font-bold text-gray-400 font-mono block mt-1 ${
                  msg.sender === 'user' ? 'text-right' : ''
                }`}>
                  {msg.timestamp}
                </span>
              </div>
            </div>
          ))}

          {/* Loading Typing Indicator */}
          {loading && (
            <div className="flex gap-3 max-w-[80%]">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 animate-pulse">
                <Bot className="w-4.5 h-4.5" />
              </div>
              <div className="p-3 bg-white border rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          
          <div ref={scrollRef} />
        </div>

        {/* Input area */}
        <div className="p-4 bg-white border-t flex gap-3 items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type your database analysis query..."
            disabled={loading}
            className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none disabled:opacity-50"
          />
          <button
            onClick={() => handleSend(inputText)}
            disabled={loading || !inputText.trim()}
            className="bg-purple-600 hover:bg-purple-700 text-white p-2.5 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 shrink-0 cursor-pointer"
          >
            <Send className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
