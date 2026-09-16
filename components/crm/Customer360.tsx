import React, { useMemo, useState } from 'react';
import { Lead, Project, Booking, CommunicationLog, DocumentRecord } from '../../types';
import { 
  User, Calendar, Phone, Mail, Building, Tag, 
  MapPin, Star, Eye, Send, FileText, 
  HelpCircle, ArrowLeft, ShieldCheck, DollarSign
} from 'lucide-react';
import { DocumentVault } from './DocumentVault';

interface Customer360Props {
  lead: Lead;
  projects: Project[];
  bookings: Booking[];
  communicationLogs: CommunicationLog[];
  onBack: () => void;
  onUploadDocument: (doc: Omit<DocumentRecord, 'id' | 'uploadedAt' | 'uploadedBy'>) => Promise<void>;
  onDeleteDocument: (docId: string) => Promise<void>;
  currentUserEmail: string;
  onShowToast: (msg: string) => void;
}

interface TimelineItem {
  id: string;
  type: 'Registration' | 'FollowUp' | 'SiteVisit' | 'Document' | 'Communication' | 'Booking' | 'Payment';
  date: string;
  time?: string;
  title: string;
  description: string;
  icon: string;
  badge?: string;
  badgeColor?: string;
}

export const Customer360: React.FC<Customer360Props> = ({
  lead,
  projects,
  bookings,
  communicationLogs,
  onBack,
  onUploadDocument,
  onDeleteDocument,
  currentUserEmail,
  onShowToast
}) => {
  const [showDocVault, setShowDocVault] = useState(false);
  // Find project details
  const projectDetails = useMemo(() => {
    return projects.find(p => p.name === lead.interestedProject);
  }, [projects, lead.interestedProject]);

  // Find active bookings matching this mobile number
  const activeBookings = useMemo(() => {
    return bookings.filter(b => b.customer?.mobile === lead.mobile);
  }, [bookings, lead.mobile]);

  // Consolidate all activities into a single sorted timeline
  const timelineItems = useMemo(() => {
    const items: TimelineItem[] = [];

    // 1. Lead Registration Event
    items.push({
      id: `reg-${lead.leadId}`,
      type: 'Registration',
      date: lead.createdAt ? lead.createdAt.split('T')[0] : '2026-07-01',
      title: 'Lead Registered in Sales CRM',
      description: `Prospect acquired from source: ${lead.source}. Initial budget noted as ₹${(lead.budget || 0).toLocaleString('en-IN')}. Assigned to coordinator ${lead.assignedExecutive || 'Unassigned'}.`,
      icon: '👤'
    });

    // 2. Follow-ups
    (lead.followups || []).forEach(f => {
      items.push({
        id: `fup-${f.id}`,
        type: 'FollowUp',
        date: f.date,
        time: f.time,
        title: `${f.type} Interaction (${f.status})`,
        description: f.notes,
        icon: f.type === 'Call' ? '📞' : f.type === 'WhatsApp' ? '💬' : '🤝',
        badge: f.status,
        badgeColor: f.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
      });
    });

    // 3. Site Visits
    (lead.siteVisits || []).forEach(sv => {
      items.push({
        id: `sv-${sv.id}`,
        type: 'SiteVisit',
        date: sv.visitDate,
        time: sv.visitTime,
        title: `Site Visit: ${sv.attendance}`,
        description: `Field coordinator: ${sv.assignedExecutive}. ${sv.notes || ''} ${sv.rating ? `Rating: ${sv.rating}★` : ''} ${sv.gpsCheckIn ? `[GPS Captured: ${sv.gpsCheckIn}]` : ''}`,
        icon: '🚗',
        badge: sv.attendance,
        badgeColor: sv.attendance === 'Attended' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
      });
    });

    // 4. Documents Uploads
    (lead.documents || []).forEach(doc => {
      items.push({
        id: `doc-${doc.id}`,
        type: 'Document',
        date: doc.uploadedAt.split('T')[0],
        title: `Document Uploaded: ${doc.name}`,
        description: `KYC Paper Category: ${doc.type}. Securely logged by administrative clearance: ${doc.uploadedBy}.`,
        icon: '📁'
      });
    });

    // 5. Communications sent via Broadcasts
    communicationLogs.forEach(log => {
      // Check if receiver is this lead
      if (log.receiver.includes(lead.fullName) || log.receiver.includes(lead.mobile)) {
        items.push({
          id: `log-${log.id}`,
          type: 'Communication',
          date: log.timestamp.split(',')[0] || 'Today',
          title: `Simulated Campaign Dispatch: ${log.type}`,
          description: `Template campaign sent. Subject: "${log.subject || 'Update'}". Content: "${log.body}"`,
          icon: '✉️'
        });
      }
    });

    // 6. Active Bookings and Timeline items from ledger
    activeBookings.forEach(b => {
      items.push({
        id: `bkg-${b.bookingId}`,
        type: 'Booking',
        date: b.bookingDate,
        title: `Plot Booked: ${b.projectName} - Plot ${b.plotNumber}`,
        description: `Active Booking successfully registered! Current lifecycle stage: "${b.workflowStage}". Total Contract Value: ₹${b.totalAmount.toLocaleString('en-IN')}.`,
        icon: '🏡',
        badge: b.workflowStage,
        badgeColor: 'bg-purple-100 text-purple-800'
      });

      // Include timeline items from this booking
      (b.timeline || []).forEach((tl, tIdx) => {
        items.push({
          id: `bkg-tl-${b.bookingId}-${tIdx}`,
          type: 'Payment',
          date: tl.date.split(',')[0],
          title: `Ledger Audit Event: ${tl.title}`,
          description: `${tl.description} Logged by supervisor: ${tl.userEmail}`,
          icon: '🧾'
        });
      });
    });

    // Sort timeline chronological descending (latest at top)
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [lead, activeBookings, communicationLogs]);

  return (
    <div className="space-y-6">
      {/* Top Header details */}
      <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-purple-50 text-purple-700 rounded-xl border transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-xl text-gray-950">{lead.fullName}</h3>
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                lead.priority === 'Hot' ? 'bg-red-100 text-red-700' :
                lead.priority === 'Warm' ? 'bg-amber-100 text-amber-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {lead.priority.toUpperCase()} PROSPECT
              </span>
            </div>
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Unified Customer 360° Portfolio Matrix</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-gray-700">
          <button
            type="button"
            onClick={() => setShowDocVault(!showDocVault)}
            className="bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-200 py-1.5 px-3 rounded-xl flex items-center gap-1.5 cursor-pointer font-black transition-all shadow-sm"
          >
            📂 {showDocVault ? 'Hide KYC Vault' : 'Manage KYC Vault'} ({lead.documents?.length || 0})
          </button>
          <span className="bg-purple-50 text-purple-700 border border-purple-200 py-1.5 px-3 rounded-xl flex items-center gap-1">
            <Tag className="w-3.5 h-3.5" />
            Stage: {lead.status}
          </span>
          <span className="bg-gray-100 py-1.5 px-3 rounded-xl flex items-center gap-1">
            <Building className="w-3.5 h-3.5" />
            Project: {lead.interestedProject || 'Any Project'}
          </span>
        </div>
      </div>

      {showDocVault && (
        <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-sm animate-scaleUp">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h4 className="text-sm font-black text-purple-900">📁 Secure Enterprise KYC Document Vault</h4>
            <button 
              type="button"
              onClick={() => setShowDocVault(false)}
              className="text-gray-400 hover:text-gray-600 text-xs font-black cursor-pointer"
            >
              Close [✕]
            </button>
          </div>
          <DocumentVault
            documents={lead.documents || []}
            onUploadDocument={onUploadDocument}
            onDeleteDocument={onDeleteDocument}
            onShowToast={onShowToast}
            currentUserEmail={currentUserEmail}
          />
        </div>
      )}

      {/* Profile summary & Timeline split panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Core Dossier */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-sm space-y-4">
            <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider border-b pb-2">
              Customer Dossier
            </h4>

            <div className="space-y-3.5 text-xs font-medium text-gray-700">
              <div>
                <span className="text-[10px] font-bold text-gray-400 block uppercase">Phone Number</span>
                <span className="font-mono font-bold text-gray-900 block mt-0.5">{lead.mobile}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 block uppercase">WhatsApp Number</span>
                <span className="font-mono font-bold text-gray-900 block mt-0.5">{lead.whatsapp || lead.mobile}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 block uppercase">Email ID</span>
                <span className="font-bold text-gray-900 block mt-0.5">{lead.email || 'None Registered'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 block uppercase">Base Location</span>
                <span className="font-bold text-gray-900 block mt-0.5">{lead.city || 'Indore'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 block uppercase">Registered Budget</span>
                <span className="font-black text-gray-900 block mt-0.5 text-base">₹{(lead.budget || 0).toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 block uppercase">Preferred Plot Size</span>
                <span className="font-bold text-gray-900 block mt-0.5">{lead.preferredPlotSize || 'Not Specified'}</span>
              </div>
            </div>
          </div>

          {/* Active holdings ledger if any */}
          {activeBookings.length > 0 && (
            <div className="bg-purple-900 text-white rounded-2xl p-5 shadow-md space-y-3">
              <h4 className="text-xs font-black uppercase tracking-widest text-amber-300 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 animate-bounce" />
                Active Ledger Holdings
              </h4>
              
              {activeBookings.map(b => {
                const isVrindavan = b.projectId === 1 || b.projectName?.toLowerCase().includes('vrindavan');
                const plotNumParsed = parseInt(b.plotNumber.toLowerCase().replace('p-', '').trim());
                const isInvalidVrindavanPlot = isVrindavan && (isNaN(plotNumParsed) || plotNumParsed > 165 || plotNumParsed < 1);
                
                return (
                  <div key={b.bookingId} className="border-t border-purple-800/80 pt-3 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-extrabold">
                        {b.projectName} - Plot {b.plotNumber}
                        {isInvalidVrindavanPlot && (
                          <span className="ml-2 text-[9px] font-bold text-red-300 bg-red-950/80 px-1.5 py-0.5 rounded border border-red-800 inline-block animate-pulse">
                            FLAGGED: INVALID PLOT
                          </span>
                        )}
                      </span>
                      <span className="bg-amber-300 text-purple-950 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                        {b.workflowStage}
                      </span>
                    </div>
                    {isInvalidVrindavanPlot && (
                      <p className="text-[10px] text-red-200 font-medium">
                        ⚠️ This customer record is linked to an invalid plot number above 165. This is flagged for administrator review. Please do not automatically reassign.
                      </p>
                    )}
                    <div className="flex justify-between items-center text-[11px] text-purple-200">
                      <span>Outstanding Contract:</span>
                      <span className="font-mono font-bold text-white">₹{b.totalAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right columns: Combined Activity Timeline */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-gray-150 shadow-sm space-y-4">
          <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">
            Combined Activity & Interaction Feed ({timelineItems.length} Entries)
          </h4>

          {/* Timeline Feed Container */}
          <div className="relative border-l border-gray-200 pl-6 ml-3 space-y-6 py-2">
            {timelineItems.map((item) => (
              <div key={item.id} className="relative group">
                {/* Visual Circle marker */}
                <div className="absolute -left-[37px] top-1 w-6.5 h-6.5 bg-white border border-gray-300 rounded-full flex items-center justify-center text-xs shadow-sm group-hover:scale-110 transition-transform">
                  {item.icon}
                </div>

                <div className="space-y-1 bg-slate-50 border rounded-2xl p-4 hover:shadow-sm transition-all">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-black text-gray-900">{item.title}</span>
                    <div className="flex items-center gap-2">
                      {item.badge && (
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase font-mono ${item.badgeColor || 'bg-gray-100 text-gray-700'}`}>
                          {item.badge}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400 font-mono font-bold">
                        {item.date} {item.time ? `@ ${item.time}` : ''}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 font-medium leading-relaxed mt-1">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}

            {timelineItems.length === 0 && (
              <div className="text-center py-12 text-gray-400 italic text-xs">No client logs or interactions recorded yet.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
