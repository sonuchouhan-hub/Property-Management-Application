import { auth, db, registerProfileGetter, registerProfileStatusGetter, BYPASS_ADMIN_APPROVAL_FOR_DEV, ENABLE_DEV_AUTH } from './firebaseService';
import { doc, getDoc } from 'firebase/firestore';
import { isSuperAdminEmail } from './firebaseService';
import { UserProfile } from '../types';

export type ProfileLoadingState = 'unauthenticated' | 'loading' | 'loaded' | 'error' | 'missing';

let cachedProfile: UserProfile | null = null;
let profileState: ProfileLoadingState = 'unauthenticated';
let lastError: string | null = null;

registerProfileGetter(() => cachedProfile);

registerProfileStatusGetter(() => {
  if (ENABLE_DEV_AUTH) {
    return {
      roleReason: 'admin',
      statusReason: 'Approved'
    };
  }
  const user = auth.currentUser;
  if (!user) {
    console.log("[UserStatusService] Status evaluation requested: Unauthenticated.");
    return {
      roleReason: 'none (User Unauthenticated)',
      statusReason: 'none (User Unauthenticated)'
    };
  }
  if (BYPASS_ADMIN_APPROVAL_FOR_DEV) {
    return {
      roleReason: 'admin',
      statusReason: 'Approved'
    };
  }
  if (profileState === 'loading') {
    console.log("[UserStatusService] Status evaluation requested: Profile loading is still pending.");
    return {
      roleReason: 'pending (Profile loading in progress)',
      statusReason: 'pending (Profile loading in progress)'
    };
  }
  if (profileState === 'error') {
    console.log(`[UserStatusService] Status evaluation requested: Profile load error present. Error: ${lastError || 'unknown'}`);
    return {
      roleReason: `failed (Error loading profile: ${lastError || 'unknown'})`,
      statusReason: `failed (Error loading profile: ${lastError || 'unknown'})`
    };
  }
  if (profileState === 'missing') {
    console.log("[UserStatusService] Status evaluation requested: Profile document is missing in Firestore.");
    return {
      roleReason: 'failed (User document missing in Firestore)',
      statusReason: 'failed (User document missing in Firestore)'
    };
  }
  
  console.log("[UserStatusService] Status evaluation requested: Profile fully loaded.", {
    uid: user.uid,
    role: cachedProfile?.role,
    status: cachedProfile?.status,
    profileState
  });

  return {
    roleReason: cachedProfile?.role || 'none (Field empty)',
    statusReason: cachedProfile?.status || 'none (Field empty)'
  };
});

export const UserStatusService = {
  /**
   * Cache the current user's profile for quick authorization checks.
   */
  setProfile(profile: UserProfile | null) {
    cachedProfile = profile;
    if (profile) {
      profileState = 'loaded';
      lastError = null;
    } else {
      profileState = auth.currentUser ? 'loading' : 'unauthenticated';
    }
  },

  setProfileState(state: ProfileLoadingState, errorMsg?: string) {
    profileState = state;
    if (errorMsg) {
      lastError = errorMsg;
    } else {
      lastError = null;
    }
  },

  getProfileState(): { state: ProfileLoadingState; error: string | null } {
    return { state: profileState, error: lastError };
  },

  /**
   * Get the currently cached user profile.
   */
  getProfile(): UserProfile | null {
    return cachedProfile;
  },

  /**
   * Verifies if a user is approved to perform a write operation on the given path.
   * Acts as a central guard for Firestore writes.
   * Throws an error if permission is denied.
   */
  async verifyWritePermission(path: string, opType: string): Promise<boolean> {
    if (ENABLE_DEV_AUTH) {
      return true;
    }
    const user = auth.currentUser;
    
    if (BYPASS_ADMIN_APPROVAL_FOR_DEV) {
      if (user) {
        return true;
      }
    }
    
    // User profile registration/setup during initial signup must be permitted.
    const isSelfProfile = user && (path === `users/${user.uid}` || path.startsWith(`users/${user.uid}/`));
    
    if (isSelfProfile) {
      // Allow initial signup, status/role setup
      return true;
    }

    if (!user) {
      const errorMsg = `Authentication required: Blocked ${opType} on ${path} because no user is logged in.`;
      console.warn(`[UserStatusService] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const email = user.email;
    const isSpecificAdmin = isSuperAdminEmail(email);

    // Admin-only paths MUST require Super Admin identity
    const isAdminOnlyPath = path.startsWith('projects/') || 
                            path.startsWith('blogs/') || 
                            path.startsWith('plot_mappings/') || 
                            path.startsWith('leads/') || 
                            path.startsWith('customers/');

    if (isAdminOnlyPath) {
      if (!isSpecificAdmin) {
        const errorMsg = `Access Denied: Only Super Admins are permitted to modify ${path}.`;
        console.warn(`[UserStatusService] ${errorMsg}`);
        throw new Error(errorMsg);
      }
      return true;
    }

    let profile = cachedProfile;
    let role = profile?.role;
    let status = profile?.status;

    // Fallback: If cache is empty or doesn't match current user, query Firestore directly
    if (!profile || profile.uid !== user.uid) {
      try {
        const docSnap = await getDoc(doc(db, 'users', user.uid));
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          role = data.role;
          status = data.status;
        }
      } catch (e: any) {
        console.warn(`[UserStatusService] Could not fetch user profile from Firestore: ${e.message}`);
      }
    }

    // Administrator is permitted if they are the designated admin
    if (isSpecificAdmin) {
      return true;
    }

    const finalStatus = status || 'Approved';

    if (finalStatus === 'Approved') {
      return true;
    }

    const errorMsg = `Permission Denied: Your account status is currently "${finalStatus}". Only approved users can perform operations.`;
    console.warn(`[UserStatusService] Denied ${opType} on ${path}. Status: ${finalStatus}`);
    throw new Error(errorMsg);
  }
};
