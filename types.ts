

export enum View {
  DASHBOARD = 'DASHBOARD',
  PROJECTS = 'PROJECTS',
  PROJECT_DETAILS = 'PROJECT_DETAILS',
  PLOT_VIEWER = 'PLOT_VIEWER',
  INSIGHTS = 'INSIGHTS',
  CALCULATORS = 'CALCULATORS',
  MAP = 'MAP',
  CONTACT = 'CONTACT',
  SAVED = 'SAVED',
  PROFILE = 'PROFILE',
  ARTICLE_DETAILS = 'ARTICLE_DETAILS',
  NOTIFICATIONS = 'NOTIFICATIONS',
  PLOT_BOOKINGS = 'PLOT_BOOKINGS',
  BOOKING_DETAILS = 'BOOKING_DETAILS',
}

export enum PlotStatus {
  AVAILABLE = 'Available',
  HOLD = 'Hold',
  BOOKED = 'Booked',
  SOLD = 'Sold',
  INVESTMENT = 'Investment',
  RESALE = 'For Resale',
}

export enum PlotFacing {
  NORTH = 'North',
  SOUTH = 'South',
  EAST = 'East',
  WEST = 'West',
  NORTH_EAST = 'North-East',
}

export enum PlotType {
  EWA = 'EWA', // Economically Weaker Section
  LIG = 'LIG', // Low Income Group
  NORMAL = 'Normal',
}

export interface Plot {
  id: number;
  number: string;
  size: number; // in sq. ft.
  dimensions: string; // e.g., "20x50"
  facing: PlotFacing;
  status: PlotStatus;
  price: number; // in INR
  type: PlotType;
  isMortgaged: boolean;
  imageUrl?: string;
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
  amenities: string[];
}

export interface Article {
  id: number;
  title: string;
  summary: string;
  imageUrl: string;
  category: string;
}

export interface UserProfile {
  email: string;
  mobile?: string;
  profileImage?: string; // base64 data URL
}

export interface AppNotification {
  id: number;
  text: string;
  timestamp: string; // ISO string for easy storage
  read: boolean;
  link?: {
    view: View;
    id: number; // project or article ID
  };
}

export type PaymentMode = 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque';

export interface Customer {
  fullName: string;
  mobile: string;
  email: string;
  address: string;
  aadhaarNumber: string;
  panNumber: string;
}

export interface Booking {
  bookingId: string;
  projectId: number;
  projectName: string;
  plotId: number;
  plotNumber: string;
  plotSize: number;
  facing: string;
  totalAmount: number;
  bookingAmount: number;
  bookingDate: string; // ISO string
  paymentMode: PaymentMode;
  transactionId: string;
  salesExecutive: string;
  bookingSource: string;
  customer: Customer;
  status: 'Confirmed' | 'Pending' | 'Cancelled';
  timeline: { title: string; date: string; description: string; completed: boolean }[];
}
