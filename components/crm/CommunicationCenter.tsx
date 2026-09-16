import React, { useState, useMemo } from 'react';
import { Lead, CommunicationLog } from '../../types';
import { 
  MessageSquare, Mail, MessageCircle, Send, Users, 
  Eye, CheckCircle, ClipboardList, RefreshCcw, FileText
} from 'lucide-react';

interface CommunicationCenterProps {
  leads: Lead[];
  onAddCommunicationLog: (log: Omit<CommunicationLog, 'id' | 'timestamp'>) => Promise<void>;
  communicationLogs: CommunicationLog[];
}

const TEMPLATES = [
  {
    id: 't_welcome',
    name: '🌟 Welcome Greeting & Brochure',
    channel: 'Email',
    subject: 'Welcome to Dhanshri Infrabulls - Premier Real Estate Layouts',
    body: 'Dear [Name],\n\nThank you for reaching out! We are delighted to assist you in securing your dream layout in Rau, Indore.\n\nOur flagship projects, Shanti Vihar (featuring our Two-Way Homes Concept) and Maa Ginni Park, offer spectacular modern infrastructure and premium amenities.\n\nOur executive, [Executive], will get in touch shortly to share pricing structures.\n\nBest regards,\nDhanshri Infrabulls Team'
  },
  {
    id: 't_site_visit',
    name: '🚗 Site Visit Convoy Scheduling',
    channel: 'WhatsApp',
    body: 'Hi [Name]! Special site visits have been arranged this weekend at Maa Ginni Park. Our luxury convoy departs from Vijay Nagar at 10 AM. Would you like our field representative, [Executive], to block a VIP seat for you?'
  },
  {
    id: 't_discount',
    name: '🔥 Shanti Vihar Pre-Launch Price Lock',
    channel: 'SMS',
    body: 'ALERT: Pre-launch residential rates at Shanti Vihar, Rau starting at just ₹2,830/sqft! Price hikes imminent. Reply YES to book your slot with executive [Executive] today.'
  },
  {
    id: 't_payment_rem',
    name: '💸 Payment Installment Reminder',
    channel: 'Email',
    subject: 'Action Required: Upcoming Plot Installment Notification',
    body: 'Dear [Name],\n\nThis is an automated reminder regarding your plot registration installment with Dhanshri Properties.\n\nPlease ensure your transfer is completed by the due date to avoid delayed payment interest charges.\n\nFor banking support, reach out to [Executive].\n\nSincerely,\nAccounts Team'
  }
];

export const CommunicationCenter: React.FC<CommunicationCenterProps> = ({
  leads,
  onAddCommunicationLog,
  communicationLogs
}) => {
  const [targetGroup, setTargetGroup] = useState<'All' | 'Hot' | 'Warm' | 'Specific'>('All');
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(TEMPLATES[0].id);
  const [customBody, setCustomBody] = useState<string>('');
  const [customSubject, setCustomSubject] = useState<string>('');
  
  // Simulation sending state
  const [sending, setSending] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  // Computed recipients
  const recipients = useMemo(() => {
    if (targetGroup === 'Specific') {
      const l = leads.find(lead => lead.leadId === selectedLeadId);
      return l ? [l] : [];
    }
    if (targetGroup === 'Hot') {
      return leads.filter(l => l.priority === 'Hot');
    }
    if (targetGroup === 'Warm') {
      return leads.filter(l => l.priority === 'Warm');
    }
    return leads; // All
  }, [leads, targetGroup, selectedLeadId]);

  // Selected template
  const currentTemplate = useMemo(() => {
    return TEMPLATES.find(t => t.id === selectedTemplateId) || TEMPLATES[0];
  }, [selectedTemplateId]);

  // Initialize form fields when template changes
  React.useEffect(() => {
    if (currentTemplate) {
      setCustomBody(currentTemplate.body);
      setCustomSubject(currentTemplate.subject || '');
    }
  }, [currentTemplate]);

  // Pre-fill text preview based on first recipient
  const previewBody = useMemo(() => {
    if (recipients.length === 0) return customBody;
    const recipient = recipients[0];
    let text = customBody;
    text = text.replace(/\[Name\]/g, recipient.fullName);
    text = text.replace(/\[Executive\]/g, recipient.assignedExecutive || 'Sales Coordinator');
    return text;
  }, [customBody, recipients]);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recipients.length === 0) {
      alert("No recipients selected. Verify your filter filters.");
      return;
    }

    setSending(true);
    setProgress(10);

    // Simulate sending progress across batch
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 15;
      });
    }, 150);

    // Wait for progress animation
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Compile and log the broadcast entries
    for (const rec of recipients) {
      let finalBody = customBody;
      finalBody = finalBody.replace(/\[Name\]/g, rec.fullName);
      finalBody = finalBody.replace(/\[Executive\]/g, rec.assignedExecutive || 'Sales Representative');

      await onAddCommunicationLog({
        type: currentTemplate.channel as any,
        sender: 'Dhanshri Infrabulls',
        receiver: `${rec.fullName} (${currentTemplate.channel === 'Email' ? rec.email || rec.mobile : rec.mobile})`,
        subject: currentTemplate.channel === 'Email' ? (customSubject || 'Dhanshri Properties Update') : undefined,
        body: finalBody,
        status: 'Sent'
      });
    }

    clearInterval(interval);
    setSending(false);
    setProgress(0);
    alert(`Successfully broadcasted simulated ${currentTemplate.channel} campaign to ${recipients.length} recipients!`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Column 1: Setup Broadcast campaign */}
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-sm space-y-4">
          <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
            <Send className="w-4.5 h-4.5 text-purple-600" />
            Trigger Broadcast Campaign
          </h4>
          <p className="text-[11px] text-gray-400 font-medium">Design bulk email, WhatsApp, or SMS updates. Select targeted priority buckets.</p>

          <form onSubmit={handleBroadcast} className="space-y-4">
            {/* Target segment */}
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1">Target Audience Group *</label>
              <select
                value={targetGroup}
                onChange={(e) => setTargetGroup(e.target.value as any)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="All">All Active Pipeline Leads ({leads.length})</option>
                <option value="Hot">🔥 Hot Leads only ({leads.filter(l => l.priority === 'Hot').length})</option>
                <option value="Warm">☀️ Warm Leads only ({leads.filter(l => l.priority === 'Warm').length})</option>
                <option value="Specific">Single Selected Prospect</option>
              </select>
            </div>

            {/* Conditional: Select specific Lead */}
            {targetGroup === 'Specific' && (
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Select Single Lead *</label>
                <select
                  required
                  value={selectedLeadId}
                  onChange={(e) => setSelectedLeadId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">-- Choose Lead --</option>
                  {leads.map(lead => (
                    <option key={lead.leadId} value={lead.leadId}>
                      {lead.fullName} ({lead.mobile})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Template select */}
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1">Acquisition Template *</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500"
              >
                {TEMPLATES.map(t => (
                  <option key={t.id} value={t.id}>
                    ({t.channel}) {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Email Subject conditional */}
            {currentTemplate.channel === 'Email' && (
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Email Subject Line *</label>
                <input
                  type="text"
                  required
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
            )}

            {/* Template Body editor */}
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1">Campaign Copy Template</label>
              <textarea
                rows={6}
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-purple-500 outline-none"
              />
              <span className="text-[10px] text-gray-400 font-bold block mt-1">Variables [Name] and [Executive] compile on runtime</span>
            </div>

            {/* Progress indicators on sending */}
            {sending && (
              <div className="space-y-1.5 bg-purple-50 p-3 rounded-xl border border-purple-200">
                <div className="flex items-center justify-between text-[10px] font-black text-purple-700">
                  <span>DISPATCHING CAMPAIGN...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-purple-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-purple-600 h-full transition-all duration-150" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={sending || recipients.length === 0}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              Broadcast simulated campaign ({recipients.length} targets)
            </button>
          </form>
        </div>
      </div>

      {/* Columns 2 & 3: Template Previews & Sent campaign logs */}
      <div className="lg:col-span-2 space-y-6">
        {/* Real-time Dynamic Preview card */}
        <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-sm space-y-3">
          <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Eye className="w-4.5 h-4.5 text-indigo-600" />
            Dynamic Recipient Preview (Template layout)
          </h4>
          <div className="text-[11px] text-gray-400 font-medium">How the first recipient will read this campaign on their screen:</div>

          <div className="border border-gray-200 rounded-2xl p-4 shadow-inner bg-slate-50 relative overflow-hidden">
            {/* Watermark of channel type */}
            <div className="absolute -top-3 -right-3 text-gray-200/50 scale-150">
              {currentTemplate.channel === 'Email' ? <Mail className="w-16 h-16" /> : currentTemplate.channel === 'WhatsApp' ? <MessageCircle className="w-16 h-16" /> : <MessageSquare className="w-16 h-16" />}
            </div>

            <div className="relative space-y-2">
              <div className="flex items-center justify-between border-b pb-2 text-[10px] font-bold text-gray-400">
                <span>CHANNEL: {currentTemplate.channel.toUpperCase()}</span>
                {currentTemplate.channel === 'Email' && <span>Subject: {customSubject}</span>}
              </div>

              <div className="text-xs text-gray-700 leading-relaxed font-semibold whitespace-pre-line bg-white/70 p-3 rounded-xl border border-gray-150 mt-2">
                {previewBody}
              </div>
            </div>
          </div>
        </div>

        {/* Campaign Sent Logs */}
        <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden">
          <div className="bg-gray-50 border-b p-4 flex items-center justify-between">
            <h4 className="text-xs font-extrabold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
              <ClipboardList className="w-4.5 h-4.5 text-purple-600" />
              Communication Broadcast Audit Logs ({communicationLogs.length})
            </h4>
            <span className="text-[10px] text-gray-400 font-mono">Simulated tracking metrics</span>
          </div>

          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b font-bold text-gray-500 uppercase">
                  <th className="py-2.5 px-4">Channel</th>
                  <th className="py-2.5 px-4">Receiver (Lead)</th>
                  <th className="py-2.5 px-4">Message Body Preview</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                {communicationLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase font-mono ${
                        log.type === 'Email' ? 'bg-indigo-100 text-indigo-800' :
                        log.type === 'WhatsApp' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {log.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-900 truncate max-w-[150px]">{log.receiver}</td>
                    <td className="py-3 px-4 text-gray-500 font-medium truncate max-w-[220px]" title={log.body}>
                      {log.body}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        ● SUCCESS
                      </span>
                    </td>
                  </tr>
                ))}
                {communicationLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-400 italic">No marketing campaign logs found. Select parameters on left to initiate.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
