import React, { useState, useEffect, useMemo } from 'react';
import { Project, Plot, PlotStatus, PlotFacing, Booking, Customer, PaymentMode } from '../types';
import Icon from './common/Icon';

interface PlotBookingsProps {
  projects: Project[];
  onUpdateProjects: (updatedProjects: Project[]) => void;
  onAddNotification: (text: string, link?: { view: any; id: number }) => void;
  onShowToast: (msg: string) => void;
  preselectedPlot?: { projectId: number; plotId: number } | null;
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
  preselectedPlot
}) => {
  const [activeTab, setActiveTab] = useState<'plots' | 'history' | 'details' | 'reports'>('plots');
  const [bookings, setBookings] = useState<Booking[]>(getStoredBookings);

  const stats = useMemo(() => {
    let total = 0;
    let available = 0;
    let booked = 0;
    let hold = 0;
    let sold = 0;

    projects.forEach(proj => {
      proj.layout.forEach(plot => {
        total++;
        const st = plot.status.toLowerCase();
        if (st === 'available' || st === 'for resale') available++;
        else if (st === 'booked') booked++;
        else if (st === 'hold') hold++;
        else if (st === 'sold') sold++;
      });
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

  // Filters for History
  const [historySearch, setHistorySearch] = useState<string>('');
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
        const pl = proj.layout.find(l => l.id === preselectedPlot.plotId);
        if (pl && pl.status === PlotStatus.AVAILABLE) {
          setBookingModalPlot({ project: proj, plot: pl });
          setActiveTab('plots');
        }
      }
    }
  }, [preselectedPlot, projects]);

  // Sync bookings to localStorage
  const saveBookings = (newBookings: Booking[]) => {
    setBookings(newBookings);
    localStorage.setItem('dhanshri_bookings', JSON.stringify(newBookings));
  };

  // Flat list of all plots with project ref
  const allPlotsWithProject = useMemo(() => {
    const list: { project: Project; plot: Plot }[] = [];
    projects.forEach(proj => {
      proj.layout.forEach(plot => {
        list.push({ project: proj, plot });
      });
    });
    return list;
  }, [projects]);

  // Filtered plots
  const filteredPlots = useMemo(() => {
    return allPlotsWithProject.filter(({ project, plot }) => {
      const matchesProject = projectFilter === 'ALL' || project.id.toString() === projectFilter;
      const matchesStatus = statusFilter === 'ALL' || plot.status.toLowerCase() === statusFilter.toLowerCase();
      const matchesSearch = !plotSearch || plot.number.toLowerCase().includes(plotSearch.toLowerCase()) || project.name.toLowerCase().includes(plotSearch.toLowerCase());
      return matchesProject && matchesStatus && matchesSearch;
    });
  }, [allPlotsWithProject, projectFilter, statusFilter, plotSearch]);

  // Filtered History
  const filteredHistory = useMemo(() => {
    return bookings.filter(b => {
      const q = historySearch.toLowerCase();
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
  }, [bookings, historySearch, historyStatusFilter, dateFilter]);

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
        const updatedLayout = proj.layout.map(pl => {
          if (pl.id === plot.id) {
            return { ...pl, status: PlotStatus.BOOKED };
          }
          return pl;
        });
        return {
          ...proj,
          layout: updatedLayout,
          availablePlots: updatedLayout.filter(pl => pl.status === PlotStatus.AVAILABLE || pl.status === PlotStatus.RESALE).length
        };
      }
      return proj;
    });

    onUpdateProjects(updatedProjects);
    saveBookings([newBooking, ...bookings]);

    // Notifications
    onShowToast(`🎉 Plot ${plot.number} booked successfully for ${formData.fullName}!`);
    onAddNotification(`New Plot Booking: ${plot.number} in ${project.name} booked by ${formData.fullName} (ID: ${bkgId})`);

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
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'reports' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <Icon name="insights" className="w-4 h-4" />
              Reports & Inventory
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
                      <td className="py-4 px-4 text-gray-600">{plot.size} sq.ft <span className="text-xs text-gray-400">({plot.dimensions})</span></td>
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

      {/* TAB 3: BOOKING DETAILS & TIMELINE VIEW */}
      {activeTab === 'details' && selectedBookingDetails && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-200">
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
                <h2 className="text-2xl font-extrabold text-gray-900 font-mono">{selectedBookingDetails.bookingId}</h2>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setReceiptBooking(selectedBookingDetails)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-sm shadow transition-all inline-flex items-center gap-2"
              >
                <Icon name="article" className="w-4 h-4" />
                Download PDF Receipt
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Customer, Plot & Payment Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Customer Information Card */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 space-y-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b pb-3">
                  <Icon name="user" className="w-5 h-5 text-blue-600" />
                  Customer Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-gray-500">Applicant Full Name</div>
                    <div className="font-bold text-gray-900 mt-0.5">{selectedBookingDetails.customer.fullName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Mobile Number</div>
                    <div className="font-semibold text-gray-800 mt-0.5">{selectedBookingDetails.customer.mobile}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Email Address</div>
                    <div className="font-medium text-gray-800 mt-0.5">{selectedBookingDetails.customer.email}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Aadhaar Number</div>
                    <div className="font-mono text-gray-800 mt-0.5">{selectedBookingDetails.customer.aadhaarNumber}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">PAN Number</div>
                    <div className="font-mono font-bold text-gray-900 mt-0.5">{selectedBookingDetails.customer.panNumber}</div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-xs text-gray-500">Residential Address</div>
                    <div className="text-gray-800 mt-0.5">{selectedBookingDetails.customer.address}</div>
                  </div>
                </div>
              </div>

              {/* Plot & Payment Information */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 space-y-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b pb-3">
                  <Icon name="projects" className="w-5 h-5 text-blue-600" />
                  Plot & Booking Breakdown
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-gray-500">Project Name</div>
                    <div className="font-bold text-gray-900 mt-0.5">{selectedBookingDetails.projectName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Plot Number</div>
                    <div className="font-extrabold text-blue-600 mt-0.5">{selectedBookingDetails.plotNumber}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Plot Size</div>
                    <div className="font-semibold text-gray-800 mt-0.5">{selectedBookingDetails.plotSize} sq.ft</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Facing</div>
                    <div className="text-gray-800 mt-0.5">{selectedBookingDetails.facing}</div>
                  </div>
                  <div className="col-span-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="text-xs text-gray-500">Total Plot Consideration</div>
                    <div className="text-lg font-extrabold text-gray-900 mt-0.5">₹{selectedBookingDetails.totalAmount.toLocaleString()}</div>
                  </div>
                  <div className="col-span-2 bg-green-50 p-3 rounded-lg border border-green-100">
                    <div className="text-xs text-green-700 font-medium">Booking Advance Paid</div>
                    <div className="text-lg font-extrabold text-green-800 mt-0.5">₹{selectedBookingDetails.bookingAmount.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Payment Mode</div>
                    <div className="font-semibold text-gray-800 mt-0.5">{selectedBookingDetails.paymentMode}</div>
                  </div>
                  <div className="col-span-3">
                    <div className="text-xs text-gray-500">Transaction / Cheque ID</div>
                    <div className="font-mono font-bold text-gray-900 mt-0.5">{selectedBookingDetails.transactionId}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Sales Executive</div>
                    <div className="text-gray-800 mt-0.5">{selectedBookingDetails.salesExecutive}</div>
                  </div>
                  <div className="col-span-3">
                    <div className="text-xs text-gray-500">Booking Source</div>
                    <div className="text-gray-800 mt-0.5">{selectedBookingDetails.bookingSource}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Col: Booking Status Timeline */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 h-fit space-y-6">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b pb-3">
                <Icon name="clock" className="w-5 h-5 text-blue-600" />
                Booking Status Timeline
              </h3>
              <div className="relative pl-6 border-l-2 border-blue-100 space-y-8">
                {selectedBookingDetails.timeline.map((step, idx) => (
                  <div key={idx} className="relative group">
                    <span className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center transition-all ${step.completed ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300'}`}>
                      {step.completed && <Icon name="check" className="w-2.5 h-2.5" />}
                    </span>
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className={`text-sm font-bold ${step.completed ? 'text-gray-900' : 'text-gray-500'}`}>{step.title}</h4>
                        <span className="text-[11px] font-mono font-semibold text-gray-400">{step.date}</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{step.description}</p>
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

              {/* Section 1: Plot Details (Auto-filled Readonly) */}
              <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100">
                <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-3">Selected Plot Specification (Auto-filled)</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
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
                    <div className="font-semibold text-gray-800 text-sm mt-0.5">{bookingModalPlot.plot.size} sq.ft ({bookingModalPlot.plot.dimensions})</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Total Price</span>
                    <div className="font-extrabold text-green-700 text-sm mt-0.5">₹{bookingModalPlot.plot.price.toLocaleString()}</div>
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
      {activeTab === 'reports' && (
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
                    const total = proj.layout.length;
                    const avail = proj.layout.filter(p => p.status.toLowerCase() === 'available' || p.status.toLowerCase() === 'for resale').length;
                    const bkd = proj.layout.filter(p => p.status.toLowerCase() === 'booked').length;
                    const hld = proj.layout.filter(p => p.status.toLowerCase() === 'hold').length;
                    const sld = proj.layout.filter(p => p.status.toLowerCase() === 'sold').length;
                    const val = proj.layout.reduce((acc, p) => acc + p.price, 0);
                    return (
                      <tr key={proj.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="py-4 px-4 font-bold text-gray-900">{proj.name}</td>
                        <td className="py-4 px-4 font-semibold">{total}</td>
                        <td className="py-4 px-4 text-green-600 font-bold">{avail}</td>
                        <td className="py-4 px-4 text-blue-600 font-bold">{bkd}</td>
                        <td className="py-4 px-4 text-amber-600 font-bold">{hld}</td>
                        <td className="py-4 px-4 text-purple-600 font-bold">{sld}</td>
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
    </div>
  );
};

export default PlotBookings;
