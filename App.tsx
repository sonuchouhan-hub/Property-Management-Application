
import React, { useState, useEffect, useRef } from 'react';
import { View, Project, Plot, UserProfile, PlotStatus, PlotFacing, PlotType } from './types';
import { 
  MOCK_PROJECTS, 
  getOfficialLocation, 
  applyMaaGinniViharOfficialSizes, 
  applyVrindavanDreamCityOfficialSizes, 
  applyShriKeshvamCorridorOfficialSizes, 
  applyDivineParkOfficialSizes, 
  applyMaaGinniViharExtensionOfficialSizes, 
  applyMaaGinniParkOfficialSizes, 
  applyShantiViharOfficialSizes, 
  applyRedwoodPlatinumOfficialSizes,
  applyRedwoodPlatinumExtensionOfficialSizes, 
  applyShrinathDreamCityOfficialSizes, 
  applyMeeraGovindParkOfficialSizes,
  applyShivajiParkOfficialSizes,
  applyMeeraValleyOfficialSizes,
  getOfficialTotalPlots, 
  standardizeProjectPlots 
} from './constants';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Dashboard from './components/Dashboard';
import ProjectList from './components/ProjectList';
import ProjectDetails from './components/ProjectDetails';
import PlotViewer from './components/PlotViewer';
import Calculators from './components/Calculators';
import MapView from './components/MapView';
import Contact from './components/Contact';
import SplashScreen from './components/SplashScreen';
import Icon from './components/common/Icon';
import ProfileView from './components/ProfileView';
import PlotBookings from './components/PlotBookings';
import AdminPanel from './components/AdminPanel';
import PropertyInsights from './components/PropertyInsights';

import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider 
} from 'firebase/auth';
import { 
  doc, 
  collection, 
  onSnapshot
} from 'firebase/firestore';
import { 
  auth, 
  db, 
  handleFirestoreError, 
  OperationType,
  sanitizeData,
  trackedGetDoc as getDoc,
  trackedSetDoc as setDoc,
  trackedDeleteDoc as deleteDoc,
  trackedGetDocs as getDocs,
  BYPASS_ADMIN_APPROVAL_FOR_DEV,
  ENABLE_DEV_AUTH,
  isSuperAdminEmail
} from './services/firebaseService';
import { runFirestorePlotMetadataMigration } from './services/metadataMigrationService';
import { UserStatusService } from './services/userStatusService';


// To allow future re-enabling of automatic database seeding and admin background synchronization, set these to true.
const ENABLE_AUTO_SEEDING_PROJECTS = false;
const ENABLE_ADMIN_AUTO_SYNC_PROJECTS = false;

const cleanProject = (p: Project): Project => {
  if (!p) return p;

  // If the project already has an explicit layout or plots array with existing plots, preserve them exactly!
  const hasExistingPlots = (p.plots && p.plots.length > 0) || (p.layout && p.layout.length > 0);
  if (hasExistingPlots) {
    const plotsList = (p.plots && p.plots.length > 0) ? p.plots : (p.layout || []);
    return {
      ...p,
      layout: plotsList,
      plots: plotsList,
      totalPlots: plotsList.length,
      availablePlots: plotsList.filter(
        plot => plot.status === PlotStatus.AVAILABLE || plot.status === PlotStatus.RESALE
      ).length,
    };
  }

  const standardized = standardizeProjectPlots(p);
  return applyVrindavanDreamCityOfficialSizes(
    applyMaaGinniViharOfficialSizes(
      applyDivineParkOfficialSizes(
        applyMaaGinniViharExtensionOfficialSizes(
          applyMaaGinniParkOfficialSizes(
            applyShantiViharOfficialSizes(
              applyRedwoodPlatinumOfficialSizes(
                applyRedwoodPlatinumExtensionOfficialSizes(
                  applyShrinathDreamCityOfficialSizes(
                    applyMeeraGovindParkOfficialSizes(
                      applyShivajiParkOfficialSizes(
                        applyShriKeshvamCorridorOfficialSizes(
                          applyMeeraValleyOfficialSizes(standardized)
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
    )
  );
};

const normalizeProjectPlots = (p: Project, generatePlotsArray: boolean = false): Project => {
  if (!p) return p;

  // Source of Truth: If project already has plots from Firestore or user edits,
  // NEVER slice, truncate, reset, or overwrite them!
  const existingPlots = (p.plots && p.plots.length > 0) ? p.plots : (p.layout && p.layout.length > 0 ? p.layout : []);
  if (existingPlots.length > 0) {
    const availableCount = existingPlots.filter(
      plot => plot.status === PlotStatus.AVAILABLE || plot.status === PlotStatus.RESALE
    ).length;
    return {
      ...p,
      layout: existingPlots,
      plots: existingPlots,
      totalPlots: existingPlots.length,
      availablePlots: availableCount,
    };
  }

  const cleanedProj = cleanProject(p);
  const targetCount = cleanedProj.totalPlots !== undefined && cleanedProj.totalPlots > 0 ? cleanedProj.totalPlots : getOfficialTotalPlots(cleanedProj.name);
  
  let layout: Plot[] = [];
  const mockProj = MOCK_PROJECTS.find(m => m.id === cleanedProj.id || m.name.toLowerCase().trim() === cleanedProj.name.toLowerCase().trim());
  
  let officialLayout = cleanedProj.plots && cleanedProj.plots.length > 0 
    ? [...cleanedProj.plots] 
    : cleanedProj.layout && cleanedProj.layout.length > 0 
      ? [...cleanedProj.layout] 
      : mockProj 
        ? [...mockProj.plots] 
        : [];

  if (officialLayout.length === 0) {
    const diff = targetCount;
    for (let i = 1; i <= diff; i++) {
      officialLayout.push({
        id: (cleanedProj.id * 1000) + i,
        number: `P-${String(i).padStart(3, '0')}`,
        size: 0,
        dimensions: 'Not Configured',
        facing: PlotFacing.NOT_CONFIGURED,
        status: PlotStatus.SOLD,
        type: 'Not Configured',
        price: 0,
        isMortgaged: false,
      });
    }
  }

  layout = officialLayout.map(plot => {
    let num = plot.number;
    const match = num.match(/^P-(\d+)$/i);
    if (match) {
      num = `P-${String(match[1]).padStart(3, '0')}`;
    }

    let status = plot.status;
    if (!status) {
      status = PlotStatus.SOLD;
    }

    return {
      ...plot,
      number: num,
      status,
    };
  });

  const availableCount = layout.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length;
  const actualTotalPlots = layout.length > 0 ? layout.length : targetCount;

  return {
    ...cleanedProj,
    layout: layout,
    plots: layout,
    totalPlots: actualTotalPlots,
    availablePlots: availableCount,
  };
};

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const hasFetchedProjects = useRef(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [viewHistory, setViewHistory] = useState<View[]>([View.DASHBOARD]);
  const [selectedProjectState, setSelectedProjectState] = useState<Project | null>(null);
  const selectedProject = selectedProjectState ? {
    ...normalizeProjectPlots(selectedProjectState, true),
    location: getOfficialLocation(selectedProjectState.name)
  } : null;
  const setSelectedProject = (val: Project | null | ((prev: Project | null) => Project | null)) => {
    setSelectedProjectState(prev => {
      const res = typeof val === 'function' ? val(prev) : val;
      if (!res) return null;
      return {
        ...normalizeProjectPlots(res, true),
        location: getOfficialLocation(res.name)
      };
    });
  };
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [contactFormPrefill, setContactFormPrefill] = useState<{ projectName: string; plotNumber: string; } | null>(null);

  const PROJECTS_CACHE_VERSION = '1.0.6';

  const DELETED_PROJECT_IDS = [2, 8, 12];
  const isDeletedProject = (proj: any): boolean => {
    if (!proj) return true;
    const pId = Number(proj.id || proj.projectId);
    if (!isNaN(pId) && DELETED_PROJECT_IDS.includes(pId)) return true;
    const name = (proj.name || proj.projectName || proj.project_name || (proj.project && proj.project.name) || proj.interestedProject || '').toLowerCase().trim();
    return (
      name.includes('shivaji') ||
      name.includes('keshvam') ||
      name.includes('redwood premium')
    );
  };

  const safeCacheProjectsData = (data: Project[]) => {
    if (typeof window === 'undefined') return;
    const payload = {
      version: PROJECTS_CACHE_VERSION,
      updatedAt: new Date().toISOString(),
      data
    };
    try {
      localStorage.setItem('dhanshri_cached_projects', JSON.stringify(payload));
    } catch {
      try {
        const lightweightData = data.map(p => ({
          ...p,
          layoutMapImage: undefined
        }));
        localStorage.setItem('dhanshri_cached_projects', JSON.stringify({ ...payload, data: lightweightData }));
      } catch {}
    }
  };

  const [projectsState, setProjectsState] = useState<Project[]>(() => {
    try {
      const cachedRaw = localStorage.getItem('dhanshri_cached_projects');
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw);
        if (parsed && parsed.version === PROJECTS_CACHE_VERSION && Array.isArray(parsed.data)) {
          const list = parsed.data as Project[];
          return list
            .filter(p => !isDeletedProject(p))
            .map(p => normalizeProjectPlots(p, false))
            .map(p => ({ ...p, location: getOfficialLocation(p.name) }));
        }
      }
      return MOCK_PROJECTS
        .filter(p => !isDeletedProject(p))
        .map(p => normalizeProjectPlots(p, false))
        .map(p => ({ ...p, location: getOfficialLocation(p.name) }));
    } catch {
      return MOCK_PROJECTS
        .filter(p => !isDeletedProject(p))
        .map(p => normalizeProjectPlots(p, false))
        .map(p => ({ ...p, location: getOfficialLocation(p.name) }));
    }
  });
  const projects = projectsState;
  const setProjects = (val: Project[] | ((prev: Project[]) => Project[])) => {
    setProjectsState(prev => {
      const list = typeof val === 'function' ? val(prev) : val;
      const filtered = list.filter(p => !isDeletedProject(p));
      const mapped = filtered.map(p => normalizeProjectPlots(p, false));
      const res = mapped.map(p => ({ ...p, location: getOfficialLocation(p.name) }));
      safeCacheProjectsData(res);
      return res;
    });
  };
  const [savedProjectIds, setSavedProjectIds] = useState<number[]>([]);

  const currentView = viewHistory[viewHistory.length - 1];

  // Keep UserStatusService synchronized with the current React user state
  useEffect(() => {
    UserStatusService.setProfile(currentUser);
  }, [currentUser]);

  // Run database plot metadata migration once
  useEffect(() => {
    runFirestorePlotMetadataMigration();
  }, []);

  // --- App Initialization & Verification ---
  useEffect(() => {
    if (ENABLE_DEV_AUTH) {
      const cachedProfileStr = localStorage.getItem('dhanshri_local_profile_dev-admin');
      let devProfile: UserProfile;
      if (cachedProfileStr) {
        try {
          devProfile = JSON.parse(cachedProfileStr);
        } catch {
          devProfile = {
            uid: "dev-admin",
            name: "Development Admin",
            fullName: "Development Admin",
            email: "admin@localhost",
            mobile: "",
            role: "admin",
            status: "Approved",
            approved: true,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            savedProjectIds: []
          };
        }
      } else {
        devProfile = {
          uid: "dev-admin",
          name: "Development Admin",
          fullName: "Development Admin",
          email: "admin@localhost",
          mobile: "",
          role: "admin",
          status: "Approved",
          approved: true,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          savedProjectIds: []
        };
      }
      devProfile.lastLogin = new Date().toISOString();
      devProfile.lastSeen = new Date().toISOString();
      localStorage.setItem('dhanshri_local_profile_dev-admin', JSON.stringify(devProfile));

      UserStatusService.setProfile(devProfile);
      setCurrentUser(devProfile);
      setSavedProjectIds(devProfile.savedProjectIds || []);
      setIsAdmin(true);
      setLoading(false);
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const isSpecificAdmin = isSuperAdminEmail(user.email);
          const nowIso = new Date().toISOString();
          
          let userProfile: UserProfile & { savedProjectIds?: number[] };
          
          if (BYPASS_ADMIN_APPROVAL_FOR_DEV) {
            // Under bypass mode, we completely skip Firestore reads and updates for the user profile.
            // All authenticated users are dynamically granted immediate access with local administrator status.
            const cachedProfileStr = localStorage.getItem(`dhanshri_local_profile_${user.uid}`);
            if (cachedProfileStr) {
              try {
                userProfile = JSON.parse(cachedProfileStr);
              } catch {
                userProfile = {} as any;
              }
            } else {
              userProfile = {} as any;
            }
            
            userProfile.uid = user.uid;
            userProfile.email = user.email || userProfile.email || '';
            userProfile.mobile = user.phoneNumber || userProfile.mobile || '';
            userProfile.profileImage = user.photoURL || userProfile.profileImage || '';
            userProfile.photoURL = user.photoURL || userProfile.photoURL || '';
            userProfile.name = user.displayName || userProfile.name || user.email?.split('@')[0] || 'User';
            userProfile.fullName = user.displayName || userProfile.fullName || user.email?.split('@')[0] || 'User';
            userProfile.role = isSpecificAdmin ? 'admin' : 'user';
            userProfile.approved = true;
            userProfile.status = 'Approved';
            userProfile.createdAt = userProfile.createdAt || nowIso;
            userProfile.lastLogin = nowIso;
            userProfile.lastSeen = nowIso;
            userProfile.savedProjectIds = userProfile.savedProjectIds || [];
            
            localStorage.setItem(`dhanshri_local_profile_${user.uid}`, JSON.stringify(userProfile));
          } else {
            // Get the real profile document from Firestore to enforce secure auth
            try {
              const docRef = doc(db, 'users', user.uid);
              const docSnap = await getDoc(docRef);
              
              if (docSnap && docSnap.exists()) {
                userProfile = docSnap.data() as any;
                userProfile.uid = user.uid;
                
                if (isSpecificAdmin) {
                  userProfile.role = 'admin';
                  userProfile.approved = true;
                  userProfile.status = 'Approved';
                  userProfile.active = true;
                  if (docSnap.data()?.role !== 'admin' || !docSnap.data()?.active) {
                    try {
                      await setDoc(docRef, sanitizeData({ ...userProfile, role: 'admin', active: true, approved: true, status: 'Approved' }), { merge: true });
                    } catch (updErr) {
                      console.warn("[Auth Flow] Could not update existing user to admin in Firestore:", updErr);
                    }
                  }
                } else {
                  userProfile.role = userProfile.role || 'user';
                  userProfile.approved = true;
                  userProfile.status = 'Approved';
                  userProfile.active = userProfile.active !== undefined ? userProfile.active : true;
                }
              } else {
                // First time registration setup if the user document is not found (e.g. initial Google login)
                userProfile = {
                  uid: user.uid,
                  email: user.email || '',
                  mobile: user.phoneNumber || '',
                  profileImage: user.photoURL || '',
                  photoURL: user.photoURL || '',
                  name: user.displayName || user.email?.split('@')[0] || '',
                  fullName: user.displayName || user.email?.split('@')[0] || '',
                  role: isSpecificAdmin ? 'admin' : 'user',
                  approved: true,
                  status: 'Approved',
                  active: true,
                  createdAt: nowIso,
                  lastLogin: nowIso,
                  lastSeen: nowIso,
                  savedProjectIds: []
                };
                try {
                  await setDoc(docRef, sanitizeData(userProfile));
                } catch (setErr) {
                  console.warn("[Auth Flow] Could not save user document to Firestore (quota or offline):", setErr);
                }
              }
              userProfile.lastSeen = nowIso;
            } catch (getDocErr: any) {
              console.warn("[Auth Flow] Could not fetch profile document from Firestore (quota or offline), creating fallback profile:", getDocErr);
              const cachedProfileStr = localStorage.getItem(`dhanshri_local_profile_${user.uid}`);
              let fallbackProfile: any = {};
              if (cachedProfileStr) {
                try { fallbackProfile = JSON.parse(cachedProfileStr); } catch {}
              }
              userProfile = {
                uid: user.uid,
                email: user.email || fallbackProfile.email || '',
                mobile: user.phoneNumber || fallbackProfile.mobile || '',
                profileImage: user.photoURL || fallbackProfile.profileImage || '',
                photoURL: user.photoURL || fallbackProfile.photoURL || '',
                name: user.displayName || fallbackProfile.name || user.email?.split('@')[0] || 'User',
                fullName: user.displayName || fallbackProfile.fullName || user.email?.split('@')[0] || 'User',
                role: isSpecificAdmin ? 'admin' : 'user',
                approved: true,
                status: 'Approved',
                createdAt: fallbackProfile.createdAt || nowIso,
                lastLogin: nowIso,
                lastSeen: nowIso,
                savedProjectIds: fallbackProfile.savedProjectIds || []
              };
            }
          }
          
          localStorage.setItem(`dhanshri_local_profile_${user.uid}`, JSON.stringify(userProfile));
          UserStatusService.setProfile(userProfile);
          setCurrentUser(userProfile);
          setSavedProjectIds(userProfile.savedProjectIds || []);
          setIsAdmin(isSpecificAdmin);
          setLoading(false);
        } catch (error: any) {
          console.error("Profile load failed:", error);
          setLoading(false);
        }
      } else {
        UserStatusService.setProfile(null);
        setCurrentUser(null);
        setSavedProjectIds([]);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Live Real-Time User Profile Synchronization ---
  useEffect(() => {
    if (!currentUser?.uid) return;

    let unsubUser: (() => void) | null = null;
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      unsubUser = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const liveProfile = docSnap.data() as UserProfile;
          liveProfile.uid = currentUser.uid;
          setCurrentUser(prev => prev ? ({ ...prev, ...liveProfile }) : liveProfile);
          const isSuper = isSuperAdminEmail(liveProfile.email);
          setIsAdmin(isSuper || liveProfile.role === 'admin');
          if (liveProfile.savedProjectIds) {
            setSavedProjectIds(liveProfile.savedProjectIds);
          }
        }
      }, (error) => {
        console.warn('[Firestore Realtime User Sync] Error or offline:', error);
      });
    } catch (err) {
      console.warn('[Firestore Realtime User Sync] Setup error:', err);
    }

    return () => {
      if (unsubUser) unsubUser();
    };
  }, [currentUser?.uid]);

  // --- Single Source of Truth Live Real-Time Project Synchronization ---
  useEffect(() => {
    if (loading) return;

    console.log(`[Firestore Realtime Sync] Subscribing to live 'projects' collection...`);
    let unsub: (() => void) | null = null;

    try {
      const projectsColRef = collection(db, 'projects');
      unsub = onSnapshot(projectsColRef, (snapshot) => {
        if (!snapshot.empty) {
          const list: Project[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Project;
            const plots = (data.plots && data.plots.length > 0) ? data.plots : (data.layout && data.layout.length > 0 ? data.layout : []);
            list.push({
              ...data,
              layout: plots,
              plots: plots,
              totalPlots: plots.length > 0 ? plots.length : (data.totalPlots || 0),
              availablePlots: plots.length > 0 
                ? plots.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length 
                : (data.availablePlots || 0),
              location: getOfficialLocation(data.name)
            });
          });
          list.sort((a, b) => a.id - b.id);

          setProjects(list);

          // Update active selected project state if open so modal/details reflect changes in real time
          setSelectedProject((prevSelected) => {
            if (!prevSelected) return prevSelected;
            const updated = list.find(p => p.id === prevSelected.id);
            return updated || prevSelected;
          });

          // Store live data in local cache for offline fallback
          safeCacheProjectsData(list);

          console.log(`[Firestore Realtime Sync] Real-time sync complete: ${list.length} live projects updated.`);
        } else {
          console.warn("[Firestore Realtime Sync] Firestore 'projects' collection is empty.");
        }
      }, (error) => {
        console.warn("[Firestore Realtime Sync] Firestore project subscription error/offline:", error);
        // Fallback to offline cache if network fails
        try {
          const cachedRaw = localStorage.getItem('dhanshri_cached_projects');
          if (cachedRaw) {
            const parsed = JSON.parse(cachedRaw);
            if (parsed && Array.isArray(parsed.data) && parsed.data.length > 0) {
              setProjects(parsed.data);
              console.warn("Database offline. Displaying cached property records.");
            }
          }
        } catch {}
      });
    } catch (err) {
      console.error("[Firestore Realtime Sync] Failed to attach project snapshot listener:", err);
    }

    return () => {
      if (unsub) {
        unsub();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // --- Auth Handlers ---
  const handleRegister = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    if (ENABLE_DEV_AUTH) {
      const nowIso = new Date().toISOString();
      const userProfile: UserProfile = {
        uid: "dev-admin",
        name: "Development Admin",
        fullName: "Development Admin",
        email: email,
        mobile: '',
        profileImage: '',
        role: 'admin',
        approved: true,
        status: 'Approved',
        createdAt: nowIso,
        lastLogin: nowIso,
        lastSeen: nowIso,
        savedProjectIds: []
      };
      localStorage.setItem('dhanshri_local_profile_dev-admin', JSON.stringify(userProfile));
      setCurrentUser(userProfile);
      setSavedProjectIds([]);
      setIsAdmin(true);
      return { success: true, message: 'Registration successful (Development Mode)!' };
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      const nowIso = new Date().toISOString();
      let userProfile: UserProfile;

      if (BYPASS_ADMIN_APPROVAL_FOR_DEV) {
        userProfile = {
          uid: user.uid,
          email: user.email || email,
          mobile: '',
          profileImage: '',
          name: email.split('@')[0],
          fullName: email.split('@')[0],
          role: 'admin',
          approved: true,
          status: 'Approved',
          createdAt: nowIso,
          lastLogin: nowIso,
          lastSeen: nowIso,
          savedProjectIds: []
        };
        localStorage.setItem(`dhanshri_local_profile_${user.uid}`, JSON.stringify(userProfile));
      } else {
        const isSpecificAdmin = isSuperAdminEmail(user.email);
        userProfile = {
          uid: user.uid,
          email: user.email || email,
          mobile: '',
          profileImage: '',
          name: email.split('@')[0],
          fullName: email.split('@')[0],
          role: isSpecificAdmin ? 'admin' : 'user',
          approved: true,
          status: 'Approved',
          active: true,
          createdAt: nowIso,
          lastLogin: nowIso,
          lastSeen: nowIso,
          savedProjectIds: []
        };
        await setDoc(doc(db, 'users', user.uid), sanitizeData(userProfile));
      }
      
      setCurrentUser(userProfile);
      return { success: true, message: 'Registration successful! Welcome to User Panel.' };
    } catch (error: any) {
      console.error("[Auth Flow - Register Error]", error);
      const isUnauthorized = error.code === 'auth/unauthorized-domain' || 
                             error.message?.toLowerCase().includes('unauthorized-domain') || 
                             error.message?.toLowerCase().includes('unauthorized domain') ||
                             error.message?.toLowerCase().includes('configuration') ||
                             error.message?.toLowerCase().includes('network-request-failed');
      if (isUnauthorized) {
        return { 
          success: false, 
          message: 'Google Sign-In is unavailable on this deployment.\n\nThis deployment domain is not authorized in Firebase Authentication.\n\nPlease use an authorized domain or contact the administrator.' 
        };
      }
      return { success: false, message: error.message || 'Registration failed.' };
    }
  };

  const handleLogin = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    if (ENABLE_DEV_AUTH) {
      const nowIso = new Date().toISOString();
      const userProfile: UserProfile = {
        uid: "dev-admin",
        name: "Development Admin",
        fullName: "Development Admin",
        email: email || "admin@localhost",
        mobile: '',
        profileImage: '',
        role: 'admin',
        approved: true,
        status: 'Approved',
        createdAt: nowIso,
        lastLogin: nowIso,
        lastSeen: nowIso,
        savedProjectIds: []
      };
      localStorage.setItem('dhanshri_local_profile_dev-admin', JSON.stringify(userProfile));
      setCurrentUser(userProfile);
      setSavedProjectIds([]);
      setIsAdmin(true);
      return { success: true, message: 'Login successful (Development Mode)!' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const isSandboxBypassCreds = isSuperAdminEmail(cleanEmail) && password === 'Sonu@1528';

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      let userProfile: UserProfile;
      const nowIso = new Date().toISOString();

      if (BYPASS_ADMIN_APPROVAL_FOR_DEV) {
        const cachedProfileStr = localStorage.getItem(`dhanshri_local_profile_${user.uid}`);
        if (cachedProfileStr) {
          try {
            userProfile = JSON.parse(cachedProfileStr);
          } catch {
            userProfile = {} as any;
          }
        } else {
          userProfile = {} as any;
        }

        userProfile.uid = user.uid;
        userProfile.email = user.email || email;
        userProfile.mobile = user.phoneNumber || userProfile.mobile || '';
        userProfile.profileImage = user.photoURL || userProfile.profileImage || '';
        userProfile.name = user.displayName || userProfile.name || email.split('@')[0];
        userProfile.fullName = user.displayName || userProfile.fullName || email.split('@')[0];
        userProfile.role = 'admin';
        userProfile.approved = true;
        userProfile.status = 'Approved';
        userProfile.createdAt = userProfile.createdAt || nowIso;
        userProfile.lastLogin = nowIso;
        userProfile.lastSeen = nowIso;
        userProfile.savedProjectIds = userProfile.savedProjectIds || [];

        localStorage.setItem(`dhanshri_local_profile_${user.uid}`, JSON.stringify(userProfile));
      } else {
        const docRef = doc(db, 'users', user.uid);
        let docSnap: any = null;
        try {
          docSnap = await getDoc(docRef);
        } catch (getDocErr: any) {
          console.warn("[Auth Flow] Login getDoc failed, using fallback profile generation:", getDocErr);
        }
        const isSpecificAdmin = isSuperAdminEmail(user.email);
        
        if (docSnap && docSnap.exists()) {
          userProfile = docSnap.data() as UserProfile;
          userProfile.uid = user.uid;
          userProfile.lastLogin = nowIso;
          userProfile.lastSeen = nowIso;
          if (isSpecificAdmin) {
            userProfile.role = 'admin';
            userProfile.approved = true;
            userProfile.status = 'Approved';
            userProfile.active = true;
            try {
              await setDoc(docRef, sanitizeData({ ...userProfile, role: 'admin', active: true, approved: true, status: 'Approved' }), { merge: true });
            } catch (updErr) {
              console.warn("[Auth Flow] Failed to update user to admin:", updErr);
            }
          } else {
            userProfile.role = userProfile.role || 'user';
            userProfile.approved = true;
            userProfile.status = 'Approved';
            userProfile.active = userProfile.active !== undefined ? userProfile.active : true;
          }
          console.log("[Auth Flow] Existing user profile loaded during login.");
        } else {
          userProfile = {
            uid: user.uid,
            email: user.email || email,
            mobile: '',
            profileImage: '',
            name: email.split('@')[0],
            fullName: email.split('@')[0],
            role: isSpecificAdmin ? 'admin' : 'user',
            approved: true,
            status: 'Approved',
            active: true,
            createdAt: nowIso,
            lastLogin: nowIso,
            lastSeen: nowIso,
            savedProjectIds: []
          };
          await setDoc(docRef, sanitizeData(userProfile));
        }
      }
      setCurrentUser(userProfile);
      return { success: true, message: 'Login successful!' };
    } catch (error: any) {
      console.error("[Auth Flow - Login Error]", error);

      // Bulletproof fallback: if the credentials are the specific admin sandbox credentials,
      // log them in as a local sandbox admin immediately.
      if (isSandboxBypassCreds) {
        console.log("[Auth Flow] Logging in via Sandbox admin credentials bypass.");
        const nowIso = new Date().toISOString();
        const sandboxProfile: UserProfile = {
          uid: 'sandbox-admin-uid-1528',
          email: cleanEmail,
          mobile: '+91 99999 15280',
          profileImage: '',
          name: 'Sonu Chouhan (Admin Sandbox)',
          fullName: 'Sonu Chouhan',
          role: 'admin',
          approved: true,
          status: 'Approved',
          createdAt: nowIso,
          lastLogin: nowIso,
          lastSeen: nowIso,
          savedProjectIds: [],
          isLocalSandbox: true
        } as any;
        setCurrentUser(sandboxProfile);
        return { success: true, message: 'Welcome to Sandbox Admin Mode! Signed in successfully.' };
      }

      const isUnauthorized = error.code === 'auth/unauthorized-domain' || 
                             error.message?.toLowerCase().includes('unauthorized-domain') || 
                             error.message?.toLowerCase().includes('unauthorized domain') ||
                             error.message?.toLowerCase().includes('configuration') ||
                             error.message?.toLowerCase().includes('network-request-failed');
      if (isUnauthorized) {
        return { 
          success: false, 
          message: 'Google Sign-In is unavailable on this deployment.\n\nThis deployment domain is not authorized in Firebase Authentication.\n\nPlease use an authorized domain or contact the administrator.' 
        };
      }
      return { success: false, message: error.message || 'Invalid email or password.' };
    }
  };

  const handleGoogleLogin = async (): Promise<{ success: boolean; message: string }> => {
    if (ENABLE_DEV_AUTH) {
      const nowIso = new Date().toISOString();
      const devProfile: UserProfile = {
        uid: "dev-admin",
        name: "Development Admin",
        fullName: "Development Admin",
        email: "admin@localhost",
        mobile: "",
        profileImage: "",
        role: "admin",
        status: "Approved",
        approved: true,
        createdAt: nowIso,
        lastLogin: nowIso,
        lastSeen: nowIso,
        savedProjectIds: []
      };
      localStorage.setItem('dhanshri_local_profile_dev-admin', JSON.stringify(devProfile));
      setCurrentUser(devProfile);
      setSavedProjectIds([]);
      setIsAdmin(true);
      return { success: true, message: 'Signed in as Development Admin (Development Mode)!' };
    }

    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      
      let userProfile: UserProfile;
      const nowIso = new Date().toISOString();

      if (BYPASS_ADMIN_APPROVAL_FOR_DEV) {
        const cachedProfileStr = localStorage.getItem(`dhanshri_local_profile_${user.uid}`);
        if (cachedProfileStr) {
          try {
            userProfile = JSON.parse(cachedProfileStr);
          } catch {
            userProfile = {} as any;
          }
        } else {
          userProfile = {} as any;
        }

        userProfile.uid = user.uid;
        userProfile.email = user.email || '';
        userProfile.mobile = user.phoneNumber || userProfile.mobile || '';
        userProfile.profileImage = user.photoURL || userProfile.profileImage || '';
        userProfile.photoURL = user.photoURL || userProfile.photoURL || '';
        userProfile.name = user.displayName || userProfile.name || user.email?.split('@')[0] || '';
        userProfile.fullName = user.displayName || userProfile.fullName || user.email?.split('@')[0] || '';
        userProfile.role = 'admin';
        userProfile.approved = true;
        userProfile.status = 'Approved';
        userProfile.createdAt = userProfile.createdAt || nowIso;
        userProfile.lastLogin = nowIso;
        userProfile.lastSeen = nowIso;
        userProfile.savedProjectIds = userProfile.savedProjectIds || [];

        localStorage.setItem(`dhanshri_local_profile_${user.uid}`, JSON.stringify(userProfile));
      } else {
        const docRef = doc(db, 'users', user.uid);
        let docSnap: any = null;
        try {
          docSnap = await getDoc(docRef);
        } catch (getDocErr: any) {
          console.warn("[Auth Flow] Google Login getDoc failed, using fallback profile generation:", getDocErr);
        }
        const isSpecificAdmin = isSuperAdminEmail(user.email);
        
        if (docSnap && docSnap.exists()) {
          userProfile = docSnap.data() as UserProfile;
          userProfile.uid = user.uid;
          userProfile.lastLogin = nowIso;
          userProfile.lastSeen = nowIso;
          if (isSpecificAdmin) {
            userProfile.role = 'admin';
            userProfile.approved = true;
            userProfile.status = 'Approved';
            userProfile.active = true;
            try {
              await setDoc(docRef, sanitizeData({ ...userProfile, role: 'admin', active: true, approved: true, status: 'Approved' }), { merge: true });
            } catch (updErr) {
              console.warn("[Auth Flow] Failed to update Google user to admin:", updErr);
            }
          } else {
            userProfile.role = userProfile.role || 'user';
            userProfile.approved = true;
            userProfile.status = 'Approved';
            userProfile.active = userProfile.active !== undefined ? userProfile.active : true;
          }
          console.log("[Auth Flow] Existing user profile loaded during Google login.");
        } else {
          userProfile = {
            uid: user.uid,
            email: user.email || '',
            mobile: user.phoneNumber || '',
            profileImage: user.photoURL || '',
            photoURL: user.photoURL || '',
            name: user.displayName || user.email?.split('@')[0] || '',
            fullName: user.displayName || user.email?.split('@')[0] || '',
            role: isSpecificAdmin ? 'admin' : 'user',
            approved: true,
            status: 'Approved',
            active: true,
            createdAt: nowIso,
            lastLogin: nowIso,
            lastSeen: nowIso,
            savedProjectIds: []
          };
          await setDoc(docRef, sanitizeData(userProfile));
        }
      }
      setCurrentUser(userProfile);
      return { success: true, message: 'Google Sign-In successful!' };
    } catch (error: any) {
      console.error("[Auth Flow - Google Login Error]", error);
      const isUnauthorized = error.code === 'auth/unauthorized-domain' || 
                             error.message?.toLowerCase().includes('unauthorized-domain') || 
                             error.message?.toLowerCase().includes('unauthorized domain') ||
                             error.message?.toLowerCase().includes('configuration') ||
                             error.message?.toLowerCase().includes('network-request-failed') ||
                             error.message?.toLowerCase().includes('popup-blocked');
      if (isUnauthorized) {
        return { 
          success: false, 
          message: 'Google Sign-In is unavailable on this deployment.\n\nThis deployment domain is not authorized in Firebase Authentication.\n\nPlease use an authorized domain or contact the administrator.' 
        };
      }
      return { success: false, message: error.message || 'Google Sign-In failed.' };
    }
  };

  const handleLogout = async () => {
    if (ENABLE_DEV_AUTH) {
      setCurrentUser(null);
      setIsAdmin(false);
      localStorage.removeItem('dhanshri_local_profile_dev-admin');
      setViewHistory([View.DASHBOARD]);
      return;
    }

    try {
      await signOut(auth);
      setCurrentUser(null);
      setViewHistory([View.DASHBOARD]);
    } catch (error) {
      console.error("Sign out failed: ", error);
    }
  };

  const handleUpdateUserProfile = async (updatedProfile: UserProfile) => {
    if (ENABLE_DEV_AUTH) {
      localStorage.setItem('dhanshri_local_profile_dev-admin', JSON.stringify(updatedProfile));
      setCurrentUser(updatedProfile);
      return;
    }

    const user = auth.currentUser;
    if (user) {
      try {
        const profileWithEmail = { ...updatedProfile, email: updatedProfile.email || user.email || '' };
        if (BYPASS_ADMIN_APPROVAL_FOR_DEV) {
          localStorage.setItem(`dhanshri_local_profile_${user.uid}`, JSON.stringify(profileWithEmail));
        } else {
          await setDoc(doc(db, 'users', user.uid), sanitizeData(profileWithEmail), { merge: true });
        }
        setCurrentUser(profileWithEmail);
      } catch (error) {
      }
    } else {
      setCurrentUser(updatedProfile);
    }
  };

  // --- Navigation ---
  const navigate = (view: View, type: 'push' | 'replace' = 'push') => {
    if (view === View.ADMIN_PANEL && !isAdmin) {
      // Direct manual block for safety
      view = View.DASHBOARD;
    }
    if (view !== View.CONTACT) setContactFormPrefill(null);
    window.scrollTo(0, 0);
    setViewHistory(prev => type === 'replace' ? [view] : (prev[prev.length - 1] === view ? prev : [...prev, view]));
  };

  const navigateBack = () => {
    window.scrollTo(0, 0);
    setViewHistory(prev => prev.length > 1 ? prev.slice(0, -1) : [View.DASHBOARD]);
  };

  // --- Project & Plot Handlers ---
  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    navigate(View.PROJECT_DETAILS);
  };

  const handleViewPlots = (project: Project) => {
    setSelectedProject(project);
    navigate(View.PLOT_VIEWER);
  };

  const handleSelectPlot = (plot: Plot | null) => setSelectedPlot(plot);

  const handleBookSiteVisit = (project: Project, plot: Plot) => {
    setContactFormPrefill({ projectName: project.name, plotNumber: plot.number });
    navigate(View.CONTACT);
  };

  const compressBase64InApp = (base64Str: string): Promise<string> => {
    if (!base64Str || !base64Str.startsWith('data:image/')) {
      return Promise.resolve(base64Str);
    }
    // If already small (under 95KB), return as is
    if (base64Str.length < 120000) {
      return Promise.resolve(base64Str);
    }
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 640;
        const MAX_HEIGHT = 640;
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64Str);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.55));
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  const handleUpdateProject = async (updatedProject: Project, isLocalOnly?: boolean) => {
    const docPath = `projects/${updatedProject.id}`;
    console.log('[UPDATE PROJECT TRACE 1] handleUpdateProject invoked');
    console.log('[UPDATE PROJECT TRACE 2] Incoming Project ID:', updatedProject.id, 'Name:', updatedProject.name);
    console.log('[UPDATE PROJECT TRACE 3] isLocalOnly flag:', isLocalOnly);
    console.log('[UPDATE PROJECT TRACE 4] Current User UID:', auth.currentUser?.uid || 'NONE', 'Email:', auth.currentUser?.email || 'NONE');
    console.log('[UPDATE PROJECT TRACE 5] Incoming layout count:', updatedProject.layout?.length, 'plots count:', updatedProject.plots?.length, 'totalPlots:', updatedProject.totalPlots, 'availablePlots:', updatedProject.availablePlots);

    try {
      let finalProject = cleanProject({ ...updatedProject });
      const plotsArray = finalProject.layout || finalProject.plots || [];
      
      // Let totalPlots match the actual layout length if specified or the explicit totalPlots
      const targetCount = plotsArray.length > 0 
        ? plotsArray.length 
        : (finalProject.totalPlots !== undefined && finalProject.totalPlots > 0 
            ? finalProject.totalPlots 
            : getOfficialTotalPlots(finalProject.name));
      
      finalProject.layout = plotsArray;
      finalProject.plots = finalProject.layout;
      finalProject.totalPlots = targetCount;
      finalProject.availablePlots = finalProject.layout.filter(
        p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE
      ).length;

      console.log('[UPDATE PROJECT TRACE 6] Prepared finalProject for Firestore update:');
      console.log('  -> Document Target Path:', docPath);
      console.log('  -> Total plots count:', finalProject.totalPlots, 'Plots array length:', finalProject.plots?.length);
      console.log('  -> Available plots count:', finalProject.availablePlots);
      console.log('  -> Sample first plot:', finalProject.plots?.[0]?.number, 'Sample last plot:', finalProject.plots?.[finalProject.plots.length - 1]?.number);

      // Check estimated JSON payload size and optimize images if it exceeds 750KB
      const estimatedSize = JSON.stringify(finalProject).length;
      console.log('[UPDATE PROJECT TRACE 7] Estimated payload JSON size:', estimatedSize, 'bytes');
      if (estimatedSize > 750000) {
        console.log('[UPDATE PROJECT TRACE 7a] Payload exceeds 750KB threshold, compressing base64 images...');
        if (finalProject.coverImage && finalProject.coverImage.startsWith('data:image/')) {
          finalProject.coverImage = await compressBase64InApp(finalProject.coverImage);
        }
        if (finalProject.galleryImages) {
          finalProject.galleryImages = await Promise.all(
            finalProject.galleryImages.map(img => compressBase64InApp(img))
          );
        }
        finalProject.imageUrls = Array.from(
          new Set([finalProject.coverImage, ...(finalProject.galleryImages || [])])
        ).filter(Boolean) as string[];
      }

      if (!isLocalOnly && auth.currentUser) {
        console.log(`[UPDATE PROJECT TRACE 8] Writing document to Firestore path "${docPath}"...`);
        const sanitized = sanitizeData(finalProject);
        console.log('[UPDATE PROJECT TRACE 8a] Sanitized payload fields:', Object.keys(sanitized));
        await setDoc(doc(db, 'projects', String(finalProject.id)), sanitized);
        console.log(`[UPDATE PROJECT TRACE 9] Firestore setDoc SUCCESS for path "${docPath}"!`);
      } else {
        console.warn(`[UPDATE PROJECT TRACE 8-SKIPPED] Skipped Firestore write for path "${docPath}". Reason: ${isLocalOnly ? 'isLocalOnly is true' : 'No authenticated user (auth.currentUser is null)'}`);
      }
      setProjects(prev => prev.map(p => p.id === finalProject.id ? finalProject : p));
      if (selectedProject?.id === finalProject.id) setSelectedProject(finalProject);
      console.log('[UPDATE PROJECT TRACE 10] Local React state updated with finalProject.');
    } catch (error: any) {
      console.error('[UPDATE PROJECT ERROR] Firestore update failed!');
      console.error('  -> Target Path:', docPath);
      console.error('  -> Error Code:', error?.code || 'UNKNOWN');
      console.error('  -> Error Message:', error?.message || String(error));
      console.error('  -> Full Error Object:', error);
      handleFirestoreError(error, OperationType.UPDATE, docPath);
    }
  };
  
  const handleAddProject = async (newProjectData: Omit<Project, 'id' | 'layout' | 'availablePlots'> & {totalPlots: number}) => {
    console.log('[ADD PROJECT TRACE 1] handleAddProject invoked');
    console.log('[ADD PROJECT TRACE 2] Project Name:', newProjectData.name, 'Requested totalPlots:', newProjectData.totalPlots);
    console.log('[ADD PROJECT TRACE 3] Current User UID:', auth.currentUser?.uid || 'NONE', 'Email:', auth.currentUser?.email || 'NONE');

    const generatePlots = (count: number, projectId: number): Plot[] => {
      const plots: Plot[] = [];
      for (let i = 1; i <= count; i++) {
        plots.push({
          id: (projectId * 1000) + i, number: `P-${100 + i}`, size: 1200, dimensions: `30x40`,
          facing: PlotFacing.EAST, status: PlotStatus.AVAILABLE, type: PlotType.NORMAL,
          price: 1200 * 1500, isMortgaged: false,
        });
      }
      return plots;
    };
    
    const newId = Date.now();
    const docPath = `projects/${newId}`;
    const newLayout = generatePlots(newProjectData.totalPlots, newId);
    const newProject: Project = normalizeProjectPlots({
        ...newProjectData,
        id: newId,
        layout: newLayout,
        availablePlots: newProjectData.totalPlots,
    });

    console.log('[ADD PROJECT TRACE 4] Generated newProject object:');
    console.log('  -> Target Firestore path:', docPath);
    console.log('  -> Total plots:', newProject.totalPlots, 'Layout length:', newProject.layout?.length);
    console.log('  -> Available plots:', newProject.availablePlots);

    try {
      if (auth.currentUser) {
        console.log(`[ADD PROJECT TRACE 5] Writing new project document to Firestore path "${docPath}"...`);
        const sanitized = sanitizeData(newProject);
        console.log('[ADD PROJECT TRACE 5a] Sanitized payload fields:', Object.keys(sanitized));
        await setDoc(doc(db, 'projects', String(newId)), sanitized);
        console.log(`[ADD PROJECT TRACE 6] Firestore setDoc SUCCESS for path "${docPath}"!`);
      } else {
        console.warn(`[ADD PROJECT TRACE 5-SKIPPED] Skipped Firestore write for path "${docPath}". Reason: auth.currentUser is null.`);
      }
      setProjects(prev => [newProject, ...prev]);
      console.log('[ADD PROJECT TRACE 7] Local React state updated with newProject.');
    } catch (error: any) {
      console.error('[ADD PROJECT ERROR] Firestore setDoc failed!');
      console.error('  -> Target Path:', docPath);
      console.error('  -> Error Code:', error?.code || 'UNKNOWN');
      console.error('  -> Error Message:', error?.message || String(error));
      console.error('  -> Full Error Object:', error);
      handleFirestoreError(error, OperationType.CREATE, docPath);
    }
  };
  
  const handleDeleteProject = async (projectId: number) => {
    const projectToDelete = projects.find(p => p.id === projectId);
    if (!projectToDelete) return;

    if(window.confirm(`Are you sure you want to delete the project "${projectToDelete.name}"? This action cannot be undone.`)){
        try {
          if (auth.currentUser) {
            await deleteDoc(doc(db, 'projects', String(projectId)));
          }
          setProjects(prev => prev.filter(p => p.id !== projectId));
          if (currentView === View.PROJECT_DETAILS || currentView === View.PLOT_VIEWER) {
              navigate(View.PROJECTS, 'replace');
          }
        } catch (error) {
        }
    }
  };

  const handleToggleSaveProject = async (projectId: number) => {
    if (!currentUser) {
      // Please login to save projects
      return;
    }
    const updatedIds = savedProjectIds.includes(projectId)
      ? savedProjectIds.filter(id => id !== projectId)
      : [...savedProjectIds, projectId];
      
    setSavedProjectIds(updatedIds);
    
    if (ENABLE_DEV_AUTH) {
      const profilePayload = { ...currentUser, savedProjectIds: updatedIds };
      localStorage.setItem('dhanshri_local_profile_dev-admin', JSON.stringify(profilePayload));
      return;
    }
    
    const user = auth.currentUser;
    if (user) {
      try {
        const profilePayload = { ...currentUser, email: currentUser.email || user.email || '', savedProjectIds: updatedIds };
        if (BYPASS_ADMIN_APPROVAL_FOR_DEV) {
          localStorage.setItem(`dhanshri_local_profile_${user.uid}`, JSON.stringify(profilePayload));
        } else {
          await setDoc(doc(db, 'users', user.uid), sanitizeData(profilePayload), { merge: true });
        }
      } catch (error) {
        console.warn("Failed to sync saved projects with server:", error);
      }
    }
  };

  // Sync saved project IDs locally

  const renderContent = () => {
    switch (currentView) {
      case View.DASHBOARD:
        return <Dashboard projects={projects} navigateTo={(view) => navigate(view, 'replace')} selectProject={handleSelectProject} savedProjectIds={savedProjectIds} onToggleSave={handleToggleSaveProject} isAdmin={isAdmin} />;
      case View.PROJECTS:
        return <ProjectList projects={projects} onSelectProject={handleSelectProject} isAdmin={isAdmin} onUpdateProject={handleUpdateProject} onAddProject={handleAddProject} onDeleteProject={handleDeleteProject} savedProjectIds={savedProjectIds} onToggleSave={handleToggleSaveProject} />;
      case View.PROJECT_DETAILS:
        return selectedProject ? (
          <ProjectDetails 
            project={selectedProject} 
            onViewPlots={handleViewPlots} 
            isSaved={savedProjectIds.includes(selectedProject.id)} 
            onToggleSave={handleToggleSaveProject} 
            isAdmin={isAdmin}
            onUpdateProject={handleUpdateProject}
          />
        ) : (
          <ProjectList projects={projects} onSelectProject={handleSelectProject} isAdmin={isAdmin} onUpdateProject={handleUpdateProject} onAddProject={handleAddProject} onDeleteProject={handleDeleteProject} savedProjectIds={savedProjectIds} onToggleSave={handleToggleSaveProject} />
        );
      case View.PLOT_VIEWER:
        return selectedProject ? <PlotViewer project={selectedProject} selectedPlot={selectedPlot} onSelectPlot={handleSelectPlot} onBookSiteVisit={handleBookSiteVisit} isAdmin={isAdmin} onUpdateProject={handleUpdateProject} /> : <ProjectList projects={projects} onSelectProject={handleSelectProject} isAdmin={isAdmin} onUpdateProject={handleUpdateProject} onAddProject={handleAddProject} onDeleteProject={handleDeleteProject} savedProjectIds={savedProjectIds} onToggleSave={handleToggleSaveProject} />;
      case View.CALCULATORS:
        return <Calculators />;
      case View.MAP:
        return <MapView projects={projects} onSelectProject={handleSelectProject}/>;
      case View.CONTACT:
        return <Contact prefillData={contactFormPrefill} />;
      case View.PLOT_BOOKINGS:
        return isAdmin ? (
          <PlotBookings projects={projects} onUpdateProjects={setProjects} currentUser={currentUser} />
        ) : (
          <Dashboard projects={projects} navigateTo={(view) => navigate(view, 'replace')} selectProject={handleSelectProject} savedProjectIds={savedProjectIds} onToggleSave={handleToggleSaveProject} isAdmin={isAdmin} />
        );
      case View.SAVED:
        const savedProjects = projects.filter(p => savedProjectIds.includes(p.id));
        return <ProjectList projects={savedProjects} onSelectProject={handleSelectProject} isAdmin={isAdmin} onUpdateProject={handleUpdateProject} onAddProject={handleAddProject} onDeleteProject={handleDeleteProject} savedProjectIds={savedProjectIds} onToggleSave={handleToggleSaveProject} title="My Saved Projects" isSavedList={savedProjects.length > 0} />;
      case View.PROFILE:
        return <ProfileView currentUser={currentUser} onRegister={handleRegister} onLogin={handleLogin} onLogout={handleLogout} onUpdateProfile={handleUpdateUserProfile} onGoogleLogin={handleGoogleLogin} />;
      case View.ADMIN_PANEL:
        return isAdmin ? (
          <AdminPanel projects={projects} onUpdateProjects={setProjects} isAdmin={isAdmin} />
        ) : (
          <Dashboard projects={projects} navigateTo={(view) => navigate(view, 'replace')} selectProject={handleSelectProject} savedProjectIds={savedProjectIds} onToggleSave={handleToggleSaveProject} isAdmin={isAdmin} />
        );
      case View.INSIGHTS:
        return <PropertyInsights currentUser={currentUser} isAdmin={isAdmin} />;
      default:
        return <Dashboard projects={projects} navigateTo={(view) => navigate(view, 'replace')} selectProject={handleSelectProject} savedProjectIds={savedProjectIds} onToggleSave={handleToggleSaveProject} isAdmin={isAdmin} />;
    }
  };

  if (loading) return <SplashScreen />;
  if (!currentUser) return <ProfileView currentUser={currentUser} onRegister={handleRegister} onLogin={handleLogin} onLogout={handleLogout} onUpdateProfile={handleUpdateUserProfile} onGoogleLogin={handleGoogleLogin} />;

  // Enforce register approval workflow by blocking app views for non-approved/pending/rejected roles
  if (!ENABLE_DEV_AUTH && !BYPASS_ADMIN_APPROVAL_FOR_DEV && currentUser && currentUser.status !== 'Approved') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100 space-y-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-blue-600">
            {currentUser.status === 'Rejected' ? (
              <span className="text-3xl text-red-500">❌</span>
            ) : (
              <span className="text-3xl animate-pulse">⏳</span>
            )}
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-gray-950 tracking-tight">
              {currentUser.status === 'Rejected' ? 'Registration Rejected' : 'Approval Pending'}
            </h1>
            <p className="text-sm text-gray-500 font-medium">
              {currentUser.status === 'Rejected'
                ? `Unfortunately, your access request has been rejected by an administrator.`
                : `Thank you for registering with Dhanshri Properties, Rau.`}
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-left text-xs font-medium space-y-1.5">
            <div><strong className="text-gray-700">Name:</strong> {currentUser.fullName || currentUser.email?.split('@')[0]}</div>
            <div><strong className="text-gray-700">Email:</strong> {currentUser.email}</div>
            <div><strong className="text-gray-700">Role Requested:</strong> Executive</div>
            <div><strong className="text-gray-700">Status:</strong> <span className={`font-bold ${currentUser.status === 'Rejected' ? 'text-red-600' : 'text-amber-600'}`}>{currentUser.status}</span></div>
            {currentUser.rejectionReason && (
              <div className="text-red-600 bg-red-50 p-2.5 rounded border border-red-100 mt-2">
                <strong>Rejection Reason:</strong> {currentUser.rejectionReason}
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400 font-medium leading-relaxed">
            {currentUser.status === 'Rejected'
              ? 'Please contact administrator sonuchouhan1528@gmail.com to update your details.'
              : 'A notification has been dispatched to sonuchouhan1528@gmail.com. Once an administrator approves your executive profile, your login access will be instantly authorized.'}
          </p>

          <button
            onClick={handleLogout}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-sm text-sm"
          >
            Sign Out / Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header
        isAdmin={isAdmin}
        onToggleAdmin={() => setIsAdmin(!isAdmin)}
        onBack={currentView !== View.DASHBOARD ? navigateBack : undefined}
        onNavigateToProfile={() => navigate(View.PROFILE)}
        onNavigateToAdmin={() => navigate(View.ADMIN_PANEL)}
        user={currentUser}
      />
      <main className="flex-grow pt-16 pb-20 md:pb-4">
        <div className="container mx-auto px-4 py-4">
          {renderContent()}
        </div>
      </main>
      <BottomNav currentView={currentView} setCurrentView={(view) => navigate(view, 'replace')} isAdmin={isAdmin} />
    </div>
  );
};

export default App;
