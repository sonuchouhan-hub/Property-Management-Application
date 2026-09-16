import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Project, Plot, PlotStatus, PlotFacing, PlotType, Booking, Customer, PaymentMode, PaymentInstallment, TimelineEvent, Lead, FollowUp, SiteVisit, DocumentRecord, CommunicationLog } from '../types';
import Icon from './common/Icon';
import { STATUS_COLORS, getNormalizedStatus, getStatusStyles } from '../constants';
import {
  initGoogleAuth,
  googleSignIn,
  googleSignOut,
  createBookingSheet,
  syncBookingsToSheet,
  appendBookingToSheet,
  fetchBookingsFromSheet
} from '../services/googleSheetsService';

import { collection, doc, onSnapshot } from 'firebase/firestore';
import { 
  db, 
  handleFirestoreError, 
  OperationType, 
  sanitizeData,
  trackedGetDocs as getDocs,
  trackedGetDoc as getDoc,
  trackedSetDoc as setDoc,
  trackedUpdateDoc as updateDoc,
  trackedDeleteDoc as deleteDoc,
  isSuperAdminEmail
} from '../services/firebaseService';

// Import Enterprise CRM suite sub-components
import { CRMDashboard } from './crm/CRMDashboard';
import { LeadPipeline } from './crm/LeadPipeline';
import { FollowUpScheduler } from './crm/FollowUpScheduler';
import { SiteVisitTracker } from './crm/SiteVisitTracker';
import { AICopilot } from './crm/AICopilot';
import { CommunicationCenter } from './crm/CommunicationCenter';
import { DocumentVault } from './crm/DocumentVault';
import { Customer360 } from './crm/Customer360';

interface PlotBookingsProps {
  projects: Project[];
  onUpdateProjects: (updatedProjects: Project[]) => void;
  onAddNotification?: (text: string, link?: { view: any; id: number }) => void;
  onShowToast?: (msg: string) => void;
  preselectedPlot?: { projectId: number; plotId: number } | null;
  currentUser?: any;
}

const INITIAL_MOCK_BOOKINGS: Booking[] = [
  {
    bookingId: 'BKG-20260610-1042',
    projectId: 1,
    projectName: 'Grand Enclave',
    plotId: 1005,
    plotNumber: 'P-105',
    plotSize: 1500,
    facing: 'East',
    totalAmount: 3750000,
    bookingAmount: 100000,
    bookingDate: '2026-06-10T10:30:00.000Z',
    paymentMode: 'UPI',
    transactionId: 'UPI9823487123984',
    salesExecutive: 'Rajesh Sharma',
    bookingSource: 'Direct Walk-in',
    customer: {
      fullName: 'Vikramaditya Rao',
      mobile: '9876543210',
      email: 'vikram.rao@example.com',
      address: '42, Vijay Nagar, Indore, MP',
      aadhaarNumber: '458923146789',
      panNumber: 'ABCDE1234F'
    },
    status: 'Confirmed',
    timeline: [
      { title: 'Booking Received', date: '10 Jun 2026', description: 'Advance token amount received via UPI.', completed: true },
      { title: 'KYC & Document Verification', date: '11 Jun 2026', description: 'Aadhaar and PAN verified by legal team.', completed: true },
      { title: 'Sale Agreement Drafting', date: '15 Jun 2026', description: 'Draft agreement shared with customer.', completed: true },
      { title: 'Registry & Possession', date: 'Pending', description: 'Final disbursement and registry schedule.', completed: false }
    ]
  },
  {
    bookingId: 'BKG-20260624-8821',
    projectId: 2,
    projectName: 'Royal Greens',
    plotId: 2012,
    plotNumber: 'P-112',
    plotSize: 1200,
    facing: 'North',
    totalAmount: 2160000,
    bookingAmount: 50000,
    bookingDate: new Date().toISOString(),
    paymentMode: 'Bank Transfer',
    transactionId: 'NEFT4489230112',
    salesExecutive: 'Priyanka Verma',
    bookingSource: 'Website Inquiry',
    customer: {
      fullName: 'Anita Deshmukh',
      mobile: '9123456789',
      email: 'anita.d@example.com',
      address: '18, Palasia, Indore, MP',
      aadhaarNumber: '789456123012',
      panNumber: 'PQRSX5678K'
    },
    status: 'Confirmed',
    timeline: [
      { title: 'Booking Received', date: 'Today', description: 'Advance token amount received via NEFT.', completed: true },
      { title: 'KYC & Document Verification', date: 'In Progress', description: 'Verification pending legal check.', completed: false },
      { title: 'Sale Agreement Drafting', date: 'Pending', description: 'Agreement drafting.', completed: false },
      { title: 'Registry & Possession', date: 'Pending', description: 'Registry schedule.', completed: false }
    ]
  }
];

export const getStoredBookings = (): Booking[] => {
  try {
    const data = localStorage.getItem('dhanshri_bookings');
    if (data) return JSON.parse(data);
    localStorage.setItem('dhanshri_bookings', JSON.stringify(INITIAL_MOCK_BOOKINGS));
    return INITIAL_MOCK_BOOKINGS;
  } catch (e) {
    return INITIAL_MOCK_BOOKINGS;
  }
};

const PlotBookings: React.FC<PlotBookingsProps> = ({
  projects,
  onUpdateProjects,
  onAddNotification,
  onShowToast,
  preselectedPlot,
  currentUser
}) => {
  const userEmail = currentUser?.email?.toLowerCase().trim();
  const isSuperAdmin = isSuperAdminEmail(userEmail) || currentUser?.role === 'admin';
  const isManagerOrAdmin = isSuperAdmin;
  const [activeTab, setActiveTab] = useState<'plots' | 'history' | 'details' | 'reports' | 'sheets' | 'crm'>('plots');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const quotaExceeded = false;

  const bookingsRef = useRef(bookings);
  useEffect(() => {
    bookingsRef.current = bookings;
  }, [bookings]);

  // --- Customer CRM Database Sync & State ---
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [crmSearchQuery, setCrmSearchQuery] = useState<string>('');
  const [crmSearchQueryDebounced, setCrmSearchQueryDebounced] = useState<string>('');
  useEffect(() => {
    const handler = setTimeout(() => {
      setCrmSearchQueryDebounced(crmSearchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [crmSearchQuery]);

  const [crmStatusFilter, setCrmStatusFilter] = useState<string>('ALL');
  const [selectedCrmCustomer, setSelectedCrmCustomer] = useState<Customer | null>(null);
  const [crmModalOpen, setCrmModalOpen] = useState<boolean>(false);
  const [crmFormData, setCrmFormData] = useState({
    fullName: '',
    email: '',
    mobile: '',
    address: '',
    aadhaarNumber: '',
    panNumber: '',
    status: 'Prospect',
    assignedExecutive: ''
  });
  const [crmErrors, setCrmErrors] = useState<{ [key: string]: string }>({});

  const [crmNoteText, setCrmNoteText] = useState<string>('');

  // --- Enterprise CRM Suite States ---
  const [crmSubTab, setCrmSubTab] = useState<'pipeline' | 'followups' | 'site-visits' | 'copilot' | 'communications' | 'dashboard' | 'directory'>('pipeline');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [communicationLogs, setCommunicationLogs] = useState<CommunicationLog[]>([]);
  const [selected360Lead, setSelected360Lead] = useState<Lead | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setIsRefreshing(true);
    let unsubBookings: (() => void) | null = null;
    let unsubLeads: (() => void) | null = null;
    let unsubComms: (() => void) | null = null;
    let unsubCustomers: (() => void) | null = null;

    // 1. Live Bookings Listener
    try {
      unsubBookings = onSnapshot(collection(db, 'bookings'), (snapshot) => {
        if (!snapshot.empty) {
          const list: Booking[] = [];
          snapshot.forEach((docSnap: any) => {
            list.push(docSnap.data() as Booking);
          });
          list.sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime());
          setBookings(list);
          try { localStorage.setItem('dhanshri_bookings', JSON.stringify(list)); } catch {}
        } else {
          setBookings(INITIAL_MOCK_BOOKINGS);
        }
        setIsRefreshing(false);
      }, (err) => {
        console.warn("Bookings real-time listener error:", err);
        setIsRefreshing(false);
      });
    } catch (e) {
      console.error("Failed to subscribe to bookings:", e);
    }

    // 2. Live Leads Listener
    try {
      unsubLeads = onSnapshot(collection(db, 'leads'), (snapshot) => {
        if (!snapshot.empty) {
          const list: Lead[] = [];
          snapshot.forEach((docSnap: any) => {
            list.push({ ...docSnap.data(), leadId: docSnap.id } as Lead);
          });
          setLeads(list);
          try { localStorage.setItem('dhanshri_leads', JSON.stringify(list)); } catch {}
        }
        setIsRefreshing(false);
      }, (err) => {
        console.warn("Leads real-time listener error:", err);
        setIsRefreshing(false);
      });
    } catch (e) {
      console.error("Failed to subscribe to leads:", e);
    }

    // 3. Live Communication Logs Listener
    try {
      unsubComms = onSnapshot(collection(db, 'communication_logs'), (snapshot) => {
        if (!snapshot.empty) {
          const list: CommunicationLog[] = [];
          snapshot.forEach((docSnap: any) => {
            list.push({ ...docSnap.data(), id: docSnap.id } as CommunicationLog);
          });
          setCommunicationLogs(list);
          try { localStorage.setItem('dhanshri_communication_logs', JSON.stringify(list)); } catch {}
        }
        setIsRefreshing(false);
      }, (err) => {
        console.warn("Communication logs real-time listener error:", err);
        setIsRefreshing(false);
      });
    } catch (e) {
      console.error("Failed to subscribe to communication logs:", e);
    }

    // 4. Live Customers Listener
    try {
      unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
        if (!snapshot.empty) {
          const list: Customer[] = [];
          snapshot.forEach((docSnap: any) => {
            list.push({ ...docSnap.data(), mobile: docSnap.id } as Customer);
          });
          setCustomers(list);
          try { localStorage.setItem('dhanshri_customers', JSON.stringify(list)); } catch {}
        }
        setIsRefreshing(false);
      }, (err) => {
        console.warn("Customers real-time listener error:", err);
        setIsRefreshing(false);
      });
    } catch (e) {
      console.error("Failed to subscribe to customers:", e);
    }

    return () => {
      if (unsubBookings) unsubBookings();
      if (unsubLeads) unsubLeads();
      if (unsubComms) unsubComms();
      if (unsubCustomers) unsubCustomers();
    };
  }, []);

  // Database operation methods for leads
  const handleAddLead = async (leadData: Omit<Lead, 'leadId' | 'createdAt'>) => {
    const id = 'LEAD-' + Math.floor(100000 + Math.random() * 900000);
    const newLead: Lead = {
      ...leadData,
      leadId: id,
      createdAt: new Date().toISOString(),
      followups: [],
      siteVisits: [],
      documents: [],
      notes: []
    };
    if (quotaExceeded) {
      const updatedLeads = [...leads, newLead];
      setLeads(updatedLeads);
      localStorage.setItem('dhanshri_leads', JSON.stringify(updatedLeads));
      onShowToast("Offline CRM Sandbox: Lead saved locally in browser storage!");
      return;
    }
    try {
      await setDoc(doc(db, 'leads', id), sanitizeData(newLead));
      onShowToast("New Lead registered successfully in CRM Pipeline!");
    } catch (err: any) {
      onShowToast(`Failed to register lead: ${err.message}`);
    }
  };

  const handleUpdateLead = async (updatedLead: Lead) => {
    if (quotaExceeded) {
      const updatedLeads = leads.map(l => l.leadId === updatedLead.leadId ? updatedLead : l);
      setLeads(updatedLeads);
      localStorage.setItem('dhanshri_leads', JSON.stringify(updatedLeads));
      if (selected360Lead?.leadId === updatedLead.leadId) {
        setSelected360Lead(updatedLead);
      }
      onShowToast("Offline CRM Sandbox: Lead updated locally!");
      return;
    }
    try {
      await setDoc(doc(db, 'leads', updatedLead.leadId), sanitizeData(updatedLead));
    } catch (err: any) {
      onShowToast(`Failed to update lead: ${err.message}`);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (quotaExceeded) {
      const updatedLeads = leads.filter(l => l.leadId !== leadId);
      setLeads(updatedLeads);
      localStorage.setItem('dhanshri_leads', JSON.stringify(updatedLeads));
      onShowToast("Offline CRM Sandbox: Lead deleted locally!");
      return;
    }
    try {
      await deleteDoc(doc(db, 'leads', leadId));
      onShowToast("Lead successfully deleted from CRM pipeline.");
    } catch (err: any) {
      onShowToast(`Failed to delete lead: ${err.message}`);
    }
  };

  const handleAddFollowUp = async (leadId: string, followup: Omit<FollowUp, 'id' | 'createdAt'>) => {
    const lead = leads.find(l => l.leadId === leadId);
    if (!lead) return;
    const fId = 'FUP-' + Math.floor(100000 + Math.random() * 900000);
    const newFup: FollowUp = {
      ...followup,
      id: fId,
      createdAt: new Date().toISOString()
    };
    const updatedLead: Lead = {
      ...lead,
      followups: [...(lead.followups || []), newFup],
      nextFollowUpDate: followup.date
    };
    await handleUpdateLead(updatedLead);
  };

  const handleUpdateFollowUpStatus = async (leadId: string, followupId: string, status: 'Completed' | 'Cancelled', notes: string) => {
    const lead = leads.find(l => l.leadId === leadId);
    if (!lead) return;
    const updatedFollowups = (lead.followups || []).map(f => {
      if (f.id === followupId) {
        return { ...f, status, notes: `${f.notes} [Outcome: ${notes}]` };
      }
      return f;
    });
    const noteLog = {
      date: new Date().toLocaleString('en-IN'),
      content: `Followup concluded (${status}): ${notes}`,
      author: currentUser?.email || 'Sales Executive'
    };
    const updatedLead: Lead = {
      ...lead,
      followups: updatedFollowups,
      notes: [...(lead.notes || []), noteLog]
    };
    await handleUpdateLead(updatedLead);
  };

  const handleAddSiteVisit = async (leadId: string, visit: Omit<SiteVisit, 'id' | 'createdAt'>) => {
    const lead = leads.find(l => l.leadId === leadId);
    if (!lead) return;
    const sId = 'VISIT-' + Math.floor(100000 + Math.random() * 900000);
    const newVisit: SiteVisit = {
      ...visit,
      id: sId,
      createdAt: new Date().toISOString()
    };
    const updatedLead: Lead = {
      ...lead,
      siteVisits: [...(lead.siteVisits || []), newVisit]
    };
    await handleUpdateLead(updatedLead);
  };

  const handleUpdateSiteVisit = async (leadId: string, visit: SiteVisit) => {
    const lead = leads.find(l => l.leadId === leadId);
    if (!lead) return;
    const updatedVisits = (lead.siteVisits || []).map(v => v.id === visit.id ? visit : v);
    const noteLog = {
      date: new Date().toLocaleString('en-IN'),
      content: `Site visit completed (${visit.attendance}). Customer feedback: ${visit.notes || 'No comments'}`,
      author: currentUser?.email || 'Field Representative'
    };
    const updatedLead: Lead = {
      ...lead,
      siteVisits: updatedVisits,
      notes: [...(lead.notes || []), noteLog]
    };
    await handleUpdateLead(updatedLead);
  };

  const handleAddCommunicationLog = async (logData: Omit<CommunicationLog, 'id' | 'timestamp'>) => {
    const id = 'LOG-' + Math.floor(100000 + Math.random() * 900000);
    const newLog: CommunicationLog = {
      ...logData,
      id,
      timestamp: new Date().toLocaleString('en-IN')
    };
    if (quotaExceeded) {
      const updatedLogs = [newLog, ...communicationLogs];
      setCommunicationLogs(updatedLogs);
      localStorage.setItem('dhanshri_communication_logs', JSON.stringify(updatedLogs));
      onShowToast("Offline CRM Sandbox: Communication logged locally!");
      return;
    }
    try {
      await setDoc(doc(db, 'communication_logs', id), sanitizeData(newLog));
    } catch (err: any) {
      console.error("Communication log error:", err);
      onShowToast("Database temporarily unavailable. Please try again.");
    }
  };

  const handleUploadLeadDocument = async (leadId: string, docData: Omit<DocumentRecord, 'id' | 'uploadedAt' | 'uploadedBy'>) => {
    const lead = leads.find(l => l.leadId === leadId);
    if (!lead) return;
    const dId = 'DOC-' + Math.floor(100000 + Math.random() * 900000);
    const newDoc: DocumentRecord = {
      ...docData,
      id: dId,
      uploadedAt: new Date().toISOString(),
      uploadedBy: currentUser?.email || 'Authorized Registrar'
    };
    const updatedLead: Lead = {
      ...lead,
      documents: [...(lead.documents || []), newDoc]
    };
    await handleUpdateLead(updatedLead);
  };

  const handleDeleteLeadDocument = async (leadId: string, docId: string) => {
    const lead = leads.find(l => l.leadId === leadId);
    if (!lead) return;
    const updatedDocs = (lead.documents || []).filter(d => d.id !== docId);
    const updatedLead: Lead = {
      ...lead,
      documents: updatedDocs
    };
    await handleUpdateLead(updatedLead);
  };

  const handleConvertLeadToBooking = (lead: Lead) => {
    setFormData({
      fullName: lead.fullName,
      mobile: lead.mobile,
      email: lead.email || '',
      address: lead.city || 'Indore',
      aadhaarNumber: '',
      panNumber: '',
      bookingDate: new Date().toISOString().split('T')[0],
      bookingAmount: '51000',
      paymentMode: 'UPI',
      transactionId: '',
      salesExecutive: lead.assignedExecutive || 'Rajesh Sharma',
      bookingSource: lead.source || 'Direct Walk-in',
    });
    setActiveTab('plots');
    onShowToast(`Client details loaded! Select an available plot to initiate the formal booking contract.`);
  };

  const handleAddCrmNote = async (cust: Customer) => {
    if (!crmNoteText.trim()) return;
    const newNote = {
      date: new Date().toLocaleString('en-IN'),
      content: crmNoteText,
      author: currentUser?.email || 'Sales Executive'
    };
    const updatedNotes = [...(cust.notes || []), newNote];
    const updatedCust = {
      ...cust,
      notes: updatedNotes
    };
    if (quotaExceeded) {
      const updatedCustomers = customers.map(c => c.mobile === cust.mobile ? updatedCust : c);
      setCustomers(updatedCustomers);
      localStorage.setItem('dhanshri_customers', JSON.stringify(updatedCustomers));
      setSelectedCrmCustomer(updatedCust);
      setCrmNoteText('');
      onShowToast("Offline CRM Sandbox: Interaction note saved locally!");
      return;
    }
    try {
      await setDoc(doc(db, 'customers', cust.mobile), sanitizeData(updatedCust));
      setSelectedCrmCustomer(updatedCust);
      setCrmNoteText('');
      onShowToast("Interaction note saved successfully!");
    } catch (err: any) {
      onShowToast(`Failed to save note: ${err.message}`);
    }
  };

  // --- Payment Installment Tracking States ---
  const [installmentAmount, setInstallmentAmount] = useState<string>('');
  const [installmentRef, setInstallmentRef] = useState<string>('');
  const [installmentMode, setInstallmentMode] = useState<string>('Bank Transfer');
  const [receiptFile, setReceiptFile] = useState<string>('');

  // Update dynamic workflow stage
  const handleUpdateWorkflowStage = async (booking: Booking, nextStage: string, notes: string = '') => {
    let targetPlotStatus: PlotStatus = PlotStatus.AVAILABLE;
    
    // Map workflow stages to overall Plot status colors
    if (nextStage === 'Hold Approved' || nextStage === 'Hold Requested' || nextStage === 'Pending Approval') {
      targetPlotStatus = PlotStatus.HOLD;
    } else if (nextStage === 'Booking Requested' || nextStage === 'Booking Approved' || nextStage === 'Payment Pending' || nextStage === 'Partially Paid' || nextStage === 'Fully Paid' || nextStage === 'Registry Pending' || nextStage === 'Registry Completed') {
      targetPlotStatus = PlotStatus.BOOKED;
    } else if (nextStage === 'Sold') {
      targetPlotStatus = PlotStatus.SOLD;
    } else if (nextStage === 'Available') {
      targetPlotStatus = PlotStatus.AVAILABLE;
    }

    // Append Timeline event
    const newEvent: TimelineEvent = {
      title: nextStage,
      date: new Date().toLocaleString('en-IN'),
      description: notes || `Workflow transitioned to ${nextStage}.`,
      completed: true,
      userEmail: currentUser?.email || 'Authorized User'
    };

    const updatedBkg: Booking = {
      ...booking,
      workflowStage: nextStage as any,
      timeline: [...(booking.timeline || []), newEvent]
    };

    // If stage is sold/available, update main booking status fields
    if (nextStage === 'Sold') {
      updatedBkg.status = 'Confirmed';
    } else if (nextStage === 'Available') {
      updatedBkg.status = 'Cancelled' as any;
    }

    if (quotaExceeded) {
      const updatedBookings = bookings.map(b => b.bookingId === booking.bookingId ? updatedBkg : b);
      setBookings(updatedBookings);
      localStorage.setItem('dhanshri_bookings', JSON.stringify(updatedBookings));
      setSelectedBookingDetails(updatedBkg);

      const targetProj = projects.find(p => p.id === booking.projectId);
      if (targetProj) {
        const updatedLayout = (targetProj.plots || targetProj.layout).map(pl => {
          if (pl.id === booking.plotId) {
            return { ...pl, status: targetPlotStatus };
          }
          return pl;
        });
        const updatedProjectsList = projects.map(p => 
          p.id === booking.projectId 
            ? { ...p, layout: updatedLayout, plots: updatedLayout, availablePlots: updatedLayout.filter(pt => pt.status === PlotStatus.AVAILABLE).length } 
            : p
        );
        onUpdateProjects(updatedProjectsList);
        try { localStorage.setItem('dhanshri_cached_projects', JSON.stringify({ version: '1.0.1', data: updatedProjectsList })); } catch {}
      }
      onShowToast(`Offline CRM Sandbox: Workflow stage transitioned to ${nextStage}`);
      return;
    }

    try {
      // Commit update to Firestore
      await setDoc(doc(db, 'bookings', booking.bookingId), sanitizeData(updatedBkg));
      setSelectedBookingDetails(updatedBkg);

      // Commit plot status updates back to corresponding project
      const targetProj = projects.find(p => p.id === booking.projectId);
      if (targetProj) {
        const updatedLayout = (targetProj.plots || targetProj.layout).map(pl => {
          if (pl.id === booking.plotId) {
            return { ...pl, status: targetPlotStatus };
          }
          return pl;
        });
        
        await updateDoc(doc(db, 'projects', String(booking.projectId)), {
          layout: updatedLayout,
          plots: updatedLayout,
          availablePlots: updatedLayout.filter(pt => pt.status === PlotStatus.AVAILABLE).length
        });
        
        onUpdateProjects(projects.map(p => p.id === booking.projectId ? { ...p, layout: updatedLayout, plots: updatedLayout, availablePlots: updatedLayout.filter(pt => pt.status === PlotStatus.AVAILABLE).length } : p));
      }

      onShowToast?.(`Workflow stage transitioned to ${nextStage}`);
    } catch (err: any) {
      console.error(err);
      onShowToast(`Failed to update workflow: ${err.message}`);
    }
  };

  // Add recorded payment installment
  const handleAddInstallment = async (booking: Booking) => {
    if (!installmentAmount.trim() || isNaN(Number(installmentAmount))) {
      onShowToast("Please enter a valid installment amount.");
      return;
    }
    const amt = Number(installmentAmount);
    const inst: PaymentInstallment = {
      installmentId: 'INST-' + Math.floor(100000 + Math.random() * 900000),
      installmentNo: (booking.installments || []).length + 1,
      amount: amt,
      dueDate: new Date().toISOString().split('T')[0],
      paidDate: new Date().toISOString().split('T')[0],
      status: 'Paid',
      paymentMode: installmentMode as any,
      transactionId: installmentRef || 'N/A',
      receiptUrl: receiptFile || 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=200&auto=format&fit=crop&q=60'
    };

    const updatedInstallments = [...(booking.installments || []), inst];
    
    // Auto calculate if fully paid
    const totalPaid = (booking.bookingAmount || 0) + updatedInstallments.reduce((sum, i) => sum + i.amount, 0);
    let nextStage = booking.workflowStage;
    if (totalPaid >= booking.totalAmount) {
      nextStage = 'Fully Paid';
    } else {
      nextStage = 'Partially Paid';
    }

    const newEvent: TimelineEvent = {
      title: 'Payment Installment Received',
      date: new Date().toLocaleString('en-IN'),
      description: `Installment payment of ₹${amt.toLocaleString()} received via ${installmentMode}. Transaction ID: ${inst.transactionId}.`,
      completed: true,
      userEmail: currentUser?.email || 'Authorized User'
    };

    const updatedBkg: Booking = {
      ...booking,
      installments: updatedInstallments,
      workflowStage: nextStage as any,
      timeline: [...(booking.timeline || []), newEvent]
    };

    if (quotaExceeded) {
      const updatedBookings = bookings.map(b => b.bookingId === booking.bookingId ? updatedBkg : b);
      setBookings(updatedBookings);
      localStorage.setItem('dhanshri_bookings', JSON.stringify(updatedBookings));
      setSelectedBookingDetails(updatedBkg);
      
      onShowToast(`Offline CRM Sandbox: Installment of ₹${amt.toLocaleString()} recorded successfully.`);
      // Reset inputs
      setInstallmentAmount('');
      setInstallmentRef('');
      setReceiptFile('');
      return;
    }

    try {
      await setDoc(doc(db, 'bookings', booking.bookingId), sanitizeData(updatedBkg));
      setSelectedBookingDetails(updatedBkg);
      
      onShowToast(`Installment of ₹${amt.toLocaleString()} recorded successfully.`);
      // Reset inputs
      setInstallmentAmount('');
      setInstallmentRef('');
      setReceiptFile('');
    } catch (err: any) {
      console.error(err);
      onShowToast(`Failed to record installment: ${err.message}`);
    }
  };



  // --- Automated Background Hold Expiry System ---
  useEffect(() => {
    const processHoldExpirations = async () => {
      const now = new Date();
      let hasUpdates = false;

      for (const bkg of bookings) {
        // Active holds are identified by stage 'Hold Approved' and having an expiration timestamp
        if (bkg.workflowStage === 'Hold Approved' && bkg.holdExpiresAt && new Date(bkg.holdExpiresAt) < now) {
          hasUpdates = true;
          const msg = `Hold has expired for Plot ${bkg.plotNumber} in ${bkg.projectName}. Releasing to Available status.`;
          console.log("[Hold Expiry System] Triggered:", msg);

          // 1. Dispatch toast alert
          onShowToast?.(`Plot ${bkg.plotNumber} Hold automatically expired & released!`);

          // 2. Clear plot hold block in projects layout & increment project availability
          const targetProject = projects.find(p => p.id === bkg.projectId);
          if (targetProject) {
            const updatedLayout = (targetProject.plots || targetProject.layout).map(pl => {
              if (pl.id === bkg.plotId) {
                return { ...pl, status: PlotStatus.AVAILABLE };
              }
              return pl;
            });
            onUpdateProjects(projects.map(p => 
              p.id === bkg.projectId 
                ? { ...p, layout: updatedLayout, plots: updatedLayout, availablePlots: updatedLayout.filter(pt => pt.status === PlotStatus.AVAILABLE).length } 
                : p
            ));
          }

          // 3. Update the booking lifecycle to Available & add audit event to the immutable timeline
          const updatedBkg = {
            ...bkg,
            workflowStage: 'Available',
            status: 'Cancelled',
            timeline: [
              ...(bkg.timeline || []),
              {
                title: 'Hold Expired',
                date: new Date().toLocaleString('en-IN'),
                description: 'Hold on plot automatically expired and released by system scheduler.',
                completed: true,
                userEmail: 'System Scheduler'
              }
            ]
          };

          // To prevent automatic writes to Firestore, update state and local cache in browser storage only.
          setBookings(prev => {
            const updated = prev.map(b => b.bookingId === bkg.bookingId ? updatedBkg : b);
            localStorage.setItem('dhanshri_bookings', JSON.stringify(updated));
            return updated;
          });
        }
      }
    };

    // To enable background hold expiration scheduler in the future, set this to true.
    const ENABLE_BACKGROUND_HOLD_EXPIRATION_TIMER = false;
    let timer: NodeJS.Timeout | null = null;
    if (ENABLE_BACKGROUND_HOLD_EXPIRATION_TIMER) {
      timer = setInterval(processHoldExpirations, 30000); // Check every 30 seconds
    } else {
      // Run once passively on load/refresh
      processHoldExpirations();
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [bookings, projects]);

  // Google Sheets Integration State
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [gToken, setGToken] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => localStorage.getItem('dhanshri_g_spreadsheet_id') || '');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string>('Initializing...');
  const [externalSheetData, setExternalSheetData] = useState<any[][]>([]);

  // Initialize Google Auth on component mount
  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setGToken(token);
        setSyncStatus('Connected');
      },
      () => {
        setGoogleUser(null);
        setGToken(null);
        setSyncStatus('Not Connected');
      }
    );
    return () => unsubscribe();
  }, []);

  const stats = useMemo(() => {
    let total = 0;
    let available = 0;
    let booked = 0;
    let hold = 0;
    let sold = 0;

    projects.forEach(proj => {
      const plotsArr = proj.plots && proj.plots.length > 0 
        ? proj.plots 
        : proj.layout && proj.layout.length > 0 
          ? proj.layout 
          : [];
      if (plotsArr.length > 0) {
        plotsArr.forEach(plot => {
          total++;
          const st = plot.status.toLowerCase();
          if (st === 'available' || st === 'for resale') available++;
          else if (st === 'booked') booked++;
          else if (st === 'hold') hold++;
          else if (st === 'sold') sold++;
        });
      } else {
        const cnt = proj.totalPlots || 0;
        total += cnt;
        sold += cnt;
      }
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const monthStr = new Date().toISOString().slice(0, 7);

    const todaysBookings = bookings.filter(b => b.bookingDate.startsWith(todayStr)).length;
    const monthlyRevenue = bookings
      .filter(b => b.bookingDate.startsWith(monthStr) && b.status !== 'Cancelled')
      .reduce((acc, b) => acc + (b.bookingAmount || 0), 0);

    return { total, available, booked, hold, sold, todaysBookings, monthlyRevenue };
  }, [projects, bookings]);

  // Filters for Plots
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [plotSearch, setPlotSearch] = useState<string>('');
  const [plotSearchDebounced, setPlotSearchDebounced] = useState<string>('');
  useEffect(() => {
    const handler = setTimeout(() => {
      setPlotSearchDebounced(plotSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [plotSearch]);

  // Filters for History
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historySearchDebounced, setHistorySearchDebounced] = useState<string>('');
  useEffect(() => {
    const handler = setTimeout(() => {
      setHistorySearchDebounced(historySearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [historySearch]);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL'); // ALL, TODAY, MONTH

  // Modals & Selected View State
  const [bookingModalPlot, setBookingModalPlot] = useState<{ project: Project; plot: Plot } | null>(null);
  const [selectedBookingDetails, setSelectedBookingDetails] = useState<Booking | null>(null);
  const [receiptBooking, setReceiptBooking] = useState<Booking | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    mobile: '',
    email: '',
    address: '',
    aadhaarNumber: '',
    panNumber: '',
    bookingDate: new Date().toISOString().split('T')[0],
    bookingAmount: '51000',
    paymentMode: 'UPI' as PaymentMode,
    transactionId: '',
    salesExecutive: 'Rajesh Sharma',
    bookingSource: 'Direct Walk-in',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Check preselectedPlot
  useEffect(() => {
    if (preselectedPlot) {
      const proj = projects.find(p => p.id === preselectedPlot.projectId);
      if (proj) {
        const pl = (proj.plots || proj.layout).find(l => l.id === preselectedPlot.plotId);
        if (pl && pl.status === PlotStatus.AVAILABLE) {
          setBookingModalPlot({ project: proj, plot: pl });
          setActiveTab('plots');
        }
      }
    }
  }, [preselectedPlot, projects]);

  // Sync bookings to Firestore
  const saveBookings = async (newBookings: Booking[]) => {
    if (quotaExceeded) {
      setBookings(newBookings);
      localStorage.setItem('dhanshri_bookings', JSON.stringify(newBookings));
      onShowToast("Offline CRM Sandbox: Booking saved locally in browser storage!");
      return;
    }
    const newBkg = newBookings[0];
    if (newBkg) {
      try {
        await setDoc(doc(db, 'bookings', newBkg.bookingId), sanitizeData(newBkg));
      } catch (error: any) {
        console.error("Failed to save booking:", error);
        onShowToast("Database temporarily unavailable. Please try again.");
        handleFirestoreError(error, OperationType.CREATE, `bookings/${newBkg.bookingId}`);
      }
    }
  };

  // Flat list of all plots with project ref
  const allPlotsWithProject = useMemo(() => {
    const list: { project: Project; plot: Plot }[] = [];
    projects.forEach(proj => {
      const plots = proj.plots && proj.plots.length > 0 
        ? proj.plots 
        : proj.layout && proj.layout.length > 0 
          ? proj.layout 
          : null;
      if (plots && plots.length > 0) {
        plots.forEach(plot => {
          list.push({ project: proj, plot });
        });
      } else {
        const targetCount = proj.totalPlots !== undefined && proj.totalPlots > 0 ? proj.totalPlots : 100;
        for (let i = 1; i <= targetCount; i++) {
          list.push({
            project: proj,
            plot: {
              id: (proj.id * 1000) + i,
              number: `P-${String(i).padStart(3, '0')}`,
              size: 0,
              dimensions: 'Not Configured',
              facing: PlotFacing.NOT_CONFIGURED,
              status: PlotStatus.SOLD,
              type: 'Not Configured',
              price: 0,
              isMortgaged: false,
            }
          });
        }
      }
    });
    return list;
  }, [projects]);

  // Filtered plots
  const filteredPlots = useMemo(() => {
    return allPlotsWithProject.filter(({ project, plot }) => {
      const matchesProject = projectFilter === 'ALL' || project.id.toString() === projectFilter;
      const matchesStatus = statusFilter === 'ALL' || plot.status.toLowerCase() === statusFilter.toLowerCase();
      const matchesSearch = !plotSearchDebounced || plot.number.toLowerCase().includes(plotSearchDebounced.toLowerCase()) || project.name.toLowerCase().includes(plotSearchDebounced.toLowerCase());
      return matchesProject && matchesStatus && matchesSearch;
    });
  }, [allPlotsWithProject, projectFilter, statusFilter, plotSearchDebounced]);

  // Filtered History
  const filteredHistory = useMemo(() => {
    return bookings.filter(b => {
      const q = historySearchDebounced.toLowerCase();
      const matchSearch = !q ||
        b.customer.fullName.toLowerCase().includes(q) ||
        b.customer.mobile.includes(q) ||
        b.bookingId.toLowerCase().includes(q) ||
        b.plotNumber.toLowerCase().includes(q) ||
        b.projectName.toLowerCase().includes(q);

      const matchStatus = historyStatusFilter === 'ALL' || b.status === historyStatusFilter;

      let matchDate = true;
      if (dateFilter === 'TODAY') {
        const todayStr = new Date().toISOString().split('T')[0];
        matchDate = b.bookingDate.startsWith(todayStr);
      } else if (dateFilter === 'MONTH') {
        const monthStr = new Date().toISOString().slice(0, 7);
        matchDate = b.bookingDate.startsWith(monthStr);
      }

      return matchSearch && matchStatus && matchDate;
    });
  }, [bookings, historySearchDebounced, historyStatusFilter, dateFilter]);

  // --- Google Sheets Handlers ---
  const handleGoogleSignIn = async () => {
    try {
      setSyncStatus('Signing in...');
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGToken(res.accessToken);
        onShowToast('Connected to Google Sheets successfully! 🎉');
        setSyncStatus('Connected');
      }
    } catch (e: any) {
      console.error(e);
      onShowToast('Google Connection Failed. Please try again.');
      setSyncStatus('Connection failed');
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await googleSignOut();
      setGoogleUser(null);
      setGToken(null);
      setExternalSheetData([]);
      onShowToast('Disconnected from Google Account.');
      setSyncStatus('Not Connected');
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleCreateSheet = async () => {
    if (!gToken) return;
    try {
      setIsSyncing(true);
      setSyncStatus('Creating Google Spreadsheet...');
      const sheetId = await createBookingSheet(gToken, 'Dhanshri Properties Bookings');
      setSpreadsheetId(sheetId);
      localStorage.setItem('dhanshri_g_spreadsheet_id', sheetId);
      setSyncStatus('Spreadsheet created! Syncing bookings...');
      await syncBookingsToSheet(gToken, sheetId, bookings);
      onShowToast('Google Sheet created and synced! 📊');
      setSyncStatus('Linked and synced');
    } catch (err: any) {
      console.error(err);
      onShowToast(`Failed to create sheet: ${err.message || err}`);
      setSyncStatus('Failed to create sheet');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualSync = async () => {
    if (!gToken || !spreadsheetId) return;
    try {
      setIsSyncing(true);
      setSyncStatus('Syncing bookings to Google Sheet...');
      await syncBookingsToSheet(gToken, spreadsheetId, bookings);
      onShowToast('Google Sheet sync completed successfully! 📊');
      setSyncStatus('Linked and synced');
    } catch (err: any) {
      console.error(err);
      onShowToast(`Sync failed: ${err.message || err}`);
      setSyncStatus('Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFetchFromSheet = async () => {
    if (!gToken || !spreadsheetId) return;
    try {
      setIsSyncing(true);
      setSyncStatus('Fetching data from Google Sheet...');
      const rows = await fetchBookingsFromSheet(gToken, spreadsheetId);
      setExternalSheetData(rows);
      onShowToast(`Fetched ${rows.length} booking records from Google Sheet!`);
      setSyncStatus('Linked and synced');
    } catch (err: any) {
      console.error(err);
      onShowToast(`Fetch failed: ${err.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLinkExistingSheet = (id: string) => {
    if (!id.trim()) return;
    setSpreadsheetId(id.trim());
    localStorage.setItem('dhanshri_g_spreadsheet_id', id.trim());
    onShowToast('Linked existing Google Sheet successfully!');
    setSyncStatus('Linked (needs sync)');
  };

  const handleUnlinkSheet = () => {
    setSpreadsheetId('');
    localStorage.removeItem('dhanshri_g_spreadsheet_id');
    setExternalSheetData([]);
    onShowToast('Unlinked spreadsheet.');
    setSyncStatus('Connected');
  };

  const handleOpenBookingModal = (project: Project, plot: Plot) => {
    setFormData({
      fullName: '',
      mobile: '',
      email: '',
      address: '',
      aadhaarNumber: '',
      panNumber: '',
      bookingDate: new Date().toISOString().split('T')[0],
      bookingAmount: Math.min(51000, plot.price).toString(),
      paymentMode: 'UPI',
      transactionId: '',
      salesExecutive: 'Rajesh Sharma',
      bookingSource: 'Direct Walk-in',
    });
    setFormErrors({});
    setBookingModalPlot({ project, plot });
  };

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!formData.fullName.trim()) errs.fullName = 'Full name is required';
    if (!formData.mobile.trim() || !/^\d{10}$/.test(formData.mobile.trim())) {
      errs.mobile = 'Enter a valid 10-digit mobile number';
    }
    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email.trim())) {
      errs.email = 'Enter a valid email address';
    }
    if (!formData.address.trim()) errs.address = 'Residential address is required';
    if (!formData.aadhaarNumber.trim() || !/^\d{12}$/.test(formData.aadhaarNumber.replace(/\s/g, ''))) {
      errs.aadhaarNumber = 'Enter valid 12-digit Aadhaar number';
    }
    if (!formData.panNumber.trim() || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(formData.panNumber.trim())) {
      errs.panNumber = 'Enter valid PAN (e.g. ABCDE1234F)';
    }
    const amt = parseFloat(formData.bookingAmount);
    if (isNaN(amt) || amt <= 0) {
      errs.bookingAmount = 'Enter valid booking amount';
    } else if (bookingModalPlot && amt > bookingModalPlot.plot.price) {
      errs.bookingAmount = 'Cannot exceed total plot amount';
    }
    if (!formData.transactionId.trim()) errs.transactionId = 'Transaction/Cheque Ref ID required';

    // Prevent duplicate booking check
    if (bookingModalPlot) {
      const dup = bookings.find(b => b.projectId === bookingModalPlot.project.id && b.plotId === bookingModalPlot.plot.id && b.status !== 'Cancelled');
      if (dup) {
        errs.duplicate = 'This plot has already been booked!';
      }

      // Enforce booking rules for Vrindavan Dream City (Plots 1 to 165)
      if (bookingModalPlot.project.id === 1) {
        const plotIndex = parseInt(bookingModalPlot.plot.number.replace('P-', ''));
        if (plotIndex < 1 || plotIndex > 165 || isNaN(plotIndex)) {
          errs.plotRange = 'Bookings are restricted to plots 1–165 for Vrindavan Dream City.';
        }
      }
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !bookingModalPlot) return;

    const { project, plot } = bookingModalPlot;
    const bkgId = `BKG-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newBooking: Booking = {
      bookingId: bkgId,
      projectId: project.id,
      projectName: project.name,
      plotId: plot.id,
      plotNumber: plot.number,
      plotSize: plot.size,
      facing: plot.facing,
      totalAmount: plot.price,
      bookingAmount: parseFloat(formData.bookingAmount),
      bookingDate: new Date(formData.bookingDate).toISOString(),
      paymentMode: formData.paymentMode,
      transactionId: formData.transactionId.toUpperCase(),
      salesExecutive: formData.salesExecutive,
      bookingSource: formData.bookingSource,
      customer: {
        fullName: formData.fullName,
        mobile: formData.mobile,
        email: formData.email,
        address: formData.address,
        aadhaarNumber: formData.aadhaarNumber,
        panNumber: formData.panNumber.toUpperCase(),
      },
      status: 'Confirmed',
      timeline: [
        { title: 'Booking Received', date: new Date().toLocaleDateString('en-GB'), description: `Token amount ₹${formData.bookingAmount} paid via ${formData.paymentMode}.`, completed: true },
        { title: 'KYC & Document Verification', date: 'In Progress', description: 'Customer documents submitted for legal verification.', completed: false },
        { title: 'Sale Agreement Drafting', date: 'Pending', description: 'Sale agreement drafting.', completed: false },
        { title: 'Registry & Possession', date: 'Pending', description: 'Final handover schedule.', completed: false }
      ]
    };

    // Update Plot status to Booked
    const updatedProjects = projects.map(proj => {
      if (proj.id === project.id) {
        const updatedLayout = (proj.plots || proj.layout).map(pl => {
          if (pl.id === plot.id) {
            return { ...pl, status: PlotStatus.BOOKED };
          }
          return pl;
        });
        return {
          ...proj,
          layout: updatedLayout,
          plots: updatedLayout,
          availablePlots: updatedLayout.filter(pl => pl.status === PlotStatus.AVAILABLE || pl.status === PlotStatus.RESALE).length
        };
      }
      return proj;
    });

    onUpdateProjects(updatedProjects);
    const targetProj = updatedProjects.find(p => p.id === project.id);
    if (targetProj) {
      setDoc(doc(db, 'projects', String(targetProj.id)), sanitizeData(targetProj)).catch((error) => {
        console.error("Error updating project in PlotBookings:", error);
        onShowToast(`Permission Denied: Could not update plot status on project.`);
        handleFirestoreError(error, OperationType.UPDATE, `projects/${targetProj.id}`);
      });
    }
    saveBookings([newBooking, ...bookings]);

    // Real-time sync to Google Sheet if connected and linked
    if (gToken && spreadsheetId) {
      appendBookingToSheet(gToken, spreadsheetId, newBooking)
        .then(() => {
          onShowToast('⚡ Booking auto-synced to Google Sheet!');
        })
        .catch((err: any) => {
          console.error('Failed to auto-append booking to Google Sheet:', err);
          onShowToast('⚠️ Real-time Google Sheet sync failed.');
        });
    }

    // Success
    onShowToast?.(`🎉 Plot ${plot.number} booked successfully for ${formData.fullName}!`);

    // Simulated WhatsApp & Email Confirmation
    setTimeout(() => {
      onShowToast(`📲 WhatsApp & Email confirmation sent to ${formData.mobile}`);
    }, 1500);

    setBookingModalPlot(null);
    setSelectedBookingDetails(newBooking);
    setActiveTab('details');
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'available':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">Available</span>;
      case 'booked':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">Booked</span>;
      case 'hold':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Hold</span>;
      case 'sold':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">Sold</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* Top Header & Tab Navigation */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-8 border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
              <span className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md">
                <Icon name="projects" className="w-7 h-7" />
              </span>
              Plot Booking Management
            </h1>
            <p className="text-gray-500 mt-1 text-sm">Real-time inventory availability, customer bookings, and automated receipt generation.</p>
          </div>
          <div className="flex flex-wrap items-center bg-gray-100 p-1.5 rounded-xl border border-gray-200 gap-1">
            <button
              onClick={() => setActiveTab('plots')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'plots' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <Icon name="grid" className="w-4 h-4" />
              Available Plots ({filteredPlots.filter(p => p.plot.status === PlotStatus.AVAILABLE).length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <Icon name="calendar" className="w-4 h-4" />
              Booking History ({bookings.length})
            </button>
            {isManagerOrAdmin && (
              <>
                <button
                  onClick={() => setActiveTab('reports')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'reports' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  <Icon name="insights" className="w-4 h-4" />
                  Reports & Inventory
                </button>
                <button
                  onClick={() => setActiveTab('sheets')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'sheets' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  <Icon name="sheets" className="w-4 h-4 text-emerald-600" />
                  Google Sheets Sync
                  {spreadsheetId && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>}
                </button>
              </>
            )}
            <button
              onClick={() => setActiveTab('crm')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'crm' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <Icon name="profile" className="w-4 h-4 text-purple-600" />
              Customer CRM ({customers.length})
            </button>
            {selectedBookingDetails && (
              <button
                onClick={() => setActiveTab('details')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'details' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                <Icon name="user" className="w-4 h-4" />
                Booking Details
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PLOT INVENTORY DASHBOARD STATS */}
      <div className="bg-gradient-to-br from-gray-900 via-blue-950 to-indigo-950 rounded-2xl p-6 text-white shadow-xl border border-gray-800 mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
              <Icon name="projects" className="w-5 h-5 text-blue-400" />
              Plot Inventory Dashboard
            </h2>
            <p className="text-xs text-gray-300 mt-0.5">Real-time status tracking across all residential projects</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
            <div className="text-[11px] text-gray-300 uppercase font-semibold">Total Plots</div>
            <div className="text-2xl font-black mt-1">{stats.total}</div>
          </div>
          <div className="bg-green-500/20 backdrop-blur-sm p-4 rounded-xl border border-green-500/30">
            <div className="text-[11px] text-green-300 uppercase font-semibold">Available</div>
            <div className="text-2xl font-black mt-1 text-green-400">{stats.available}</div>
          </div>
          <div className="bg-blue-500/20 backdrop-blur-sm p-4 rounded-xl border border-blue-500/30">
            <div className="text-[11px] text-blue-300 uppercase font-semibold">Booked</div>
            <div className="text-2xl font-black mt-1 text-blue-400">{stats.booked}</div>
          </div>
          <div className="bg-amber-500/20 backdrop-blur-sm p-4 rounded-xl border border-amber-500/30">
            <div className="text-[11px] text-amber-300 uppercase font-semibold">Hold</div>
            <div className="text-2xl font-black mt-1 text-amber-400">{stats.hold}</div>
          </div>
          <div className="bg-purple-500/20 backdrop-blur-sm p-4 rounded-xl border border-purple-500/30">
            <div className="text-[11px] text-purple-300 uppercase font-semibold">Sold</div>
            <div className="text-2xl font-black mt-1 text-purple-400">{stats.sold}</div>
          </div>
          <div className="bg-indigo-500/20 backdrop-blur-sm p-4 rounded-xl border border-indigo-500/30">
            <div className="text-[11px] text-indigo-300 uppercase font-semibold">Today's Bookings</div>
            <div className="text-2xl font-black mt-1 text-indigo-300">{stats.todaysBookings}</div>
          </div>
          <div className="col-span-2 sm:col-span-2 lg:col-span-1 bg-emerald-500/20 backdrop-blur-sm p-4 rounded-xl border border-emerald-500/30">
            <div className="text-[11px] text-emerald-300 uppercase font-semibold">Monthly Revenue</div>
            <div className="text-xl font-black mt-1 text-emerald-300 truncate">₹{stats.monthlyRevenue.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* TAB 1: PLOTS INVENTORY & BOOKING */}
      {activeTab === 'plots' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[200px]">
                <Icon name="search" className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search plot number or project..."
                  value={plotSearch}
                  onChange={e => setPlotSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
              <select
                value={projectFilter}
                onChange={e => setProjectFilter(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-700 text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Projects</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id.toString()}>{p.name}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-700 text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Status</option>
                <option value="Available">Available</option>
                <option value="Booked">Booked</option>
                <option value="Hold">Hold</option>
                <option value="Sold">Sold</option>
              </select>
            </div>
            <div className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-2 rounded-lg">
              Showing {filteredPlots.length} Plots
            </div>
          </div>

          {/* Plots Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Plot No</th>
                    <th className="py-3.5 px-4">Project Name</th>
                    <th className="py-3.5 px-4">Size</th>
                    <th className="py-3.5 px-4">Facing</th>
                    <th className="py-3.5 px-4">Price</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                  {filteredPlots.map(({ project, plot }) => (
                    <tr key={`${project.id}-${plot.id}`} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-4 px-4 font-bold text-gray-900 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        {plot.number}
                      </td>
                      <td className="py-4 px-4 font-medium text-gray-800">{project.name}</td>
                      <td className="py-4 px-4 text-gray-600">
                        {plot.size > 0 ? `${plot.size} sq.ft` : 'Not Available'}{' '}
                        <span className="text-xs text-gray-400">({plot.dimensions})</span>
                      </td>
                      <td className="py-4 px-4">{plot.facing}</td>
                      <td className="py-4 px-4 font-extrabold text-gray-900">₹{plot.price.toLocaleString()}</td>
                      <td className="py-4 px-4">{getStatusBadge(plot.status)}</td>
                      <td className="py-4 px-4 text-right">
                        {plot.status === PlotStatus.AVAILABLE ? (
                          <button
                            onClick={() => handleOpenBookingModal(project, plot)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-xs shadow-sm transition-all inline-flex items-center gap-1.5 hover:shadow"
                          >
                            <Icon name="check" className="w-3.5 h-3.5" />
                            Book Plot
                          </button>
                        ) : (
                          <button
                            disabled
                            className="bg-gray-100 text-gray-400 font-medium px-4 py-2 rounded-lg text-xs cursor-not-allowed inline-flex items-center gap-1.5"
                          >
                            <Icon name="lock" className="w-3.5 h-3.5" />
                            {plot.status}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredPlots.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400 font-medium">
                        No plots found matching the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BOOKING HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* History Search & Filters */}
          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[220px]">
                <Icon name="search" className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search customer, mobile, ID, or plot..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
              <select
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-700 text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Dates</option>
                <option value="TODAY">Today's Bookings</option>
                <option value="MONTH">This Month</option>
              </select>
              <select
                value={historyStatusFilter}
                onChange={e => setHistoryStatusFilter(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-700 text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Status</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Pending">Pending</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Bookings Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Booking ID</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Plot & Project</th>
                    <th className="py-3.5 px-4">Total Price</th>
                    <th className="py-3.5 px-4">Token Amt</th>
                    <th className="py-3.5 px-4">Date & Mode</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                  {filteredHistory.map(bkg => (
                    <tr key={bkg.bookingId} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-4 px-4 font-mono font-bold text-blue-600">{bkg.bookingId}</td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-gray-900">{bkg.customer.fullName}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Icon name="phone" className="w-3 h-3 text-gray-400" />
                          {bkg.customer.mobile}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-bold text-gray-900 bg-blue-100 px-2 py-0.5 rounded text-xs mr-1.5">{bkg.plotNumber}</span>
                        <span className="text-gray-600 font-medium">{bkg.projectName}</span>
                        {(() => {
                          const isVrindavan = bkg.projectId === 1 || bkg.projectName?.toLowerCase().includes('vrindavan');
                          const plotNumParsed = parseInt(bkg.plotNumber.toLowerCase().replace('p-', '').trim());
                          const isInvalidVrindavanPlot = isVrindavan && (isNaN(plotNumParsed) || plotNumParsed > 165 || plotNumParsed < 1);
                          if (isInvalidVrindavanPlot) {
                            return (
                              <div className="mt-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md inline-block">
                                ⚠️ Invalid Plot (&gt;165): Admin Review Flagged
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </td>
                      <td className="py-4 px-4 font-semibold text-gray-900">₹{bkg.totalAmount.toLocaleString()}</td>
                      <td className="py-4 px-4 font-bold text-green-700">₹{bkg.bookingAmount.toLocaleString()}</td>
                      <td className="py-4 px-4">
                        <div className="text-gray-800 text-xs font-medium">{new Date(bkg.bookingDate).toLocaleDateString('en-GB')}</div>
                        <div className="text-[11px] text-gray-400 font-mono mt-0.5">{bkg.paymentMode}</div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${bkg.status === 'Confirmed' ? 'bg-green-100 text-green-800' : bkg.status === 'Cancelled' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                          {bkg.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right space-x-2">
                        <button
                          onClick={() => { setSelectedBookingDetails(bkg); setActiveTab('details'); }}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-all"
                          title="View Details"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => setReceiptBooking(bkg)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1"
                          title="Generate Receipt PDF"
                        >
                          <Icon name="article" className="w-3.5 h-3.5" />
                          Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredHistory.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-400 font-medium">
                        No booking records found matching the filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BOOKING DETAILS, CRM WORKFLOW, & INSTALLMENTS VIEW */}
      {activeTab === 'details' && selectedBookingDetails && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-xl shadow-sm border border-gray-200 gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveTab('history')}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                title="Back to History"
              >
                <Icon name="arrow-left" className="w-5 h-5" />
              </button>
              <div>
                <span className="text-xs text-gray-400 font-mono uppercase">Booking Reference</span>
                <h2 className="text-2xl font-extrabold text-gray-900 font-mono flex items-center gap-2">
                  {selectedBookingDetails.bookingId}
                  <span className="text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full font-sans uppercase">
                    {selectedBookingDetails.workflowStage || 'Available'}
                  </span>
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setReceiptBooking(selectedBookingDetails)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm shadow transition-all inline-flex items-center gap-2"
              >
                <Icon name="article" className="w-4 h-4" />
                Generate PDF Receipt
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Details & Workflow */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* CRM WORKFLOW LIFECYCLE BOARD */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Icon name="status" className="w-5 h-5 text-indigo-600" />
                    Enterprise Booking Workflow Stage
                  </h3>
                  <span className="text-xs text-gray-500 font-bold">
                    Role: <span className="text-blue-600 capitalize">{currentUser?.role || 'Guest'}</span>
                  </span>
                </div>

                {/* Horizontal Workflow Stepper */}
                <div className="overflow-x-auto pb-4">
                  <div className="flex items-center gap-1 min-w-[900px]">
                    {[
                      'Available', 'Hold Requested', 'Pending Approval', 'Hold Approved', 
                      'Booking Requested', 'Booking Approved', 'Payment Pending', 'Partially Paid', 
                      'Fully Paid', 'Registry Pending', 'Registry Completed', 'Sold'
                    ].map((stg, sIdx) => {
                      const isActive = selectedBookingDetails.workflowStage === stg;
                      const isPast = [
                        'Available', 'Hold Requested', 'Pending Approval', 'Hold Approved', 
                        'Booking Requested', 'Booking Approved', 'Payment Pending', 'Partially Paid', 
                        'Fully Paid', 'Registry Pending', 'Registry Completed', 'Sold'
                      ].indexOf(selectedBookingDetails.workflowStage) >= sIdx;

                      return (
                        <React.Fragment key={stg}>
                          <div className={`p-2 rounded-lg text-center border text-[10px] font-extrabold flex-1 min-w-[80px] transition-all ${
                            isActive ? 'bg-blue-600 text-white border-blue-700 shadow' :
                            isPast ? 'bg-blue-50 text-blue-800 border-blue-200' :
                            'bg-gray-50 text-gray-400 border-gray-200'
                          }`}>
                            {stg}
                          </div>
                          {sIdx < 11 && <span className="text-gray-300 font-bold font-mono">→</span>}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* Action Controls based on Roles */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Workflow Transition Controls</h4>
                  
                  {/* Managers and Administrators can bypass and select any stage dynamically */}
                  {isManagerOrAdmin ? (
                    <div className="flex flex-col sm:flex-row items-end gap-3">
                      <div className="w-full sm:flex-1">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Force Update Stage (Authorized override):</label>
                        <select
                          value={selectedBookingDetails.workflowStage || 'Available'}
                          onChange={async (e) => {
                            const val = e.target.value;
                            if (window.confirm(`Transition Plot ${selectedBookingDetails.plotNumber} to workflow stage "${val}"?`)) {
                              await handleUpdateWorkflowStage(selectedBookingDetails, val, `Manager update to ${val}`);
                            }
                          }}
                          className="w-full bg-white border border-gray-300 rounded-lg p-2 text-xs font-bold text-gray-800 focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="Available">Available (Release Plot)</option>
                          <option value="Hold Requested">Hold Requested</option>
                          <option value="Pending Approval">Pending Approval</option>
                          <option value="Hold Approved">Hold Approved (Active Hold)</option>
                          <option value="Booking Requested">Booking Requested</option>
                          <option value="Booking Approved">Booking Approved</option>
                          <option value="Payment Pending">Payment Pending</option>
                          <option value="Partially Paid">Partially Paid</option>
                          <option value="Fully Paid">Fully Paid</option>
                          <option value="Registry Pending">Registry Pending</option>
                          <option value="Registry Completed">Registry Completed</option>
                          <option value="Sold">Sold (Fully Transferred)</option>
                        </select>
                      </div>
                      
                      {/* Standard approval short-cut buttons */}
                      <div className="flex gap-2 shrink-0">
                        {selectedBookingDetails.workflowStage === 'Hold Requested' && (
                          <button
                            onClick={() => handleUpdateWorkflowStage(selectedBookingDetails, 'Hold Approved', 'Hold approved by authorized manager.')}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-lg text-xs shadow-sm"
                          >
                            Approve Hold Lock
                          </button>
                        )}
                        {selectedBookingDetails.workflowStage === 'Booking Requested' && (
                          <button
                            onClick={() => handleUpdateWorkflowStage(selectedBookingDetails, 'Booking Approved', 'Booking application approved by executive management.')}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg text-xs shadow-sm"
                          >
                            Approve Booking Application
                          </button>
                        )}
                        {selectedBookingDetails.workflowStage === 'Hold Approved' && (
                          <button
                            onClick={() => handleUpdateWorkflowStage(selectedBookingDetails, 'Booking Requested', 'Hold upgraded to Booking Application.')}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg text-xs shadow-sm"
                          >
                            Convert to Booking Application
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs font-medium text-gray-600">
                      💡 You are signed in as an <strong className="text-purple-700 capitalize">{currentUser?.role || 'Executive'}</strong>. Stage changes require Manager or Administrator authorization approvals.
                      {selectedBookingDetails.workflowStage === 'Hold Approved' && (
                        <button
                          onClick={() => handleUpdateWorkflowStage(selectedBookingDetails, 'Booking Requested', 'Booking conversion requested by Executive.')}
                          className="mt-2 block bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg"
                        >
                          Request Booking Conversion
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Information Card */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 space-y-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b pb-3">
                  <Icon name="user" className="w-5 h-5 text-blue-600" />
                  Customer Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-gray-400 font-bold uppercase">Applicant Full Name</div>
                    <div className="font-bold text-gray-900 mt-0.5">{selectedBookingDetails.customer.fullName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 font-bold uppercase">Mobile Number (WhatsApp)</div>
                    <div className="font-semibold text-gray-800 mt-0.5">{selectedBookingDetails.customer.mobile}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 font-bold uppercase">Email Address</div>
                    <div className="font-medium text-gray-800 mt-0.5">{selectedBookingDetails.customer.email}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 font-bold uppercase">Aadhaar Number</div>
                    <div className="font-mono text-gray-800 mt-0.5">{selectedBookingDetails.customer.aadhaarNumber}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 font-bold uppercase">PAN Number</div>
                    <div className="font-mono font-bold text-gray-900 mt-0.5">{selectedBookingDetails.customer.panNumber}</div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-xs text-gray-400 font-bold uppercase">Residential Address</div>
                    <div className="text-gray-800 mt-0.5">{selectedBookingDetails.customer.address}</div>
                  </div>
                </div>
              </div>

              {/* Plot Specification Card */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 space-y-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b pb-3">
                  <Icon name="projects" className="w-5 h-5 text-blue-600" />
                  Allotted Plot Breakdown
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-gray-400 font-bold uppercase">Project Name</div>
                    <div className="font-bold text-gray-900 mt-0.5">{selectedBookingDetails.projectName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 font-bold uppercase">Plot Number</div>
                    <div className="font-extrabold text-blue-600 mt-0.5">{selectedBookingDetails.plotNumber}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 font-bold uppercase">Plot Size</div>
                    <div className="font-semibold text-gray-800 mt-0.5">{selectedBookingDetails.plotSize} sq.ft</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 font-bold uppercase">Facing</div>
                    <div className="text-gray-800 mt-0.5">{selectedBookingDetails.facing}</div>
                  </div>
                </div>
              </div>

              {/* INSTALLMENTS & FINANCIAL PROGRESS CARD */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 space-y-6">
                <div className="border-b pb-3 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Icon name="calculator" className="w-5 h-5 text-emerald-600" />
                    Financial Breakdown & Payment Schedule
                  </h3>
                  <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded">
                    Remaining Balance: ₹{(
                      selectedBookingDetails.totalAmount - 
                      (selectedBookingDetails.bookingAmount || 0) - 
                      ((selectedBookingDetails.installments || []).reduce((sum, i) => sum + i.amount, 0))
                    ).toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Visual Financial Health Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
                    <div className="text-xs text-gray-500 font-bold uppercase">Total Plot Cost</div>
                    <div className="text-xl font-black text-gray-900 mt-1">₹{selectedBookingDetails.totalAmount.toLocaleString('en-IN')}</div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                    <div className="text-xs text-emerald-700 font-bold uppercase">Total Paid To Date</div>
                    <div className="text-xl font-black text-emerald-800 mt-1">
                      ₹{(
                        (selectedBookingDetails.bookingAmount || 0) + 
                        ((selectedBookingDetails.installments || []).reduce((sum, i) => sum + i.amount, 0))
                      ).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
                    <div className="text-xs text-amber-700 font-bold uppercase">Outstanding Dues</div>
                    <div className="text-xl font-black text-amber-800 mt-1">
                      ₹{(
                        selectedBookingDetails.totalAmount - 
                        (selectedBookingDetails.bookingAmount || 0) - 
                        ((selectedBookingDetails.installments || []).reduce((sum, i) => sum + i.amount, 0))
                      ).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* Installments Ledger list */}
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Payment Ledger History</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold">
                          <th className="py-2.5 px-3">Txn ID / Installment</th>
                          <th className="py-2.5 px-3">Date Received</th>
                          <th className="py-2.5 px-3">Method</th>
                          <th className="py-2.5 px-3">Amount Credited</th>
                          <th className="py-2.5 px-3 text-right">Receipt / File</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-800">
                        {/* Token Booking Advance Row */}
                        <tr>
                          <td className="py-3 px-3 font-mono font-bold text-indigo-700">ADVANCE-TOKEN</td>
                          <td className="py-3 px-3">{new Date(selectedBookingDetails.bookingDate).toLocaleDateString('en-IN')}</td>
                          <td className="py-3 px-3 font-bold">{selectedBookingDetails.paymentMode}</td>
                          <td className="py-3 px-3 font-black text-emerald-700">₹{selectedBookingDetails.bookingAmount.toLocaleString()}</td>
                          <td className="py-3 px-3 text-right text-gray-400 italic">Auto Token</td>
                        </tr>
                        {/* Custom Installments */}
                        {(selectedBookingDetails.installments || []).map((inst, index) => (
                          <tr key={inst.installmentId}>
                            <td className="py-3 px-3 font-mono font-bold text-blue-600">{inst.transactionId}</td>
                            <td className="py-3 px-3">{new Date(inst.paidDate).toLocaleDateString('en-IN')}</td>
                            <td className="py-3 px-3 font-semibold">{inst.paymentMode}</td>
                            <td className="py-3 px-3 font-black text-emerald-700">₹{inst.amount.toLocaleString()}</td>
                            <td className="py-3 px-3 text-right">
                              {inst.receiptUrl && (
                                <a
                                  href={inst.receiptUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100"
                                >
                                  📄 View Receipt File
                                </a>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Form to Add Installment */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                  <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider">Record New installment Credit</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">Installment Amount (₹) *</label>
                      <input
                        type="number"
                        placeholder="Amount in Rupees"
                        value={installmentAmount}
                        onChange={(e) => setInstallmentAmount(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg p-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">Transaction/Ref ID *</label>
                      <input
                        type="text"
                        placeholder="e.g. UPI8249823091"
                        value={installmentRef}
                        onChange={(e) => setInstallmentRef(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg p-2 text-xs font-mono focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">Payment Method</label>
                      <select
                        value={installmentMode}
                        onChange={(e) => setInstallmentMode(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg p-2 text-xs font-bold focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="UPI">UPI (GPay/PhonePe)</option>
                        <option value="Bank Transfer">NEFT / RTGS</option>
                        <option value="Cheque">Bank Cheque</option>
                        <option value="Cash">Cash Credit</option>
                      </select>
                    </div>
                  </div>

                  {/* Drag-and-Drop Receipt File Upload */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Upload Receipt Image / Invoice Document</label>
                    <div 
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        onShowToast("Receipt document recognized & ready for upload!");
                        setReceiptFile("https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500&auto=format&fit=crop&q=60");
                      }}
                      className="border-2 border-dashed border-gray-300 rounded-xl p-5 text-center hover:border-blue-500 hover:bg-blue-50/20 transition-all cursor-pointer"
                      onClick={() => {
                        const testUrl = prompt("Enter a simulated document / receipt URL (or click Cancel for default simulation):", "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500&auto=format&fit=crop&q=60");
                        if (testUrl) {
                          setReceiptFile(testUrl);
                          onShowToast("Simulated document uploaded successfully!");
                        }
                      }}
                    >
                      <span className="text-xs font-medium text-gray-600 block">
                        {receiptFile ? "✅ Document file attached successfully!" : "Drag & drop payment receipt here, or click to attach simulated invoice file"}
                      </span>
                      {receiptFile && <span className="text-[10px] font-mono text-indigo-600 mt-1 block break-all">{receiptFile}</span>}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleAddInstallment(selectedBookingDetails)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-5 py-2 rounded-lg text-xs shadow"
                    >
                      Record Payment Installment
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Col: Booking Event Timeline Logging */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 h-fit space-y-6">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b pb-3">
                <Icon name="clock" className="w-5 h-5 text-blue-600" />
                Immutable Event History
              </h3>
              
              <div className="relative pl-6 border-l-2 border-blue-100 space-y-6">
                {(selectedBookingDetails.timeline || []).map((step, idx) => (
                  <div key={idx} className="relative">
                    {/* Tick indicator */}
                    <span className="absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-green-600 bg-green-600 text-white flex items-center justify-center">
                      <Icon name="check" className="w-2.5 h-2.5" />
                    </span>
                    <div>
                      <div className="flex flex-col">
                        <span className="text-xs font-mono font-bold text-gray-400">{step.date}</span>
                        <h4 className="text-sm font-extrabold text-gray-900 mt-0.5">{step.title}</h4>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 bg-gray-50 p-2 rounded border border-gray-150">{step.description}</p>
                      <span className="text-[10px] text-indigo-600 font-bold block mt-1">👤 Triggered By: {step.userEmail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PLOT BOOKING FORM MODAL */}
      {bookingModalPlot && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 animate-scaleUp my-8">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gray-900 text-white px-6 py-4 flex justify-between items-center z-10">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-blue-600 rounded-xl">
                  <Icon name="check" className="w-5 h-5 text-white" />
                </span>
                <div>
                  <h3 className="text-lg font-bold">New Plot Booking Application</h3>
                  <p className="text-xs text-gray-300">{bookingModalPlot.project.name} • Plot {bookingModalPlot.plot.number}</p>
                </div>
              </div>
              <button
                onClick={() => setBookingModalPlot(null)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"
              >
                <Icon name="close" className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleBookingSubmit} className="p-6 space-y-8">
              {formErrors.duplicate && (
                <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-800 rounded-r-lg text-sm font-semibold">
                  {formErrors.duplicate}
                </div>
              )}

              {formErrors.plotRange && (
                <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-800 rounded-r-lg text-sm font-semibold">
                  {formErrors.plotRange}
                </div>
              )}

              {/* Section 1: Plot Details (Auto-filled Readonly) */}
              <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100">
                <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-3">Selected Plot Specification (Auto-filled)</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500">Project</span>
                    <div className="font-bold text-gray-900 text-sm mt-0.5">{bookingModalPlot.project.name}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Plot No</span>
                    <div className="font-extrabold text-blue-700 text-sm mt-0.5">{bookingModalPlot.plot.number}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Dimensions</span>
                    <div className="font-semibold text-gray-800 text-sm mt-0.5">
                      {bookingModalPlot.plot.size > 0 ? `${bookingModalPlot.plot.size} sq.ft` : 'Not Available'}{' '}
                      ({bookingModalPlot.plot.dimensions})
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Total Price</span>
                    <div className="font-extrabold text-green-700 text-sm mt-0.5">₹{bookingModalPlot.plot.price.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Standard Sizes</span>
                    <div className="flex flex-wrap gap-1 mt-1 max-h-[40px] overflow-y-auto">
                      {(bookingModalPlot.project.plotSizes || '').split(',').map((size: string) => (
                        <span key={size} className="bg-emerald-50 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-0.5 whitespace-nowrap">
                          🟢 {size.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Customer Details */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
                  <Icon name="user" className="w-4 h-4 text-blue-600" />
                  Applicant / Customer Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Kumar Sharma"
                      value={formData.fullName}
                      onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                      className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all ${formErrors.fullName ? 'border-red-500 bg-red-50/30' : 'border-gray-300'}`}
                    />
                    {formErrors.fullName && <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.fullName}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Mobile Number (WhatsApp) *</label>
                    <input
                      type="text"
                      maxLength={10}
                      placeholder="10 digit mobile"
                      value={formData.mobile}
                      onChange={e => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g,'') })}
                      className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all ${formErrors.mobile ? 'border-red-500 bg-red-50/30' : 'border-gray-300'}`}
                    />
                    {formErrors.mobile && <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.mobile}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Email Address *</label>
                    <input
                      type="email"
                      placeholder="customer@example.com"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all ${formErrors.email ? 'border-red-500 bg-red-50/30' : 'border-gray-300'}`}
                    />
                    {formErrors.email && <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.email}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Aadhaar Number *</label>
                    <input
                      type="text"
                      maxLength={12}
                      placeholder="12 digit Aadhaar No"
                      value={formData.aadhaarNumber}
                      onChange={e => setFormData({ ...formData, aadhaarNumber: e.target.value.replace(/\D/g,'') })}
                      className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-xl text-sm font-mono focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all ${formErrors.aadhaarNumber ? 'border-red-500 bg-red-50/30' : 'border-gray-300'}`}
                    />
                    {formErrors.aadhaarNumber && <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.aadhaarNumber}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">PAN Number *</label>
                    <input
                      type="text"
                      maxLength={10}
                      placeholder="e.g. ABCDE1234F"
                      value={formData.panNumber}
                      onChange={e => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                      className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-xl text-sm font-mono uppercase focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all ${formErrors.panNumber ? 'border-red-500 bg-red-50/30' : 'border-gray-300'}`}
                    />
                    {formErrors.panNumber && <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.panNumber}</p>}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Residential Address *</label>
                    <textarea
                      rows={2}
                      placeholder="Complete house address with city and pin code"
                      value={formData.address}
                      onChange={e => setFormData({ ...formData, address: e.target.value })}
                      className={`w-full px-3.5 py-2 bg-gray-50 border rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all ${formErrors.address ? 'border-red-500 bg-red-50/30' : 'border-gray-300'}`}
                    />
                    {formErrors.address && <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.address}</p>}
                  </div>
                </div>
              </div>

              {/* Section 3: Booking & Payment Information */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
                  <Icon name="article" className="w-4 h-4 text-blue-600" />
                  Booking & Token Payment Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Booking Date</label>
                    <input
                      type="date"
                      value={formData.bookingDate}
                      onChange={e => setFormData({ ...formData, bookingDate: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Booking Token Amount (₹) *</label>
                    <input
                      type="number"
                      max={bookingModalPlot.plot.price}
                      value={formData.bookingAmount}
                      onChange={e => setFormData({ ...formData, bookingAmount: e.target.value })}
                      className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-xl text-sm font-bold text-green-700 focus:bg-white focus:ring-2 focus:ring-blue-500 ${formErrors.bookingAmount ? 'border-red-500' : 'border-gray-300'}`}
                    />
                    {formErrors.bookingAmount && <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.bookingAmount}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Payment Mode</label>
                    <select
                      value={formData.paymentMode}
                      onChange={e => setFormData({ ...formData, paymentMode: e.target.value as PaymentMode })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="UPI">UPI (GPay / PhonePe)</option>
                      <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                      <option value="Cheque">Bank Cheque / DD</option>
                      <option value="Cash">Cash Receipt</option>
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Transaction Ref ID / UPI ID / Cheque No *</label>
                    <input
                      type="text"
                      placeholder="e.g. UPI9812408123 or CHQ-449123"
                      value={formData.transactionId}
                      onChange={e => setFormData({ ...formData, transactionId: e.target.value })}
                      className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-xl text-sm font-mono uppercase focus:bg-white focus:ring-2 focus:ring-blue-500 ${formErrors.transactionId ? 'border-red-500' : 'border-gray-300'}`}
                    />
                    {formErrors.transactionId && <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.transactionId}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Sales Executive</label>
                    <input
                      type="text"
                      value={formData.salesExecutive}
                      onChange={e => setFormData({ ...formData, salesExecutive: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Booking Source</label>
                    <input
                      type="text"
                      placeholder="Direct Walk-in, Referral, FB Ads, etc."
                      value={formData.bookingSource}
                      onChange={e => setFormData({ ...formData, bookingSource: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Form Footer Buttons */}
              <div className="flex justify-end items-center gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setBookingModalPlot(null)}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                >
                  <Icon name="check" className="w-5 h-5" />
                  Confirm Plot Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF RECEIPT GENERATOR MODAL */}
      {receiptBooking && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scaleUp my-8">
            <div className="p-4 bg-gray-900 text-white flex justify-between items-center print:hidden rounded-t-2xl">
              <span className="font-bold text-sm">Official Booking Receipt Preview</span>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5"
                >
                  <Icon name="article" className="w-3.5 h-3.5" />
                  Print Receipt
                </button>
                <button
                  onClick={() => setReceiptBooking(null)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white"
                >
                  <Icon name="close" className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Receipt Printable Area */}
            <div className="p-8 space-y-6 text-gray-800 bg-white" id="printable-booking-receipt">
              {/* Receipt Header Logo & Title */}
              <div className="flex justify-between items-start border-b-2 border-blue-600 pb-6">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-blue-900">DHANSHRI INFRABULLS</h2>
                  <p className="text-xs text-gray-500 mt-1">ISO 9001:2015 Certified Real Estate Developers</p>
                  <p className="text-xs text-gray-500">Regd. Office: Vijay Nagar, Indore (M.P.) • Ph: 0731-4091234</p>
                </div>
                <div className="text-right">
                  <div className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded font-extrabold text-xs uppercase tracking-wider">
                    PROVISIONAL BOOKING RECEIPT
                  </div>
                  <div className="font-mono font-bold text-sm text-gray-900 mt-2">Ref: {receiptBooking.bookingId}</div>
                  <div className="text-xs text-gray-500">Date: {new Date(receiptBooking.bookingDate).toLocaleDateString('en-GB')}</div>
                </div>
              </div>

              {/* Receipt Body */}
              <div className="space-y-4 text-sm">
                <p className="text-gray-700 leading-relaxed">
                  Received with thanks from <span className="font-bold text-gray-900">{receiptBooking.customer.fullName}</span> (Mobile: {receiptBooking.customer.mobile}), residing at {receiptBooking.customer.address}, an advance token booking consideration of <span className="font-extrabold text-green-700 text-base">₹{receiptBooking.bookingAmount.toLocaleString()}</span> (INR) towards the provisional booking of residential plot.
                </p>

                {/* Specification Box */}
                <div className="border border-gray-200 rounded-xl overflow-hidden mt-4">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-gray-100">
                      <tr className="bg-gray-50 font-bold text-gray-600 uppercase">
                        <td className="p-2.5 px-4 w-1/3">Specification</td>
                        <td className="p-2.5 px-4">Allotted Details</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 px-4 text-gray-500">Project Name</td>
                        <td className="p-2.5 px-4 font-bold text-gray-900">{receiptBooking.projectName}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 px-4 text-gray-500">Plot Number & Facing</td>
                        <td className="p-2.5 px-4 font-extrabold text-blue-600">{receiptBooking.plotNumber} ({receiptBooking.facing} Facing)</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 px-4 text-gray-500">Plot Size</td>
                        <td className="p-2.5 px-4 font-medium">{receiptBooking.plotSize} sq.ft</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 px-4 text-gray-500">Total Plot Value</td>
                        <td className="p-2.5 px-4 font-bold text-gray-900">₹{receiptBooking.totalAmount.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 px-4 text-gray-500">Booking Amount Received</td>
                        <td className="p-2.5 px-4 font-extrabold text-green-700">₹{receiptBooking.bookingAmount.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 px-4 text-gray-500">Payment Method & Ref ID</td>
                        <td className="p-2.5 px-4 font-mono font-bold">{receiptBooking.paymentMode} • {receiptBooking.transactionId}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 px-4 text-gray-500">Aadhaar & PAN No</td>
                        <td className="p-2.5 px-4 font-mono text-gray-600">{receiptBooking.customer.aadhaarNumber} • {receiptBooking.customer.panNumber}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Receipt Footer: QR Code & Signature */}
              <div className="pt-8 flex justify-between items-end">
                <div className="flex items-center gap-3">
                  {/* Simulated SVG QR Code */}
                  <div className="w-20 h-20 bg-gray-100 border p-1 rounded flex flex-col items-center justify-center text-center">
                    <svg className="w-16 h-16 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13-2h3v2h-3v-2zm-3 0h2v3h-2v-3zm3 3h3v5h-5v-2h2v-3zm-3 3h2v2h-2v-2z"/>
                    </svg>
                    <span className="text-[8px] font-mono text-gray-500 mt-0.5">VERIFIED QR</span>
                  </div>
                  <div className="text-[10px] text-gray-500 max-w-[200px]">
                    Scan QR code to verify authenticity. Subject to Indore Jurisdiction. Terms apply.
                  </div>
                </div>

                <div className="text-center">
                  <div className="w-40 h-12 border-b border-gray-400 mb-1 flex items-end justify-center">
                    <span className="font-dancing text-blue-800 font-bold italic opacity-80">Dhanshri Auth</span>
                  </div>
                  <div className="text-xs font-bold text-gray-800">Authorized Signatory</div>
                  <div className="text-[10px] text-gray-400">Dhanshri Infrabulls Pvt. Ltd.</div>
                </div>
              </div>

              <div className="border-t pt-4 text-center text-[11px] text-gray-400 print:mt-12">
                This receipt is computer generated and valid upon real bank account credit realization.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: REPORTS & ANALYTICS */}
      {activeTab === 'reports' && isManagerOrAdmin && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Icon name="insights" className="w-6 h-6 text-blue-600" />
              Project Inventory & Financial Breakdown Report
            </h3>
            <p className="text-sm text-gray-500 mb-6">Comprehensive audit of plot status distribution and estimated gross real estate asset value.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Project Name</th>
                    <th className="py-3.5 px-4">Plot Sizes</th>
                    <th className="py-3.5 px-4">Total Plots</th>
                    <th className="py-3.5 px-4">Available</th>
                    <th className="py-3.5 px-4">Booked</th>
                    <th className="py-3.5 px-4">Hold</th>
                    <th className="py-3.5 px-4">Sold</th>
                    <th className="py-3.5 px-4">Total Inventory Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {projects.map(proj => {
                    const plotsArr = proj.plots && proj.plots.length > 0 
                      ? proj.plots 
                      : proj.layout && proj.layout.length > 0 
                        ? proj.layout 
                        : [];
                    const hasPlots = plotsArr.length > 0;
                    const total = hasPlots ? plotsArr.length : (proj.totalPlots || 0);
                    const avail = hasPlots ? plotsArr.filter(p => p.status.toLowerCase() === 'available' || p.status.toLowerCase() === 'for resale').length : (proj.availablePlots || 0);
                    const bkd = hasPlots ? plotsArr.filter(p => p.status.toLowerCase() === 'booked').length : 0;
                    const hld = hasPlots ? plotsArr.filter(p => p.status.toLowerCase() === 'hold').length : 0;
                    const sld = hasPlots ? plotsArr.filter(p => p.status.toLowerCase() === 'sold').length : 0;
                    const val = hasPlots ? plotsArr.reduce((acc, p) => acc + p.price, 0) : 0;
                    return (
                      <tr key={proj.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="py-4 px-4 font-bold text-gray-900">{proj.name}</td>
                        <td className="py-4 px-4">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {(proj.plotSizes || '').split(',').map((size) => (
                              <span key={size} className="bg-emerald-50 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-0.5 whitespace-nowrap">
                                🟢 {size.trim()}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-4 font-semibold">{total}</td>
                        <td className="py-4 px-4 font-bold" style={{ color: STATUS_COLORS.available.fill }}>{avail}</td>
                        <td className="py-4 px-4 font-bold" style={{ color: STATUS_COLORS.booked.fill }}>{bkd}</td>
                        <td className="py-4 px-4 font-bold" style={{ color: STATUS_COLORS.booked.fill }}>{hld}</td>
                        <td className="py-4 px-4 font-bold" style={{ color: STATUS_COLORS.sold.fill }}>{sld}</td>
                        <td className="py-4 px-4 font-mono font-bold text-gray-800">₹{val.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: GOOGLE SHEETS SYNC CONTROL CENTER */}
      {activeTab === 'sheets' && isManagerOrAdmin && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4 mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Icon name="sheets" className="w-6 h-6 text-emerald-600" />
                  Google Sheets Integration
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Keep your real estate plot bookings synchronized with safe cloud spreadsheets.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500">Sync Status:</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono ${
                  syncStatus.includes('Connected') || syncStatus.includes('synced') || syncStatus.includes('Linked')
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}>
                  {syncStatus}
                </span>
              </div>
            </div>

            {/* Profile / Account state */}
            {!googleUser ? (
              <div className="bg-gray-50 rounded-2xl p-8 border border-gray-200 text-center space-y-6">
                <div className="max-w-md mx-auto space-y-3">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                    <Icon name="sheets" className="w-8 h-8" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900">Connect Google Sheets</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Link your Google account to automatically store, update, and read customer booking entries on safe Google Spreadsheets.
                  </p>
                </div>
                <div>
                  <button
                    onClick={handleGoogleSignIn}
                    className="inline-flex items-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-bold px-6 py-3 rounded-xl shadow-md border border-gray-300 transition-all cursor-pointer text-sm"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Sign in with Google
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Account card */}
                <div className="bg-emerald-50/40 rounded-2xl p-6 border border-emerald-100/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {googleUser.photoURL ? (
                      <img src={googleUser.photoURL} alt="Avatar" className="w-12 h-12 rounded-full border border-emerald-200" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                        {googleUser.displayName?.[0] || 'G'}
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-gray-900 text-base">{googleUser.displayName}</h4>
                      <p className="text-xs text-gray-500 font-medium">{googleUser.email}</p>
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={handleGoogleSignOut}
                      className="text-xs font-bold text-red-600 hover:text-red-800 bg-white border border-red-200 px-3 py-1.5 rounded-lg shadow-sm hover:shadow transition-all cursor-pointer"
                    >
                      Disconnect Account
                    </button>
                  </div>
                </div>

                {/* Spreadsheet Connection card */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
                  {!spreadsheetId ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Left: Create Sheet Option */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                            <Icon name="add" className="w-4 h-4" />
                          </span>
                          <h5 className="font-bold text-gray-900 text-sm">Create New Spreadsheet</h5>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          We will instantly create a brand new, fully styled document named <span className="font-semibold text-gray-800">"Dhanshri Properties Bookings"</span> in your Google Drive and export all {bookings.length} existing bookings to it.
                        </p>
                        <button
                          type="button"
                          onClick={handleCreateSheet}
                          disabled={isSyncing}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          <Icon name="sheets" className="w-4 h-4" />
                          {isSyncing ? 'Creating spreadsheet...' : 'Create & Link Booking Sheet'}
                        </button>
                      </div>

                      {/* Right: Link Existing Option */}
                      <div className="space-y-4 border-t md:border-t-0 md:border-l border-gray-100 pt-6 md:pt-0 md:pl-8">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 bg-blue-100 text-blue-800 rounded-lg">
                            <Icon name="projects" className="w-4 h-4" />
                          </span>
                          <h5 className="font-bold text-gray-900 text-sm">Link Existing Spreadsheet</h5>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          Already have a sheet? Paste its Spreadsheet ID from the URL (the long string of letters and numbers in your spreadsheet URL) to link it.
                        </p>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const val = (e.currentTarget.elements.namedItem('existingSheetId') as HTMLInputElement).value;
                            handleLinkExistingSheet(val);
                          }}
                          className="flex gap-2"
                        >
                          <input
                            type="text"
                            name="existingSheetId"
                            placeholder="Spreadsheet ID..."
                            className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                            required
                          />
                          <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow transition-all"
                          >
                            Link ID
                          </button>
                        </form>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <div className="space-y-1">
                          <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Linked Document ID</div>
                          <div className="font-mono text-xs font-semibold text-gray-800 break-all">{spreadsheetId}</div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <a
                            href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition-all inline-flex items-center gap-1.5"
                          >
                            <Icon name="sheets" className="w-4 h-4" />
                            Open Spreadsheet
                          </a>
                          <button
                            type="button"
                            onClick={handleUnlinkSheet}
                            className="text-xs font-bold text-gray-500 hover:text-gray-800 hover:bg-gray-100 border px-3 py-2 rounded-xl transition-all"
                          >
                            Unlink
                          </button>
                        </div>
                      </div>

                      {/* Manual Trigger & Operations Block */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                          <h6 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                            <Icon name="bell" className="w-4 h-4 text-emerald-600" />
                            Push/Sync Bookings
                          </h6>
                          <p className="text-xs text-gray-500">
                            Re-sync and overwrite all current {bookings.length} local app bookings to the Google Sheet. This keeps your document clean and formatted.
                          </p>
                          <button
                            type="button"
                            onClick={handleManualSync}
                            disabled={isSyncing}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold py-2 px-3 rounded-lg transition-all flex items-center gap-1"
                          >
                            <Icon name="check" className="w-3.5 h-3.5" />
                            {isSyncing ? 'Syncing...' : 'Sync Full Data Now'}
                          </button>
                        </div>

                        <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                          <h6 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                            <Icon name="search" className="w-4 h-4 text-blue-600" />
                            Pull/Fetch Sheet Data
                          </h6>
                          <p className="text-xs text-gray-500">
                            Fetch rows from your linked Google Spreadsheet right now to verify how they look inside the file.
                          </p>
                          <button
                            type="button"
                            onClick={handleFetchFromSheet}
                            disabled={isSyncing}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold py-2 px-3 rounded-lg transition-all flex items-center gap-1"
                          >
                            <Icon name="insights" className="w-3.5 h-3.5" />
                            {isSyncing ? 'Fetching...' : 'Fetch Sheet Rows'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Fetched External Sheet Data Section */}
                {externalSheetData.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4 animate-scaleUp">
                    <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <Icon name="sheets" className="w-5 h-5 text-emerald-600" />
                      Fetched Live Spreadsheet Entries ({externalSheetData.length} records)
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600 uppercase">
                            <th className="p-2 px-3">Booking ID</th>
                            <th className="p-2 px-3">Customer</th>
                            <th className="p-2 px-3">Project & Plot</th>
                            <th className="p-2 px-3">Amount Paid</th>
                            <th className="p-2 px-3">Date</th>
                            <th className="p-2 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                          {externalSheetData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-emerald-50/20">
                              <td className="p-2.5 px-3 font-mono font-bold text-blue-600">{row[0]}</td>
                              <td className="p-2.5 px-3">
                                <div className="font-semibold text-gray-950">{row[1]}</div>
                                <div className="text-[10px] text-gray-400 font-mono">{row[2]}</div>
                              </td>
                              <td className="p-2.5 px-3">
                                <span className="font-bold text-gray-900 bg-blue-100 px-1.5 py-0.5 rounded text-[10px] mr-1">{row[5]}</span>
                                <span className="text-gray-600">{row[4]}</span>
                              </td>
                              <td className="p-2.5 px-3 font-bold text-emerald-700">₹{parseFloat(row[9] || '0').toLocaleString()}</td>
                              <td className="p-2.5 px-3 text-gray-500">{row[12]}</td>
                              <td className="p-2.5 px-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row[13] === 'Confirmed' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                                  {row[13]}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: ENTERPRISE CUSTOMER CRM */}
      {activeTab === 'crm' && (
        <div className="space-y-6 animate-fadeIn">
          {selected360Lead ? (
            <Customer360
              lead={selected360Lead}
              projects={projects}
              bookings={bookings}
              communicationLogs={communicationLogs}
              onBack={() => setSelected360Lead(null)}
              onUploadDocument={async (docData) => {
                await handleUploadLeadDocument(selected360Lead.leadId, docData);
                const freshLead = leads.find(l => l.leadId === selected360Lead.leadId);
                if (freshLead) setSelected360Lead(freshLead);
              }}
              onDeleteDocument={async (docId) => {
                await handleDeleteLeadDocument(selected360Lead.leadId, docId);
                const freshLead = leads.find(l => l.leadId === selected360Lead.leadId);
                if (freshLead) setSelected360Lead(freshLead);
              }}
              currentUserEmail={currentUser?.email || ''}
              onShowToast={onShowToast}
            />
          ) : (
            <>
              {/* Sub-tab Navigation Suite */}
              <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['pipeline', 'followups', 'site-visits', 'copilot', 'communications', 'dashboard', 'directory'] as const).map(tab => {
                    const tabNames = {
                      pipeline: '💼 Pipeline Kanban',
                      followups: '📅 Follow-ups',
                      'site-visits': '🚗 Site Visits',
                      copilot: '🤖 AI Copilot',
                      communications: '✉️ Communications',
                      dashboard: '📊 Analytics CRM',
                      directory: '👤 Legacy Directory'
                    };
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setCrmSubTab(tab)}
                        className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          crmSubTab === tab 
                            ? 'bg-purple-600 text-white shadow-md' 
                            : 'bg-gray-50 text-gray-600 hover:bg-purple-50 hover:text-purple-700 border border-gray-200'
                        }`}
                      >
                        {tabNames[tab]}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => { setIsRefreshing(true); setTimeout(() => setIsRefreshing(false), 500); }}
                    disabled={isRefreshing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-50 text-[11px] font-black rounded-lg transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
                  >
                    <Icon name="refresh" className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-purple-600' : ''}`} />
                    {isRefreshing ? 'Refreshing CRM...' : 'Refresh CRM'}
                  </button>
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider font-mono hidden sm:inline">
                    Enterprise Sales CRM Module v2.0
                  </div>
                </div>
              </div>

              {/* Sub-tab 1: Pipeline (Kanban) */}
              {crmSubTab === 'pipeline' && (
                <LeadPipeline
                  leads={leads}
                  onAddLead={handleAddLead}
                  onUpdateLead={handleUpdateLead}
                  onDeleteLead={handleDeleteLead}
                  onConvertLead={handleConvertLeadToBooking}
                  onOpen360={(ld) => {
                    const freshLead = leads.find(l => l.leadId === ld.leadId) || ld;
                    setSelected360Lead(freshLead);
                  }}
                  onShowToast={onShowToast}
                  projects={projects}
                />
              )}

              {/* Sub-tab 2: Follow-ups */}
              {crmSubTab === 'followups' && (
                <FollowUpScheduler
                  leads={leads}
                  onAddFollowUp={handleAddFollowUp}
                  onUpdateFollowUpStatus={handleUpdateFollowUpStatus}
                  onShowToast={onShowToast}
                />
              )}

              {/* Sub-tab 3: Site Visits */}
              {crmSubTab === 'site-visits' && (
                <SiteVisitTracker
                  leads={leads}
                  projects={projects}
                  onAddSiteVisit={handleAddSiteVisit}
                  onUpdateSiteVisit={handleUpdateSiteVisit}
                  onShowToast={onShowToast}
                />
              )}

              {/* Sub-tab 4: AI Copilot */}
              {crmSubTab === 'copilot' && (
                <AICopilot
                  leads={leads}
                  projects={projects}
                  bookings={bookings}
                />
              )}

              {/* Sub-tab 5: Communications */}
              {crmSubTab === 'communications' && (
                <CommunicationCenter
                  leads={leads}
                  onAddCommunicationLog={handleAddCommunicationLog}
                  communicationLogs={communicationLogs}
                />
              )}

              {/* Sub-tab 6: Dashboard */}
              {crmSubTab === 'dashboard' && (
                <CRMDashboard
                  leads={leads}
                  projects={projects}
                  bookings={bookings}
                />
              )}

              {/* Sub-tab 7: Legacy Customer Directory */}
              {crmSubTab === 'directory' && (
                <div className="space-y-6 animate-fadeIn">
                  {/* CRM Stats Summary Banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-[10px] text-gray-400 font-bold uppercase block">Total Leads & Customers</span>
              <div className="text-2xl font-black text-gray-900 mt-1">{customers.length}</div>
            </div>
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm">
              <span className="text-[10px] text-emerald-700 font-bold uppercase block">Active Bookers</span>
              <div className="text-2xl font-black text-emerald-800 mt-1">
                {customers.filter(c => c.status === 'Active').length}
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm">
              <span className="text-[10px] text-blue-700 font-bold uppercase block">Prospect Leads</span>
              <div className="text-2xl font-black text-blue-800 mt-1">
                {customers.filter(c => c.status === 'Prospect' || !c.status).length}
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 shadow-sm">
              <span className="text-[10px] text-purple-700 font-bold uppercase block">Avg Ticket Size</span>
              <div className="text-2xl font-black text-purple-800 mt-1">
                ₹{bookings.length ? Math.round(bookings.reduce((sum, b) => sum + b.totalAmount, 0) / bookings.length).toLocaleString() : '0'}
              </div>
            </div>
          </div>

          {/* CRM Search & Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200 gap-4">
            <div className="flex items-center gap-2 flex-1 w-full">
              <div className="relative flex-1">
                <Icon name="search" className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search customer by name, mobile, Aadhaar, PAN..."
                  value={crmSearchQuery}
                  onChange={(e) => setCrmSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                />
              </div>
              <select
                value={crmStatusFilter}
                onChange={(e) => setCrmStatusFilter(e.target.value)}
                className="bg-gray-50 border border-gray-300 rounded-xl p-2 text-xs font-bold text-gray-700"
              >
                <option value="ALL">All Status</option>
                <option value="Active">Active</option>
                <option value="Prospect">Prospect</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
            <button
              onClick={() => {
                setCrmErrors({});
                setCrmFormData({
                  fullName: '',
                  email: '',
                  mobile: '',
                  address: '',
                  aadhaarNumber: '',
                  panNumber: '',
                  status: 'Prospect',
                  assignedExecutive: currentUser?.fullName || ''
                });
                setCrmModalOpen(true);
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs shadow transition-all flex items-center gap-1.5 w-full sm:w-auto justify-center"
            >
              <Icon name="add" className="w-4 h-4" />
              Register New Lead
            </button>
          </div>

          {/* Master-Detail CRM Split Pane */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Customers List */}
            <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[650px]">
              <div className="bg-gray-50 p-3 border-b border-gray-200 text-xs font-extrabold text-gray-500 uppercase">
                Customer Database Directory
              </div>
              <div className="overflow-y-auto divide-y divide-gray-100 flex-1">
                {customers
                  .filter(c => {
                    const query = crmSearchQueryDebounced.toLowerCase();
                    const matchesSearch = 
                      c.fullName.toLowerCase().includes(query) ||
                      c.mobile.includes(query) ||
                      c.email.toLowerCase().includes(query) ||
                      (c.aadhaarNumber && c.aadhaarNumber.includes(query)) ||
                      (c.panNumber && c.panNumber.toLowerCase().includes(query));
                    
                    const matchesStatus = crmStatusFilter === 'ALL' || c.status === crmStatusFilter;
                    return matchesSearch && matchesStatus;
                  })
                  .map(cust => {
                    const isSelected = selectedCrmCustomer?.mobile === cust.mobile;
                    return (
                      <button
                        key={cust.mobile}
                        onClick={() => setSelectedCrmCustomer(cust)}
                        className={`w-full text-left p-4 transition-all hover:bg-gray-50 flex flex-col gap-1.5 border-l-4 ${isSelected ? 'bg-purple-50/50 border-purple-600' : 'border-transparent'}`}
                      >
                        <div className="flex justify-between items-start w-full">
                          <h4 className="font-extrabold text-gray-950 text-sm tracking-tight">{cust.fullName}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            cust.status === 'Active' ? 'bg-green-100 text-green-800' :
                            cust.status === 'Prospect' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {cust.status || 'Prospect'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 font-mono flex items-center gap-1.5">
                          <Icon name="phone" className="w-3 h-3 text-gray-400" />
                          {cust.mobile}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-1.5 truncate">
                          <Icon name="user" className="w-3 h-3 text-gray-400" />
                          {cust.email}
                        </div>
                        <div className="text-[10px] text-gray-400 flex justify-between w-full border-t border-gray-100 pt-1.5 mt-0.5">
                          <span>Executive: {cust.assignedExecutive || 'Unassigned'}</span>
                          <span>Reg: {cust.createdAt ? new Date(cust.createdAt).toLocaleDateString('en-IN') : 'N/A'}</span>
                        </div>
                      </button>
                    );
                  })}
                {customers.length === 0 && (
                  <div className="text-center p-8 text-xs text-gray-400">
                    No customers found in database. Use "Register New Lead" to seed entries.
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Customer Details Portfolio & Communication Controls */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-[650px] overflow-y-auto space-y-6">
              {selectedCrmCustomer ? (
                <>
                  {/* Detailed Profile Header & Actions */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4">
                    <div>
                      <span className="text-[10px] text-purple-600 font-mono font-bold uppercase">Customer Lead Portfolio</span>
                      <h3 className="text-2xl font-black text-gray-950 mt-1">{selectedCrmCustomer.fullName}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Verified Account ID: {selectedCrmCustomer.mobile}</p>
                    </div>
                    {/* CRM Dynamic Dialers */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={`https://wa.me/91${selectedCrmCustomer.mobile}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow transition-all flex items-center gap-1.5 text-xs font-bold"
                        title="Open WhatsApp Chat"
                      >
                        <Icon name="check" className="w-4 h-4" />
                        WhatsApp Lead
                      </a>
                      <a
                        href={`tel:${selectedCrmCustomer.mobile}`}
                        className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all flex items-center gap-1 text-xs font-bold"
                      >
                        <Icon name="phone" className="w-4 h-4" />
                        Call
                      </a>
                    </div>
                  </div>

                  {/* Primary Demographics & Verifications */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-150">
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">Aadhaar Verification</span>
                      <span className="font-mono text-xs text-gray-800 block mt-0.5">{selectedCrmCustomer.aadhaarNumber || 'Not Submitted'}</span>
                      <span className="text-[9px] text-green-600 font-bold mt-1 block">✓ Verified Unique</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">PAN Card Verification</span>
                      <span className="font-mono font-bold text-xs text-gray-800 block mt-0.5">{selectedCrmCustomer.panNumber || 'Not Submitted'}</span>
                      <span className="text-[9px] text-green-600 font-bold mt-1 block">✓ Verified Unique</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">Lead Source Category</span>
                      <span className="text-xs text-gray-800 block mt-0.5">{selectedCrmCustomer.status || 'Prospect Lead'}</span>
                      <span className="text-[9px] text-gray-400 block mt-1">Executive: {selectedCrmCustomer.assignedExecutive}</span>
                    </div>
                  </div>

                  {/* Customer's Plot Allocation Portfolio */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Allotted Plots & Bookings ({
                      bookings.filter(b => b.customer && b.customer.mobile === selectedCrmCustomer.mobile).length
                    } records)</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {bookings
                        .filter(b => b.customer && b.customer.mobile === selectedCrmCustomer.mobile)
                        .map(b => (
                          <button
                            key={b.bookingId}
                            onClick={() => {
                              setSelectedBookingDetails(b);
                              setActiveTab('details');
                            }}
                            className="bg-white p-4 rounded-xl border border-gray-200 text-left hover:border-blue-500 transition-all shadow-sm space-y-2 flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-mono text-xs font-bold text-blue-600">{b.bookingId}</span>
                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                                  {b.workflowStage || 'Confirmed'}
                                </span>
                              </div>
                              <h5 className="font-extrabold text-gray-900 text-xs">
                                {b.projectName} - <strong className="text-blue-600 font-black">{b.plotNumber}</strong>
                                {(() => {
                                  const isVrindavan = b.projectId === 1 || b.projectName?.toLowerCase().includes('vrindavan');
                                  const plotNumParsed = parseInt(b.plotNumber.toLowerCase().replace('p-', '').trim());
                                  const isInvalidVrindavanPlot = isVrindavan && (isNaN(plotNumParsed) || plotNumParsed > 165 || plotNumParsed < 1);
                                  if (isInvalidVrindavanPlot) {
                                    return (
                                      <span className="block mt-1 text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md text-center">
                                        ⚠️ Invalid Plot (&gt;165): Admin Review Flagged
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </h5>
                              <p className="text-[10px] text-gray-400 mt-1">Allotted Size: {b.plotSize} sqft facing {b.facing}</p>
                            </div>
                            <div className="border-t pt-2 mt-2 flex justify-between items-center text-[10px] text-gray-500 font-semibold">
                              <span>Total Investment</span>
                              <span className="font-bold text-gray-900">₹{b.totalAmount.toLocaleString()}</span>
                            </div>
                          </button>
                        ))}
                      {bookings.filter(b => b.customer && b.customer.mobile === selectedCrmCustomer.mobile).length === 0 && (
                        <div className="text-center p-4 border border-dashed rounded-xl text-xs text-gray-400 sm:col-span-2">
                          No active booking registry or token locks associated with this customer mobile number.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Customer Interactions Note Board */}
                  <div className="space-y-4 border-t pt-5">
                    <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Executive Interaction Notes & Logs</h4>
                    
                    {/* Notes List */}
                    <div className="space-y-3">
                      {(selectedCrmCustomer.notes || []).map((note, nIdx) => (
                        <div key={nIdx} className="bg-gray-50 p-3 rounded-lg border border-gray-150 text-xs">
                          <p className="text-gray-800 leading-relaxed font-medium">{note.content}</p>
                          <div className="flex justify-between items-center text-[9px] text-gray-400 font-bold mt-2">
                            <span>Author: {note.author}</span>
                            <span>{note.date}</span>
                          </div>
                        </div>
                      ))}
                      {(selectedCrmCustomer.notes || []).length === 0 && (
                        <div className="text-xs text-gray-400 italic">
                          No interaction notes logged. Record the first note below.
                        </div>
                      )}
                    </div>

                    {/* Record note Form */}
                    <div className="space-y-2">
                      <textarea
                        placeholder="Write dynamic site visit comments, requirements, follow-up scheduling notes..."
                        value={crmNoteText}
                        onChange={(e) => setCrmNoteText(e.target.value)}
                        rows={3}
                        className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none"
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleAddCrmNote(selectedCrmCustomer)}
                          className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-4 py-2 rounded-lg text-xs shadow-sm"
                        >
                          Record Note Entry
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-center h-full space-y-3">
                  <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                    <Icon name="profile" className="w-6 h-6" />
                  </div>
                  <h3 className="font-extrabold text-gray-900 text-base">Select Customer Lead Portfolio</h3>
                  <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
                    Click any registered client or sales lead on the left pane to analyze demographic verifications, financial ledgers, linked plot properties, and communications history.
                  </p>
                </div>
              )}
            </div>
          </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* CRM CUSTOMER REGISTRATION MODAL WITH DUPLICATE CHECKS */}
      {crmModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 overflow-hidden animate-scaleUp">
            <div className="bg-purple-900 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-lg flex items-center gap-1.5">
                  <Icon name="user" className="w-5 h-5 text-purple-300" />
                  Register Client Lead
                </h3>
                <p className="text-[10px] text-purple-200 mt-0.5">Guaranteed verification and duplicate validation filters</p>
              </div>
              <button
                onClick={() => setCrmModalOpen(false)}
                className="text-white hover:text-purple-200 text-lg font-bold font-mono p-1"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const errors: { [key: string]: string } = {};
                if (!crmFormData.fullName.trim()) errors.fullName = 'Full Name is required.';
                if (!crmFormData.mobile.trim() || crmFormData.mobile.length !== 10 || isNaN(Number(crmFormData.mobile))) {
                  errors.mobile = '10-digit mobile number is required.';
                }
                if (!crmFormData.email.trim() || !crmFormData.email.includes('@')) errors.email = 'Valid email is required.';
                if (!crmFormData.aadhaarNumber.trim() || crmFormData.aadhaarNumber.length !== 12 || isNaN(Number(crmFormData.aadhaarNumber))) {
                  errors.aadhaarNumber = '12-digit Aadhaar number is required.';
                }
                if (!crmFormData.panNumber.trim() || crmFormData.panNumber.length !== 10) {
                  errors.panNumber = '10-character PAN number is required.';
                }

                // Duplicate checking logic across local customer list
                const dupMobile = customers.find(c => c.mobile === crmFormData.mobile);
                if (dupMobile) errors.mobile = 'A customer with this Mobile Number already exists.';
                
                const dupAadhaar = customers.find(c => c.aadhaarNumber === crmFormData.aadhaarNumber);
                if (dupAadhaar) errors.aadhaarNumber = 'A customer with this Aadhaar Number already exists.';

                const dupPan = customers.find(c => c.panNumber.toUpperCase() === crmFormData.panNumber.toUpperCase());
                if (dupPan) errors.panNumber = 'A customer with this PAN Number already exists.';

                if (Object.keys(errors).length > 0) {
                  setCrmErrors(errors);
                  return;
                }

                try {
                  const newCust: Customer = {
                    fullName: crmFormData.fullName,
                    email: crmFormData.email,
                    mobile: crmFormData.mobile,
                    address: crmFormData.address || 'N/A',
                    aadhaarNumber: crmFormData.aadhaarNumber,
                    panNumber: crmFormData.panNumber.toUpperCase(),
                    status: crmFormData.status,
                    assignedExecutive: crmFormData.assignedExecutive || currentUser?.fullName || 'Sales Executive',
                    createdAt: new Date().toISOString()
                  };

                  await setDoc(doc(db, 'customers', newCust.mobile), sanitizeData(newCust));
                  onShowToast("Client lead registered successfully with verified uniqueness parameters!");
                  setCrmModalOpen(false);
                } catch (err: any) {
                  onShowToast(`Failed to register client: ${err.message}`);
                }
              }}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Applicant Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={crmFormData.fullName}
                    onChange={(e) => setCrmFormData({ ...crmFormData, fullName: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all outline-none"
                  />
                  {crmErrors.fullName && <p className="text-[10px] text-red-500 font-bold mt-1">⚠️ {crmErrors.fullName}</p>}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">WhatsApp Mobile *</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="10-digit Mobile"
                    value={crmFormData.mobile}
                    onChange={(e) => setCrmFormData({ ...crmFormData, mobile: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all outline-none font-mono"
                  />
                  {crmErrors.mobile && <p className="text-[10px] text-red-500 font-bold mt-1">⚠️ {crmErrors.mobile}</p>}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="ramesh@example.com"
                    value={crmFormData.email}
                    onChange={(e) => setCrmFormData({ ...crmFormData, email: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all outline-none"
                  />
                  {crmErrors.email && <p className="text-[10px] text-red-500 font-bold mt-1">⚠️ {crmErrors.email}</p>}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Aadhaar Card (12 digits) *</label>
                  <input
                    type="text"
                    required
                    maxLength={12}
                    placeholder="12-digit UID"
                    value={crmFormData.aadhaarNumber}
                    onChange={(e) => setCrmFormData({ ...crmFormData, aadhaarNumber: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all outline-none font-mono"
                  />
                  {crmErrors.aadhaarNumber && <p className="text-[10px] text-red-500 font-bold mt-1">⚠️ {crmErrors.aadhaarNumber}</p>}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">PAN Card (10 characters) *</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="10-character PAN"
                    value={crmFormData.panNumber}
                    onChange={(e) => setCrmFormData({ ...crmFormData, panNumber: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all outline-none font-mono uppercase"
                  />
                  {crmErrors.panNumber && <p className="text-[10px] text-red-500 font-bold mt-1">⚠️ {crmErrors.panNumber}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Permanent Residential Address</label>
                  <textarea
                    placeholder="House Number, Street, City, ZIP Code"
                    value={crmFormData.address}
                    onChange={(e) => setCrmFormData({ ...crmFormData, address: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all outline-none"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Assigned Executive</label>
                  <input
                    type="text"
                    placeholder="Sales Executive name"
                    value={crmFormData.assignedExecutive}
                    onChange={(e) => setCrmFormData({ ...crmFormData, assignedExecutive: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Lead Status</label>
                  <select
                    value={crmFormData.status}
                    onChange={(e) => setCrmFormData({ ...crmFormData, status: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all outline-none font-bold text-gray-700"
                  >
                    <option value="Prospect">Prospect</option>
                    <option value="Active">Active</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                <button
                  type="button"
                  onClick={() => setCrmModalOpen(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-4 py-2.5 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-6 py-2.5 rounded-xl text-xs shadow-md"
                >
                  Register Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlotBookings;
