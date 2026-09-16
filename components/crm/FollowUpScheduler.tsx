import React, { useState, useMemo } from 'react';
import { Lead, FollowUp } from '../../types';
import { 
  Calendar, Check, X, Phone, Users, Plus, AlertCircle, 
  MessageSquare, BellRing, Clock, Repeat, HelpCircle
} from 'lucide-react';

interface FollowUpSchedulerProps {
  leads: Lead[];
  onAddFollowUp: (leadId: string, followup: Omit<FollowUp, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateFollowUpStatus: (leadId: string, followupId: string, status: 'Completed' | 'Cancelled', notes: string) => Promise<void>;
}

export const FollowUpScheduler: React.FC<FollowUpSchedulerProps> = ({
  leads,
  onAddFollowUp,
  onUpdateFollowUpStatus
}) => {
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [followUpType, setFollowUpType] = useState<FollowUp['type']>('Call');
  const [followUpDate, setFollowUpDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [followUpTime, setFollowUpTime] = useState<string>('10:00');
  const [followUpNotes, setFollowUpNotes] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurringInterval, setRecurringInterval] = useState<FollowUp['recurringInterval']>('Weekly');
  
  // Interaction Logging
  const [completingFollowUp, setCompletingFollowUp] = useState<{ leadId: string, fUp: FollowUp } | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<string>('');

  // Calculate upcoming and overdue followups across all leads
  const { overdue, upcoming, completed } = useMemo(() => {
    const overdueList: { lead: Lead, fUp: FollowUp }[] = [];
    const upcomingList: { lead: Lead, fUp: FollowUp }[] = [];
    const completedList: { lead: Lead, fUp: FollowUp }[] = [];

    const now = new Date();
    // Reset hours to compare dates only
    const todayStr = now.toISOString().split('T')[0];

    leads.forEach(lead => {
      (lead.followups || []).forEach(fUp => {
        if (fUp.status === 'Completed' || fUp.status === 'Cancelled') {
          completedList.push({ lead, fUp });
        } else {
          // Check if overdue (date is before today, or today but earlier time)
          const fUpDateTime = new Date(`${fUp.date}T${fUp.time}`);
          if (fUpDateTime < now && fUp.date !== todayStr) {
            overdueList.push({ lead, fUp });
          } else {
            upcomingList.push({ lead, fUp });
          }
        }
      });
    });

    // Sort chronologically
    overdueList.sort((a, b) => new Date(`${a.fUp.date}T${a.fUp.time}`).getTime() - new Date(`${b.fUp.date}T${b.fUp.time}`).getTime());
    upcomingList.sort((a, b) => new Date(`${a.fUp.date}T${a.fUp.time}`).getTime() - new Date(`${b.fUp.date}T${b.fUp.time}`).getTime());
    completedList.sort((a, b) => new Date(`${b.fUp.date}T${b.fUp.time}`).getTime() - new Date(`${a.fUp.date}T${a.fUp.time}`).getTime()); // descending completed

    return { overdue: overdueList, upcoming: upcomingList, completed: completedList };
  }, [leads]);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId) {
      alert('Please select a lead first.');
      return;
    }
    if (!followUpNotes.trim()) {
      alert('Please write follow-up schedule notes.');
      return;
    }

    await onAddFollowUp(selectedLeadId, {
      type: followUpType,
      date: followUpDate,
      time: followUpTime,
      notes: followUpNotes,
      status: 'Pending',
      recurring: isRecurring,
      recurringInterval: isRecurring ? recurringInterval : 'None'
    });

    // Reset Form
    setSelectedLeadId('');
    setFollowUpNotes('');
    setIsRecurring(false);
  };

  const handleCompleteSubmit = async () => {
    if (!completingFollowUp) return;
    await onUpdateFollowUpStatus(
      completingFollowUp.leadId,
      completingFollowUp.fUp.id,
      'Completed',
      resolutionNotes || 'Follow-up successfully resolved.'
    );
    setCompletingFollowUp(null);
    setResolutionNotes('');
  };

  const handleCancel = async (leadId: string, followupId: string) => {
    if (window.confirm('Are you sure you want to cancel this scheduled follow-up?')) {
      await onUpdateFollowUpStatus(leadId, followupId, 'Cancelled', 'Follow-up was cancelled by the executive.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Column 1: Schedule Form & Action links */}
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-sm">
          <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <Plus className="w-4.5 h-4.5 text-purple-600" />
            Schedule Follow-up Task
          </h4>

          <form onSubmit={handleSchedule} className="space-y-4">
            {/* Select Lead */}
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1">Associate Lead *</label>
              <select
                required
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">-- Choose Lead/Prospect --</option>
                {leads.map(lead => (
                  <option key={lead.leadId} value={lead.leadId}>
                    {lead.fullName} ({lead.mobile})
                  </option>
                ))}
              </select>
            </div>

            {/* Type */}
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1">Interaction Medium *</label>
              <select
                value={followUpType}
                onChange={(e) => setFollowUpType(e.target.value as any)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="Call">📞 Phone Call</option>
                <option value="WhatsApp">💬 WhatsApp Message</option>
                <option value="Meeting">🤝 Direct Meeting</option>
                <option value="Site Visit">🚗 Site Visit Convoy</option>
                <option value="Payment Reminder">💸 Payment Instalment Reminder</option>
              </select>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Schedule Date *</label>
                <input
                  type="date"
                  required
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Time Slot *</label>
                <input
                  type="time"
                  required
                  value={followUpTime}
                  onChange={(e) => setFollowUpTime(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
            </div>

            {/* Note / Purpose */}
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1">Objective / Notes *</label>
              <textarea
                required
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
                rows={3}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="Explain task objective e.g. Discuss Shanti Vihar pricing"
              />
            </div>

            {/* Recurring options */}
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                  <Repeat className="w-3.5 h-3.5 text-purple-600" />
                  Is Recurring Task?
                </span>
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                />
              </div>
              
              {isRecurring && (
                <div className="mt-2 pt-2 border-t">
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Repeat Cadence</label>
                  <select
                    value={recurringInterval}
                    onChange={(e) => setRecurringInterval(e.target.value as any)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold text-gray-700"
                  >
                    <option value="Daily">Daily Follow-up</option>
                    <option value="Weekly">Weekly Check-in</option>
                    <option value="Monthly">Monthly Account Audit</option>
                  </select>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Calendar className="w-4 h-4" />
              Commit Task to Calendar
            </button>
          </form>
        </div>

        {/* Executive Templates Panel */}
        <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-sm space-y-3">
          <h5 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider flex items-center gap-1">
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            Quick WhatsApp Templates
          </h5>
          <div className="text-[11px] text-gray-400 font-medium">Click copy or share to use predefined templates instantly.</div>
          
          <div className="space-y-2.5">
            <div className="p-3 bg-slate-50 border rounded-xl">
              <span className="text-[10px] font-bold text-emerald-700 uppercase">1. Site Visit invitation</span>
              <p className="text-[11px] text-gray-600 mt-1 italic font-medium leading-relaxed">
                "Hi [Name], we've scheduled a VIP Site Visit to Maa Ginni Park this weekend. Confirm if 11 AM works?"
              </p>
            </div>
            <div className="p-3 bg-slate-50 border rounded-xl">
              <span className="text-[10px] font-bold text-indigo-700 uppercase">2. Pre-Launch discount alert</span>
              <p className="text-[11px] text-gray-600 mt-1 italic font-medium leading-relaxed">
                "Hello [Name], special residential rates are opening for Shanti Vihar at ₹2,830/sqft! Secure corner plot before hike."
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Columns 2 & 3: Calendar lists (Overdue alerts, Upcoming & completed) */}
      <div className="lg:col-span-2 space-y-6">
        {/* Overdue Follow-ups Panel */}
        {overdue.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 shadow-sm">
            <h4 className="text-xs font-black text-red-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <AlertCircle className="w-4.5 h-4.5 text-red-600 animate-pulse" />
              Overdue CRM Reminders ({overdue.length})
            </h4>
            
            <div className="divide-y divide-red-100 max-h-48 overflow-y-auto pr-1">
              {overdue.map(({ lead, fUp }) => (
                <div key={fUp.id} className="py-2.5 flex items-center justify-between gap-4">
                  <div>
                    <span className="font-extrabold text-xs text-red-900">{lead.fullName}</span>
                    <span className="bg-red-100 text-red-700 text-[8px] font-black font-mono px-1.5 py-0.5 rounded ml-2 uppercase">
                      {fUp.type}
                    </span>
                    <p className="text-[11px] text-red-700 font-medium mt-0.5 line-clamp-1">{fUp.notes}</p>
                    <span className="text-[10px] text-red-500 font-bold block mt-0.5">
                      Missed on {fUp.date} at {fUp.time}
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCompletingFollowUp({ leadId: lead.leadId, fUp })}
                      className="bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-lg text-xs font-bold shadow-sm cursor-pointer"
                      title="Log notes and mark completed"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCancel(lead.leadId, fUp.id)}
                      className="bg-white border border-red-200 text-red-600 p-1.5 rounded-lg hover:bg-red-100 cursor-pointer"
                      title="Cancel follow-up"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Tasks & Completed Timeline */}
        <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden">
          <div className="bg-gray-50 border-b p-4 flex items-center justify-between">
            <h4 className="text-xs font-extrabold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
              <BellRing className="w-4.5 h-4.5 text-purple-600" />
              Scheduled Upcoming Follow-up Queue ({upcoming.length})
            </h4>
            <span className="text-[10px] text-gray-400 font-mono">Syncs automatically to executive daily charts</span>
          </div>

          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto pr-1">
            {upcoming.map(({ lead, fUp }) => (
              <div key={fUp.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-xs text-gray-900">{lead.fullName}</span>
                    <span className="text-[10px] text-gray-400 font-bold font-mono">({lead.mobile})</span>
                    <span className="bg-purple-100 text-purple-800 text-[8px] font-black px-1.5 py-0.5 rounded uppercase font-mono">
                      {fUp.type}
                    </span>
                    {fUp.recurring && (
                      <span className="bg-emerald-50 text-emerald-700 text-[8px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <Repeat className="w-2.5 h-2.5" />
                        {fUp.recurringInterval}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 font-medium mt-1 leading-relaxed">{fUp.notes}</p>
                  <div className="flex items-center gap-3 text-[10px] font-bold text-purple-600 mt-2">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {fUp.date} @ {fUp.time}
                    </span>
                    <span className="text-gray-400">Owner: {lead.assignedExecutive || 'Unassigned'}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setCompletingFollowUp({ leadId: lead.leadId, fUp })}
                    className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-lg shadow-sm cursor-pointer"
                    title="Mark Completed"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleCancel(lead.leadId, fUp.id)}
                    className="bg-white border border-gray-200 text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 cursor-pointer"
                    title="Cancel Follow-up"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {upcoming.length === 0 && (
              <div className="text-center py-10 text-xs text-gray-400 italic">No upcoming follow-ups scheduled. Use the scheduler panel on the left to add tasks.</div>
            )}
          </div>
        </div>

        {/* Past Resolution Logs */}
        <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden">
          <div className="bg-gray-50 border-b p-4">
            <h4 className="text-xs font-extrabold text-gray-600 uppercase tracking-wider">
              Completed Interaction & resolution Logs ({completed.length})
            </h4>
          </div>

          <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto pr-1">
            {completed.map(({ lead, fUp }) => (
              <div key={fUp.id} className="p-4 hover:bg-slate-50/40 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-gray-800">{lead.fullName}</span>
                    <span className="text-[10px] font-bold text-gray-400">({lead.mobile})</span>
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase font-mono ${
                      fUp.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {fUp.status}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">{fUp.date}</span>
                </div>
                <p className="text-gray-600 mt-1.5 font-medium leading-relaxed">
                  <strong className="text-gray-400 uppercase text-[9px] block">Objective:</strong>
                  {fUp.notes}
                </p>
              </div>
            ))}
            {completed.length === 0 && (
              <div className="text-center py-6 text-xs text-gray-400 italic">No past resolution history found.</div>
            )}
          </div>
        </div>
      </div>

      {/* RESOLUTION MODAL: Log Notes on Completion */}
      {completingFollowUp && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border overflow-hidden">
            <div className="p-5 border-b bg-gray-50">
              <h3 className="font-extrabold text-sm text-gray-800 uppercase tracking-wider">
                Log Follow-up Resolution Notes
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Record customer response to conclude this task.</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <span className="text-[10px] font-bold text-purple-600 uppercase block font-mono">TASK OBJECTIVE</span>
                <p className="text-xs font-semibold text-gray-700 mt-1 bg-slate-50 p-2.5 rounded-xl border italic">
                  "{completingFollowUp.fUp.notes}"
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Final Outcome Notes *</label>
                <textarea
                  required
                  rows={4}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                  placeholder="Record customer's response, interest level, next steps discussed..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setCompletingFollowUp(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs py-2 px-4 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCompleteSubmit}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-2 px-5 rounded-xl shadow-md cursor-pointer"
                >
                  Save & Resolve Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
