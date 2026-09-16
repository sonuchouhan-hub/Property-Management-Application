import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  setLogLevel,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
setLogLevel('silent');
export const auth = getAuth();

export const BYPASS_ADMIN_APPROVAL_FOR_DEV = false; // Dev bypass disabled for strict role-based access control
export const ENABLE_DEV_AUTH = false; // Firebase Authentication is active

export const SUPER_ADMIN_EMAILS = [
  'aiconsultdhanshri@gmail.com',
  'pnkalra20@gmail.com',
  'sc.dhanshri@gmail.com',
  'sonuchouhan1528@gmail.com',
  'sonuchouhan@gmail.com'
];

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

// ============================================================================
// 🛡️ DIRECT & SIMPLIFIED FIRESTORE SDK CALLS (Online-only CRM)
// ============================================================================

// ============================================================================
// 🛡️ DIRECT & SIMPLIFIED FIRESTORE SDK CALLS (Online-only CRM) with Global Caching
// ============================================================================

const docCache = new Map<string, any>();
const docsCache = new Map<string, any>();

/**
 * Safely generates a unique query string key from a Firestore Query or CollectionReference.
 */
function getQueryKey(q: any): string {
  if (!q) return 'empty';
  if (typeof q.path === 'string') {
    return q.path;
  }

  try {
    let path = 'unknown';
    if (q._query && q._query.path && q._query.path.segments) {
      path = q._query.path.segments.join('/');
    } else if (q.path) {
      path = typeof q.path === 'function' ? q.path() : String(q.path);
    }

    const parts: string[] = [path];
    const filters = q._query?.filters || q._query?.explicitFilters || [];
    for (const f of filters) {
      const fieldPath = f.field?.segments?.join('.') || f.field?.toString() || '';
      const op = f.op || f.operator || '==';
      let val = '';
      if (f.value) {
        if (typeof f.value === 'object') {
          val = f.value.internalValue !== undefined ? String(f.value.internalValue) : (f.value.stringValue || JSON.stringify(f.value));
        } else {
          val = String(f.value);
        }
      }
      parts.push(`${fieldPath}:${op}:${val}`);
    }
    return parts.join('|');
  } catch (err) {
    console.warn("[Cache Key Generator] Fallback key generation used:", err);
    return 'query_fallback_' + String(q?.path || 'unknown');
  }
}

/**
 * Automatically invalidates any document or query cache matching the modified collection.
 */
function invalidateCollectionCache(collectionName: string) {
  if (!collectionName) return;
  console.log(`[Cache Invalidation] Invalidation triggered for collection: ${collectionName}`);
  
  // Clear matching queries
  for (const key of docsCache.keys()) {
    if (key === collectionName || key.startsWith(collectionName + '/') || key.startsWith(collectionName + '|')) {
      docsCache.delete(key);
    }
  }

  // Clear matching single documents
  for (const key of docCache.keys()) {
    if (key.startsWith(collectionName + '/')) {
      docCache.delete(key);
    }
  }
}

/**
 * Completely clears all cache maps manually (e.g. on full reload)
 */
export function clearFirestoreCache() {
  docCache.clear();
  docsCache.clear();
  console.log("[Cache] All Firestore cache records have been cleared.");
}

export async function trackedGetDoc(docRef: any, ...args: any[]): Promise<any> {
  const force = args[0] === true;
  const path = docRef.path;
  const collectionName = path ? path.split('/')[0] : '';

  if (force) {
    console.log(`[Cache] Forced refresh requested for doc path: ${path}`);
    invalidateCollectionCache(collectionName);
  } else if (docCache.has(path)) {
    console.log(`[Cache] Cache hit for doc path: ${path}`);
    return docCache.get(path);
  }

  try {
    const result = await getDoc(docRef);
    docCache.set(path, result);
    return result;
  } catch (err: any) {
    handleFirestoreError(err, OperationType.GET, docRef.path);
    if (docCache.has(path)) {
      console.warn(`[Quota/Offline Fallback] Returning cached document snapshot for ${path}`);
      return docCache.get(path);
    }
    // Return safe empty document snapshot on quota/network error so caller doesn't break
    return {
      exists: () => false,
      data: () => null,
      id: docRef.id || 'unknown'
    };
  }
}

export async function trackedGetDocs(q: any, ...args: any[]): Promise<any> {
  const force = args[0] === true;
  const key = getQueryKey(q);
  const collectionName = key.split('|')[0].split('/')[0];

  if (force) {
    console.log(`[Cache] Forced refresh requested for query key: ${key}`);
    invalidateCollectionCache(collectionName);
  } else if (docsCache.has(key)) {
    console.log(`[Cache] Cache hit for query key: ${key}`);
    return docsCache.get(key);
  }

  try {
    const result = await getDocs(q);
    docsCache.set(key, result);
    return result;
  } catch (err: any) {
    const path = q.path || 'query';
    handleFirestoreError(err, OperationType.GET, path);
    if (docsCache.has(key)) {
      console.warn(`[Quota/Offline Fallback] Returning cached query snapshot for ${key}`);
      return docsCache.get(key);
    }
    // Return safe empty query snapshot on quota/network error so caller doesn't break
    return {
      empty: true,
      docs: [],
      forEach: () => {},
      size: 0
    };
  }
}

export async function trackedSetDoc(docRef: any, data: any, ...args: any[]): Promise<void> {
  const path = docRef.path;
  const collectionName = path ? path.split('/')[0] : '';
  invalidateCollectionCache(collectionName);

  try {
    const options = args[0];
    await setDoc(docRef, data, options);
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, docRef.path);
    throw err;
  }
}

export async function trackedUpdateDoc(docRef: any, data: any, ...args: any[]): Promise<void> {
  const path = docRef.path;
  const collectionName = path ? path.split('/')[0] : '';
  invalidateCollectionCache(collectionName);

  try {
    await updateDoc(docRef, data);
  } catch (err: any) {
    handleFirestoreError(err, OperationType.UPDATE, docRef.path);
    throw err;
  }
}

export async function trackedDeleteDoc(docRef: any, ...args: any[]): Promise<void> {
  const path = docRef.path;
  const collectionName = path ? path.split('/')[0] : '';
  invalidateCollectionCache(collectionName);

  try {
    await deleteDoc(docRef);
  } catch (err: any) {
    handleFirestoreError(err, OperationType.DELETE, docRef.path);
    throw err;
  }
}

export async function trackedAddDoc(colRef: any, data: any, ...args: any[]): Promise<any> {
  const path = colRef.path;
  const collectionName = path ? path.split('/')[0] : '';
  invalidateCollectionCache(collectionName);

  try {
    return await addDoc(colRef, data);
  } catch (err: any) {
    handleFirestoreError(err, OperationType.CREATE, colRef.path);
    throw err;
  }
}

export async function trackedBatchWrite(updates: { docRef: any; data: any; operation: 'set' | 'update' | 'delete' }[]): Promise<void> {
  if (updates.length === 0) return;

  // Invalidate any affected collections before starting write
  const affectedCollections = new Set<string>();
  updates.forEach(({ docRef }) => {
    if (docRef && docRef.path) {
      affectedCollections.add(docRef.path.split('/')[0]);
    }
  });
  affectedCollections.forEach(col => invalidateCollectionCache(col));

  const batch = writeBatch(db);
  updates.forEach(({ docRef, data, operation }) => {
    if (operation === 'set') {
      batch.set(docRef, data);
    } else if (operation === 'update') {
      batch.update(docRef, data);
    } else if (operation === 'delete') {
      batch.delete(docRef);
    }
  });

  try {
    await batch.commit();
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, 'batch_write');
    throw err;
  }
}

let getProfileFn: (() => any) | null = null;
let getProfileStatusFn: (() => { roleReason: string; statusReason: string }) | null = null;

export function registerProfileGetter(fn: () => any) {
  getProfileFn = fn;
}

export function registerProfileStatusGetter(fn: () => { roleReason: string; statusReason: string }) {
  getProfileStatusFn = fn;
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function sanitizeData<T>(obj: T): T {
  if (obj === undefined) {
    return null as any;
  }
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeData(item)) as any;
  }
  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      if (val !== undefined) {
        result[key] = sanitizeData(val);
      }
    }
  }
  return result;
}

export function handleFirestoreError(error: any, operationType: OperationType, path: string | null, shouldThrow: boolean = false): void {
  const code = error?.code || 'unknown-code';
  const message = error?.message || String(error);
  const stack = error?.stack || new Error().stack;

  // Extract collection and document ID from path
  let collectionName = 'unknown';
  let docId = 'unknown';
  if (path) {
    const parts = path.split('/');
    collectionName = parts[0] || 'unknown';
    docId = parts.slice(1).join('/') || 'all';
  }

  const profile = getProfileFn ? getProfileFn() : null;
  const statusSummary = getProfileStatusFn ? getProfileStatusFn() : { roleReason: 'none', statusReason: 'none' };
  const loadedRole = profile?.role || statusSummary.roleReason;
  const loadedStatus = profile?.status || statusSummary.statusReason;
  const uid = auth.currentUser?.uid || 'unauthenticated';
  const email = auth.currentUser?.email || 'none';

  // Evaluate the exact failing rule based on path and operation type
  let evaluatedFailingRule = 'Unknown (Matches general deny-all safety net)';
  if (path) {
    if (path.startsWith('users/')) {
      evaluatedFailingRule = "match /users/{userId} -> isOwner(userId) || isAdmin()";
    } else if (path.startsWith('projects/')) {
      evaluatedFailingRule = "match /projects/{projectId} -> isApprovedUser() && isAdmin()";
    } else if (path.startsWith('bookings/')) {
      evaluatedFailingRule = "match /bookings/{bookingId} -> isApprovedUser() && isValidBooking(incoming())";
    } else if (path.startsWith('hold_requests/')) {
      evaluatedFailingRule = "match /hold_requests/{requestId} -> isApprovedUser() && isValidHoldRequest(incoming())";
    } else if (path.startsWith('blogs/')) {
      evaluatedFailingRule = "match /blogs/{blogId} -> isApprovedUser() && isValidBlog(incoming())";
    }
  }

  const isEmailAdmin = isSuperAdminEmail(email);
  const evaluation = {
    isSpecificAdmin: isEmailAdmin || uid === 'RUM0lhuJ7qWxJyPFKWarsKArW0P2',
    hasAdminRole: loadedRole === 'admin',
    isApproved: loadedStatus === 'Approved',
    passedLocalGuard: loadedStatus === 'Approved' || ((isEmailAdmin || uid === 'RUM0lhuJ7qWxJyPFKWarsKArW0P2') && loadedRole === 'admin')
  };

  const errInfo = {
    diagnosticTimestamp: new Date().toISOString(),
    operation: {
      type: operationType,
      path: path,
      collection: collectionName,
      documentId: docId
    },
    authContext: {
      authenticatedUid: uid,
      authenticatedEmail: email,
      loadedRole: loadedRole,
      loadedStatus: loadedStatus
    },
    permissionEvaluation: evaluation,
    databaseInvariants: {
      exactFailingRulePattern: evaluatedFailingRule,
      error_code: code,
      error_message: message,
      error_stack: stack
    }
  };

  if (code === 'resource-exhausted' || message.includes('Quota limit exceeded')) {
    console.warn(`[Firestore Quota Warning] ${message}`);
  } else if (code === 'unavailable' || message.includes('Could not reach Cloud Firestore backend')) {
    console.warn(`[Firestore Connection Notice] ${message}. Firestore client will automatically retry or operate with local cache.`);
  } else {
    console.error('=================== FIRESTORE ERROR DIAGNOSTIC ===================');
    console.error(JSON.stringify(errInfo, null, 2));
    console.error('==================================================================');
  }

  if (shouldThrow) {
    const customErr = new Error(message) as any;
    customErr.code = code;
    customErr.errInfo = errInfo;
    throw customErr;
  }
}
