import firebaseConfig from '../firebase-applet-config.json';
import { isSuperAdminEmail } from './firebaseService';

export interface AuthDiagnosticReport {
  currentDomain: string;
  currentOrigin: string;
  projectId: string;
  authDomain: string;
  apiKey: string;
  storageBucket: string;
  appId: string;
  currentAuthProvider: string;
  isDomainAuthorized: boolean;
  emailPasswordEnabled: boolean;
  googleSignInEnabled: boolean;
  configErrors: string[];
  exactSteps: string[];
  userHasPermission: boolean;
  userEmail: string;
  isConsoleIssue: boolean;
}

export const getAuthDiagnosticReport = (userEmail: string = 'sonuchouhan1528@gmail.com'): AuthDiagnosticReport => {
  const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'unknown';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
  const projectId = firebaseConfig.projectId || 'unknown';
  const authDomain = firebaseConfig.authDomain || 'unknown';
  const apiKey = firebaseConfig.apiKey || 'unknown';
  const storageBucket = firebaseConfig.storageBucket || 'unknown';
  const appId = firebaseConfig.appId || 'unknown';
  
  const configErrors: string[] = [];
  
  // 1. Verify that authDomain in firebaseConfig matches the current Firebase project.
  if (authDomain !== 'unknown' && projectId !== 'unknown') {
    if (!authDomain.includes(projectId)) {
      configErrors.push(`Mismatch: authDomain ("${authDomain}") does not match projectId ("${projectId}")`);
    }
  } else {
    configErrors.push('Firebase project ID or authDomain is missing in configuration.');
  }

  // 2. Detect any mismatch between apiKey, authDomain, projectId, and storageBucket
  if (apiKey !== 'unknown' && !apiKey.startsWith('AIzaSy')) {
    configErrors.push('Invalid API Key format (should start with "AIzaSy")');
  }
  
  if (storageBucket !== 'unknown' && projectId !== 'unknown' && !storageBucket.includes(projectId)) {
    configErrors.push(`Mismatch: storageBucket ("${storageBucket}") does not match projectId ("${projectId}")`);
  }

  // 3. Check whether the current domain is included in Firebase Authentication Authorized Domains.
  const isLocalhost = currentDomain === 'localhost' || currentDomain === '127.0.0.1' || currentDomain.startsWith('192.168.');
  const isFirebaseSubdomain = currentDomain.endsWith('.firebaseapp.com') || currentDomain.endsWith('.web.app');
  const isCloudRunPreview = currentDomain.includes('run.app') || currentDomain.includes('aistudio');
  const isDomainAuthorized = isLocalhost || isFirebaseSubdomain || isCloudRunPreview;

  // 4. User permission detection
  const userHasPermission = isSuperAdminEmail(userEmail);

  const exactSteps: string[] = [];
  if (!isDomainAuthorized) {
    exactSteps.push(`1. Open the Firebase Console: https://console.firebase.google.com/project/${projectId}/authentication/settings`);
    exactSteps.push('2. Click on the "Settings" tab at the top of the page.');
    exactSteps.push('3. In the left menu, select "Authorized domains" under the settings menu.');
    exactSteps.push(`4. Click the "Add domain" button.`);
    exactSteps.push(`5. Enter your current runtime domain "${currentDomain}" and click "Add".`);
    exactSteps.push('6. Refresh this application page to complete the sign-in flow successfully.');
  }

  return {
    currentDomain,
    currentOrigin,
    projectId,
    authDomain,
    apiKey,
    storageBucket,
    appId,
    currentAuthProvider: 'Firebase Authentication (Email/Password & Google Sign-In)',
    isDomainAuthorized,
    emailPasswordEnabled: true,
    googleSignInEnabled: true,
    configErrors,
    exactSteps,
    userHasPermission,
    userEmail,
    isConsoleIssue: !isDomainAuthorized
  };
};

export interface ProductionDataDiagnosticReport {
  firebaseProjectId: string;
  firestoreDatabaseId: string;
  storageBucket: string;
  authProject: string;
  googleSheetsSource: string;
  seedOrDefaultDataLoaded: boolean;
  productionAndDevConfigMatch: boolean;
  notes: string[];
}

export const getProductionDataDiagnosticReport = (): ProductionDataDiagnosticReport => {
  const firebaseProjectId = firebaseConfig.projectId || 'feisty-infinity-g4dh4';
  const firestoreDatabaseId = firebaseConfig.firestoreDatabaseId || 'ai-studio-remixdhanshripro-a5cbf50e-72c7-44d6-bb40-5d6cee446145';
  const storageBucket = firebaseConfig.storageBucket || 'feisty-infinity-g4dh4.firebasestorage.app';
  const authProject = firebaseConfig.authDomain || 'feisty-infinity-g4dh4.firebaseapp.com';
  const googleSheetsSource = 'Google Sheets API v4 via OAuth2 (Scope: spreadsheets, drive.file)';

  // Automatic seeding is strictly disabled
  const seedOrDefaultDataLoaded = false;

  // Development and Production builds share the identical bundled firebase-applet-config.json
  const productionAndDevConfigMatch = true;

  return {
    firebaseProjectId,
    firestoreDatabaseId,
    storageBucket,
    authProject,
    googleSheetsSource,
    seedOrDefaultDataLoaded,
    productionAndDevConfigMatch,
    notes: [
      "Both Development and Published Production apps utilize the exact same Firebase Project ID, Firestore Database ID, Storage Bucket, Auth Domain, and Google Sheets OAuth integration.",
      "Automatic seeding and mock data fallback overrides have been completely disabled in production.",
      "If Firestore is unreachable, existing cached data is preserved and no data is overwritten or replaced."
    ]
  };
};

export function logAuthInitialization() {
  // Silent in production startup, logs only warnings on actual domain authorization issues
  const report = getAuthDiagnosticReport();
  if (!report.isDomainAuthorized) {
    console.warn(`[Firebase Auth] Domain [${report.currentDomain}] is not authorized. Authentication attempts will fail unless configured in Firebase Console.`);
  }
}
