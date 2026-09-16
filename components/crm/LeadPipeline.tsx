import React, { useState } from 'react';
import { Lead, Project } from '../../types';
import { 
  Plus, Search, ArrowRight, User, Phone, Mail, MapPin, 
  Tag, Calendar, Edit2, CheckCircle, Trash, ExternalLink, 
  HelpCircle, AlertCircle, Sparkles, Building
} from 'lucide-react';

interface LeadPipelineProps {
  leads: Lead[];
  projects: Project[];
  onAddLead: (lead: Omit<Lead, 'leadId' | 'createdAt'>) => Promise<void>;
  onUpdateLead: (lead: Lead) => Promise<void>;
  onDeleteLead: (leadId: string) => Promise<void>;
  onOpenCustomer360: (lead: Lead) => void;
  onConvertToBooking: (lead: Lead) => void;
  executivesList: string[];
}

const FUNNEL_STAGES = [
  'New Lead', 'Contacted', 'Qualified', 'Site Visit Scheduled', 
  'Site Visit Completed', 'Negotiation', 'Booking', 'Payment', 
  'Registry', 'Closed Won', 'Closed Lost'
];

export const LeadPipeline: React.FC<LeadPipelineProps> = ({
  leads,
  projects,
  onAddLead,
  onUpdateLead,
  onDeleteLead,
  onOpenCustomer360,
  onConvertToBooking,
  executivesList
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [execFilter, setExecFilter] = useState<string>('ALL');
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

  // Form State for new lead
  const [formData, setFormData] = useState({
    fullName: '',
    mobile: '',
    whatsapp: '',
    email: '',
    city: 'Indore',
    source: 'Walk-in',
    budget: '',
    preferredLocation: '',
    preferredPlotSize: '',
    interestedProject: '',
    assignedExecutive: '',
    priority: 'Warm' as 'Hot' | 'Warm' | 'Cold',
    status: 'New Lead',
    nextFollowUpDate: new Date().toISOString().split('T')[0]
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!formData.fullName.trim()) errors.fullName = 'Name is required';
    if (!formData.mobile.trim()) {
      errors.mobile = 'Mobile is required';
    } else if (!/^\d{10}$/.test(formData.mobile.trim())) {
      errors.mobile = 'Enter a valid 10-digit number';
    }
    if (formData.whatsapp && !/^\d{10}$/.test(formData.whatsapp.trim())) {
      errors.whatsapp = 'Enter a valid 10-digit number';
    }
    if (!formData.budget.trim() || isNaN(Number(formData.budget))) errors.budget = 'Enter a valid budget amount';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    await onAddLead({
      ...formData,
      budget: Number(formData.budget),
      lastContactDate: new Date().toISOString().split('T')[0]
    });

    setIsAddModalOpen(false);
    // Reset form
    setFormData({
      fullName: '',
      mobile: '',
      whatsapp: '',
      email: '',
      city: 'Indore',
      source: 'Walk-in',
      budget: '',
      preferredLocation: '',
      preferredPlotSize: '',
      interestedProject: '',
      assignedExecutive: executivesList[0] || 'Unassigned',
      priority: 'Warm',
      status: 'New Lead',
      nextFollowUpDate: new Date().toISOString().split('T')[0]
    });
    setFormErrors({});
  };

  // Drag & Drop Mechanics
  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('text/plain', leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // necessary to allow drop
  };

  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('text/plain');
    const lead = leads.find(l => l.leadId === leadId);
    if (lead && lead.status !== targetStage) {
      const updatedLead: Lead = {
        ...lead,
        status: targetStage,
        lastContactDate: new Date().toISOString().split('T')[0]
      };
      await onUpdateLead(updatedLead);
    }
  };

  const handleStageButtonClick = async (lead: Lead, targetStage: string) => {
    const updatedLead: Lead = {
      ...lead,
      status: targetStage,
      lastContactDate: new Date().toISOString().split('T')[0]
    };
    await onUpdateLead(updatedLead);
    if (selectedLead?.leadId === lead.leadId) {
      setSelectedLead(updatedLead);
    }
  };

  // Filter leads
  const filteredLeads = leads.filter(l => {
    const searchMatch = 
      l.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.mobile.includes(searchTerm) ||
      (l.email && l.email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const prioMatch = priorityFilter === 'ALL' || l.priority === priorityFilter;
    const execMatch = execFilter === 'ALL' || l.assignedExecutive === execFilter;

    return searchMatch && prioMatch && execMatch;
  });

  return (
    <div className="space-y-6">
      {/* Control Bar: Search & Filtering */}
      <div className="bg-white rounded-2xl p-4 border border-gray-150 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:max-w-xs">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search leads by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-9 pr-4 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto md:justify-end">
          {/* Priority filter */}
          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="ALL">All Priorities</option>
              <option value="Hot">🔥 Hot</option>
              <option value="Warm">☀️ Warm</option>
              <option value="Cold">❄️ Cold</option>
            </select>
          </div>

          {/* Executive filter */}
          <div>
            <select
              value={execFilter}
              onChange={(e) => setExecFilter(e.target.value)}
              className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="ALL">All Executives</option>
              {executivesList.map(ex => (
                <option key={ex} value={ex}>{ex}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer ml-auto md:ml-0"
          >
            <Plus className="w-4.5 h-4.5" />
            Add New Lead
          </button>
        </div>
      </div>

      {/* Kanban Board Container */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-purple-200">
        {FUNNEL_STAGES.map((stage) => {
          const stageLeads = filteredLeads.filter(l => l.status === stage);
          
          return (
            <div
              key={stage}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage)}
              className="bg-slate-50 border border-slate-150 rounded-2xl p-3 w-72 shrink-0 flex flex-col min-h-[450px]"
            >
              {/* Stage Header */}
              <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider truncate">
                  {stage}
                </span>
                <span className="bg-slate-200/80 text-slate-800 text-[10px] font-black font-mono px-2 py-0.5 rounded-full">
                  {stageLeads.length}
                </span>
              </div>

              {/* Stage Cards Stack */}
              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[480px] pr-1">
                {stageLeads.map((lead) => {
                  const priorityColors = {
                    Hot: 'border-l-4 border-l-red-500 bg-red-50/20',
                    Warm: 'border-l-4 border-l-amber-500 bg-amber-50/20',
                    Cold: 'border-l-4 border-l-blue-400 bg-blue-50/20'
                  };

                  return (
                    <div
                      key={lead.leadId}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead.leadId)}
                      onClick={() => {
                        setSelectedLead(lead);
                        setIsDetailModalOpen(true);
                      }}
                      className={`p-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition-all ${priorityColors[lead.priority] || 'border-l-4 border-l-purple-300'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold tracking-wider text-purple-600 font-mono">
                          {lead.leadId}
                        </span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                          lead.priority === 'Hot' ? 'bg-red-100 text-red-700' :
                          lead.priority === 'Warm' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {lead.priority.toUpperCase()}
                        </span>
                      </div>

                      <h5 className="font-extrabold text-sm text-gray-900 mt-1 truncate">{lead.fullName}</h5>
                      
                      <div className="mt-2 space-y-1 text-[11px] text-gray-500 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          <span>{lead.mobile}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-gray-400" />
                          <span className="truncate">{lead.interestedProject || 'Any Project'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-gray-400" />
                          <span>Budget: ₹{(lead.budget || 0).toLocaleString('en-IN')}</span>
                        </div>
                      </div>

                      <div className="border-t border-gray-100 mt-2.5 pt-2 flex items-center justify-between text-[10px] font-bold text-gray-400">
                        <span>By: {lead.assignedExecutive || 'Unassigned'}</span>
                        {lead.nextFollowUpDate && (
                          <span className="text-purple-600">F/Up: {lead.nextFollowUpDate}</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {stageLeads.length === 0 && (
                  <div className="text-center py-8 text-xs text-slate-400 italic border-2 border-dashed border-slate-200 rounded-xl">
                    Drag leads here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL 1: Create Lead */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
              <h3 className="font-black text-base text-gray-800 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                Register New Sales CRM Lead
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreateLead} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="col-span-2">
                  <label className="text-xs font-bold text-gray-500 block mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder="Enter customer name"
                  />
                  {formErrors.fullName && <p className="text-[10px] text-red-500 font-bold mt-0.5">{formErrors.fullName}</p>}
                </div>

                {/* Mobile */}
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Mobile Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder="10-digit mobile"
                  />
                  {formErrors.mobile && <p className="text-[10px] text-red-500 font-bold mt-0.5">{formErrors.mobile}</p>}
                </div>

                {/* WhatsApp */}
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">WhatsApp Number</label>
                  <input
                    type="text"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder="10-digit WhatsApp"
                  />
                  {formErrors.whatsapp && <p className="text-[10px] text-red-500 font-bold mt-0.5">{formErrors.whatsapp}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder="name@domain.com"
                  />
                </div>

                {/* City */}
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>

                {/* Source */}
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Lead Acquisition Source</label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="Facebook">Facebook Ads</option>
                    <option value="Google">Google Search</option>
                    <option value="Website">Company Website</option>
                    <option value="Referral">Referral Agent</option>
                    <option value="Walk-in">Walk-in Prospect</option>
                    <option value="Newspaper">Newspaper Ad</option>
                    <option value="Other">Other/Cold Call</option>
                  </select>
                </div>

                {/* Budget */}
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Total Budget (INR) *</label>
                  <input
                    type="text"
                    required
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder="e.g. 2500000"
                  />
                  {formErrors.budget && <p className="text-[10px] text-red-500 font-bold mt-0.5">{formErrors.budget}</p>}
                </div>

                {/* Preferred Location */}
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Preferred Location</label>
                  <input
                    type="text"
                    value={formData.preferredLocation}
                    onChange={(e) => setFormData({ ...formData, preferredLocation: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder="e.g. Rau, Mhow Highway"
                  />
                </div>

                {/* Preferred Plot Size */}
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Preferred Plot Size</label>
                  <input
                    type="text"
                    value={formData.preferredPlotSize}
                    onChange={(e) => setFormData({ ...formData, preferredPlotSize: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder="e.g. 1000 Sqft"
                  />
                </div>

                {/* Interested Project */}
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Interested Project</label>
                  <select
                    value={formData.interestedProject}
                    onChange={(e) => setFormData({ ...formData, interestedProject: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Any Project</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Assigned Sales Executive */}
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Assigned Executive</label>
                  <select
                    value={formData.assignedExecutive}
                    onChange={(e) => setFormData({ ...formData, assignedExecutive: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {executivesList.map(ex => (
                      <option key={ex} value={ex}>{ex}</option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="Hot">🔥 Hot</option>
                    <option value="Warm">☀️ Warm</option>
                    <option value="Cold">❄️ Cold</option>
                  </select>
                </div>

                {/* Next follow up date */}
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Next Follow-up Date</label>
                  <input
                    type="date"
                    value={formData.nextFollowUpDate}
                    onChange={(e) => setFormData({ ...formData, nextFollowUpDate: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              </div>

              <div className="border-t pt-4 flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs py-2 px-4 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-2 px-5 rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Create Prospect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Lead Master-Detail Dialog */}
      {isDetailModalOpen && selectedLead && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
              <div>
                <span className="text-[10px] font-black font-mono tracking-wider text-purple-600 block">LEAD ID: {selectedLead.leadId}</span>
                <h3 className="font-extrabold text-lg text-gray-800 mt-0.5">{selectedLead.fullName}</h3>
              </div>
              <button 
                onClick={() => setIsDetailModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Top Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-150">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Phone / Mobile</span>
                  <span className="text-xs font-bold text-gray-800 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3.5 h-3.5 text-purple-600" />
                    {selectedLead.mobile}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">WhatsApp</span>
                  <span className="text-xs font-bold text-gray-800 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3.5 h-3.5 text-green-500" />
                    {selectedLead.whatsapp || 'Same'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Email Address</span>
                  <span className="text-xs font-bold text-gray-800 truncate block mt-0.5">
                    {selectedLead.email || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Budget (INR)</span>
                  <span className="text-xs font-black text-gray-900 block mt-0.5">
                    ₹{(selectedLead.budget || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Interested Project</span>
                  <span className="text-xs font-extrabold text-purple-700 block mt-0.5">
                    {selectedLead.interestedProject || 'Any Project'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Acquisition Source</span>
                  <span className="text-xs font-bold text-gray-700 block mt-0.5">
                    {selectedLead.source}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Preferred Location</span>
                  <span className="text-xs font-bold text-gray-700 block mt-0.5">
                    {selectedLead.preferredLocation || 'Not specified'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Assigned Executive</span>
                  <span className="text-xs font-extrabold text-gray-800 block mt-0.5">
                    {selectedLead.assignedExecutive || 'Unassigned'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Next follow-up date</span>
                  <span className="text-xs font-bold text-purple-600 block mt-0.5">
                    {selectedLead.nextFollowUpDate || 'None Scheduled'}
                  </span>
                </div>
              </div>

              {/* Status workflow quick transitions */}
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-700 block">Move Funnel Stage</label>
                <div className="flex flex-wrap gap-1.5">
                  {FUNNEL_STAGES.map((stg) => (
                    <button
                      key={stg}
                      onClick={() => handleStageButtonClick(selectedLead, stg)}
                      className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${
                        selectedLead.status === stg 
                          ? 'bg-purple-600 text-white shadow-sm' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {stg}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons: 360 profile, convert to booking, delete */}
              <div className="border-t border-b py-4 flex flex-col sm:flex-row gap-3">
                {/* 1. View Customer 360 timeline */}
                <button
                  onClick={() => {
                    onOpenCustomer360(selectedLead);
                    setIsDetailModalOpen(false);
                  }}
                  className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-extrabold text-xs py-2.5 px-4 rounded-xl flex-1 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Customer 360° Profile
                </button>

                {/* 2. Convert to plot booking */}
                <button
                  onClick={() => {
                    onConvertToBooking(selectedLead);
                    setIsDetailModalOpen(false);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl flex-1 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  Convert to Plot Booking
                </button>

                {/* 3. Delete Lead */}
                <button
                  onClick={async () => {
                    if (window.confirm('Are you sure you want to delete this lead?')) {
                      await onDeleteLead(selectedLead.leadId);
                      setIsDetailModalOpen(false);
                    }
                  }}
                  className="bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer"
                >
                  <Trash className="w-4 h-4" />
                  Delete
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs py-2 px-5 rounded-xl cursor-pointer"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
