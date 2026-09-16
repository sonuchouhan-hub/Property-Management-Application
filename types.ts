

export enum View {
  DASHBOARD = 'DASHBOARD',
  PROJECTS = 'PROJECTS',
  PROJECT_DETAILS = 'PROJECT_DETAILS',
  PLOT_VIEWER = 'PLOT_VIEWER',
  CALCULATORS = 'CALCULATORS',
  MAP = 'MAP',
  CONTACT = 'CONTACT',
  SAVED = 'SAVED',
  PROFILE = 'PROFILE',
  PLOT_BOOKINGS = 'PLOT_BOOKINGS',
  BOOKING_DETAILS = 'BOOKING_DETAILS',
  ADMIN_PANEL = 'ADMIN_PANEL',
  INSIGHTS = 'INSIGHTS',
}

export enum PlotStatus {
  AVAILABLE = 'Available',
  HOLD = 'Hold',
  BOOKED = 'Booked',
  SOLD = 'Sold',
  INVESTMENT = 'Investment',
  RESALE = 'For Resale',
  RESERVED = 'Reserved',
  PENDING = 'Pending',
}

export enum PlotFacing {
  NORTH = 'North',
  SOUTH = 'South',
  EAST = 'East',
  WEST = 'West',
  NORTH_EAST = 'North-East',
  NOT_CONFIGURED = 'Not Configured',
}

export enum PlotType {
  NORMAL = 'Normal',
  RESIDENTIAL = 'Residential',
  COMMERCIAL = 'Commercial',
  EWS = 'EWS',
  LIG = 'LIG',
  SR = 'SR',
}

export interface Plot {
  id: number;
  number: string;
  size: number; // in sq. ft.
  dimensions: string; // e.g., "20x50"
  facing: PlotFacing;
  status: PlotStatus;
  price: number; // in INR
  type: PlotType | string;
  isMortgaged: boolean;
  imageUrl?: string;
  width?: number;
  length?: number;
  plotSizeLabel?: string;
  category?: string;
  specialType?: string;
  remarks?: string;
  
  // Google Sheets extended info
  salesExecutive?: string;
  customerName?: string;
  bookingDate?: string;
  lastUpdated?: string;
  block?: string;

  // Relative coordinate mapping on layout image background (percentage values 0-100)
  layoutX?: number;
  layoutY?: number;
  layoutW?: number;
  layoutH?: number;
}

export interface Project {
  id: number;
  name: string;
  location: string;
  description: string;
  imageUrls: string[];
  totalPlots: number;
  availablePlots: number;
  coords: { lat: number; lng: number };
  layout: Plot[];
  plots: Plot[];
  amenities: string[];
  documents?: ProjectDocument[];
  
  // Rich Project Fields
  projectCode?: string;
  status?: string;
  propertyType?: string;
  category?: string;
  approval?: string;
  specialFeature?: string;
  plotSizes?: string;
  plotDimensions?: string;
  residentialRate?: string;
  commercialRate?: string;
  paymentOptions?: string;
  createdAt?: string;
  updatedAt?: string;
  isActive?: boolean;
  featuredProject?: boolean;
  displayOrder?: number;
  spreadsheetId?: string;
  appsScriptUrl?: string;
  nearbyAmenities?: NearbyAmenity[];
  layoutMap?: ProjectDocument;
  layoutMapImage?: string;
  coverImage?: string;
  galleryImages?: string[];
}

export interface NearbyAmenity {
  id: string;
  name: string;
  distance: string; // e.g. "7 km"
  category: string; // e.g. "Education", "Hospital", etc.
}

export interface ProjectDocument {
  id: string;
  name: string;
  type: 'brochure' | 'legal';
  size: string;
  uploadedAt: string;
  uploadedBy: string;
  url: string; // Base64 data url or URL representation
}

export interface UserProfile {
  uid?: string;
  email: string;
  fullName?: string;
  name?: string;
  mobile?: string;
  profileImage?: string; // base64 data URL or photo URL
  photoURL?: string;
  role: 'admin' | 'manager' | 'sales' | 'viewer' | 'executive' | 'user';
  approved: boolean;
  status: 'Pending Approval' | 'Approved' | 'Rejected';
  active?: boolean;
  createdAt?: string;
  lastLogin?: string;
  lastSeen?: string;
  rejectionReason?: string;
  savedProjectIds?: number[];
}

export interface HoldRequest {
  id: string;
  projectId: number;
  projectName: string;
  plotId: number;
  plotNumber: string;
  customerName: string;
  salesExecutiveName: string;
  salesExecutiveEmail: string;
  salesExecutiveUid: string;
  reason: string;
  duration: string; // e.g., "24 Hours" | "48 Hours" | "72 Hours"
  status: 'Pending Approval' | 'Approved' | 'Rejected';
  rejectionReason?: string;
  createdAt: string;
}

export type PaymentMode = 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque';

export interface Customer {
  fullName: string;
  mobile: string;
  email: string;
  address: string;
  aadhaarNumber: string;
  panNumber: string;
  status?: string; // e.g. "Prospect" | "Active" | "Closed"
  assignedExecutive?: string;
  createdAt?: string;
  notes?: { date: string; content: string; author: string }[];
}

export interface PaymentInstallment {
  installmentId: string;
  installmentNo: number; // e.g., 1, 2, 3
  amount: number;
  dueDate: string;
  paidDate?: string;
  paymentMode?: PaymentMode;
  transactionId?: string;
  receiptUrl?: string; // base64 or file placeholder
  status: 'Pending' | 'Paid' | 'Overdue';
}

export interface TimelineEvent {
  title: string;
  date: string;
  description: string;
  completed: boolean;
  userEmail?: string;
}

export interface Booking {
  bookingId: string;
  projectId: number;
  projectName: string;
  plotId: number;
  plotNumber: string;
  plotSize: number;
  facing: string;
  totalAmount: number; // Base price before discount
  discount?: number; // Discount amount in INR
  agreedAmount?: number; // final total amount: totalAmount - discount
  bookingAmount: number; // token amount paid initially
  bookingDate: string; // ISO string
  paymentMode: PaymentMode;
  transactionId: string;
  salesExecutive: string;
  salesExecutiveUid?: string;
  bookingSource: string;
  customer: Customer;
  status: 'Confirmed' | 'Pending' | 'Cancelled';
  workflowStage?: string; // Stage from the 12-stage lifecycle
  installments?: PaymentInstallment[];
  timeline: TimelineEvent[];
  holdExpiresAt?: string; // For hold expiration
}

export interface FollowUp {
  id: string;
  leadId?: string;
  leadName?: string;
  type: 'Call' | 'WhatsApp' | 'Meeting' | 'Site Visit' | 'Payment Reminder';
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  notes: string;
  status: 'Pending' | 'Completed' | 'Cancelled';
  recurring?: boolean;
  recurringInterval?: 'Daily' | 'Weekly' | 'Monthly' | 'None';
  createdAt?: string;
}

export interface SiteVisit {
  id: string;
  leadId: string;
  leadName: string;
  visitDate: string; // YYYY-MM-DD
  visitTime: string; // HH:MM
  assignedExecutive: string;
  attendance: 'Scheduled' | 'Attended' | 'No Show' | 'Cancelled';
  gpsCheckIn?: string; // "Lat: XX, Lng: YY" or address
  gpsCheckOut?: string;
  notes?: string;
  photos?: string[]; // base64 or photo labels
  rating?: number; // 1 to 5 stars
  createdAt?: string;
}

export interface DocumentRecord {
  id: string;
  name: string;
  type: 'Aadhaar' | 'PAN' | 'Booking Form' | 'Agreement' | 'Registry' | 'Receipt' | 'Photo' | 'Other';
  fileUrl: string; // base64 data url or raw url
  uploadedAt: string;
  uploadedBy: string;
}

export interface CommunicationLog {
  id: string;
  type: 'WhatsApp' | 'SMS' | 'Email';
  sender: string;
  receiver: string;
  subject?: string;
  body: string;
  timestamp: string;
  status: 'Draft' | 'Sent' | 'Failed';
}

export interface Lead {
  leadId: string;
  fullName: string;
  mobile: string;
  whatsapp: string;
  email: string;
  city: string;
  source: string; // 'Facebook' | 'Google' | 'Website' | 'Referral' | 'Walk-in' | etc.
  budget: number; // in INR
  preferredLocation: string;
  preferredPlotSize: string; // e.g. "1200 sqft"
  interestedProject: string; // Project Name or Code
  assignedExecutive: string; // Sales Executive
  priority: 'Hot' | 'Warm' | 'Cold';
  status: string; // Kanban stages: "New Lead", "Contacted", "Qualified", etc.
  createdAt: string; // ISO String
  lastContactDate?: string; // ISO String or YYYY-MM-DD
  nextFollowUpDate?: string; // YYYY-MM-DD
  notes?: { date: string; content: string; author: string }[];
  followups?: FollowUp[];
  siteVisits?: SiteVisit[];
  documents?: DocumentRecord[];
}

export interface PlotMapping {
  projectId: number;
  plotNumber: string;
  layoutX: number;
  layoutY: number;
  layoutW: number;
  layoutH: number;
}

export interface BlogPost {
  id: string;
  title: string;
  coverImage?: string;
  description: string;
  content: string;
  category: string;
  tags?: string[];
  author: string;
  authorEmail?: string;
  status: 'Draft' | 'Published';
  createdAt: string;
  updatedAt?: string;
}



