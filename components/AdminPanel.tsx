import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where,
  doc, 
  onSnapshot
} from 'firebase/firestore';
import { 
  db, 
  auth,
  isSuperAdminEmail,
  sanitizeData, 
  handleFirestoreError, 
  OperationType,
  trackedGetDocs as getDocs,
  trackedGetDoc as getDoc,
  trackedSetDoc as setDoc,
  trackedUpdateDoc as updateDoc,
  trackedDeleteDoc as deleteDoc
} from '../services/firebaseService';
import { UserProfile, HoldRequest, PlotStatus, Project, View, Plot, PlotFacing, PlotType } from '../types';
import Icon from './common/Icon';
import { STATUS_COLORS, getNormalizedStatus, getStatusStyles } from '../constants';

interface AdminPanelProps {
  onShowToast?: (msg: string) => void;
  projects: Project[];
  onUpdateProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  isAdmin?: boolean;
}

const PLOT_CATEGORY_OPTIONS: PlotType[] = [
  PlotType.NORMAL,
  PlotType.RESIDENTIAL,
  PlotType.COMMERCIAL,
  PlotType.EWS,
  PlotType.LIG,
  PlotType.SR,
];

const AdminPanel: React.FC<AdminPanelProps> = ({ onShowToast, projects, onUpdateProjects, isAdmin = true }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'holds' | 'inventory'>('users');
  
  // Real-time states
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('all');
  const [holdRequests, setHoldRequests] = useState<HoldRequest[]>([]);
  
  // UI Loading/Remarks state
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [rejectionTargetId, setRejectionTargetId] = useState<string | null>(null);
  const [rejectionRemarks, setRejectionRemarks] = useState('');
  const [rejectionType, setRejectionType] = useState<'user' | 'hold' | null>(null);

  // Notifications
  const [internalToast, setInternalToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setInternalToast({ message: msg, type });
    setTimeout(() => setInternalToast(null), 4000);
    if (onShowToast) {
      try {
        onShowToast(msg);
      } catch (err) {
        console.warn("onShowToast callback notice:", err);
      }
    }
  };

  // Determine admin permissions
  const userIsAdmin = Boolean(isAdmin || isSuperAdminEmail(auth.currentUser?.email));

  // Add Plot Modal State
  const [isAddPlotModalOpen, setIsAddPlotModalOpen] = useState(false);
  const [addPlotError, setAddPlotError] = useState<string | null>(null);
  const [isAddingPlot, setIsAddingPlot] = useState(false);

  // Add Plot Form fields
  const [newPlotNumber, setNewPlotNumber] = useState('');
  const [newPlotSize, setNewPlotSize] = useState('1200');
  const [newPlotDimensions, setNewPlotDimensions] = useState('30x40');
  const [newPlotCategory, setNewPlotCategory] = useState<PlotType>(PlotType.NORMAL);
  const [newPlotPrice, setNewPlotPrice] = useState('1500000');
  const [newPlotFacing, setNewPlotFacing] = useState<PlotFacing>(PlotFacing.NORTH);
  const [newPlotStatus, setNewPlotStatus] = useState<PlotStatus>(PlotStatus.AVAILABLE);
  const [newPlotIsMortgaged, setNewPlotIsMortgaged] = useState(false);

  // Plot Deletion State
  const [deletingPlotId, setDeletingPlotId] = useState<number | null>(null);
  const [plotToDelete, setPlotToDelete] = useState<Plot | null>(null);

  // Compute user statistics for analytics dashboard
  const userStats = React.useMemo(() => {
    const total = pendingUsers.length;
    const approved = pendingUsers.filter(u => u.status === 'Approved').length;
    const pending = pendingUsers.filter(u => u.status === 'Pending Approval').length;
    const rejected = pendingUsers.filter(u => u.status === 'Rejected').length;
    
    const hasEverLoggedIn = pendingUsers.filter(u => !!u.lastLogin).length;
    const activeToday = pendingUsers.filter(u => {
      if (!u.lastLogin) return false;
      const diffMs = Date.now() - new Date(u.lastLogin).getTime();
      return diffMs < 24 * 60 * 60 * 1000;
    }).length;

    const admin = pendingUsers.filter(u => u.role === 'admin').length;
    const manager = pendingUsers.filter(u => u.role === 'manager').length;
    const executive = pendingUsers.filter(u => u.role === 'executive').length;
    const client = pendingUsers.filter(u => u.role === 'user').length;

    return { total, approved, pending, rejected, hasEverLoggedIn, activeToday, admin, manager, executive, client };
  }, [pendingUsers]);

  // Filtered users array based on search & filters
  const filteredUsers = React.useMemo(() => {
    return pendingUsers.filter(user => {
      const q = userSearchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        (user.fullName || '').toLowerCase().includes(q) ||
        (user.name || '').toLowerCase().includes(q) ||
        (user.email || '').toLowerCase().includes(q) ||
        (user.mobile || '').toLowerCase().includes(q);

      const matchesRole = userRoleFilter === 'all' || user.role === userRoleFilter;
      const matchesStatus = userStatusFilter === 'all' || user.status === userStatusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [pendingUsers, userSearchQuery, userRoleFilter, userStatusFilter]);

  // Plot Inventory Manager States
  const [selectedProjectId, setSelectedProjectId] = useState<number>(projects[0]?.id || 1);
  const [editingPlots, setEditingPlots] = useState<Plot[]>([]);
  const [selectedPlotIds, setSelectedPlotIds] = useState<number[]>([]);
  const [isSavingInventory, setIsSavingInventory] = useState(false);
  const [plotSearchQuery, setPlotSearchQuery] = useState('');

  // Sync edited plots list when project or selected projectId changes
  useEffect(() => {
    const selectedProj = projects.find(p => p.id === selectedProjectId);
    if (selectedProj) {
      const plotsArr = selectedProj.plots || selectedProj.layout || [];
      // Create deep clone of plots array to prevent direct state mutation before clicking Save
      setEditingPlots(JSON.parse(JSON.stringify(plotsArr)));
      setSelectedPlotIds([]);
    }
  }, [selectedProjectId, projects]);

  const filteredEditingPlots = React.useMemo(() => {
    if (!plotSearchQuery.trim()) return editingPlots;
    const q = plotSearchQuery.toLowerCase().trim();
    return editingPlots.filter(p => 
      p.number.toLowerCase().includes(q) ||
      p.dimensions.toLowerCase().includes(q) ||
      (p.facing || '').toLowerCase().includes(q) ||
      (p.status || '').toLowerCase().includes(q) ||
      (p.type || '').toLowerCase().includes(q)
    );
  }, [editingPlots, plotSearchQuery]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setIsRefreshing(true);
    let unsubUsers: (() => void) | null = null;
    let unsubHolds: (() => void) | null = null;

    try {
      const usersQuery = query(collection(db, 'users'));
      unsubUsers = onSnapshot(usersQuery, (snapshot) => {
        const usersList: UserProfile[] = [];
        snapshot.forEach((docSnap) => {
          const u = docSnap.data() as UserProfile;
          usersList.push({ ...u, uid: docSnap.id });
        });
        setPendingUsers(usersList);
        setIsRefreshing(false);
      }, (error) => {
        console.warn("Realtime Users listener error:", error);
        handleFirestoreError(error, OperationType.LIST, 'users');
        setIsRefreshing(false);
      });
    } catch (err) {
      console.error("Failed to setup users snapshot listener:", err);
    }

    try {
      const holdsQuery = query(collection(db, 'hold_requests'));
      unsubHolds = onSnapshot(holdsQuery, (snapshot) => {
        const holdsList: HoldRequest[] = [];
        snapshot.forEach((docSnap) => {
          holdsList.push({ ...docSnap.data(), id: docSnap.id } as HoldRequest);
        });
        holdsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setHoldRequests(holdsList);
        setIsRefreshing(false);
      }, (error) => {
        console.warn("Realtime Hold Requests listener error:", error);
        handleFirestoreError(error, OperationType.LIST, 'hold_requests');
        setIsRefreshing(false);
      });
    } catch (err) {
      console.error("Failed to setup hold requests snapshot listener:", err);
    }

    return () => {
      if (unsubUsers) unsubUsers();
      if (unsubHolds) unsubHolds();
    };
  }, []);

  // --- Actions ---

  // Handle User Approval
  const handleApproveUser = async (userId: string) => {
    setIsActionLoading(true);
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: 'Approved',
        approved: true,
        rejectionReason: ''
      });
      setPendingUsers(prev => prev.map(u => u.uid === userId ? { ...u, status: 'Approved', approved: true, rejectionReason: '' } : u));
      onShowToast("User account has been successfully approved!");
    } catch (err: any) {
      console.error(err);
      onShowToast(`Failed to approve user: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Dynamic User Role Update
  const handleUpdateUserRole = async (userId: string, role: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role });
      setPendingUsers(prev => prev.map(u => u.uid === userId ? { ...u, role: role as any } : u));
      onShowToast(`User role updated to "${role}" successfully!`);
    } catch (err: any) {
      console.error(err);
      onShowToast(`Failed to update role: ${err.message}`);
    }
  };

  // Handle User Access Revocation
  const handleRevokeUser = async (userId: string) => {
    setIsActionLoading(true);
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: 'Rejected',
        approved: false,
        rejectionReason: 'Access revoked by Administrator'
      });
      setPendingUsers(prev => prev.map(u => u.uid === userId ? { ...u, status: 'Rejected', approved: false, rejectionReason: 'Access revoked by Administrator' } : u));
      onShowToast("User access has been revoked.");
    } catch (err: any) {
      console.error(err);
      onShowToast(`Failed to revoke access: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle User Deletion
  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this user profile? This action cannot be undone.")) {
      return;
    }
    setIsActionLoading(true);
    try {
      await deleteDoc(doc(db, 'users', userId));
      setPendingUsers(prev => prev.filter(u => u.uid !== userId));
      onShowToast("User profile permanently deleted.");
    } catch (err: any) {
      console.error(err);
      onShowToast(`Failed to delete user: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Open Rejection Modal/Section
  const openRejectionDialog = (id: string, type: 'user' | 'hold') => {
    setRejectionTargetId(id);
    setRejectionType(type);
    setRejectionRemarks('');
  };

  // Submit Rejection
  const handleSubmitRejection = async () => {
    if (!rejectionTargetId || !rejectionType) return;
    if (!rejectionRemarks.trim()) {
      onShowToast("Rejection reason is required.");
      return;
    }
    setIsActionLoading(true);

    try {
      if (rejectionType === 'user') {
        const userId = rejectionTargetId;
        await updateDoc(doc(db, 'users', userId), {
          status: 'Rejected',
          approved: false,
          rejectionReason: rejectionRemarks
        });
        setPendingUsers(prev => prev.map(u => u.uid === userId ? { ...u, status: 'Rejected', approved: false, rejectionReason: rejectionRemarks } : u));
        onShowToast("User registration was rejected with comments.");
      } else if (rejectionType === 'hold') {
        // Update hold status
        await updateDoc(doc(db, 'hold_requests', rejectionTargetId), {
          status: 'Rejected',
          rejectionReason: rejectionRemarks
        });
        onShowToast("Hold request rejected.");
      }
      
      // Reset dialog
      setRejectionTargetId(null);
      setRejectionType(null);
      setRejectionRemarks('');
    } catch (err: any) {
      console.error(err);
      onShowToast(`Operation failed: ${err.message}`);
      handleFirestoreError(err, OperationType.UPDATE, `${rejectionType === 'user' ? 'users' : 'hold_requests'}/${rejectionTargetId}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Hold Request Approval
  const handleApproveHold = async (hold: HoldRequest) => {
    setIsActionLoading(true);
    try {
      // 1. Fetch current project document
      const projectDocRef = doc(db, 'projects', String(hold.projectId));
      const projectSnap = await getDoc(projectDocRef);
      
      if (!projectSnap.exists()) {
        throw new Error(`Project with ID ${hold.projectId} not found.`);
      }

      const projectData = projectSnap.data() as Project;
      
      // 2. Modify specific plot status inside layout to "Hold"
      const plotsArray = projectData.plots || projectData.layout || [];
      const updatedLayout = plotsArray.map(p => {
        if (p.id === hold.plotId) {
          return { ...p, status: PlotStatus.HOLD };
        }
        return p;
      });

      // Recalculate available plots
      const availableCount = updatedLayout.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length;

      // 3. Update project in Firestore
      await updateDoc(projectDocRef, {
        layout: updatedLayout,
        plots: updatedLayout,
        availablePlots: availableCount
      });

      // 4. Update hold request status
      await updateDoc(doc(db, 'hold_requests', hold.id), {
        status: 'Approved'
      });

      // 5. Update local projects state
      onUpdateProjects(prev => prev.map(p => p.id === hold.projectId ? { ...p, layout: updatedLayout, plots: updatedLayout, availablePlots: availableCount } : p));

      onShowToast(`Plot ${hold.plotNumber} is now officially on Hold!`);
    } catch (err: any) {
      console.error(err);
      onShowToast(`Failed to approve hold request: ${err.message}`);
      handleFirestoreError(err, OperationType.UPDATE, `hold_requests/${hold.id}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // --- Plot Inventory Helper Functions ---

  const handleUpdatePlotField = (plotId: number, field: keyof Plot, value: any) => {
    setEditingPlots(prev => prev.map(p => {
      if (p.id === plotId) {
        const updated = { ...p, [field]: value };
        // If dimensions changed and it's in format "WxH", let's parse and set size (Area) automatically if possible!
        if (field === 'dimensions' && typeof value === 'string') {
          const parts = value.toLowerCase().split('x');
          if (parts.length === 2) {
            const w = parseFloat(parts[0]);
            const h = parseFloat(parts[1]);
            if (!isNaN(w) && !isNaN(h)) {
              updated.size = w * h;
            }
          }
        }
        return updated;
      }
      return p;
    }));
  };

  const handleOpenAddPlotModal = () => {
    console.log('[ADD TRACE 1] Add Plot clicked');
    if (!userIsAdmin) {
      showToast("Only an authenticated Admin user can add a plot.", "error");
      return;
    }
    const existing = editingPlots;
    // Suggest the next plot number
    const nextNum = existing.length + 1;
    let suggestedNumber = `P-${String(nextNum).padStart(3, '0')}`;
    let counter = nextNum;
    while (existing.some(p => p.number.trim().toLowerCase() === suggestedNumber.toLowerCase())) {
      counter++;
      suggestedNumber = `P-${String(counter).padStart(3, '0')}`;
    }

    setNewPlotNumber(suggestedNumber);
    setNewPlotSize('1200');
    setNewPlotDimensions('30x40');
    setNewPlotCategory(PlotType.NORMAL);
    setNewPlotPrice('1500000');
    setNewPlotFacing(PlotFacing.NORTH);
    setNewPlotStatus(PlotStatus.AVAILABLE);
    setNewPlotIsMortgaged(false);
    setAddPlotError(null);
    setIsAddPlotModalOpen(true);
  };

  const handleConfirmAddPlot = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    console.log('[ADD TRACE 2] Handler executed');
    console.log('[ADD TRACE 3] Current user UID:', auth.currentUser?.uid || 'none');
    console.log('[ADD TRACE 4] Admin status:', userIsAdmin);
    console.log('[ADD TRACE 5] Project ID:', selectedProjectId);
    setAddPlotError(null);

    // Permission check
    if (!userIsAdmin) {
      const msg = "Only an authenticated Admin user can add a plot.";
      setAddPlotError(msg);
      showToast(msg, "error");
      return;
    }

    // 1. Validate the Plot Number
    const trimmedNumber = newPlotNumber.trim();
    if (!trimmedNumber) {
      const msg = "Please enter a valid plot number.";
      setAddPlotError(msg);
      return;
    }

    // 2. Check that the Plot Number does not already exist in that project
    const selectedProj = projects.find(p => p.id === selectedProjectId);
    if (!selectedProj) {
      setAddPlotError("Selected project not found.");
      return;
    }

    const currentPlots = editingPlots;
    const existsLocally = currentPlots.some(
      p => p.number.trim().toLowerCase() === trimmedNumber.toLowerCase()
    );

    // 3. If the plot number already exists, show: "This plot number already exists in this project."
    if (existsLocally) {
      const errorMsg = "This plot number already exists in this project.";
      setAddPlotError(errorMsg);
      showToast(errorMsg, "error");
      return;
    }

    // Parse values
    const sizeNum = parseFloat(newPlotSize) || 0;
    const priceNum = parseFloat(newPlotPrice) || 0;
    const dim = newPlotDimensions.trim() || `${sizeNum} sq.ft.`;

    // 4. Create exactly ONE new plot
    const nextId = currentPlots.length > 0 
      ? Math.max(...currentPlots.map(p => Number(p.id) || 0)) + 1 
      : (selectedProjectId * 1000) + 1;

    const newPlot: Plot = {
      id: nextId,
      number: trimmedNumber,
      size: sizeNum,
      dimensions: dim,
      facing: newPlotFacing,
      type: newPlotCategory,
      category: newPlotCategory,
      price: priceNum,
      status: newPlotStatus,
      isMortgaged: newPlotIsMortgaged,
      layoutX: 10,
      layoutY: 10,
      layoutW: 6,
      layoutH: 8
    };

    console.log('[ADD TRACE 6] Plot data:', newPlot);
    console.log('[ADD TRACE 7] Firestore path:', `projects/${selectedProjectId}`);
    console.log('[ADD TRACE 8] Starting write');

    setIsAddingPlot(true);
    try {
      // 5. Save it to the EXISTING Firestore database/collection structure
      const selectedProj = projects.find(p => p.id === selectedProjectId);
      const projRef = doc(db, 'projects', String(selectedProjectId));
      const projSnap = await getDoc(projRef);
      
      let basePlots: Plot[] = [];
      if (projSnap.exists()) {
        const data = projSnap.data();
        basePlots = data.plots || data.layout || [];
      } else {
        basePlots = selectedProj?.plots || selectedProj?.layout || currentPlots;
      }

      // Check uniqueness against latest Firestore data
      if (basePlots.some(p => p.number.trim().toLowerCase() === trimmedNumber.toLowerCase())) {
        const errorMsg = "This plot number already exists in this project.";
        setAddPlotError(errorMsg);
        showToast(errorMsg, "error");
        setIsAddingPlot(false);
        return;
      }

      const updatedPlots = [...basePlots, newPlot];
      const totalPlots = updatedPlots.length;
      const availablePlots = updatedPlots.filter(
        p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE
      ).length;

      await setDoc(projRef, sanitizeData({
        ...(selectedProj || {}),
        plots: updatedPlots,
        layout: updatedPlots,
        totalPlots,
        availablePlots,
        updatedAt: new Date().toISOString()
      }), { merge: true });

      console.log('[ADD TRACE 9] Firestore write SUCCESS');

      // 6. Update the local application state immediately
      setEditingPlots(updatedPlots);
      onUpdateProjects(prev => prev.map(p => {
        if (p.id === selectedProjectId) {
          return {
            ...p,
            plots: updatedPlots,
            layout: updatedPlots,
            totalPlots,
            availablePlots
          };
        }
        return p;
      }));

      // 7. Display the newly added plot immediately in the inventory
      // 8. Update project inventory totals
      setIsAddPlotModalOpen(false);
      showToast("Plot added successfully.", "success");
    } catch (err: any) {
      console.error('[ADD ERROR]');
      console.error(err?.code || 'NO_CODE');
      console.error(err?.message || String(err));
      console.error('[ADD ERROR DETAILS]', err);
      const msg = err?.message || "Failed to add plot to database.";
      setAddPlotError(msg);
      showToast(`Failed to add plot: ${msg}`, "error");
    } finally {
      setIsAddingPlot(false);
    }
  };

  const handleDeleteSinglePlot = (plot: Plot) => {
    console.log('[DELETE TRACE 1] Delete clicked');
    console.log('[DELETE TRACE 3] Current user UID:', auth.currentUser?.uid || 'none');
    console.log('[DELETE TRACE 4] Admin status:', userIsAdmin);
    console.log('[DELETE TRACE 5] Project ID:', selectedProjectId);
    console.log('[DELETE TRACE 6] Plot ID:', plot.id);
    console.log('[DELETE TRACE 7] Plot number:', plot.number);

    if (!userIsAdmin) {
      showToast("Only an authenticated Admin user can delete a plot.", "error");
      return;
    }

    // Trigger confirmation dialog
    setPlotToDelete(plot);
  };

  const handleExecuteDeletePlot = async (plot: Plot) => {
    setPlotToDelete(null);

    console.log('[DELETE TRACE 2] Handler executed');
    console.log('[DELETE TRACE 3] Current user UID:', auth.currentUser?.uid || 'none');
    console.log('[DELETE TRACE 4] Admin status:', userIsAdmin);
    console.log('[DELETE TRACE 5] Project ID:', selectedProjectId);
    console.log('[DELETE TRACE 6] Plot ID:', plot.id);
    console.log('[DELETE TRACE 7] Plot number:', plot.number);
    console.log('[DELETE TRACE 8] Firestore path:', `projects/${selectedProjectId}`);
    console.log('[DELETE TRACE 9] Starting delete');

    setDeletingPlotId(plot.id);
    try {
      const selectedProj = projects.find(p => p.id === selectedProjectId);
      const projRef = doc(db, 'projects', String(selectedProjectId));
      const projSnap = await getDoc(projRef);

      let basePlots: Plot[] = [];
      if (projSnap.exists()) {
        const data = projSnap.data();
        basePlots = data.plots || data.layout || [];
      } else {
        basePlots = selectedProj?.plots || selectedProj?.layout || editingPlots;
      }

      // Delete ONLY the selected plot
      const updatedPlots = basePlots.filter(p => p.id !== plot.id && p.number !== plot.number);
      const totalPlots = updatedPlots.length;
      const availablePlots = updatedPlots.filter(
        p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE
      ).length;

      // Update in Firestore
      await setDoc(projRef, sanitizeData({
        ...(selectedProj || {}),
        plots: updatedPlots,
        layout: updatedPlots,
        totalPlots,
        availablePlots,
        updatedAt: new Date().toISOString()
      }), { merge: true });

      console.log('[DELETE TRACE 10] Firestore delete SUCCESS');

      // Delete corresponding plot_mappings if any exists
      try {
        const mapQ = query(
          collection(db, 'plot_mappings'),
          where('projectId', '==', selectedProjectId),
          where('plotNumber', '==', plot.number)
        );
        const mapSnap = await getDocs(mapQ);
        for (const docSnap of mapSnap.docs) {
          await deleteDoc(doc(db, 'plot_mappings', docSnap.id));
        }
      } catch (mapErr) {
        console.warn("Notice: plot_mappings cleanup error:", mapErr);
      }

      // Remove the plot from local state immediately
      setEditingPlots(prev => prev.filter(p => p.id !== plot.id && p.number !== plot.number));
      setSelectedPlotIds(prev => prev.filter(id => id !== plot.id));

      onUpdateProjects(prev => prev.map(p => {
        if (p.id === selectedProjectId) {
          return {
            ...p,
            plots: updatedPlots,
            layout: updatedPlots,
            totalPlots,
            availablePlots
          };
        }
        return p;
      }));

      showToast("Plot deleted successfully.", "success");
    } catch (err: any) {
      console.error('[DELETE ERROR]');
      console.error(err?.code || 'NO_CODE');
      console.error(err?.message || String(err));
      console.error('[DELETE ERROR DETAILS]', err);
      const realMsg = err?.message || String(err);
      showToast(`Failed to delete plot: ${realMsg}`, "error");
    } finally {
      setDeletingPlotId(null);
    }
  };

  const handleDeleteSelectedPlots = async () => {
    console.log('[DELETE TRACE 1] Delete clicked (bulk selected)');
    console.log('[DELETE TRACE 3] Current user UID:', auth.currentUser?.uid || 'none');
    console.log('[DELETE TRACE 4] Admin status:', userIsAdmin);
    console.log('[DELETE TRACE 5] Project ID:', selectedProjectId);

    if (!userIsAdmin) {
      showToast("Only an authenticated Admin user can delete a plot.", "error");
      return;
    }

    if (selectedPlotIds.length === 0) {
      showToast("Please select at least one plot to delete by checking its row checkbox.", "info");
      return;
    }

    const confirmMessage = selectedPlotIds.length === 1
      ? "Are you sure you want to delete this plot?"
      : `Are you sure you want to delete these ${selectedPlotIds.length} plots?`;

    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) return;

    console.log('[DELETE TRACE 2] Handler executed');
    console.log('[DELETE TRACE 6] Plot IDs:', selectedPlotIds);
    console.log('[DELETE TRACE 8] Firestore path:', `projects/${selectedProjectId}`);
    console.log('[DELETE TRACE 9] Starting delete');

    setIsSavingInventory(true);
    try {
      const selectedProj = projects.find(p => p.id === selectedProjectId);
      const projRef = doc(db, 'projects', String(selectedProjectId));
      const projSnap = await getDoc(projRef);

      let basePlots: Plot[] = [];
      if (projSnap.exists()) {
        const data = projSnap.data();
        basePlots = data.plots || data.layout || [];
      } else {
        basePlots = selectedProj?.plots || selectedProj?.layout || editingPlots;
      }

      const deletedPlots = basePlots.filter(p => selectedPlotIds.includes(p.id));
      const updatedPlots = basePlots.filter(p => !selectedPlotIds.includes(p.id));
      const totalPlots = updatedPlots.length;
      const availablePlots = updatedPlots.filter(
        p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE
      ).length;

      await updateDoc(projRef, sanitizeData({
        plots: updatedPlots,
        layout: updatedPlots,
        totalPlots,
        availablePlots,
        updatedAt: new Date().toISOString()
      }));

      console.log('[DELETE TRACE 10] Firestore delete SUCCESS');

      for (const delP of deletedPlots) {
        try {
          const mapQ = query(
            collection(db, 'plot_mappings'),
            where('projectId', '==', selectedProjectId),
            where('plotNumber', '==', delP.number)
          );
          const mapSnap = await getDocs(mapQ);
          mapSnap.forEach(async (docSnap: any) => {
            await deleteDoc(doc(db, 'plot_mappings', docSnap.id));
          });
        } catch (mapErr) {
          console.warn("Notice: plot_mappings cleanup error:", mapErr);
        }
      }

      setEditingPlots(prev => prev.filter(p => !selectedPlotIds.includes(p.id)));
      setSelectedPlotIds([]);

      onUpdateProjects(prev => prev.map(p => {
        if (p.id === selectedProjectId) {
          return {
            ...p,
            plots: updatedPlots,
            layout: updatedPlots,
            totalPlots,
            availablePlots
          };
        }
        return p;
      }));

      showToast(`Selected plots successfully deleted.`, "success");
    } catch (err: any) {
      console.error('[DELETE ERROR]');
      console.error(err?.code || 'NO_CODE');
      console.error(err?.message || String(err));
      console.error('[DELETE ERROR DETAILS]', err);
      const realMsg = err?.message || String(err);
      alert(`Failed to delete plots: ${realMsg}`);
      showToast(`Failed to delete plots: ${realMsg}`, "error");
    } finally {
      setIsSavingInventory(false);
    }
  };

  const handleSaveInventory = async () => {
    const selectedProj = projects.find(p => p.id === selectedProjectId);
    if (!selectedProj) return;

    // Validate plot numbers: non-empty and unique within project
    const seen = new Set<string>();
    for (const p of editingPlots) {
      const num = (p.number || '').trim();
      if (!num) {
        showToast("Plot number cannot be empty. Please ensure all plots have a valid number.", "error");
        return;
      }
      const lower = num.toLowerCase();
      if (seen.has(lower)) {
        showToast(`Duplicate plot number detected: "${p.number}". Each plot within the project must have a unique number.`, "error");
        return;
      }
      seen.add(lower);
    }

    setIsSavingInventory(true);
    try {
      const updatedLayout = [...editingPlots];
      const totalPlots = updatedLayout.length;
      const availablePlots = updatedLayout.filter(
        p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE
      ).length;

      // Update in Firestore
      const projRef = doc(db, 'projects', String(selectedProjectId));
      await updateDoc(projRef, sanitizeData({
        layout: updatedLayout,
        plots: updatedLayout,
        totalPlots,
        availablePlots,
        updatedAt: new Date().toISOString()
      }));

      // Update local state in App.tsx
      onUpdateProjects(prev => prev.map(p => {
        if (p.id === selectedProjectId) {
          return {
            ...p,
            layout: updatedLayout,
            plots: updatedLayout,
            totalPlots,
            availablePlots
          };
        }
        return p;
      }));

      showToast(`Inventory for "${selectedProj.name}" successfully saved to database! Total: ${totalPlots}, Available: ${availablePlots}`, "success");
    } catch (err: any) {
      console.error("Error saving inventory:", err);
      showToast(`Failed to save inventory: ${err.message}`, "error");
      handleFirestoreError(err, OperationType.UPDATE, `projects/${selectedProjectId}`);
    } finally {
      setIsSavingInventory(false);
    }
  };

  const handleApplyEverywhere = async () => {
    const selectedProj = projects.find(p => p.id === selectedProjectId);
    if (!selectedProj) return;

    if (window.confirm(`⚠️ WARNING: "Apply Everywhere" will replicate this exact plot list (${editingPlots.length} plots) to ALL other projects in the database! It will overwrite their current plot inventory, names, sizing, and status with this list. This action is irreversible. Proceed?`)) {
      setIsSavingInventory(true);
      try {
        const batchPromises = projects.map(async (proj) => {
          if (proj.id === selectedProjectId) return; // Skip current project as it's saved via Save Inventory

          // Build mapped plots for target project
          const replicatedPlots = editingPlots.map((plot, idx) => ({
            ...plot,
            id: (proj.id * 1000) + idx, // Keep unique IDs for each project scope
          }));

          const totalPlots = replicatedPlots.length;
          const availablePlots = replicatedPlots.filter(
            p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE
          ).length;

          const projRef = doc(db, 'projects', String(proj.id));
          await updateDoc(projRef, {
            layout: replicatedPlots,
            plots: replicatedPlots,
            totalPlots,
            availablePlots
          });
        });

        await Promise.all(batchPromises);

        // Update local React state for all projects
        onUpdateProjects(prev => prev.map(p => {
          if (p.id === selectedProjectId) {
            const totalPlots = editingPlots.length;
            const availablePlots = editingPlots.filter(
              pl => pl.status === PlotStatus.AVAILABLE || pl.status === PlotStatus.RESALE
            ).length;
            return {
              ...p,
              layout: [...editingPlots],
              plots: [...editingPlots],
              totalPlots,
              availablePlots
            };
          } else {
            const replicatedPlots = editingPlots.map((plot, idx) => ({
              ...plot,
              id: (p.id * 1000) + idx,
            }));
            const totalPlots = replicatedPlots.length;
            const availablePlots = replicatedPlots.filter(
              pl => pl.status === PlotStatus.AVAILABLE || pl.status === PlotStatus.RESALE
            ).length;
            return {
              ...p,
              layout: replicatedPlots,
              plots: replicatedPlots,
              totalPlots,
              availablePlots
            };
          }
        }));

        onShowToast(`Successfully applied this inventory layout template to ALL other projects!`);
      } catch (err: any) {
        console.error("Error applying inventory everywhere:", err);
        onShowToast(`Failed to apply everywhere: ${err.message}`);
      } finally {
        setIsSavingInventory(false);
      }
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 pb-4 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <Icon name="lock" className="w-8 h-8 text-blue-600 shrink-0" />
            Admin Control Panel
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Authorization console for plot holds, user approvals, and plot inventory management.</p>
        </div>
        <button
          onClick={() => { setIsRefreshing(true); setTimeout(() => setIsRefreshing(false), 500); }}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm rounded-lg border border-gray-200 transition-all shadow-sm active:scale-95 disabled:opacity-50 shrink-0 self-start sm:self-center"
        >
          <Icon name="refresh" className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh Database'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white p-2 rounded-xl shadow-sm gap-2">
        {(['users', 'holds', 'inventory'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setRejectionTargetId(null); }}
            className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              activeTab === tab 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab === 'users' && `User Approvals (${pendingUsers.length})`}
            {tab === 'holds' && `Hold Requests (${holdRequests.length})`}
            {tab === 'inventory' && `Plot Inventory`}
          </button>
        ))}
      </div>

      {/* REJECTION OVERLAY BOX */}
      {rejectionTargetId && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5 space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-red-800 text-sm flex items-center gap-1.5">
              <span>🚨</span> Specify Rejection Remarks
            </h3>
            <button 
              onClick={() => setRejectionTargetId(null)}
              className="text-red-500 hover:text-red-700"
            >
              <Icon name="close" className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-red-700 font-medium">Please provide a clear reason. This comment will be visible to the applicant or executive to help them understand why the request was denied.</p>
          <div className="space-y-3">
            <textarea
              value={rejectionRemarks}
              onChange={e => setRejectionRemarks(e.target.value)}
              placeholder="Enter rejection reason or corrective instructions..."
              className="w-full p-3 bg-white border border-red-300 rounded-lg text-sm text-gray-850 focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-400"
              rows={3}
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setRejectionTargetId(null)}
                className="bg-white text-gray-600 border border-gray-300 font-bold px-4 py-2 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmitRejection}
                disabled={isActionLoading}
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2 rounded-lg text-xs disabled:bg-red-400 flex items-center gap-1.5"
              >
                {isActionLoading && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 1: USER APPROVALS (ANALYTICS & ROLES CONTROL) --- */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* --- ANALYTICS CARDS GRID --- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fadeIn">
            {/* Card 1: Total Registered */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
              <div className="space-y-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">Total Registered</span>
                <div className="text-3xl font-black text-gray-900 tracking-tight">{userStats.total}</div>
                <p className="text-[10px] text-gray-500 font-medium font-sans">Active & pending profiles</p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Icon name="profile" className="w-6 h-6" />
              </div>
            </div>

            {/* Card 2: Active / Logged In */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
              <div className="space-y-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">Active / Logged In</span>
                <div className="text-3xl font-black text-green-600 tracking-tight flex items-baseline gap-1.5">
                  {userStats.hasEverLoggedIn}
                  <span className="text-xs font-bold text-gray-400 font-mono">({userStats.activeToday} today)</span>
                </div>
                <p className="text-[10px] text-gray-500 font-medium font-sans">People who have signed in</p>
              </div>
              <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                <Icon name="status" className="w-6 h-6" />
              </div>
            </div>

            {/* Card 3: Pending Approvals */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
              <div className="space-y-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">Pending Approvals</span>
                <div className="text-3xl font-black text-amber-500 tracking-tight flex items-center gap-1.5">
                  {userStats.pending}
                  {userStats.pending > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  )}
                </div>
                <p className="text-[10px] text-gray-500 font-medium font-sans">Awaiting admin clearance</p>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Icon name="lock" className="w-6 h-6" />
              </div>
            </div>

            {/* Card 4: Team Role Breakdown */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
              <div className="space-y-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">Role Breakdown</span>
                <div className="text-sm font-extrabold text-gray-700 tracking-tight font-sans">
                  <span className="text-blue-600 font-black">{userStats.admin + userStats.manager + userStats.executive}</span> Staff 
                  <span className="text-gray-300 mx-1">|</span> 
                  <span className="text-indigo-600 font-black">{userStats.client}</span> Clients
                </div>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                  Admins: {userStats.admin} | Mgrs: {userStats.manager} | Execs: {userStats.executive}
                </p>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <Icon name="projects" className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* --- SEARCH & ADVANCED FILTER PANEL --- */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col md:flex-row gap-4 items-center justify-between animate-fadeIn">
            {/* Search query input */}
            <div className="relative w-full md:w-96">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                <Icon name="search" className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={userSearchQuery}
                onChange={e => setUserSearchQuery(e.target.value)}
                placeholder="Search by name, email, phone..."
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-gray-800 transition-all placeholder-gray-400 font-bold"
              />
              {userSearchQuery && (
                <button 
                  onClick={() => setUserSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  <Icon name="close" className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dropdowns */}
            <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
              <div className="flex items-center gap-1.5 flex-1 md:flex-none">
                <span className="text-xs font-bold text-gray-400 font-mono uppercase">Role:</span>
                <select
                  value={userRoleFilter}
                  onChange={e => setUserRoleFilter(e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer w-full md:w-auto"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Administrator</option>
                  <option value="manager">Manager</option>
                  <option value="executive">Sales Executive</option>
                  <option value="user">Client / User</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 flex-1 md:flex-none">
                <span className="text-xs font-bold text-gray-400 font-mono uppercase">Status:</span>
                <select
                  value={userStatusFilter}
                  onChange={e => setUserStatusFilter(e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer w-full md:w-auto"
                >
                  <option value="all">All Status</option>
                  <option value="Approved">Approved</option>
                  <option value="Pending Approval">Pending Approval</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              {(userSearchQuery || userRoleFilter !== 'all' || userStatusFilter !== 'all') && (
                <button
                  onClick={() => {
                    setUserSearchQuery('');
                    setUserRoleFilter('all');
                    setUserStatusFilter('all');
                  }}
                  className="text-xs font-extrabold text-red-600 hover:text-red-700 bg-red-50 px-3.5 py-2 rounded-lg border border-red-100 transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* --- RESULTS LIST PANEL --- */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200 animate-fadeIn">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider font-mono">Team Roles & Activity Logs</h2>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                Found {filteredUsers.length} of {userStats.total} Profiles
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              {filteredUsers.map(user => {
                const isRecentActive = user.lastLogin && (Date.now() - new Date(user.lastLogin).getTime() < 60 * 60 * 1000 * 24);
                
                return (
                  <div key={user.uid} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-gray-900 text-base">{user.fullName || "Anonymous"}</span>
                        
                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                          user.status === 'Approved' ? 'bg-green-100 text-green-800 border border-green-200' :
                          user.status === 'Pending Approval' ? 'bg-amber-100 text-amber-800 animate-pulse border border-amber-200' :
                          'bg-red-100 text-red-800 border border-red-200'
                        }`}>
                          {user.status}
                        </span>


                      </div>

                      {/* Info & Activity Grid */}
                      <div className="text-xs text-gray-500 font-medium space-y-1.5">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <p className="flex items-center gap-1.5 text-gray-600 font-bold">
                            <span className="text-gray-400">📧</span> {user.email}
                          </p>
                          {user.mobile && (
                            <p className="flex items-center gap-1.5 text-gray-600">
                              <span className="text-gray-400">📞</span> {user.mobile}
                            </p>
                          )}
                          {user.createdAt && (
                            <p className="flex items-center gap-1.5 text-gray-400 text-[11px] font-mono">
                              Registered: {new Date(user.createdAt).toLocaleDateString('en-IN')}
                            </p>
                          )}
                        </div>

                        {/* Login Activity Analytics Status Bar */}
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider font-mono">Activity:</span>
                          {user.lastLogin ? (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold ${
                              isRecentActive 
                                ? 'bg-green-50 text-green-800 border border-green-200' 
                                : 'bg-gray-100 text-gray-700 border border-gray-200'
                            }`}>
                              <span className={`w-2 h-2 rounded-full ${isRecentActive ? 'bg-green-500 animate-ping' : 'bg-gray-400'}`}></span>
                              {isRecentActive ? '🟢 Currently Active / Logged In today' : '🕒 Last sign-in'}: {new Date(user.lastLogin).toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] text-gray-400 bg-gray-50 border border-gray-200 border-dashed">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                              No logins logged in system logs yet
                            </span>
                          )}
                        </div>
                      </div>

                      {user.rejectionReason && (
                        <p className="text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-100 mt-2 text-xs font-bold leading-relaxed max-w-xl">
                          ⚠️ <strong>Rejection Reason:</strong> {user.rejectionReason}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 shrink-0">
                      {/* Role Dropdown */}
                      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1">
                        <label className="text-xs font-extrabold text-gray-400 uppercase tracking-wider font-mono">Role:</label>
                        <select
                          value={user.role}
                          onChange={(e) => handleUpdateUserRole(user.uid!, e.target.value as any)}
                          className="bg-transparent text-gray-800 text-xs font-bold focus:outline-none cursor-pointer py-1"
                        >
                          <option value="user">Client / User</option>
                          <option value="executive">Sales Executive</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>

                      {/* Status Actions */}
                      <div className="flex items-center gap-2">
                        {user.status === 'Pending Approval' && (
                          <>
                            <button 
                              onClick={() => openRejectionDialog(user.uid!, 'user')}
                              disabled={isActionLoading}
                              className="bg-white text-red-600 border border-red-200 hover:bg-red-50 font-bold px-4 py-2 rounded-lg text-xs transition-colors"
                            >
                              Reject
                            </button>
                            <button 
                              onClick={() => handleApproveUser(user.uid!)}
                              disabled={isActionLoading}
                              className="bg-green-600 hover:bg-green-700 text-white font-black px-5 py-2 rounded-lg text-xs flex items-center gap-1 shadow-sm transition-all hover:scale-[1.01]"
                            >
                              Approve
                            </button>
                          </>
                        )}
                        {user.status === 'Approved' && (
                          <button 
                            onClick={() => handleRevokeUser(user.uid!)}
                            disabled={isActionLoading}
                            className="bg-white hover:bg-red-50 text-red-600 border border-red-200 font-bold px-4 py-2 rounded-lg text-xs transition-colors"
                          >
                            Revoke Access
                          </button>
                        )}
                        {user.status === 'Rejected' && (
                          <button 
                            onClick={() => handleApproveUser(user.uid!)}
                            disabled={isActionLoading}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors"
                          >
                            Re-Approve Access
                          </button>
                        )}
                        <button 
                          onClick={() => handleDeleteUser(user.uid!)}
                          disabled={isActionLoading}
                          className="bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-bold px-2.5 py-2 rounded-lg text-xs transition-colors"
                          title="Delete User profile permanently"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {filteredUsers.length === 0 && (
                <div className="p-16 text-center text-gray-400 font-medium">
                  🔍 No users found matching the search criteria or filter configuration.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: PLOT HOLD REQUESTS --- */}
      {activeTab === 'holds' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h2 className="text-base font-extrabold text-gray-800">Plot Hold Requests (Executive Hold Queue)</h2>
            <span className="text-xs font-bold text-gray-500 bg-gray-200 px-2.5 py-1 rounded-full">{holdRequests.length} Holds</span>
          </div>
          <div className="divide-y divide-gray-100">
            {holdRequests.map(hold => (
              <div key={hold.id} className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-4 hover:bg-gray-50/50 transition-colors">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-gray-900 bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded text-xs">
                      Plot {hold.plotNumber}
                    </span>
                    <span className="text-gray-800 font-extrabold text-sm">{hold.projectName}</span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      hold.status === 'Pending Approval' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                      hold.status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {hold.status}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs font-medium text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div>👤 <strong className="text-gray-700">Client:</strong> {hold.customerName}</div>
                    <div>💼 <strong className="text-gray-700">Executive:</strong> {hold.salesExecutiveName} ({hold.salesExecutiveEmail})</div>
                    <div>⏱️ <strong className="text-gray-700">Duration:</strong> {hold.duration}</div>
                    <div>📅 <strong className="text-gray-700">Requested:</strong> {new Date(hold.createdAt).toLocaleDateString('en-GB')}</div>
                    <div className="sm:col-span-2">💬 <strong className="text-gray-700">Reason:</strong> {hold.reason}</div>
                    
                    {hold.rejectionReason && (
                      <div className="sm:col-span-2 text-red-600 bg-red-50 p-2 rounded border border-red-100 mt-1">
                        <strong>Rejection Reason:</strong> {hold.rejectionReason}
                      </div>
                    )}
                  </div>
                </div>

                {hold.status === 'Pending Approval' && (
                  <div className="flex items-center gap-2 shrink-0 md:pt-2">
                    <button 
                      onClick={() => openRejectionDialog(hold.id, 'hold')}
                      disabled={isActionLoading}
                      className="bg-white text-red-600 border border-red-200 hover:bg-red-50 font-bold px-4 py-2.5 rounded-lg text-xs"
                    >
                      Reject
                    </button>
                    <button 
                      onClick={() => handleApproveHold(hold)}
                      disabled={isActionLoading}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-lg text-xs flex items-center gap-1 shadow-sm"
                    >
                      Approve Hold
                    </button>
                  </div>
                )}
              </div>
            ))}
            {holdRequests.length === 0 && (
              <div className="p-12 text-center text-gray-400 font-medium">
                No active plot hold requests.
              </div>
            )}
          </div>
        </div>
      )}



      {/* --- TAB 5: PLOT INVENTORY MANAGER --- */}
      {activeTab === 'inventory' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Top Controls */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider">Project Name</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                  className="bg-gray-50 border border-gray-300 text-gray-900 font-extrabold text-base rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-80 shadow-xs"
                >
                  {projects.map(proj => (
                    <option key={proj.id} value={proj.id}>{proj.name}</option>
                  ))}
                </select>
              </div>

              {/* Action Buttons — Admin Only for Add/Delete */}
              <div className="flex flex-wrap items-center gap-2 sm:pt-4">
                {userIsAdmin && (
                  <button
                    type="button"
                    onClick={handleOpenAddPlotModal}
                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs px-4 py-2.5 rounded-lg border border-blue-200 flex items-center gap-1.5 transition-colors shadow-xs"
                    title="Add a new plot to this project"
                  >
                    ➕ Add Plot
                  </button>
                )}
                {userIsAdmin && (
                  <button
                    type="button"
                    onClick={handleDeleteSelectedPlots}
                    disabled={selectedPlotIds.length === 0 || isSavingInventory}
                    className="bg-red-550 hover:bg-red-650 text-white disabled:bg-gray-100 disabled:text-gray-400 font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                    style={{ backgroundColor: selectedPlotIds.length > 0 ? '#ef4444' : undefined }}
                    title="Delete selected plot(s)"
                  >
                    🗑️ Delete Plot ({selectedPlotIds.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveInventory}
                  disabled={isSavingInventory}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors shadow shadow-emerald-200/50 disabled:bg-emerald-400"
                >
                  {isSavingInventory ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : '💾'} Save Inventory
                </button>
                <button
                  type="button"
                  onClick={handleApplyEverywhere}
                  disabled={isSavingInventory}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors shadow shadow-indigo-200/50 disabled:bg-indigo-400"
                >
                  🌍 Apply Everywhere
                </button>
              </div>
            </div>

            {/* Statistics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 pt-2">
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-center shadow-2xs">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Total Plots</p>
                <p className="text-xl font-black text-slate-800 mt-1 font-mono">
                  {editingPlots.length}
                </p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-center shadow-2xs">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Available</p>
                <p className="text-xl font-black text-emerald-900 mt-1 font-mono">
                  {editingPlots.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length}
                </p>
              </div>
              <div className="bg-red-50 border border-red-200 p-3.5 rounded-xl text-center shadow-2xs">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-red-700">Sold</p>
                <p className="text-xl font-black text-red-900 mt-1 font-mono font-bold">
                  {editingPlots.filter(p => p.status === PlotStatus.SOLD).length}
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-center shadow-2xs">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">Hold</p>
                <p className="text-xl font-black text-amber-900 mt-1 font-mono">
                  {editingPlots.filter(p => p.status === PlotStatus.HOLD).length}
                </p>
              </div>
              <div className="bg-purple-50 border border-purple-200 p-3.5 rounded-xl text-center shadow-2xs">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700">Booked</p>
                <p className="text-xl font-black text-purple-900 mt-1 font-mono">
                  {editingPlots.filter(p => p.status === PlotStatus.BOOKED).length}
                </p>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-xl text-center shadow-2xs">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">Reserved</p>
                <p className="text-xl font-black text-indigo-900 mt-1 font-mono">
                  {editingPlots.filter(p => p.status === PlotStatus.RESERVED || p.status === PlotStatus.INVESTMENT).length}
                </p>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Search and Table Info Header */}
            <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-gray-800 text-sm">Editable Inventory Spreadsheet</h3>
                <p className="text-xs text-gray-500 mt-0.5">Directly click, type, and choose options below to change values. Changes are safe until Saved.</p>
              </div>
              
              {/* Search Box */}
              <div className="relative w-full sm:w-72 shrink-0">
                <input
                  type="text"
                  value={plotSearchQuery}
                  onChange={(e) => setPlotSearchQuery(e.target.value)}
                  placeholder="Quick search plot no, facing, status..."
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                />
                {plotSearchQuery && (
                  <button 
                    onClick={() => setPlotSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* The Table */}
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs table-fixed min-w-[950px]">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-600 font-extrabold uppercase tracking-wider bg-gray-50/70 sticky top-0 z-10 backdrop-blur-xs">
                    <th className="py-3 px-3 text-center w-12">
                      <input
                        type="checkbox"
                        checked={filteredEditingPlots.length > 0 && filteredEditingPlots.every(p => selectedPlotIds.includes(p.id))}
                        onChange={() => {
                          const isAllSel = filteredEditingPlots.length > 0 && filteredEditingPlots.every(p => selectedPlotIds.includes(p.id));
                          if (isAllSel) {
                            const filteredIds = filteredEditingPlots.map(p => p.id);
                            setSelectedPlotIds(prev => prev.filter(id => !filteredIds.includes(id)));
                          } else {
                            const filteredIds = filteredEditingPlots.map(p => p.id);
                            setSelectedPlotIds(prev => Array.from(new Set([...prev, ...filteredIds])));
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-3 w-28">Plot No.</th>
                    <th className="py-3 px-3 w-28">Dimensions</th>
                    <th className="py-3 px-3 w-28">Area (Sq.Ft)</th>
                    <th className="py-3 px-3 w-36">Facing</th>
                    <th className="py-3 px-3 w-36">Category</th>
                    <th className="py-3 px-3 w-36">Price (INR)</th>
                    <th className="py-3 px-3 w-40">Status</th>
                    <th className="py-3 px-3">Coordinates</th>
                    <th className="py-3 px-3 w-20 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                  {filteredEditingPlots.map((plot, index) => {
                    const plotsPerRow = Math.ceil(editingPlots.length / 6);
                    const rowIndex = Math.floor(index / (plotsPerRow || 1));
                    const rowPlotIndex = index % (plotsPerRow || 1);
                    const dynamicCoordStr = `Row ${rowIndex + 1}, Pos ${rowPlotIndex + 1}`;
                    const isSelected = selectedPlotIds.includes(plot.id);

                    return (
                      <tr key={plot.id} className={`hover:bg-slate-50/50 transition-colors ${isSelected ? 'bg-blue-50/30' : ''}`}>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPlotIds(prev => [...prev, plot.id]);
                              } else {
                                setSelectedPlotIds(prev => prev.filter(id => id !== plot.id));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={plot.number}
                            onChange={(e) => handleUpdatePlotField(plot.id, 'number', e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-none font-bold text-gray-900"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={plot.dimensions}
                            onChange={(e) => handleUpdatePlotField(plot.id, 'dimensions', e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-none font-semibold text-gray-800"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            value={plot.size}
                            onChange={(e) => handleUpdatePlotField(plot.id, 'size', Number(e.target.value))}
                            className="w-full bg-white border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-none text-gray-800"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            value={plot.facing}
                            onChange={(e) => handleUpdatePlotField(plot.id, 'facing', e.target.value as PlotFacing)}
                            className="w-full bg-white border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-none font-medium text-gray-700"
                          >
                            {Object.values(PlotFacing).map(face => (
                              <option key={face} value={face}>{face}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            value={plot.type}
                            onChange={(e) => handleUpdatePlotField(plot.id, 'type', e.target.value as PlotType)}
                            className="w-full bg-white border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-none font-medium text-gray-700"
                          >
                            {Object.values(PlotType).map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            value={plot.price}
                            onChange={(e) => handleUpdatePlotField(plot.id, 'price', Number(e.target.value))}
                            className="w-full bg-white border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-none text-gray-800 font-semibold"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            value={plot.status}
                            onChange={(e) => handleUpdatePlotField(plot.id, 'status', e.target.value as PlotStatus)}
                            className="w-full bg-white border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-none font-bold"
                            style={{ color: getStatusStyles(plot.status).fill }}
                          >
                            {Object.values(PlotStatus).map(st => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={(plot as any).coordinates || ''}
                            onChange={(e) => handleUpdatePlotField(plot.id, 'coordinates' as any, e.target.value)}
                            placeholder={dynamicCoordStr}
                            className="w-full bg-white border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-none text-gray-500 italic placeholder-gray-400"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {userIsAdmin ? (
                            <button
                              type="button"
                              disabled={deletingPlotId === plot.id}
                              onClick={() => handleDeleteSinglePlot(plot)}
                              className="bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 border border-red-200 px-2.5 py-1 rounded text-xs font-bold transition-colors inline-flex items-center gap-1"
                              title="Delete plot"
                            >
                              {deletingPlotId === plot.id ? (
                                <div className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <>🗑️ Del</>
                              )}
                            </button>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredEditingPlots.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-gray-400 font-bold text-sm bg-gray-50/50">
                        {plotSearchQuery ? '🔍 No matching plots found in search results.' : '📝 No plots available. Click "+ Add Plot" to build the inventory!'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer Stats */}
            <div className="p-4 bg-slate-50 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-gray-500">
              <span>Showing {filteredEditingPlots.length} of {editingPlots.length} Plots</span>
              <span>Select plots to bulk delete</span>
            </div>
          </div>
        </div>
      )}
      {/* Official Project Plot Sizes & Inventory Reference Panel */}
      <div className="mt-8 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 bg-slate-50 border-b border-gray-200 flex items-center gap-2">
          <span className="text-xl">📋</span>
          <div>
            <h3 className="text-lg font-bold text-gray-800 font-sans tracking-tight">Official Project Plot Sizes & Inventory Reference</h3>
            <p className="text-xs text-gray-500 mt-0.5">Admin single-source of truth for project plot inventories and official dimensions.</p>
          </div>
        </div>
        <div className="p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider bg-gray-50/50">
                  <th className="py-2.5 px-3">Project Name</th>
                  <th className="py-2.5 px-3 text-center">Total Plots</th>
                  <th className="py-2.5 px-3">Official Plot Sizes / Dimensions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {projects.map(proj => (
                  <tr key={proj.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-3 font-bold text-gray-900">{proj.name}</td>
                    <td className="py-3 px-3 text-center font-bold text-blue-800 bg-blue-50/30">{proj.totalPlots}</td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1">
                        {(proj.plotSizes || '').split(',').map((size) => (
                          <span key={size} className="bg-emerald-50 text-emerald-800 border border-emerald-100 px-1.5 py-0.5 rounded font-semibold text-[10px] flex items-center gap-0.5">
                            🟢 {size.trim()}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ADD PLOT MODAL — ADMIN ONLY */}
      {isAddPlotModalOpen && userIsAdmin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">➕</span>
                <h3 className="text-base font-black text-slate-800">
                  Add Plot — {projects.find(p => p.id === selectedProjectId)?.name || 'Project'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setIsAddPlotModalOpen(false); setAddPlotError(null); }}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg transition-colors"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Error banner if validation fails */}
            {addPlotError && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
                <span className="text-base">⚠️</span>
                <span>{addPlotError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleConfirmAddPlot} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Plot Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Plot Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newPlotNumber}
                    onChange={(e) => { setNewPlotNumber(e.target.value); setAddPlotError(null); }}
                    placeholder="e.g. P-101"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                  />
                </div>

                {/* Plot Size */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Plot Size (sq. ft.) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={newPlotSize}
                    onChange={(e) => setNewPlotSize(e.target.value)}
                    placeholder="1200"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                  />
                </div>

                {/* Plot Category — strictly 6 options */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Plot Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newPlotCategory}
                    onChange={(e) => setNewPlotCategory(e.target.value as PlotType)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                  >
                    {PLOT_CATEGORY_OPTIONS.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Price */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={newPlotPrice}
                    onChange={(e) => setNewPlotPrice(e.target.value)}
                    placeholder="1500000"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                  />
                </div>

                {/* Dimensions */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Dimensions (e.g. 30x40)
                  </label>
                  <input
                    type="text"
                    value={newPlotDimensions}
                    onChange={(e) => setNewPlotDimensions(e.target.value)}
                    placeholder="30x40"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                  />
                </div>

                {/* Facing */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Facing Direction
                  </label>
                  <select
                    value={newPlotFacing}
                    onChange={(e) => setNewPlotFacing(e.target.value as PlotFacing)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                  >
                    <option value={PlotFacing.NORTH}>North</option>
                    <option value={PlotFacing.SOUTH}>South</option>
                    <option value={PlotFacing.EAST}>East</option>
                    <option value={PlotFacing.WEST}>West</option>
                    <option value={PlotFacing.NORTH_EAST}>North-East</option>
                    <option value={PlotFacing.NOT_CONFIGURED}>Not Configured</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Initial Status
                  </label>
                  <select
                    value={newPlotStatus}
                    onChange={(e) => setNewPlotStatus(e.target.value as PlotStatus)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                  >
                    <option value={PlotStatus.AVAILABLE}>Available</option>
                    <option value={PlotStatus.HOLD}>Hold</option>
                    <option value={PlotStatus.BOOKED}>Booked</option>
                    <option value={PlotStatus.SOLD}>Sold</option>
                    <option value={PlotStatus.INVESTMENT}>Investment</option>
                    <option value={PlotStatus.RESALE}>For Resale</option>
                    <option value={PlotStatus.RESERVED}>Reserved</option>
                  </select>
                </div>

                {/* Mortgaged checkbox */}
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={newPlotIsMortgaged}
                      onChange={(e) => setNewPlotIsMortgaged(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <span>Is Mortgaged</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setIsAddPlotModalOpen(false); setAddPlotError(null); }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingPlot}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  {isAddingPlot ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Adding to Firestore...</span>
                    </>
                  ) : (
                    <span>Add Plot</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE PLOT CONFIRMATION DIALOG — ADMIN ONLY */}
      {plotToDelete && userIsAdmin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                ⚠️
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-2">
                Are you sure you want to delete this plot?
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                Plot <span className="font-bold text-slate-700">{plotToDelete.number}</span> will be permanently removed from this project.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setPlotToDelete(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingPlotId === plotToDelete.id}
                  onClick={() => handleExecuteDeletePlot(plotToDelete)}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  {deletingPlotId === plotToDelete.id ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Delete</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visual Toast Notification Banner */}
      {internalToast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2.5 border transition-all ${
          internalToast.type === 'error'
            ? 'bg-red-50 text-red-700 border-red-200 shadow-red-100'
            : internalToast.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-emerald-100'
            : 'bg-slate-900 text-white border-slate-800 shadow-slate-900/30'
        }`}>
          <span className="text-base">{internalToast.type === 'error' ? '⚠️' : internalToast.type === 'success' ? '✅' : 'ℹ️'}</span>
          <span>{internalToast.message}</span>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
