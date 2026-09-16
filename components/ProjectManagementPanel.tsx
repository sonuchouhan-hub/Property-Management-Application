import React, { useState, useMemo, useRef } from 'react';
import { Project, Plot, PlotStatus, PlotFacing, PlotType, NearbyAmenity } from '../types';
import Icon from './common/Icon';
import { generateProjectDescription } from '../services/geminiService';
import { MOCK_PROJECTS, STATUS_COLORS, getNormalizedStatus, getStatusStyles } from '../constants';
import { db, auth, sanitizeData } from '../services/firebaseService';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';

interface ProjectManagementPanelProps {
  project: Project;
  isAdmin?: boolean;
  onClose: () => void;
  onSave: (updatedProject: Project) => void;
  onDuplicate: (project: Project) => void;
  onDelete: (projectId: number) => void;
  onApplyChangesEverywhere: (updatedProject: Project) => void;
}

// Helper to compress images inside the panel
const compressImage = (base64Str: string, maxWidth = 1000, maxHeight = 800): Promise<string> => {
  return new Promise((resolve) => {
    if (!base64Str.startsWith('data:image/')) {
      resolve(base64Str);
      return;
    }
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
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
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = () => resolve(base64Str);
  });
};

export const ProjectManagementPanel: React.FC<ProjectManagementPanelProps> = ({
  project: initialProject,
  isAdmin = true,
  onClose,
  onSave,
  onDuplicate,
  onDelete,
  onApplyChangesEverywhere,
}) => {
  // Use state to track editable copy of the project
  const [project, setProject] = useState<Project>({
    ...initialProject,
    layout: initialProject.layout ? [...initialProject.layout] : [],
    plots: initialProject.plots ? [...initialProject.plots] : [],
    imageUrls: initialProject.imageUrls ? [...initialProject.imageUrls] : [],
    galleryImages: initialProject.galleryImages ? [...initialProject.galleryImages] : (initialProject.imageUrls ? [...initialProject.imageUrls] : []),
    amenities: initialProject.amenities ? [...initialProject.amenities] : [],
    nearbyAmenities: initialProject.nearbyAmenities ? [...initialProject.nearbyAmenities] : [],
    historicalPrices: initialProject.historicalPrices ? [...initialProject.historicalPrices] : [],
  });

  const [activeTab, setActiveTab] = useState<'general' | 'stats_pricing' | 'inventory' | 'sizes_amenities' | 'images'>('general');
  const [plotSearchQuery, setPlotSearchQuery] = useState('');
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [selectedPlotId, setSelectedPlotId] = useState<number | null>(null);
  const [selectedInventoryPlotIds, setSelectedInventoryPlotIds] = useState<number[]>([]);

  // Zoom Layout Map Image state
  const [isLayoutZoomed, setIsLayoutZoomed] = useState(false);

  // Add Plot Modal State
  const [isAddPlotModalOpen, setIsAddPlotModalOpen] = useState(false);
  const [addPlotError, setAddPlotError] = useState<string | null>(null);
  const [plotActionNotification, setPlotActionNotification] = useState<string | null>(null);
  const [newPlotNumber, setNewPlotNumber] = useState('');
  const [newPlotSize, setNewPlotSize] = useState('1200');
  const [newPlotDimensions, setNewPlotDimensions] = useState('30x40');
  const [newPlotCategory, setNewPlotCategory] = useState<PlotType>(PlotType.NORMAL);
  const [newPlotPrice, setNewPlotPrice] = useState('1500000');
  const [newPlotFacing, setNewPlotFacing] = useState<PlotFacing>(PlotFacing.EAST);
  const [newPlotStatus, setNewPlotStatus] = useState<PlotStatus>(PlotStatus.AVAILABLE);

  // Delete Plot Modal State
  const [plotToDelete, setPlotToDelete] = useState<{ id: number; number: string } | null>(null);

  // 1. Plot Sizes List parsing & management
  const plotSizesList = useMemo(() => {
    if (!project.plotSizes) return [];
    return project.plotSizes.split(',').map(s => s.trim()).filter(Boolean);
  }, [project.plotSizes]);

  const handleUpdatePlotSizesStr = (newSizes: string[]) => {
    setProject(prev => ({
      ...prev,
      plotSizes: newSizes.join(', ')
    }));
  };

  const handleAddPlotSize = (size: string) => {
    if (!size.trim()) return;
    const current = [...plotSizesList];
    if (!current.includes(size.trim())) {
      current.push(size.trim());
      handleUpdatePlotSizesStr(current);
    }
  };

  const handleDeletePlotSize = (sizeToDelete: string) => {
    const current = plotSizesList.filter(s => s !== sizeToDelete);
    handleUpdatePlotSizesStr(current);
  };

  // 2. NearBy Amenities / Locations
  const predefinedNearbyCategories = [
    { key: 'Hospital', label: '🏥 Hospital' },
    { key: 'School', label: '🏫 School' },
    { key: 'College', label: '🎓 College' },
    { key: 'Mall', label: '🛍️ Mall' },
    { key: 'Railway Station', label: '🚂 Railway Station' },
    { key: 'Airport', label: '✈️ Airport' },
    { key: 'Temple', label: '🕌 Temple' },
    { key: 'Restaurant', label: '🍽️ Restaurant' },
    { key: 'Bus Stand', label: '🚌 Bus Stand' }
  ];

  const getNearbyDistance = (category: string) => {
    const found = project.nearbyAmenities?.find(n => n.category.toLowerCase() === category.toLowerCase());
    return found ? found.distance : '';
  };

  const handleSetNearbyDistance = (category: string, name: string, distance: string) => {
    const current = project.nearbyAmenities ? [...project.nearbyAmenities] : [];
    const idx = current.findIndex(n => n.category.toLowerCase() === category.toLowerCase());
    if (idx !== -1) {
      if (!distance.trim()) {
        current.splice(idx, 1);
      } else {
        current[idx] = { ...current[idx], name: name || category, distance };
      }
    } else if (distance.trim()) {
      current.push({
        id: `nb-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: name || category,
        distance,
        category,
      });
    }
    setProject(prev => ({ ...prev, nearbyAmenities: current }));
  };

  // 3. Price History Records
  const handleAddPriceHistory = (year: number, price: number, notes?: string) => {
    const current = project.historicalPrices ? [...project.historicalPrices] : [];
    current.push({ year, price, notes });
    // Sort descending by year
    current.sort((a, b) => b.year - a.year);
    setProject(prev => ({ ...prev, historicalPrices: current }));
  };

  const handleDeletePriceHistory = (index: number) => {
    const current = project.historicalPrices ? [...project.historicalPrices] : [];
    current.splice(index, 1);
    setProject(prev => ({ ...prev, historicalPrices: current }));
  };

  // 4. Inventory List Operations
  const filteredPlots = useMemo(() => {
    const plots = project.layout || [];
    if (!plotSearchQuery.trim()) return plots;
    const q = plotSearchQuery.toLowerCase();
    return plots.filter(p =>
      p.number.toLowerCase().includes(q) ||
      p.dimensions.toLowerCase().includes(q) ||
      (p.facing || '').toLowerCase().includes(q) ||
      (p.status || '').toLowerCase().includes(q) ||
      (p.type || '').toLowerCase().includes(q) ||
      (p.customerName || '').toLowerCase().includes(q)
    );
  }, [project.layout, plotSearchQuery]);

  const handleAddPlot = () => {
    console.log('[ADD PLOT DEBUG] Button clicked');
    console.log('[ADD TRACE 1] Add Plot clicked');
    if (!isAdmin) {
      alert("Only an authenticated Admin can add a plot.");
      return;
    }
    const currentPlots = project.layout ? [...project.layout] : [];
    let nextNum = currentPlots.length + 1;
    let suggestedNumber = `P-${String(nextNum).padStart(3, '0')}`;
    while (currentPlots.some(p => p.number.trim().toLowerCase() === suggestedNumber.toLowerCase())) {
      nextNum++;
      suggestedNumber = `P-${String(nextNum).padStart(3, '0')}`;
    }

    setNewPlotNumber(suggestedNumber);
    setNewPlotSize('1200');
    setNewPlotDimensions('30x40');
    setNewPlotCategory(PlotType.NORMAL);
    setNewPlotPrice('1500000');
    setNewPlotFacing(PlotFacing.EAST);
    setNewPlotStatus(PlotStatus.AVAILABLE);
    setAddPlotError(null);
    setIsAddPlotModalOpen(true);
  };

  const handleConfirmAddPlot = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    console.log('[ADD TRACE 2] Handler executed');
    console.log('[ADD TRACE 3] Current user UID:', auth.currentUser?.uid || 'none');
    console.log('[ADD TRACE 4] Admin status:', isAdmin);
    console.log('[ADD TRACE 5] Project ID:', project.id);
    setAddPlotError(null);

    const cleanNumber = newPlotNumber.trim();
    if (!cleanNumber) {
      setAddPlotError("Please enter a valid plot number.");
      return;
    }

    const currentPlots = project.layout ? [...project.layout] : [];
    if (currentPlots.some(p => p.number.trim().toLowerCase() === cleanNumber.toLowerCase())) {
      setAddPlotError("This plot number already exists in this project.");
      return;
    }

    const size = parseFloat(newPlotSize) || 1200;
    const price = parseFloat(newPlotPrice) || 1500000;
    const dim = newPlotDimensions.trim() || `${size} sq.ft.`;

    const newPlot: Plot = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      number: cleanNumber,
      size,
      dimensions: dim,
      facing: newPlotFacing,
      status: newPlotStatus,
      price,
      type: newPlotCategory,
      category: newPlotCategory,
      isMortgaged: false,
      layoutX: Math.floor(Math.random() * 60) + 10,
      layoutY: Math.floor(Math.random() * 60) + 10,
      layoutW: 6,
      layoutH: 8,
    };

    console.log('[ADD TRACE 6] Plot data:', newPlot);
    console.log('[ADD TRACE 7] Firestore path:', `projects/${project.id}`);
    console.log('[ADD TRACE 8] Starting write');

    if (project.id) {
      try {
        const projRef = doc(db, 'projects', String(project.id));
        const projSnap = await getDoc(projRef);
        let basePlots: Plot[] = [];
        if (projSnap.exists()) {
          const snapData = projSnap.data();
          const snapPlots = snapData?.plots || snapData?.layout || [];
          basePlots = snapPlots.length > 0 ? snapPlots : currentPlots;
        } else {
          basePlots = currentPlots;
        }

        if (basePlots.some(p => p.number.trim().toLowerCase() === cleanNumber.toLowerCase())) {
          setAddPlotError("This plot number already exists in this project.");
          return;
        }

        const updated = [...basePlots, newPlot];
        const totalPlots = updated.length;
        const availablePlots = updated.filter(
          p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE
        ).length;

        const updatedProj: Project = {
          ...project,
          layout: updated,
          plots: updated,
          totalPlots,
          availablePlots,
        };

        await setDoc(projRef, sanitizeData({
          ...updatedProj,
          layout: updated,
          plots: updated,
          totalPlots,
          availablePlots,
          updatedAt: new Date().toISOString()
        }), { merge: true });
        console.log('[ADD TRACE 9] Firestore write SUCCESS');

        setProject(updatedProj);
        if (onApplyChangesEverywhere) {
          onApplyChangesEverywhere(updatedProj);
        }
        setIsAddPlotModalOpen(false);
        setPlotActionNotification(`Plot ${cleanNumber} added successfully.`);
        setTimeout(() => setPlotActionNotification(null), 5000);
      } catch (err: any) {
        console.error('[ADD ERROR]');
        console.error(err?.code || 'NO_CODE');
        console.error(err?.message || String(err));
        console.error('[ADD ERROR DETAILS]', err);
        setAddPlotError(err?.message || "Failed to write to database.");
        return;
      }
    }
    setIsAddPlotModalOpen(false);
  };

  const handleDeletePlot = (plotId: number, plotNumber?: string) => {
    const pNumber = plotNumber || project.layout?.find(p => p.id === plotId)?.number || 'selected plot';
    console.log('[DELETE TRACE 1] Delete clicked');
    console.log('[DELETE TRACE 3] Current user UID:', auth.currentUser?.uid || 'none');
    console.log('[DELETE TRACE 4] Admin status:', isAdmin);
    console.log('[DELETE TRACE 5] Project ID:', project.id);
    console.log('[DELETE TRACE 6] Plot ID:', plotId);
    console.log('[DELETE TRACE 7] Plot number:', pNumber);

    if (!isAdmin) {
      alert("Only an authenticated Admin can delete a plot.");
      return;
    }

    setPlotToDelete({ id: plotId, number: pNumber });
  };

  const handleExecuteDeletePlot = async (target: { id: number; number: string }) => {
    setPlotToDelete(null);

    console.log('[DELETE TRACE 2] Handler executed');
    console.log('[DELETE TRACE 3] Current user UID:', auth.currentUser?.uid || 'none');
    console.log('[DELETE TRACE 4] Admin status:', isAdmin);
    console.log('[DELETE TRACE 5] Project ID:', project.id);
    console.log('[DELETE TRACE 6] Plot ID:', target.id);
    console.log('[DELETE TRACE 7] Plot number:', target.number);
    console.log('[DELETE TRACE 8] Firestore path:', `projects/${project.id}`);
    console.log('[DELETE TRACE 9] Starting delete');

    if (project.id) {
      try {
        const projRef = doc(db, 'projects', String(project.id));
        const projSnap = await getDoc(projRef);
        let basePlots: Plot[] = [];
        if (projSnap.exists()) {
          const snapData = projSnap.data();
          const snapPlots = snapData?.plots || snapData?.layout || [];
          basePlots = snapPlots.length > 0 ? snapPlots : (project.layout || project.plots || []);
        } else {
          basePlots = project.layout || project.plots || [];
        }

        const updated = basePlots.filter(
          p => p.id !== target.id && p.number.trim().toLowerCase() !== target.number.trim().toLowerCase()
        );
        const totalPlots = updated.length;
        const availablePlots = updated.filter(
          p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE
        ).length;

        const updatedProj: Project = {
          ...project,
          layout: updated,
          plots: updated,
          totalPlots,
          availablePlots,
        };

        await setDoc(projRef, sanitizeData({
          ...updatedProj,
          layout: updated,
          plots: updated,
          totalPlots,
          availablePlots,
          updatedAt: new Date().toISOString()
        }), { merge: true });
        console.log('[DELETE TRACE 10] Firestore delete SUCCESS');

        setProject(updatedProj);
        if (onApplyChangesEverywhere) {
          onApplyChangesEverywhere(updatedProj);
        }
        setPlotActionNotification(`Plot ${target.number} deleted successfully.`);
        setTimeout(() => setPlotActionNotification(null), 5000);
      } catch (err: any) {
        console.error('[DELETE ERROR]');
        console.error(err?.code || 'NO_CODE');
        console.error(err?.message || String(err));
        console.error('[DELETE ERROR DETAILS]', err);
        alert(`Failed to delete plot: ${err?.message || String(err)}`);
      }
    }
  };

  const handleDeleteSelectedPlots = () => {
    if (!isAdmin) {
      alert("Only an authenticated Admin can delete plots.");
      return;
    }
    if (selectedInventoryPlotIds.length === 0) return;
    if (!window.confirm("Are you sure you want to delete this plot?")) {
      return;
    }
    const currentPlots = project.layout ? [...project.layout] : [];
    const updated = currentPlots.filter(p => !selectedInventoryPlotIds.includes(p.id));
    const totalPlots = updated.length;
    const availablePlots = updated.filter(
      p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE
    ).length;

    const updatedProj: Project = {
      ...project,
      layout: updated,
      plots: updated,
      totalPlots,
      availablePlots,
    };
    setProject(updatedProj);
    setSelectedInventoryPlotIds([]);

    // Persist deletion directly to Firestore
    if (project.id) {
      updateDoc(doc(db, 'projects', String(project.id)), sanitizeData({
        layout: updated,
        plots: updated,
        totalPlots,
        availablePlots,
        updatedAt: new Date().toISOString()
      })).catch(err => console.error("Firestore sync error:", err));
    }
  };

  const handleDuplicatePlot = (plot: Plot) => {
    const currentPlots = project.layout ? [...project.layout] : [];
    const duplicatedPlot: Plot = {
      ...plot,
      id: Date.now() + Math.floor(Math.random() * 1000),
      number: `${plot.number}-Dup`,
      layoutX: plot.layoutX ? Math.min(plot.layoutX + 3, 95) : 15,
      layoutY: plot.layoutY ? Math.min(plot.layoutY + 3, 95) : 15,
    };
    const updated = [...currentPlots, duplicatedPlot];
    setProject(prev => ({
      ...prev,
      layout: updated,
      plots: updated,
      totalPlots: updated.length,
    }));
  };

  const handleUpdatePlotField = (plotId: number, field: keyof Plot | string, value: any) => {
    const currentPlots = project.layout ? [...project.layout] : [];
    const updated = currentPlots.map(p => {
      if (p.id === plotId) {
        return { ...p, [field]: value };
      }
      return p;
    });
    setProject(prev => ({
      ...prev,
      layout: updated,
      plots: updated,
    }));
  };

  const handleValidateAndSave = () => {
    const plots = project.layout || project.plots || [];
    const seen = new Set<string>();
    for (const p of plots) {
      const num = (p.number || '').trim();
      if (!num) {
        alert('Plot number cannot be empty. Please ensure all plots have a valid plot number.');
        return;
      }
      const lower = num.toLowerCase();
      if (seen.has(lower)) {
        alert(`Duplicate Plot Number Detected: "${p.number}". Each plot within the project must have a unique number.`);
        return;
      }
      seen.add(lower);
    }
    onSave(project);
  };

  // Merge Plot
  const handleMergePlots = () => {
    if (selectedInventoryPlotIds.length < 2) return;
    const currentPlots = project.layout ? [...project.layout] : [];
    const toMerge = currentPlots.filter(p => selectedInventoryPlotIds.includes(p.id));
    if (toMerge.length < 2) return;

    // Create a merged plot representing combined area/price
    const basePlot = toMerge[0];
    const totalSize = toMerge.reduce((acc, p) => acc + p.size, 0);
    const totalPrice = toMerge.reduce((acc, p) => acc + p.price, 0);
    const mergedNo = toMerge.map(p => p.number).join('+');

    const mergedPlot: Plot = {
      ...basePlot,
      id: Date.now(),
      number: mergedNo,
      size: totalSize,
      price: totalPrice,
      dimensions: `${Math.round(Math.sqrt(totalSize))}x${Math.round(Math.sqrt(totalSize))}`,
      status: PlotStatus.AVAILABLE,
    };

    const remaining = currentPlots.filter(p => !selectedInventoryPlotIds.includes(p.id));
    const updated = [...remaining, mergedPlot];

    setProject(prev => ({
      ...prev,
      layout: updated,
      plots: updated,
      totalPlots: updated.length,
    }));
    setSelectedInventoryPlotIds([]);
  };

  // Split Plot
  const handleSplitPlot = (plotId: number) => {
    const currentPlots = project.layout ? [...project.layout] : [];
    const target = currentPlots.find(p => p.id === plotId);
    if (!target) return;

    const halfSize = Math.round(target.size / 2);
    const halfPrice = Math.round(target.price / 2);

    const plotA: Plot = {
      ...target,
      id: Date.now() + 1,
      number: `${target.number}A`,
      size: halfSize,
      price: halfPrice,
      layoutW: target.layoutW ? Math.round(target.layoutW / 2) : 3,
    };

    const plotB: Plot = {
      ...target,
      id: Date.now() + 2,
      number: `${target.number}B`,
      size: halfSize,
      price: halfPrice,
      layoutX: target.layoutX && target.layoutW ? Math.round(target.layoutX + (target.layoutW / 2)) : 20,
      layoutW: target.layoutW ? Math.round(target.layoutW / 2) : 3,
    };

    const remaining = currentPlots.filter(p => p.id !== plotId);
    const updated = [...remaining, plotA, plotB];

    setProject(prev => ({
      ...prev,
      layout: updated,
      plots: updated,
      totalPlots: updated.length,
    }));
  };

  // 6. Image & Gallery Management
  const handleUploadImageFile = async (e: React.ChangeEvent<HTMLInputElement>, target: 'cover' | 'layoutMap' | 'gallery') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = async (event) => {
        const rawBase64 = event.target?.result as string;
        if (!rawBase64) return;
        const compressed = await compressImage(rawBase64);

        if (target === 'cover') {
          setProject(prev => ({
            ...prev,
            coverImage: compressed,
            imageUrls: Array.from(new Set([compressed, ...(prev.galleryImages || [])]))
          }));
        } else if (target === 'layoutMap') {
          setProject(prev => ({
            ...prev,
            layoutMapImage: compressed,
            layoutMap: {
              id: `map-${Date.now()}`,
              name: file.name,
              type: 'legal',
              size: `${Math.round(file.size / 1024)} KB`,
              uploadedAt: new Date().toLocaleDateString(),
              uploadedBy: 'Admin',
              url: compressed
            }
          }));
        } else if (target === 'gallery') {
          setProject(prev => {
            const currentGallery = prev.galleryImages ? [...prev.galleryImages] : (prev.imageUrls ? [...prev.imageUrls] : []);
            const updatedGallery = [...currentGallery, compressed];
            return {
              ...prev,
              galleryImages: updatedGallery,
              imageUrls: Array.from(new Set([prev.coverImage || updatedGallery[0], ...updatedGallery])).filter(Boolean) as string[]
            };
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveGalleryImage = (img: string) => {
    setProject(prev => {
      const currentGallery = prev.galleryImages ? prev.galleryImages.filter(g => g !== img) : [];
      const updatedCover = prev.coverImage === img ? (currentGallery[0] || '') : prev.coverImage;
      return {
        ...prev,
        coverImage: updatedCover,
        galleryImages: currentGallery,
        imageUrls: Array.from(new Set([updatedCover, ...currentGallery])).filter(Boolean) as string[]
      };
    });
  };

  const handleSetCoverImage = (img: string) => {
    setProject(prev => ({
      ...prev,
      coverImage: img,
      imageUrls: Array.from(new Set([img, ...(prev.galleryImages || [])]))
    }));
  };

  // Reordering gallery images (Shift left/right)
  const handleReorderGalleryImage = (index: number, direction: 'left' | 'right') => {
    const current = project.galleryImages ? [...project.galleryImages] : [];
    if (direction === 'left' && index > 0) {
      const temp = current[index];
      current[index] = current[index - 1];
      current[index - 1] = temp;
    } else if (direction === 'right' && index < current.length - 1) {
      const temp = current[index];
      current[index] = current[index + 1];
      current[index + 1] = temp;
    }
    setProject(prev => ({
      ...prev,
      galleryImages: current,
      imageUrls: Array.from(new Set([prev.coverImage || current[0], ...current])).filter(Boolean) as string[]
    }));
  };

  // Import / Export
  const handleExportPlots = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project.layout, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${project.name.replace(/\s+/g, '_')}_plots_inventory.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportPlots = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          // Validate structure loosely
          const valid = parsed.map((item, idx) => ({
            id: item.id || Date.now() + idx,
            number: item.number || `P-${idx + 1}`,
            size: Number(item.size) || 1000,
            dimensions: item.dimensions || '20x50',
            facing: item.facing || PlotFacing.EAST,
            status: item.status || PlotStatus.AVAILABLE,
            price: Number(item.price) || 1500000,
            type: item.type || PlotType.NORMAL,
            isMortgaged: !!item.isMortgaged,
            layoutX: item.layoutX || 10,
            layoutY: item.layoutY || 10,
            layoutW: item.layoutW || 6,
            layoutH: item.layoutH || 8,
          }));
          setProject(prev => ({
            ...prev,
            layout: valid,
            plots: valid,
            totalPlots: valid.length,
          }));
          alert(`Successfully imported ${valid.length} plots!`);
        }
      } catch {
        alert("Failed to parse JSON file. Ensure correct structure.");
      }
    };
    reader.readAsText(file);
  };

  const handleGenerateDescriptionWithAI = async () => {
    setIsGeneratingDesc(true);
    const desc = await generateProjectDescription(project);
    setProject(prev => ({ ...prev, description: desc }));
    setIsGeneratingDesc(false);
  };

  // Total Bookings stats calculator
  const totalSoldBooked = useMemo(() => {
    const pl = project.layout || [];
    return pl.filter(p => p.status === PlotStatus.SOLD || p.status === PlotStatus.BOOKED).length;
  }, [project.layout]);

  const bookingPercentage = useMemo(() => {
    const total = project.layout?.length || 1;
    return Math.round((totalSoldBooked / total) * 100);
  }, [project.layout, totalSoldBooked]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex justify-center items-center p-4">
      <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header Block */}
        <div className="bg-white border-b border-slate-200 p-4 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2.5 rounded-xl text-amber-700">
              <span className="text-xl">🛠️</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 leading-none">Dhanshri Master Studio</h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Project Admin Engine for <span className="font-bold text-blue-700">"{project.name}"</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onApplyChangesEverywhere(project)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-md transition-all flex items-center gap-1.5"
            >
              🌍 Apply Changes Everywhere
            </button>
            <button
              onClick={handleValidateAndSave}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-md transition-all flex items-center gap-1"
            >
              💾 Save Changes
            </button>
            <button
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold text-xs p-2 rounded-xl transition-all"
              title="Close panel"
            >
              <Icon name="close" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Studio Content Workspace */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Tab Menu Column */}
          <div className="w-64 bg-white border-r border-slate-200 p-4 flex flex-col gap-1 shrink-0 overflow-y-auto">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-2 block">Management Hub</span>
            
            <button
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl font-extrabold text-xs text-left transition-all ${activeTab === 'general' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              📄 General & Location Info
            </button>
            
            <button
              onClick={() => setActiveTab('stats_pricing')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl font-extrabold text-xs text-left transition-all ${activeTab === 'stats_pricing' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              📈 Stats, Booking & Pricing
            </button>

            <button
              onClick={() => setActiveTab('images')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl font-extrabold text-xs text-left transition-all ${activeTab === 'images' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              🖼️ Official Map & Gallery
            </button>

            <button
              onClick={() => setActiveTab('sizes_amenities')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl font-extrabold text-xs text-left transition-all ${activeTab === 'sizes_amenities' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              📐 Sizes & Amenities Hub
            </button>

            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl font-extrabold text-xs text-left transition-all ${activeTab === 'inventory' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              📊 Plot Inventory Spreadsheet
            </button>

            <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-2">
              <button
                onClick={() => {
                  if (confirm("Are you sure you want to duplicate this entire project development?")) {
                    onDuplicate(project);
                  }
                }}
                className="w-full bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-extrabold text-[11px] py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all"
              >
                👥 Duplicate Project
              </button>
              <button
                onClick={() => {
                  if (confirm(`CRITICAL WARNING: Are you absolutely sure you want to permanently delete the development "${project.name}"? This action CANNOT be undone.`)) {
                    onDelete(project.id);
                  }
                }}
                className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold text-[11px] py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all"
              >
                🗑️ Delete Project
              </button>
            </div>
          </div>

          {/* Active Tab Workspace Panel */}
          <div className="flex-1 bg-slate-50 p-6 overflow-y-auto">
            
            {/* --- TAB 1: GENERAL INFORMATION --- */}
            {activeTab === 'general' && (
              <div className="space-y-6 max-w-4xl">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">General Development Specifications</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Project Name</label>
                      <input
                        type="text"
                        value={project.name}
                        onChange={(e) => setProject(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Project Code (Reference)</label>
                      <input
                        type="text"
                        value={project.projectCode || ''}
                        onChange={(e) => setProject(prev => ({ ...prev, projectCode: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Location Map Address</label>
                      <input
                        type="text"
                        value={project.location}
                        onChange={(e) => setProject(prev => ({ ...prev, location: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Project Status</label>
                      <select
                        value={project.status || 'Ongoing'}
                        onChange={(e) => setProject(prev => ({ ...prev, status: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Ongoing">Ongoing</option>
                        <option value="Upcoming">Upcoming</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">TNCP Approval Status</label>
                      <input
                        type="text"
                        value={project.approval || 'TNCP Approved'}
                        onChange={(e) => setProject(prev => ({ ...prev, approval: e.target.value }))}
                        placeholder="e.g., TNCP Approved"
                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">RERA Registration No.</label>
                      <input
                        type="text"
                        value={project.specialFeature || ''}
                        onChange={(e) => setProject(prev => ({ ...prev, specialFeature: e.target.value }))}
                        placeholder="e.g., RERA Reg. No. P-IND-24-1234"
                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-500">Description Overview</label>
                      <button
                        onClick={handleGenerateDescriptionWithAI}
                        disabled={isGeneratingDesc}
                        className="bg-purple-50 hover:bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-1 rounded-md border border-purple-200 inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        {isGeneratingDesc ? 'Generating...' : '✨ Rewrite with Gemini AI'}
                      </button>
                    </div>
                    <textarea
                      value={project.description}
                      rows={5}
                      onChange={(e) => setProject(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl p-3 text-xs font-normal leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Coordinates setup */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Geographical Coordinates (Google Maps Position)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Latitude (Lat)</label>
                      <input
                        type="number"
                        step="any"
                        value={project.coords?.lat || 22.7196}
                        onChange={(e) => setProject(prev => ({ ...prev, coords: { ...(prev.coords || {lat: 22.7196, lng: 75.8577}), lat: Number(e.target.value) } }))}
                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Longitude (Lng)</label>
                      <input
                        type="number"
                        step="any"
                        value={project.coords?.lng || 75.8577}
                        onChange={(e) => setProject(prev => ({ ...prev, coords: { ...(prev.coords || {lat: 22.7196, lng: 75.8577}), lng: Number(e.target.value) } }))}
                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-semibold"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- TAB 2: STATS, BOOKING & PRICING --- */}
            {activeTab === 'stats_pricing' && (
              <div className="space-y-6 max-w-4xl">
                
                {/* Statistics Row */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Development Statistics & Bookings</h3>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Total Plots</label>
                      <input
                        type="number"
                        value={project.totalPlots}
                        onChange={(e) => setProject(prev => ({ ...prev, totalPlots: Number(e.target.value) }))}
                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Available Plots</label>
                      <input
                        type="number"
                        value={project.availablePlots}
                        onChange={(e) => setProject(prev => ({ ...prev, availablePlots: Number(e.target.value) }))}
                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Calculated Booking Rate</label>
                      <div className="w-full border border-slate-100 bg-slate-50 rounded-xl p-2.5 text-xs font-extrabold text-slate-700 flex items-center justify-between">
                        <span>{totalSoldBooked} Sold/Booked</span>
                        <span className="text-blue-700">{bookingPercentage}% Done</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pricing Rates */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Pricing Configuration</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Residential rate (e.g. ₹1,450 / Sq.Ft.)</label>
                      <input
                        type="text"
                        value={project.residentialRate || ''}
                        onChange={(e) => setProject(prev => ({ ...prev, residentialRate: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Commercial rate (e.g. ₹2,200 / Sq.Ft.)</label>
                      <input
                        type="text"
                        value={project.commercialRate || ''}
                        onChange={(e) => setProject(prev => ({ ...prev, commercialRate: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Launch Base Price (Optional)</label>
                      <input
                        type="text"
                        value={project.paymentOptions || ''}
                        onChange={(e) => setProject(prev => ({ ...prev, paymentOptions: e.target.value }))}
                        placeholder="e.g. Starting from ₹15 Lakhs"
                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Price History */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Historical Pricing Records</h3>
                    <button
                      type="button"
                      onClick={() => {
                        const y = Number(prompt("Enter Year (e.g., 2024):") || '0');
                        const p = Number(prompt("Enter Price per Sq.Ft in INR (e.g., 1450):") || '0');
                        if (y && p) handleAddPriceHistory(y, p, 'Admin added');
                      }}
                      className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-extrabold px-3 py-1.5 rounded-lg border border-blue-200"
                    >
                      ➕ Add Record
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                          <th className="py-2">Year</th>
                          <th className="py-2">Price (INR/sq.ft)</th>
                          <th className="py-2">Notes</th>
                          <th className="py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                        {project.historicalPrices?.map((record, idx) => (
                          <tr key={idx}>
                            <td className="py-2">{record.year}</td>
                            <td className="py-2">₹{record.price}</td>
                            <td className="py-2 font-normal text-slate-500">{record.notes || '-'}</td>
                            <td className="py-2 text-right">
                              <button
                                onClick={() => handleDeletePriceHistory(idx)}
                                className="text-red-500 hover:text-red-700 font-bold"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                        {(!project.historicalPrices || project.historicalPrices.length === 0) && (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-slate-400 italic font-bold">
                              No price history defined. Click Add Record to compile.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* --- TAB 3: OFFICIAL MAP & GALLERY --- */}
            {activeTab === 'images' && (
              <div className="space-y-6 max-w-4xl">
                
                {/* Official Layout Map */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Official Project Layout Map</h3>
                      <p className="text-xs text-slate-500 font-medium">Upload PNG, JPG, WEBP, or PDF to represent the primary visual layout background</p>
                    </div>
                    {project.layoutMapImage && (
                      <button
                        onClick={() => setProject(prev => ({ ...prev, layoutMapImage: undefined, layoutMap: undefined }))}
                        className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-rose-100"
                      >
                        🗑️ Delete Map
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center bg-slate-50 hover:bg-slate-100/50 transition-colors relative">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => handleUploadImageFile(e, 'layoutMap')}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <span className="text-3xl block mb-2">🗺️</span>
                      <p className="text-xs font-extrabold text-slate-700">Drag & Drop or Click to Select File</p>
                      <p className="text-[10px] text-slate-400 mt-1">Supports PNG, JPG, WEBP, or PDF</p>
                    </div>

                    <div className="bg-slate-100 rounded-2xl p-4 flex flex-col justify-center items-center border border-slate-200 min-h-[160px] relative">
                      {project.layoutMapImage ? (
                        <>
                          <img
                            src={project.layoutMapImage}
                            alt="Project layout blueprint"
                            referrerPolicy="no-referrer"
                            className="max-h-36 object-contain rounded-lg shadow-sm border border-slate-200 cursor-pointer"
                            onClick={() => setIsLayoutZoomed(true)}
                          />
                          <p className="text-[10px] text-slate-400 mt-2 font-mono truncate max-w-full">
                            {project.layoutMap?.name || 'layout_map.jpg'} ({project.layoutMap?.size || 'N/A'})
                          </p>
                          <button
                            onClick={() => setIsLayoutZoomed(true)}
                            className="bg-slate-900/70 text-white text-[10px] font-bold px-2.5 py-1 rounded-md absolute bottom-6 hover:bg-slate-900"
                          >
                            🔍 Zoom Preview
                          </button>
                        </>
                      ) : (
                        <div className="text-center text-slate-400 italic text-xs font-bold">
                          No official blueprint loaded. Default vector layouts will be auto-generated.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Project Gallery Images */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div>
                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Project Media Gallery</h3>
                    <p className="text-xs text-slate-500 font-medium">Reorder, select a cover photo, or upload additional showcase photos of the development site</p>
                  </div>

                  <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center bg-slate-50 hover:bg-slate-100/50 transition-colors relative">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleUploadImageFile(e, 'gallery')}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <span className="text-3xl block mb-2">📸</span>
                    <p className="text-xs font-extrabold text-slate-700">Select Multiple Gallery Images</p>
                  </div>

                  {project.galleryImages && project.galleryImages.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                      {project.galleryImages.map((img, idx) => {
                        const isCover = project.coverImage === img;
                        return (
                          <div key={idx} className={`relative group rounded-xl overflow-hidden bg-slate-100 border transition-all ${isCover ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-slate-200 hover:border-slate-300'}`}>
                            <img
                              src={img}
                              alt={`Gallery item ${idx + 1}`}
                              referrerPolicy="no-referrer"
                              className="w-full aspect-[4/3] object-cover"
                            />
                            
                            <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleReorderGalleryImage(idx, 'left')}
                                  disabled={idx === 0}
                                  className="bg-white/20 hover:bg-white/40 disabled:opacity-20 text-white p-1 rounded font-bold text-xs"
                                >
                                  ◀
                                </button>
                                <button
                                  onClick={() => handleReorderGalleryImage(idx, 'right')}
                                  disabled={idx === project.galleryImages!.length - 1}
                                  className="bg-white/20 hover:bg-white/40 disabled:opacity-20 text-white p-1 rounded font-bold text-xs"
                                >
                                  ▶
                                </button>
                              </div>
                              <button
                                onClick={() => handleRemoveGalleryImage(img)}
                                className="bg-red-500 hover:bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded"
                              >
                                Delete
                              </button>
                            </div>

                            {/* Cover selector badge */}
                            <button
                              onClick={() => handleSetCoverImage(img)}
                              className={`absolute top-2 left-2 text-[9px] font-black px-2 py-0.5 rounded-full shadow ${isCover ? 'bg-blue-600 text-white' : 'bg-white/90 text-slate-700 hover:bg-white'}`}
                            >
                              {isCover ? '⭐ Cover' : 'Set Cover'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-400 italic text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl">
                      Gallery is empty. Upload showcase photos of the development!
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- TAB 4: SIZES & AMENITIES --- */}
            {activeTab === 'sizes_amenities' && (
              <div className="space-y-6 max-w-4xl">
                
                {/* Plot Size Management */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Plot Size Specifications</h3>
                      <p className="text-xs text-slate-500 font-medium">Add, edit, or delete the list of standardized plot dimensions available for purchase</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newSize = prompt("Enter standard size (e.g. 20×50):") || '';
                        handleAddPlotSize(newSize);
                      }}
                      className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-extrabold px-3 py-1.5 rounded-lg border border-blue-200"
                    >
                      ➕ Add Size
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2.5 pt-1">
                    {plotSizesList.map((size) => (
                      <span
                        key={size}
                        className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-black text-slate-700 flex items-center gap-1.5"
                      >
                        📐 {size}
                        <button
                          onClick={() => handleDeletePlotSize(size)}
                          className="text-slate-400 hover:text-red-500 font-bold ml-1 text-[11px]"
                          title="Remove size"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    {plotSizesList.length === 0 && (
                      <p className="text-xs text-slate-400 italic font-bold">No standardized plot sizes configured yet.</p>
                    )}
                  </div>
                </div>

                {/* Amenities */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Internal Amenities & Perks</h3>
                      <p className="text-xs text-slate-500 font-medium">Manage showcase amenities listed in the development (e.g. Garden, Clubhouse, Temple)</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const am = prompt("Enter amenity name (e.g. Garden, Swimming Pool):") || '';
                        if (am.trim()) {
                          const updated = [...project.amenities, am.trim()];
                          setProject(prev => ({ ...prev, amenities: updated }));
                        }
                      }}
                      className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-extrabold px-3 py-1.5 rounded-lg border border-blue-200"
                    >
                      ➕ Add Amenity
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2.5 pt-1">
                    {project.amenities.map((amenity, idx) => (
                      <span
                        key={idx}
                        className="bg-blue-50/70 border border-blue-100 text-blue-800 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
                      >
                        🌟 {amenity}
                        <button
                          onClick={() => {
                            const updated = project.amenities.filter((_, i) => i !== idx);
                            setProject(prev => ({ ...prev, amenities: updated }));
                          }}
                          className="text-blue-400 hover:text-red-500 font-bold ml-1 text-[11px]"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Nearby Locations / distances */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Nearby Locations & Distances Hub</h3>
                  <p className="text-xs text-slate-500 font-medium">Specify distance and landmark names for surrounding public facilities</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    {predefinedNearbyCategories.map(({ key, label }) => {
                      const currentDist = getNearbyDistance(key);
                      return (
                        <div key={key} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-700 w-36 shrink-0">{label}</span>
                          <input
                            type="text"
                            placeholder="e.g. 3.5 km (Indore Hosp)"
                            value={currentDist}
                            onChange={(e) => handleSetNearbyDistance(key, `${key} Near`, e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-semibold focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* --- TAB 5: PLOT INVENTORY SPREADSHEET --- */}
            {activeTab === 'inventory' && (
              <div className="space-y-6">
                
                {plotActionNotification && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-base">✅</span>
                      <span>{plotActionNotification}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPlotActionNotification(null)}
                      className="text-emerald-600 hover:text-emerald-800 font-bold px-2 py-0.5 rounded cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}
                
                {/* Control Actions bar */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    {isAdmin && (
                      <button
                        onClick={handleAddPlot}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-extrabold px-3 py-2 rounded-lg border border-blue-200 flex items-center gap-1.5"
                      >
                        ➕ Add Plot
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={handleDeleteSelectedPlots}
                        disabled={selectedInventoryPlotIds.length === 0}
                        className="bg-red-50 hover:bg-red-100 disabled:opacity-40 text-red-700 text-xs font-extrabold px-3 py-2 rounded-lg border border-red-200 flex items-center gap-1.5"
                      >
                        🗑️ Delete Selected ({selectedInventoryPlotIds.length})
                      </button>
                    )}
                    <button
                      onClick={handleMergePlots}
                      disabled={selectedInventoryPlotIds.length < 2}
                      className="bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 text-indigo-700 text-xs font-extrabold px-3 py-2 rounded-lg border border-indigo-200 flex items-center gap-1.5"
                    >
                      🔗 Merge Plots
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportPlots}
                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-extrabold px-3 py-2 rounded-lg border border-emerald-200 flex items-center gap-1.5"
                    >
                      📤 Export JSON
                    </button>
                    <div className="relative">
                      <button className="bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-extrabold px-3 py-2 rounded-lg border border-orange-200 flex items-center gap-1.5 cursor-pointer">
                        📥 Import JSON
                      </button>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportPlots}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Live Search and Spreadsheet */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-3">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Spreadsheet Inventory Table</h4>
                      <p className="text-[11px] text-slate-500 font-medium">Click, select, or type in the fields below. Data matches the exact real database schema.</p>
                    </div>

                    <input
                      type="text"
                      placeholder="Filter by plot, dimension, status, facing..."
                      value={plotSearchQuery}
                      onChange={(e) => setPlotSearchQuery(e.target.value)}
                      className="w-full sm:w-64 bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-semibold placeholder-slate-400"
                    />
                  </div>

                  <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-left border-collapse text-xs table-fixed min-w-[1200px]">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 font-extrabold uppercase tracking-wider sticky top-0 z-10">
                          <th className="py-2.5 px-3 text-center w-12">
                            <input
                              type="checkbox"
                              checked={filteredPlots.length > 0 && filteredPlots.every(p => selectedInventoryPlotIds.includes(p.id))}
                              onChange={() => {
                                const allSel = filteredPlots.length > 0 && filteredPlots.every(p => selectedInventoryPlotIds.includes(p.id));
                                if (allSel) {
                                  setSelectedInventoryPlotIds([]);
                                } else {
                                  setSelectedInventoryPlotIds(filteredPlots.map(p => p.id));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                            />
                          </th>
                          <th className="py-2.5 px-3 w-28">Plot No</th>
                          <th className="py-2.5 px-3 w-28">Dimensions</th>
                          <th className="py-2.5 px-3 w-28">Area (sq.ft)</th>
                          <th className="py-2.5 px-3 w-32">Facing</th>
                          <th className="py-2.5 px-3 w-32">Category</th>
                          <th className="py-2.5 px-3 w-32">Price (INR)</th>
                          <th className="py-2.5 px-3 w-32">Status</th>
                          <th className="py-2.5 px-3 w-40">Owner (Buyer)</th>
                          <th className="py-2.5 px-3 w-28">X-Coord (%)</th>
                          <th className="py-2.5 px-3 w-28">Y-Coord (%)</th>
                          <th className="py-2.5 px-3 w-32 text-center">Duplicate/Split</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {filteredPlots.map((plot) => {
                          const isSel = selectedInventoryPlotIds.includes(plot.id);
                          return (
                            <tr key={plot.id} className={`hover:bg-slate-50/50 transition-colors ${isSel ? 'bg-blue-50/30' : ''}`}>
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSel}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedInventoryPlotIds(prev => [...prev, plot.id]);
                                    } else {
                                      setSelectedInventoryPlotIds(prev => prev.filter(id => id !== plot.id));
                                    }
                                  }}
                                  className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={plot.number}
                                  onChange={(e) => handleUpdatePlotField(plot.id, 'number', e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-slate-800 font-extrabold focus:ring-1 focus:ring-blue-500"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={plot.dimensions}
                                  onChange={(e) => handleUpdatePlotField(plot.id, 'dimensions', e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 focus:ring-1 focus:ring-blue-500"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  value={plot.size}
                                  onChange={(e) => handleUpdatePlotField(plot.id, 'size', Number(e.target.value))}
                                  className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 focus:ring-1 focus:ring-blue-500"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <select
                                  value={plot.facing}
                                  onChange={(e) => handleUpdatePlotField(plot.id, 'facing', e.target.value as PlotFacing)}
                                  className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 focus:ring-1 focus:ring-blue-500"
                                >
                                  {Object.values(PlotFacing).map(f => (
                                    <option key={f} value={f}>{f}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 px-3">
                                <select
                                  value={plot.type}
                                  onChange={(e) => handleUpdatePlotField(plot.id, 'type', e.target.value as PlotType)}
                                  className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 focus:ring-1 focus:ring-blue-500"
                                >
                                  {Object.values(PlotType).map(t => (
                                    <option key={t} value={t}>{t}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  value={plot.price}
                                  onChange={(e) => handleUpdatePlotField(plot.id, 'price', Number(e.target.value))}
                                  className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 focus:ring-1 focus:ring-blue-500 font-extrabold"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <select
                                  value={plot.status}
                                  onChange={(e) => handleUpdatePlotField(plot.id, 'status', e.target.value as PlotStatus)}
                                  className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 font-bold"
                                  style={{ color: getStatusStyles(plot.status).fill }}
                                >
                                  {Object.values(PlotStatus).map(st => (
                                    <option key={st} value={st}>{st}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={plot.customerName || ''}
                                  placeholder="e.g. Rahul Sharma"
                                  onChange={(e) => handleUpdatePlotField(plot.id, 'customerName', e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 focus:ring-1 focus:ring-blue-500"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  step="any"
                                  value={plot.layoutX || 0}
                                  onChange={(e) => handleUpdatePlotField(plot.id, 'layoutX', Number(e.target.value))}
                                  className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 focus:ring-1 focus:ring-blue-500"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  step="any"
                                  value={plot.layoutY || 0}
                                  onChange={(e) => handleUpdatePlotField(plot.id, 'layoutY', Number(e.target.value))}
                                  className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 focus:ring-1 focus:ring-blue-500"
                                />
                              </td>
                              <td className="py-2 px-3 flex justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleDuplicatePlot(plot)}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded text-[10px] font-bold"
                                  title="Duplicate plot item"
                                >
                                  👥 Dup
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSplitPlot(plot.id)}
                                  className="bg-orange-50 hover:bg-orange-100 text-orange-700 px-2 py-1 rounded text-[10px] font-bold"
                                  title="Split plot into half"
                                >
                                  ✂️ Split
                                </button>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePlot(plot.id, plot.number)}
                                    className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-2 py-1 rounded text-[10px] font-bold"
                                    title="Delete plot"
                                  >
                                    🗑️ Del
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {filteredPlots.length === 0 && (
                          <tr>
                            <td colSpan={12} className="py-8 text-center text-slate-400 font-bold italic">
                              No matching plots found in inventory.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Studio Status / Control footer */}
        <div className="bg-white border-t border-slate-200 p-4 shrink-0 flex items-center justify-between text-xs font-bold text-slate-500">
          <span>Active Plots Configured: {project.layout?.length || 0}</span>
          <div className="flex gap-4">
            <button
              onClick={() => {
                if (confirm("Reset layout and inventory back to default templates? All your customized modifications will be deleted.")) {
                  // Find mock default
                  const originalMock = MOCK_PROJECTS.find(m => m.id === project.id);
                  if (originalMock) {
                    const resetPlots = [...(originalMock.plots || [])];
                    const avail = resetPlots.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length;
                    setProject({
                      ...originalMock,
                      layout: resetPlots,
                      plots: resetPlots,
                      availablePlots: avail,
                      imageUrls: [...originalMock.imageUrls],
                    });
                  }
                }
              }}
              className="text-amber-600 hover:text-amber-800"
            >
              🔄 Reset Project
            </button>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700"
            >
              Discard Changes
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen blueprint zoom modal */}
      {isLayoutZoomed && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <button
            onClick={() => setIsLayoutZoomed(false)}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white rounded-full p-2"
          >
            <Icon name="close" className="w-6 h-6" />
          </button>
          <img
            src={project.layoutMapImage}
            alt="Layout blueprint zoomed"
            referrerPolicy="no-referrer"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}

      {/* Add Plot Modal */}
      {isAddPlotModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <span>➕</span> Add Plot — {project.name}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddPlotModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {addPlotError && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
                <span>⚠️</span>
                <span>{addPlotError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmAddPlot} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Plot Number *</label>
                  <input
                    type="text"
                    required
                    value={newPlotNumber}
                    onChange={(e) => { setNewPlotNumber(e.target.value); setAddPlotError(null); }}
                    placeholder="e.g. P-101"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Plot Size (sq. ft.) *</label>
                  <input
                    type="text"
                    required
                    value={newPlotSize}
                    onChange={(e) => setNewPlotSize(e.target.value)}
                    placeholder="1200"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Dimensions</label>
                  <input
                    type="text"
                    value={newPlotDimensions}
                    onChange={(e) => setNewPlotDimensions(e.target.value)}
                    placeholder="e.g. 30x40"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Facing Direction</label>
                  <select
                    value={newPlotFacing}
                    onChange={(e) => setNewPlotFacing(e.target.value as PlotFacing)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-800"
                  >
                    <option value={PlotFacing.NORTH}>North</option>
                    <option value={PlotFacing.SOUTH}>South</option>
                    <option value={PlotFacing.EAST}>East</option>
                    <option value={PlotFacing.WEST}>West</option>
                    <option value={PlotFacing.NORTH_EAST}>North-East</option>
                    <option value={PlotFacing.NOT_CONFIGURED}>Not Configured</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Plot Category *</label>
                  <select
                    value={newPlotCategory}
                    onChange={(e) => setNewPlotCategory(e.target.value as PlotType)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-800"
                  >
                    {[PlotType.NORMAL, PlotType.RESIDENTIAL, PlotType.COMMERCIAL, PlotType.EWS, PlotType.LIG, PlotType.SR].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={newPlotPrice}
                    onChange={(e) => setNewPlotPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddPlotModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md"
                >
                  Add Plot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Plot Confirmation Modal */}
      {plotToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              ⚠️
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-2">
              Are you sure you want to delete this plot?
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Plot <span className="font-bold text-slate-700">{plotToDelete.number}</span> will be permanently removed.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setPlotToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleExecuteDeletePlot(plotToDelete)}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-md"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


