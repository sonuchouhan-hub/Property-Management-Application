import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { Booking } from '../types';
import { auth } from './firebaseService';

// Configure Google Auth Provider with Google Sheets and Drive scopes
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/drive');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize the Auth state listener on app load
export const initGoogleAuth = (
  onAuthSuccess: (user: User, token: string) => void,
  onAuthFailure: () => void
) => {
  // Load token from memory/session if available or wait for listener
  const storedToken = sessionStorage.getItem('dhanshri_g_token');
  if (storedToken) {
    cachedAccessToken = storedToken;
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        sessionStorage.removeItem('dhanshri_g_token');
        onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      sessionStorage.removeItem('dhanshri_g_token');
      onAuthFailure();
    }
  });
};

// Sign in with Google Popup
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google Auth Provider');
    }

    cachedAccessToken = credential.accessToken;
    sessionStorage.setItem('dhanshri_g_token', cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Get current access token
export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken) {
    cachedAccessToken = sessionStorage.getItem('dhanshri_g_token');
  }
  return cachedAccessToken;
};

// Sign out from Google
export const googleSignOut = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  sessionStorage.removeItem('dhanshri_g_token');
};

/**
 * --- Google Sheets API Functions ---
 */

const HEADERS = [
  "Booking ID",
  "Customer Name",
  "Mobile",
  "Email",
  "Project Name",
  "Plot Number",
  "Plot Size (sqft)",
  "Facing",
  "Total Price (INR)",
  "Booking Amount (INR)",
  "Payment Mode",
  "Transaction ID",
  "Booking Date",
  "Status"
];

// Helper to format booking object into a row array
const formatBookingToRow = (b: Booking) => {
  return [
    b.bookingId,
    b.customer.fullName,
    b.customer.mobile,
    b.customer.email,
    b.projectName,
    b.plotNumber,
    b.plotSize,
    b.facing,
    b.totalAmount,
    b.bookingAmount,
    b.paymentMode,
    b.transactionId,
    new Date(b.bookingDate).toLocaleDateString('en-GB'),
    b.status
  ];
};

// Create a new Google Spreadsheet
export const createBookingSheet = async (accessToken: string, title: string): Promise<string> => {
  try {
    const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title: title
        },
        sheets: [
          {
            properties: {
              title: 'Bookings',
              gridProperties: {
                frozenRowCount: 1
              }
            }
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to create spreadsheet');
    }

    const data = await response.json();
    const spreadsheetId = data.spreadsheetId;

    // Initialize spreadsheet header columns
    await updateSheetValues(accessToken, spreadsheetId, 'Bookings!A1:N1', [HEADERS]);

    return spreadsheetId;
  } catch (error) {
    console.error('Error in createBookingSheet:', error);
    throw error;
  }
};

// Update/write exact values to a range in spreadsheet
export const updateSheetValues = async (
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: any[][]
): Promise<any> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to update sheet values');
  }

  return response.json();
};

// Sync full bookings list to Google Sheet (Overwrites entire content to stay clean)
export const syncBookingsToSheet = async (
  accessToken: string,
  spreadsheetId: string,
  bookings: Booking[]
): Promise<void> => {
  try {
    const rows = [
      HEADERS,
      ...bookings.map(formatBookingToRow)
    ];

    // Clear existing data first by updating range with empty cells or just overwrite starting from A1
    // A standard sheet has sufficient rows, so we can write A1:N followed by number of rows + 1
    const range = `Bookings!A1:N${rows.length + 10}`;
    
    // First, let's fetch current size to clear if needed, or simply overwrite the range A1:N
    // To make it super robust, we can clear the values first
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Bookings!A1:Z500:clear`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    // Write new values
    await updateSheetValues(accessToken, spreadsheetId, 'Bookings!A1', rows);
  } catch (error) {
    console.error('Error in syncBookingsToSheet:', error);
    throw error;
  }
};

// Append a single booking to the spreadsheet in real-time
export const appendBookingToSheet = async (
  accessToken: string,
  spreadsheetId: string,
  booking: Booking
): Promise<void> => {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Bookings!A1:append?valueInputOption=USER_ENTERED`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [formatBookingToRow(booking)]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to append booking to sheet');
    }
  } catch (error) {
    console.error('Error in appendBookingToSheet:', error);
    throw error;
  }
};

// Fetch values from Sheet
export const fetchBookingsFromSheet = async (
  accessToken: string,
  spreadsheetId: string
): Promise<any[][]> => {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Bookings!A2:N500`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to fetch spreadsheet values');
    }

    const data = await response.json();
    return data.values || [];
  } catch (error) {
    console.error('Error in fetchBookingsFromSheet:', error);
    throw error;
  }
};
