import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Project, Plot, PlotStatus, PlotFacing, PlotType } from '../types';
import Icon from './common/Icon';
import { doc } from 'firebase/firestore';
import { db, sanitizeData, trackedSetDoc as setDoc } from '../services/firebaseService';
import { STATUS_COLORS, getNormalizedStatus, getStatusStyles } from '../constants';

interface InteractiveProjectMapProps {
  project: Project;
  isAdmin: boolean;
  onUpdateProject?: (updatedProject: Project, isLocalOnly?: boolean) => void;
  onBookSiteVisit?: (project: Project, plot: Plot) => void;
  selectedPlot?: Plot | null;
  onSelectPlot?: (plot: Plot | null) => void;
  externalSearchQuery?: string;
  externalStatusFilter?: string;
  externalFacingFilter?: string;
}

// Map interface for holding Google Sheet parsed data
interface GoogleSheetPlotData {
  projectName: string;
  plotNumber: string;
  size?: number;
  category?: string;
  price?: number;
  status?: PlotStatus;
  facing?: PlotFacing;
  block?: string;
  salesExecutive?: string;
  customerName?: string;
  bookingDate?: string;
  lastUpdated?: string;
}

// Auto-sync configuration. To enable automatic background sync and periodic writes in the future, set this to true.
const ENABLE_AUTO_SYNC_BACKGROUND_WRITES = false;

export const InteractiveProjectMap: React.FC<InteractiveProjectMapProps> = ({
  project,
  isAdmin,
  onUpdateProject,
  onBookSiteVisit,
  selectedPlot: selectedPlotProp,
  onSelectPlot,
  externalSearchQuery,
  externalStatusFilter,
  externalFacingFilter,
}) => {
  // Map Container & Transform States
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [hoveredPlot, setHoveredPlot] = useState<Plot | null>(null);
  
  const [selectedPlotInternal, setSelectedPlotInternal] = useState<Plot | null>(null);
  const [selectedPlotLiveDetails, setSelectedPlotLiveDetails] = useState<any | null>(null);

  // Unified State & SetState for Selected Plot
  const selectedPlot = selectedPlotProp !== undefined ? selectedPlotProp : selectedPlotInternal;
  const setSelectedPlot = (plot: Plot | null) => {
    if (onSelectPlot) {
      onSelectPlot(plot);
    } else {
      setSelectedPlotInternal(plot);
    }
  };

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [blockFilter, setBlockFilter] = useState<string>('All');
  const [facingFilter, setFacingFilter] = useState<string>('All');
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(10000000);
  const [minSize, setMinSize] = useState<number>(0);
  const [maxSize, setMaxSize] = useState<number>(5000);

  // Resolve filter values (fallback to external overrides if provided)
  const activeSearchQuery = externalSearchQuery !== undefined ? externalSearchQuery : searchQuery;
  const activeStatusFilter = externalStatusFilter !== undefined ? externalStatusFilter : statusFilter;
  const activeFacingFilter = externalFacingFilter !== undefined ? externalFacingFilter : facingFilter;

  // Google Sheets Integration State
  const [spreadsheetId, setSpreadsheetId] = useState<string>(project.spreadsheetId || '');
  const [appsScriptUrl, setAppsScriptUrl] = useState<string>(project.appsScriptUrl || '');
  const [showSetupGuide, setShowSetupGuide] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [liveSheetData, setLiveSheetData] = useState<Map<string, GoogleSheetPlotData>>(new Map());
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [isUsingLiveSync, setIsUsingLiveSync] = useState<boolean>(false);

  // Production-Grade Live Inventory Diagnostics States
  const [lastModifiedTimestamp, setLastModifiedTimestamp] = useState<string | null>(() => {
    return localStorage.getItem(`sheet_last_mod_${project.id}`) || null;
  });
  const [lastChecksum, setLastChecksum] = useState<string | null>(() => {
    return localStorage.getItem(`sheet_checksum_${project.id}`) || null;
  });
  const [totalRecordsLoaded, setTotalRecordsLoaded] = useState<number>(() => {
    const cached = localStorage.getItem(`sheet_total_rec_${project.id}`);
    return cached ? parseInt(cached, 10) : 0;
  });
  const [apiResponseTime, setApiResponseTime] = useState<number | null>(null);
  const [lastSyncDuration, setLastSyncDuration] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'live' | 'syncing' | 'offline'>('live');
  const [plotsUpdatedCount, setPlotsUpdatedCount] = useState<number>(0);
  const [syncSuccess, setSyncSuccess] = useState<boolean | null>(null);
  const [lastSyncedDate, setLastSyncedDate] = useState<Date | null>(null);
  const [timeSinceLastSync, setTimeSinceLastSync] = useState<string>('never');
  const [syncNotification, setSyncNotification] = useState<string | null>(null);
  const [sheetWarnings, setSheetWarnings] = useState<string[]>([]);

  const lastSyncedDateRef = useRef<Date | null>(null);

  // Dynamic relative time countdown for "Last synced: X seconds ago" indicator
  useEffect(() => {
    const updateRelativeTime = () => {
      if (!lastSyncedDateRef.current) {
        setTimeSinceLastSync('never');
        return;
      }
      const diffSecs = Math.floor((Date.now() - lastSyncedDateRef.current.getTime()) / 1000);
      if (diffSecs < 5) {
        setTimeSinceLastSync('just now');
      } else if (diffSecs < 60) {
        setTimeSinceLastSync(`${diffSecs} seconds ago`);
      } else {
        const diffMins = Math.floor(diffSecs / 60);
        setTimeSinceLastSync(`${diffMins} minute${diffMins > 1 ? 's' : ''} ago`);
      }
    };

    updateRelativeTime();
    const interval = setInterval(updateRelativeTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Pinch-to-zoom for Mobile support
  const touchStartDist = useRef<number | null>(null);
  const touchStartZoom = useRef<number>(1);

  // Setup auto-refresh every 30 seconds if we are synced
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (ENABLE_AUTO_SYNC_BACKGROUND_WRITES && isUsingLiveSync && (spreadsheetId || appsScriptUrl)) {
      intervalId = setInterval(() => {
        fetchGoogleSheetData(spreadsheetId, true, appsScriptUrl);
      }, 30000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isUsingLiveSync, spreadsheetId, appsScriptUrl, lastModifiedTimestamp, lastChecksum]);

  // Handle page visibility changes and focus to trigger an automatic revisit sync
  useEffect(() => {
    const handleRevisit = () => {
      if (ENABLE_AUTO_SYNC_BACKGROUND_WRITES && document.visibilityState === 'visible' && (spreadsheetId || appsScriptUrl)) {
        console.log('[Sync] User revisited page. Syncing live inventory...');
        fetchGoogleSheetData(spreadsheetId, true, appsScriptUrl);
      }
    };
    const handleFocus = () => {
      if (ENABLE_AUTO_SYNC_BACKGROUND_WRITES && (spreadsheetId || appsScriptUrl)) {
        console.log('[Sync] Window focused. Syncing live inventory...');
        fetchGoogleSheetData(spreadsheetId, true, appsScriptUrl);
      }
    };

    if (ENABLE_AUTO_SYNC_BACKGROUND_WRITES) {
      document.addEventListener('visibilitychange', handleRevisit);
      window.addEventListener('focus', handleFocus);
    }
    return () => {
      document.removeEventListener('visibilitychange', handleRevisit);
      window.removeEventListener('focus', handleFocus);
    };
  }, [spreadsheetId, appsScriptUrl, lastModifiedTimestamp, lastChecksum]);

  // Load project-specific sheet ID and Apps Script URL from firebase on project load
  useEffect(() => {
    const hasSheet = !!(project.spreadsheetId || project.appsScriptUrl);
    if (hasSheet) {
      setSpreadsheetId(project.spreadsheetId || '');
      setAppsScriptUrl(project.appsScriptUrl || '');
      fetchGoogleSheetData(project.spreadsheetId || '', false, project.appsScriptUrl || '');
    } else {
      setSpreadsheetId('');
      setAppsScriptUrl('');
      setLiveSheetData(new Map());
      setLastSyncedTime(null);
      setLastSyncedDate(null);
      lastSyncedDateRef.current = null;
      setIsUsingLiveSync(false);
      setSheetError(null);
      setConnectionStatus('live');
    }
  }, [project.id]);

  // Handle CSS Fullscreen element setup
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => handleFitToScreen(), 100);
  };

  // Helper string hashing function for fast, low-overhead client checksum comparison
  const computeStringHash = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return hash.toString();
  };

  // CSV / REST API Reader & Parser from Google Sheets or Apps Script Web App
  const fetchGoogleSheetData = async (sheetId: string, silent = false, overrideAppsScriptUrl?: string) => {
    const currentAppsScriptUrl = overrideAppsScriptUrl !== undefined ? overrideAppsScriptUrl : appsScriptUrl;
    if (!sheetId && !currentAppsScriptUrl) return;
    
    setConnectionStatus('syncing');
    if (!silent) setIsSyncing(true);
    setSheetError(null);
    setSyncSuccess(null);
    const startTime = performance.now();

    try {
      let rows: string[][] = [];
      const cleanId = sheetId ? sheetId.trim() : '';
      let isChanged = true;
      let newLastModified = lastModifiedTimestamp;

      if (currentAppsScriptUrl && currentAppsScriptUrl.trim()) {
        // Fetch from Google Apps Script Web App REST API
        let url = currentAppsScriptUrl.trim();
        const urlParams = new URLSearchParams();
        if (cleanId) {
          urlParams.append('spreadsheetId', cleanId);
        }
        // Send lastModifiedTimestamp parameter for lightweight change detection
        if (lastModifiedTimestamp) {
          urlParams.append('lastUpdated', lastModifiedTimestamp);
        }
        
        const fetchUrl = url + (url.includes('?') ? '&' : '?') + urlParams.toString();
        const response = await fetch(fetchUrl);
        if (!response.ok) {
          throw new Error('Google Apps Script Web App returned an error status.');
        }
        const json = await response.json();
        
        if (json.success === false) {
          throw new Error(json.error || 'Apps Script returned an unsuccessful status.');
        }

        // Check if Apps Script returned changed: false
        if (json.changed === false) {
          isChanged = false;
          if (json.lastUpdated) {
            newLastModified = String(json.lastUpdated);
          }
        } else {
          // Changed or doesn't support lightweight check, so parse the data
          if (json.lastUpdated) {
            newLastModified = String(json.lastUpdated);
          }
          
          if (json.rows && Array.isArray(json.rows)) {
            rows = json.rows;
          } else if (json.values && Array.isArray(json.values)) {
            rows = json.values;
          } else if (json.data && Array.isArray(json.data)) {
            const data = json.data;
            if (data.length > 0) {
              const headers = Object.keys(data[0]);
              rows.push(headers);
              data.forEach((item: any) => {
                rows.push(headers.map(h => String(item[h] ?? '')));
              });
            }
          } else if (json.success && json.rows && Array.isArray(json.rows)) {
            rows = json.rows;
          } else {
            throw new Error('Apps Script REST API returned unexpected format. It must return a 2D array under "rows" or "values".');
          }
        }
      } else if (cleanId) {
        // Fetching as public CSV to bypass authorization block and make it incredibly fast
        const csvUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/export?format=csv`;
        const response = await fetch(csvUrl);
        
        if (!response.ok) {
          throw new Error('Google Sheet is not shared as "Anyone with link can view" or ID is incorrect.');
        }

        const csvText = await response.text();
        const csvChecksum = computeStringHash(csvText);

        // If checksum is identical, skip updates
        if (csvChecksum === lastChecksum) {
          isChanged = false;
        } else {
          rows = parseCSV(csvText);
          // Set new checksum
          localStorage.setItem(`sheet_checksum_${project.id}`, csvChecksum);
          setLastChecksum(csvChecksum);
        }
      } else {
        setConnectionStatus('live');
        return;
      }

      const endTime = performance.now();
      const durationMs = Math.round(endTime - startTime);
      setApiResponseTime(durationMs);
      setLastSyncDuration(durationMs);

      const now = new Date();
      setLastSyncedDate(now);
      lastSyncedDateRef.current = now;
      setLastSyncedTime(now.toLocaleTimeString());
      setSyncSuccess(true);
      setConnectionStatus('live');
      setSheetError(null);

      if (!isChanged) {
        console.log('[Sync] Spreadsheet has not changed. Skipping full inventory download.');
        setPlotsUpdatedCount(0);
        setIsUsingLiveSync(true);
        return;
      }

      if (rows.length < 2) {
        throw new Error('No data found or sheet is empty.');
      }

      // Map headers to find column indices
      const headers = rows[0].map(h => h.trim().toLowerCase());
      const indices = {
        projectName: headers.findIndex(h => h.includes('project')),
        plotNumber: headers.findIndex(h => h.includes('plot')),
        size: headers.findIndex(h => h.includes('size') || h.includes('area')),
        category: headers.findIndex(h => h.includes('category') || h.includes('type')),
        price: headers.findIndex(h => h.includes('price') || h.includes('amount') || h.includes('rate')),
        status: headers.findIndex(h => h.includes('status')),
        facing: headers.findIndex(h => h.includes('facing')),
        block: headers.findIndex(h => h.includes('block') || h.includes('sector')),
        salesExecutive: headers.findIndex(h => h.includes('executive') || h.includes('sales')),
        customerName: headers.findIndex(h => h.includes('customer') || h.includes('client')),
        bookingDate: headers.findIndex(h => h.includes('date')),
        lastUpdated: headers.findIndex(h => h.includes('updated')),
      };

      if (indices.plotNumber === -1) {
        throw new Error('Could not find "Plot Number" column in spreadsheet.');
      }

      const sheetPlotMap = new Map<string, GoogleSheetPlotData>();
      let loadedRecords = 0;
      const localWarnings: string[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const plotNo = indices.plotNumber !== -1 ? row[indices.plotNumber]?.trim() : '';
        const projName = indices.projectName !== -1 ? row[indices.projectName]?.trim() : '';
        
        // Skip rows with missing details
        if (!plotNo) continue;

        // Validate plot numbers against the strict project structure
        const isValidPlot = (project.plots || project.layout).some(p => {
          const pNum = p.number.toLowerCase().replace('p-', '').trim();
          const sNum = plotNo.toLowerCase().replace('p-', '').trim();
          return pNum === sNum || p.number.toLowerCase() === plotNo.toLowerCase();
        });

        if (!isValidPlot) {
          console.warn(`[Sheet Sync Warning] Ignored invalid plot "${plotNo}" for ${project.name}. This plot is beyond the ${project.totalPlots} limit.`);
          localWarnings.push(`Row ${i + 1}: Plot "${plotNo}" is invalid (beyond ${project.totalPlots} plots limit). Ignored.`);
          continue;
        }

        loadedRecords++;

        // Parse status to match PlotStatus enum
        let parsedStatus = PlotStatus.AVAILABLE;
        if (indices.status !== -1 && row[indices.status]) {
          const rawStatus = row[indices.status].trim().toLowerCase();
          if (rawStatus.includes('sold') || rawStatus === 'red') parsedStatus = PlotStatus.SOLD;
          else if (rawStatus.includes('book') || rawStatus === 'blue') parsedStatus = PlotStatus.BOOKED;
          else if (rawStatus.includes('hold') || rawStatus === 'yellow') parsedStatus = PlotStatus.HOLD;
          else if (rawStatus.includes('reserve') || rawStatus.includes('invest') || rawStatus === 'gray' || rawStatus === 'purple') parsedStatus = PlotStatus.INVESTMENT;
          else if (rawStatus.includes('resale') || rawStatus === 'teal') parsedStatus = PlotStatus.RESALE;
        }

        // Parse facing to match PlotFacing
        let parsedFacing = PlotFacing.NORTH;
        if (indices.facing !== -1 && row[indices.facing]) {
          const rawFacing = row[indices.facing].trim().toLowerCase();
          if (rawFacing.includes('south')) parsedFacing = PlotFacing.SOUTH;
          else if (rawFacing.includes('east') && !rawFacing.includes('north')) parsedFacing = PlotFacing.EAST;
          else if (rawFacing.includes('west')) parsedFacing = PlotFacing.WEST;
          else if (rawFacing.includes('north-east') || rawFacing.includes('ne')) parsedFacing = PlotFacing.NORTH_EAST;
        }

        // Create data record
        const record: GoogleSheetPlotData = {
          projectName: projName || project.name,
          plotNumber: plotNo,
          size: indices.size !== -1 ? parseFloat(row[indices.size]?.replace(/,/g, '')) || undefined : undefined,
          category: indices.category !== -1 ? row[indices.category]?.trim() : undefined,
          price: indices.price !== -1 ? parseFloat(row[indices.price]?.replace(/,/g, '')) || undefined : undefined,
          status: parsedStatus,
          facing: parsedFacing,
          block: indices.block !== -1 ? row[indices.block]?.trim() : undefined,
          salesExecutive: indices.salesExecutive !== -1 ? row[indices.salesExecutive]?.trim() : undefined,
          customerName: indices.customerName !== -1 ? row[indices.customerName]?.trim() : undefined,
          bookingDate: indices.bookingDate !== -1 ? row[indices.bookingDate]?.trim() : undefined,
          lastUpdated: indices.lastUpdated !== -1 ? row[indices.lastUpdated]?.trim() : undefined,
        };

        // Unique key combines Project Name + Plot Number for robust cross-project accuracy
        const uniqueKey = `${(projName || project.name).toLowerCase()}_${plotNo.toLowerCase()}`;
        sheetPlotMap.set(uniqueKey, record);
      }

      setLiveSheetData(sheetPlotMap);
      setSheetWarnings(localWarnings);
      setTotalRecordsLoaded(loadedRecords);
      localStorage.setItem(`sheet_total_rec_${project.id}`, String(loadedRecords));

      if (newLastModified) {
        setLastModifiedTimestamp(newLastModified);
        localStorage.setItem(`sheet_last_mod_${project.id}`, newLastModified);
      } else {
        const fallbackStamp = now.toISOString();
        setLastModifiedTimestamp(fallbackStamp);
        localStorage.setItem(`sheet_last_mod_${project.id}`, fallbackStamp);
      }

      setIsUsingLiveSync(true);

      // Automatically sync updated statuses and fields into our local plots state
      if (onUpdateProject) {
        let hasChanges = false;
        let updatedCount = 0;
        let notifiedPlotNum: string | null = null;

        const updatedLayout = (project.plots || project.layout).map(plot => {
          const sheetKey = `${project.name.toLowerCase()}_${plot.number.toLowerCase()}`;
          const sheetPlot = sheetPlotMap.get(sheetKey);
          if (sheetPlot) {
            // Safely parse category to PlotType enum
            let parsedType = plot.type;
            if (sheetPlot.category) {
              const catLower = sheetPlot.category.toLowerCase();
              if (catLower.includes('ewa') || catLower.includes('ews')) parsedType = PlotType.EWS;
              else if (catLower.includes('lig')) parsedType = PlotType.LIG;
              else if (catLower.includes('commercial')) parsedType = PlotType.COMMERCIAL;
              else if (catLower.includes('normal') || catLower.includes('general')) parsedType = PlotType.NORMAL;
            }

            const statusDiff = sheetPlot.status && sheetPlot.status !== plot.status;
            const priceDiff = sheetPlot.price !== undefined && sheetPlot.price !== plot.price;
            const sizeDiff = sheetPlot.size !== undefined && sheetPlot.size !== plot.size;
            const facingDiff = sheetPlot.facing && sheetPlot.facing !== plot.facing;
            const typeDiff = parsedType !== plot.type;
            const customerDiff = sheetPlot.customerName !== undefined && sheetPlot.customerName !== plot.customerName;
            const executiveDiff = sheetPlot.salesExecutive !== undefined && sheetPlot.salesExecutive !== plot.salesExecutive;
            const bookingDateDiff = sheetPlot.bookingDate !== undefined && sheetPlot.bookingDate !== plot.bookingDate;
            const blockDiff = sheetPlot.block !== undefined && sheetPlot.block !== plot.block;

            if (statusDiff || priceDiff || sizeDiff || facingDiff || typeDiff || customerDiff || executiveDiff || bookingDateDiff || blockDiff) {
              hasChanges = true;
              updatedCount++;
              
              // Detect conflict if user is currently viewing this plot
              if (selectedPlot && selectedPlot.number.toLowerCase() === plot.number.toLowerCase()) {
                notifiedPlotNum = plot.number;
              }

              return {
                ...plot,
                status: sheetPlot.status || plot.status,
                price: sheetPlot.price !== undefined ? sheetPlot.price : plot.price,
                size: sheetPlot.size !== undefined ? sheetPlot.size : plot.size,
                facing: sheetPlot.facing || plot.facing,
                type: parsedType,
                customerName: sheetPlot.customerName !== undefined ? sheetPlot.customerName : plot.customerName,
                salesExecutive: sheetPlot.salesExecutive !== undefined ? sheetPlot.salesExecutive : plot.salesExecutive,
                bookingDate: sheetPlot.bookingDate !== undefined ? sheetPlot.bookingDate : plot.bookingDate,
                block: sheetPlot.block !== undefined ? sheetPlot.block : plot.block,
                lastUpdated: sheetPlot.lastUpdated || now.toLocaleTimeString() || plot.lastUpdated,
              };
            }
          }
          return plot;
        });

        setPlotsUpdatedCount(updatedCount);

        if (notifiedPlotNum) {
          setSyncNotification(`Plot ${notifiedPlotNum} has been updated from Google Sheets.`);
          setTimeout(() => setSyncNotification(null), 6000);
        }

        if (hasChanges) {
          const availableCount = updatedLayout.filter(
            p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE
          ).length;
          // Passing isLocalOnly = true so that Google Sheets sync only updates local React state and memory,
          // with absolutely zero automated write operations to the Firestore database.
          onUpdateProject({
            ...project,
            layout: updatedLayout,
            availablePlots: availableCount,
            spreadsheetId: cleanId,
            appsScriptUrl: currentAppsScriptUrl,
          }, true);
        }
      }
    } catch (err: any) {
      console.error('Error fetching Google Sheets data:', err);
      setSheetError(err.message || 'Failed to sync live Google Sheets data.');
      setSyncSuccess(false);
      setConnectionStatus('offline');
    } finally {
      setIsSyncing(false);
    }
  };

  // CSV Parser Helper
  const parseCSV = (csvText: string): string[][] => {
    const lines = csvText.split(/\r?\n/);
    return lines.map(line => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    }).filter(row => row.length > 0 && row.some(cell => cell !== ''));
  };

  // Handle linking sheet ID and Apps Script URL from Admin
  const handleLinkSheetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spreadsheetId.trim() && !appsScriptUrl.trim()) return;
    
    // Save to Firestore
    if (onUpdateProject) {
      onUpdateProject({
        ...project,
        spreadsheetId: spreadsheetId.trim(),
        appsScriptUrl: appsScriptUrl.trim(),
      });
      // Set doc on Firestore securely
      try {
        await setDoc(doc(db, 'projects', String(project.id)), sanitizeData({
          ...project,
          spreadsheetId: spreadsheetId.trim(),
          appsScriptUrl: appsScriptUrl.trim(),
        }), { merge: true });
      } catch (err) {
        console.error('Failed to save sheet configuration to firebase:', err);
      }
    }
    fetchGoogleSheetData(spreadsheetId.trim(), false, appsScriptUrl.trim());
  };

  // Helper to resolve plot stats from either public sheet rows or firestore backup
  const resolvePlotLiveStatus = (plot: Plot): PlotStatus => {
    if (!plot) return PlotStatus.AVAILABLE;
    
    // 1. Check live sheet data first if synced
    const sheetKey = `${project.name.toLowerCase().trim()}_${plot.number.toLowerCase().trim()}`;
    if (liveSheetData && liveSheetData[sheetKey] && liveSheetData[sheetKey].status) {
      return liveSheetData[sheetKey].status as PlotStatus;
    }

    // 2. Check plot's stored status
    if (plot.status) {
      const raw = String(plot.status).trim();
      const lower = raw.toLowerCase();
      if (lower === 'available' || lower === 'free' || lower === 'open') return PlotStatus.AVAILABLE;
      if (lower === 'sold') return PlotStatus.SOLD;
      if (lower === 'booked' || lower === 'booking') return PlotStatus.BOOKED;
      if (lower === 'hold' || lower === 'on hold') return PlotStatus.HOLD;
      if (lower === 'reserved' || lower === 'reservation') return PlotStatus.RESERVED;
      if (lower === 'pending') return PlotStatus.PENDING;
      if (lower === 'investment') return PlotStatus.INVESTMENT;
      if (lower === 'for resale' || lower === 'resale') return PlotStatus.RESALE;
      return plot.status;
    }

    // 3. If missing, log warning and return AVAILABLE (never default to SOLD!)
    console.warn(`[Plot Map Warning] Missing status for plot ${plot.number || plot.id} in ${project.name}. Defaulting to Available.`);
    return PlotStatus.AVAILABLE;
  };

  // Compute live plot metrics dynamically
  const liveStats = useMemo(() => {
    const plotsList = project.plots || project.layout || [];
    let total = plotsList.length;
    let available = 0;
    let sold = 0;
    let hold = 0;
    let booked = 0;
    let reserved = 0;
    let pending = 0;

    plotsList.forEach(p => {
      const liveStatus = resolvePlotLiveStatus(p);
      if (liveStatus === PlotStatus.AVAILABLE || liveStatus === PlotStatus.RESALE) available++;
      else if (liveStatus === PlotStatus.SOLD) sold++;
      else if (liveStatus === PlotStatus.HOLD) hold++;
      else if (liveStatus === PlotStatus.BOOKED) booked++;
      else if (liveStatus === PlotStatus.RESERVED || liveStatus === PlotStatus.INVESTMENT) reserved++;
      else if (liveStatus === PlotStatus.PENDING) pending++;
      else available++;
    });

    return { total, available, sold, hold, booked, reserved, pending };
  }, [project.plots, project.layout, liveSheetData]);

  // Extract unique blocks for dropdown filtering
  const uniqueBlocks = useMemo(() => {
    const blocksSet = new Set<string>();
    (project.plots || project.layout).forEach(p => {
      // Find block if specified or parse from plot number (e.g., "A-101" -> "A")
      const sheetKey = `${project.name.toLowerCase()}_${p.number.toLowerCase()}`;
      const liveData = liveSheetData.get(sheetKey);
      const b = liveData?.block || (p.number.includes('-') ? p.number.split('-')[0] : 'Normal');
      if (b) blocksSet.add(b);
    });
    return Array.from(blocksSet).sort();
  }, [project.plots, project.layout, liveSheetData]);

  // Generate SVG coordinates for each plot inside a deterministic layout
  // Height: 600, Width: 1100
  const visualLayoutElements = useMemo(() => {
    const width = 1100;
    const height = 600;
    const elements: any[] = [];

    // Roads
    elements.push({ type: 'road', name: 'MAIN 12.0m BOULEVARD', x: 0, y: 270, w: width, h: 60 });
    elements.push({ type: 'road', name: '9.0m NORTH AVENUE', x: 0, y: 80, w: width, h: 40 });
    elements.push({ type: 'road', name: '9.0m SOUTH STREET', x: 0, y: 480, w: width, h: 40 });
    elements.push({ type: 'road', name: 'INTERNAL LINK 1', x: 180, y: 0, w: 40, h: height });
    elements.push({ type: 'road', name: 'INTERNAL LINK 2', x: 550, y: 0, w: 45, h: height });
    elements.push({ type: 'road', name: 'INTERNAL LINK 3', x: 900, y: 0, w: 40, h: height });

    // Parks / Gardens
    elements.push({ type: 'park', name: 'Central Grand Park', x: 260, y: 140, w: 250, h: 110 });
    elements.push({ type: 'park', name: 'Shree Krishna Leisure Meadow', x: 630, y: 350, w: 230, h: 110 });

    // Entry Gate
    elements.push({ type: 'gate', name: 'GRAND ENTRANCE PORTAL', x: 10, y: 250, w: 50, h: 100 });

    // Custom Amenities based on Project Identity
    const normalizedName = project.name.toLowerCase();
    if (normalizedName.includes('keshvam') || normalizedName.includes('shrinath')) {
      elements.push({ type: 'amenity', name: 'Serene Marble Temple', sub: 'Temple', x: 980, y: 20, w: 80, h: 50, icon: 'temple' });
      elements.push({ type: 'amenity', name: 'Fountain of Serenity', sub: 'Water Fountain', x: 385, y: 195, w: 40, h: 40, icon: 'fountain' });
    } else if (normalizedName.includes('vrindavan')) {
      elements.push({ type: 'amenity', name: 'Radha Krishna Temple', sub: 'Temple Complex', x: 60, y: 20, w: 80, h: 50, icon: 'temple' });
      elements.push({ type: 'amenity', name: 'Overhead Reservoir', sub: 'Water Tank', x: 1020, y: 530, w: 50, h: 50, icon: 'tank' });
    } else if (normalizedName.includes('divine') || normalizedName.includes('valley')) {
      elements.push({ type: 'amenity', name: 'Community Clubhouse', sub: 'Club', x: 950, y: 140, w: 100, h: 110, icon: 'club' });
      elements.push({ type: 'amenity', name: 'Overhead Reservoir', sub: 'Water Tank', x: 100, y: 20, w: 50, h: 50, icon: 'tank' });
    } else {
      elements.push({ type: 'amenity', name: 'Sector Clubhouse', sub: 'Clubhouse', x: 340, y: 165, w: 80, h: 60, icon: 'club' });
    }

    // Plots distribution algorithm
    // We group plots in multiple logical blocks and align them in rows.
    const plotsCount = (project.plots || project.layout).length;
    const plotsPerRow = Math.ceil(plotsCount / 6);

    (project.plots || project.layout).forEach((p, idx) => {
      // Determine logical row index (0 to 5)
      const rowIndex = Math.floor(idx / plotsPerRow);
      const rowPlotIndex = idx % plotsPerRow;

      let x = 0;
      let y = 0;
      let w = 26;
      let h = 42;

      // Map row index to precise Y offset
      switch (rowIndex) {
        case 0: // Above North Ave
          y = 25;
          break;
        case 1: // Between North Ave & Central Boulevard
          y = 130;
          break;
        case 2: // Between North Ave & Central Boulevard (lower side)
          y = 210;
          break;
        case 3: // Between Central Boulevard & South Street (upper side)
          y = 340;
          break;
        case 4: // Between Central Boulevard & South Street (lower side)
          y = 420;
          break;
        case 5: // Below South Street
          y = 530;
          break;
        default:
          y = 530;
      }

      // X coordinate spreads along the width, avoiding roads and parks
      const spacing = width / (plotsPerRow + 1);
      x = spacing * (rowPlotIndex + 1) - w / 2;

      // Relocate plot if it collides with a major road
      if (x > 170 && x < 230) x += 40;
      if (x > 540 && x < 605) x += 45;
      if (x > 890 && x < 950) x += 40;

      // Relocate if it collides with parks
      if (rowIndex === 1 || rowIndex === 2) {
        if (x > 250 && x < 520) {
          // Push upwards or downwards
          y = rowIndex === 1 ? 25 : 122;
        }
      }
      if (rowIndex === 3 || rowIndex === 4) {
        if (x > 620 && x < 870) {
          y = rowIndex === 3 ? 332 : 438;
        }
      }

      // Constrain within maps width
      if (x < 60) x = 60 + (rowPlotIndex * 5);
      if (x > width - 40) x = width - 40 - (rowPlotIndex * 5);

      elements.push({
        type: 'plot',
        id: p.id,
        plot: p,
        x,
        y,
        w,
        h,
      });
    });

    return elements;
  }, [project.plots, project.layout, project.name]);

  // Zoom and pan to selectedPlot when it changes from external sources
  useEffect(() => {
    if (selectedPlot) {
      const el = visualLayoutElements.find(item => item.id === selectedPlot.id);
      if (el && containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight || 450;
        const targetZoom = 2.0;

        const targetX = containerWidth / 2 - el.x * targetZoom - (el.w / 2) * targetZoom;
        const targetY = containerHeight / 2 - el.y * targetZoom - (el.h / 2) * targetZoom;

        setZoom(targetZoom);
        setPanX(targetX);
        setPanY(targetY);
      }
    }
  }, [selectedPlot, visualLayoutElements]);

  // Handle Search & Filter Matching logic
  const filteredElements = useMemo(() => {
    return visualLayoutElements.filter(el => {
      if (el.type !== 'plot') return true; // Keep roads, parks, amenities visible always

      const plot = el.plot as Plot;
      const sheetKey = `${project.name.toLowerCase()}_${plot.number.toLowerCase()}`;
      const liveData = liveSheetData.get(sheetKey);

      const liveStatus = resolvePlotLiveStatus(plot);
      const liveCategory = liveData?.category || plot.type;
      const liveSize = liveData?.size || plot.size;
      const livePrice = liveData?.price || plot.price;
      const liveFacing = liveData?.facing || plot.facing;
      const liveBlock = liveData?.block || (plot.number.includes('-') ? plot.number.split('-')[0] : 'Normal');

      // Status Filter
      if (activeStatusFilter !== 'All' && liveStatus !== activeStatusFilter) return false;

      // Category Filter
      if (categoryFilter !== 'All' && liveCategory !== categoryFilter) return false;

      // Block Filter
      if (blockFilter !== 'All' && liveBlock !== blockFilter) return false;

      // Facing Filter
      if (activeFacingFilter !== 'All' && liveFacing !== activeFacingFilter) return false;

      // Numeric boundaries
      if (liveSize < minSize || liveSize > maxSize) return false;
      if (livePrice < minPrice || livePrice > maxPrice) return false;

      // Text query (Plot Number, Block, Category)
      if (activeSearchQuery) {
        const query = activeSearchQuery.toLowerCase();
        const matchesPlotNum = plot.number.toLowerCase().includes(query);
        const matchesBlock = liveBlock.toLowerCase().includes(query);
        const matchesCat = liveCategory.toLowerCase().includes(query);
        const matchesSize = String(liveSize).includes(query);

        if (!matchesPlotNum && !matchesBlock && !matchesCat && !matchesSize) return false;
      }

      return true;
    });
  }, [
    visualLayoutElements,
    activeSearchQuery,
    activeStatusFilter,
    categoryFilter,
    blockFilter,
    activeFacingFilter,
    minSize,
    maxSize,
    minPrice,
    maxPrice,
    liveSheetData,
  ]);

  // Clear filters
  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setCategoryFilter('All');
    setBlockFilter('All');
    setFacingFilter('All');
    setMinPrice(0);
    setMaxPrice(10000000);
    setMinSize(0);
    setMaxSize(5000);
  };

  // Zoom & Pan Handlers
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  
  const handleFitToScreen = () => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight || 450;
    const mapWidth = 1100;
    const mapHeight = 600;

    const scaleX = containerWidth / mapWidth;
    const scaleY = containerHeight / mapHeight;
    const newZoom = Math.min(scaleX, scaleY, 1) * 0.95;

    setZoom(newZoom);
    setPanX((containerWidth - mapWidth * newZoom) / 2);
    setPanY((containerHeight - mapHeight * newZoom) / 2);
  };

  const handleResetView = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  useEffect(() => {
    handleFitToScreen();
  }, [isFullscreen]);

  // Pan interaction on Drag Mouse Events
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    dragStart.current = { x: e.clientX - panX, y: e.clientY - panY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanX(e.clientX - dragStart.current.x);
    setPanY(e.clientY - dragStart.current.y);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Pinch-to-zoom on Mobile Touch support
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStart.current = { x: e.touches[0].clientX - panX, y: e.touches[0].clientY - panY };
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDist.current = dist;
      touchStartZoom.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1) {
      setPanX(e.touches[0].clientX - dragStart.current.x);
      setPanY(e.touches[0].clientY - dragStart.current.y);
    } else if (e.touches.length === 2 && touchStartDist.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = dist / touchStartDist.current;
      const newZoom = Math.max(0.5, Math.min(touchStartZoom.current * scale, 4));
      setZoom(newZoom);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchStartDist.current = null;
  };

  // Search auto-focus and zoom onto matched plot
  const handleSearchFocus = (p: Plot) => {
    if (!containerRef.current) return;
    const el = visualLayoutElements.find(item => item.id === p.id);
    if (!el) return;

    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight || 450;
    const newZoom = 2.5;

    setSelectedPlot(p);

    const sheetKey = `${project.name.toLowerCase()}_${p.number.toLowerCase()}`;
    setSelectedPlotLiveDetails(liveSheetData.get(sheetKey) || null);

    // Calculate centering translation
    const targetX = containerWidth / 2 - el.x * newZoom - (el.w / 2) * newZoom;
    const targetY = containerHeight / 2 - el.y * newZoom - (el.h / 2) * newZoom;

    setZoom(newZoom);
    setPanX(targetX);
    setPanY(targetY);
  };

  // Click handler on plot element
  const handlePlotClick = (plot: Plot, el: any) => {
    setSelectedPlot(plot);
    const sheetKey = `${project.name.toLowerCase()}_${plot.number.toLowerCase()}`;
    setSelectedPlotLiveDetails(liveSheetData.get(sheetKey) || null);

    // Dynamic zoom-to on click
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight || 450;
      const targetX = containerWidth / 2 - el.x * zoom - (el.w / 2) * zoom;
      const targetY = containerHeight / 2 - el.y * zoom - (el.h / 2) * zoom;
      setPanX(targetX);
      setPanY(targetY);
    }
  };

  // Check if plot is highlighted by query
  const isPlotHighlighted = (plot: Plot) => {
    if (activeSearchQuery) {
      return plot.number.toLowerCase().includes(activeSearchQuery.toLowerCase());
    }
    return false;
  };

  // Status mapping colors for plot rectangles
  const getStatusColor = (status: any) => {
    const norm = getNormalizedStatus(status);
    const styles = STATUS_COLORS[norm];
    return { fill: styles.fill, border: styles.stroke };
  };

  return (
    <div className="space-y-6 mt-8" id="interactive-project-map-section">
      {/* Statistics Bento Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200/50 p-3.5 rounded-xl text-center shadow-2xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Plots</p>
          <p className="text-2xl font-black text-slate-700 mt-1">{liveStats.total}</p>
        </div>
        <div className="bg-emerald-50/40 border border-emerald-100 p-3.5 rounded-xl text-center shadow-2xs">
          <p className="text-xs font-bold text-emerald-600/80 uppercase tracking-wider">Available</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{liveStats.available}</p>
        </div>
        <div className="bg-red-50/40 border border-red-100 p-3.5 rounded-xl text-center shadow-2xs">
          <p className="text-xs font-bold text-red-600/80 uppercase tracking-wider">Sold</p>
          <p className="text-2xl font-black text-red-600 mt-1">{liveStats.sold}</p>
        </div>
        <div className="bg-amber-50/40 border border-amber-100 p-3.5 rounded-xl text-center shadow-2xs">
          <p className="text-xs font-bold text-amber-600/80 uppercase tracking-wider">Hold</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{liveStats.hold}</p>
        </div>
        <div className="bg-blue-50/40 border border-blue-100 p-3.5 rounded-xl text-center shadow-2xs">
          <p className="text-xs font-bold text-blue-600/80 uppercase tracking-wider">Booked</p>
          <p className="text-2xl font-black text-blue-600 mt-1">{liveStats.booked}</p>
        </div>
        <div className="bg-slate-100 border border-slate-200 p-3.5 rounded-xl text-center shadow-2xs">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reserved</p>
          <p className="text-2xl font-black text-slate-600 mt-1">{liveStats.reserved}</p>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-6 shadow-sm overflow-hidden" id="interactive-project-map">
        {/* Banner Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              <Icon name="map" className="w-6 h-6 text-blue-600" />
              Interactive Project Map
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              Dynamic digital plot zoning built directly from official PDF layouts.
            </p>
          </div>
          
          {/* Sync Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Connection / Sync Indicator */}
            {isUsingLiveSync && (
              <div className="flex items-center gap-2 bg-slate-100/80 px-3 py-1.5 rounded-full border border-slate-200/50 text-xs font-semibold text-slate-700 shadow-3xs">
                {connectionStatus === 'syncing' && (
                  <>
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    <span className="text-amber-700 animate-pulse font-extrabold">🟡 Syncing...</span>
                  </>
                )}
                {connectionStatus === 'live' && (
                  <>
                    <span className="flex h-2 w-2 relative">
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-emerald-700 font-extrabold">🟢 Live</span>
                    <span className="text-slate-400 font-normal">| Last synced: {timeSinceLastSync}</span>
                  </>
                )}
                {connectionStatus === 'offline' && (
                  <>
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    <span className="text-red-700 font-extrabold">🔴 Connection Lost</span>
                  </>
                )}
              </div>
            )}

            {!isUsingLiveSync && (
              <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-full border border-slate-200 shadow-3xs">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                Local Database Mode
              </span>
            )}
            
            {(spreadsheetId || appsScriptUrl) && (
              <button
                type="button"
                onClick={() => fetchGoogleSheetData(spreadsheetId, false, appsScriptUrl)}
                disabled={isSyncing}
                title="Force refresh Google Sheets inventory immediately"
                className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-blue-600 text-xs font-extrabold px-3.5 py-1.5 rounded-full border border-slate-200 shadow-xs hover:border-blue-300 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                <svg className={`w-3.5 h-3.5 text-blue-500 ${isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15H19" />
                </svg>
                {isSyncing ? 'Syncing...' : 'Refresh Inventory'}
              </button>
            )}
          </div>
        </div>

        {/* Offline Error Warning Banner */}
        {sheetError && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-bold text-amber-900">Google Sheets Sync Offline</p>
              <p className="text-xs text-amber-700 mt-0.5 font-medium">
                Live inventory temporarily unavailable. Showing the latest synced data. ({sheetError})
              </p>
            </div>
          </div>
        )}

        {/* Control Bar: Filters & Search */}
        {externalSearchQuery === undefined && (
        <div className="bg-white border border-slate-200/60 rounded-xl p-4 mb-6 shadow-2xs space-y-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            
            {/* Live Search */}
            <div className="relative flex-grow max-w-lg">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Icon name="search" className="w-5 h-5 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Search by Plot No, Block, Category, Size..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full p-2.5 pl-10 border border-slate-200 rounded-lg text-sm shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick Filter Selectors */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Select */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="p-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 bg-white"
              >
                <option value="All">All Status</option>
                {Object.values(PlotStatus).map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* Category Select */}
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="p-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 bg-white"
              >
                <option value="All">All Types</option>
                {Object.values(PlotType).map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              {/* Block Select */}
              {uniqueBlocks.length > 0 && (
                <select
                  value={blockFilter}
                  onChange={e => setBlockFilter(e.target.value)}
                  className="p-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 bg-white"
                >
                  <option value="All">All Blocks</option>
                  {uniqueBlocks.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              )}

              {/* Facing Select */}
              <select
                value={facingFilter}
                onChange={e => setFacingFilter(e.target.value)}
                className="p-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 bg-white"
              >
                <option value="All">All Facings</option>
                {Object.values(PlotFacing).map(f => <option key={f} value={f}>{f}</option>)}
              </select>

              {/* Clear Filters Button */}
              {(statusFilter !== 'All' || categoryFilter !== 'All' || blockFilter !== 'All' || facingFilter !== 'All' || searchQuery) && (
                <button
                  onClick={resetFilters}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Suggestion list for matched plots from Search queries */}
          {searchQuery && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-400 mb-2">Instant Search Results (Click to Zoom & Focus):</p>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {(project.plots || project.layout)
                  .filter(p => p.number.toLowerCase().includes(searchQuery.toLowerCase()))
                  .slice(0, 15)
                  .map(p => {
                    const statusColor = getStatusColor(resolvePlotLiveStatus(p));
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleSearchFocus(p)}
                        className="px-2.5 py-1 text-xs font-bold rounded-md border flex items-center gap-1.5 transition-all cursor-pointer bg-white hover:shadow-xs hover:border-slate-300"
                        style={{ borderLeftColor: statusColor.fill, borderLeftWidth: '4px' }}
                      >
                        {p.number}
                        <span className="text-[10px] text-slate-400">({p.size} sqft)</span>
                      </button>
                    );
                  })}
                {(project.plots || project.layout).filter(p => p.number.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                  <p className="text-xs text-slate-400 font-semibold italic">No matched plots found. Try another query.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Map Stage and Sidebar Panel */}
      <div className="flex flex-col xl:flex-row gap-6">
        
        {/* Map Stage */}
        <div className="flex-grow xl:w-3/4 relative">
          
          {/* Zoom & Screen Controls Overlay */}
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
            <button
              onClick={handleZoomIn}
              className="w-10 h-10 bg-white hover:bg-slate-100 text-slate-700 font-extrabold rounded-xl border border-slate-200 shadow-md flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
              title="Zoom In"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={handleZoomOut}
              className="w-10 h-10 bg-white hover:bg-slate-100 text-slate-700 font-extrabold rounded-xl border border-slate-200 shadow-md flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
              title="Zoom Out"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
              </svg>
            </button>
            <button
              onClick={handleFitToScreen}
              className="w-10 h-10 bg-white hover:bg-slate-100 text-slate-700 font-extrabold rounded-xl border border-slate-200 shadow-md flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
              title="Fit to Screen"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 0h-4m4 0l-5-5" />
              </svg>
            </button>
            <button
              onClick={handleResetView}
              className="w-10 h-10 bg-white hover:bg-slate-100 text-slate-700 font-extrabold rounded-xl border border-slate-200 shadow-md flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
              title="Reset View"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15H19" />
              </svg>
            </button>
          </div>

          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={toggleFullscreen}
              className="p-2 bg-white hover:bg-slate-100 text-slate-700 font-extrabold rounded-xl border border-slate-200 shadow-md flex items-center gap-1.5 transition-all text-xs cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 0h-4m4 0l-5-5" />
              </svg>
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
          </div>

          {/* Interactive SVG Viewport */}
          <div
            ref={containerRef}
            className={`w-full bg-slate-900 rounded-2xl relative overflow-hidden transition-all shadow-inner select-none ${
              isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen rounded-none' : 'h-[500px]'
            } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Architectural Grid Paper effect */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]"></div>

            <motion.div
              className="absolute origin-top-left"
              animate={{ x: panX, y: panY, scale: zoom }}
              transition={isDragging ? { type: 'just' } : { type: 'spring', damping: 25, stiffness: 120 }}
              style={{ width: '1100px', height: '600px' }}
            >
              <svg width="1100" height="600" className="overflow-visible select-none">
                {/* Outer Layout Bounds Boundary */}
                <rect x="10" y="10" width="1080" height="580" rx="20" fill="#1e293b" stroke="#475569" strokeWidth="4" />
                
                {/* Dynamic Architectural Elements (Roads, Parks, Amenities) */}
                {filteredElements.map((el, i) => {
                  if (el.type === 'road') {
                    return (
                      <g key={`road-${i}`}>
                        {/* Road path */}
                        <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="#334155" />
                        {/* Center lane dash line */}
                        <line
                          x1={el.x}
                          y1={el.y + el.h / 2}
                          x2={el.x + el.w}
                          y2={el.y + el.h / 2}
                          stroke="#eab308"
                          strokeDasharray="8,8"
                          strokeWidth="2"
                        />
                        <text
                          x={el.x + el.w / 2}
                          y={el.y + el.h / 2 + 4}
                          fill="#64748b"
                          fontSize="9"
                          fontWeight="bold"
                          textAnchor="middle"
                          letterSpacing="2"
                        >
                          {el.name}
                        </text>
                      </g>
                    );
                  }

                  if (el.type === 'park') {
                    return (
                      <g key={`park-${i}`}>
                        <rect x={el.x} y={el.y} width={el.w} height={el.h} rx="8" fill="#065f46" stroke="#059669" strokeWidth="2" fillOpacity="0.85" />
                        <text x={el.x + el.w / 2} y={el.y + el.h / 2} fill="#34d399" fontSize="11" fontWeight="extrabold" textAnchor="middle">{el.name}</text>
                        {/* Scattered tree vectors */}
                        <circle cx={el.x + 30} cy={el.y + 30} r="6" fill="#059669" />
                        <circle cx={el.x + el.w - 30} cy={el.y + 30} r="6" fill="#059669" />
                        <circle cx={el.x + el.w / 2} cy={el.y + el.h - 25} r="7" fill="#10b981" />
                      </g>
                    );
                  }

                  if (el.type === 'gate') {
                    return (
                      <g key={`gate-${i}`}>
                        <rect x={el.x} y={el.y} width={el.w} height={el.h} rx="4" fill="#475569" stroke="#64748b" strokeWidth="2" />
                        <line x1={el.x + el.w / 2} y1={el.y} x2={el.x + el.w / 2} y2={el.y + el.h} stroke="#f1f5f9" strokeWidth="3" strokeDasharray="4,4" />
                        <text x={el.x + el.w / 2} y={el.y + el.h / 2} fill="#94a3b8" fontSize="8" fontWeight="bold" transform={`rotate(-90 ${el.x + el.w / 2} ${el.y + el.h / 2})`} textAnchor="middle">{el.name}</text>
                      </g>
                    );
                  }

                  if (el.type === 'amenity') {
                    return (
                      <g key={`amenity-${i}`}>
                        <rect x={el.x} y={el.y} width={el.w} height={el.h} rx="6" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
                        <text x={el.x + el.w / 2} y={el.y + el.h / 2 - 3} fill="#f8fafc" fontSize="9" fontWeight="bold" textAnchor="middle">{el.name}</text>
                        <text x={el.x + el.w / 2} y={el.y + el.h / 2 + 10} fill="#38bdf8" fontSize="8" textAnchor="middle" fontWeight="bold">{el.sub}</text>
                      </g>
                    );
                  }

                  // Plot Elements
                  if (el.type === 'plot') {
                    const plot = el.plot as Plot;
                    const liveStatus = resolvePlotLiveStatus(plot);
                    const color = getStatusColor(liveStatus);
                    const isSelected = selectedPlot?.id === plot.id;
                    const isHighlighted = isPlotHighlighted(plot);

                    return (
                      <g
                        key={`plot-${plot.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlotClick(plot, el);
                        }}
                        onMouseEnter={() => setHoveredPlot(plot)}
                        onMouseLeave={() => setHoveredPlot(null)}
                        className="cursor-pointer"
                      >
                        {/* Highlight Ring */}
                        {(isSelected || isHighlighted) && (
                          <rect
                            x={el.x - 3}
                            y={el.y - 3}
                            width={el.w + 6}
                            height={el.h + 6}
                            rx="6"
                            fill="none"
                            stroke={isHighlighted ? '#f59e0b' : '#3b82f6'}
                            strokeWidth="3"
                            className={isHighlighted ? 'animate-pulse' : ''}
                          />
                        )}

                        {/* Core Plot Body */}
                        <rect
                          x={el.x}
                          y={el.y}
                          width={el.w}
                          height={el.h}
                          rx="4"
                          fill={color.fill}
                          stroke={color.border}
                          strokeWidth="1.5"
                          fillOpacity={hoveredPlot?.id === plot.id ? 1 : 0.85}
                          className="transition-all duration-150"
                        />

                        {/* Plot Number Label */}
                        <text
                          x={el.x + el.w / 2}
                          y={el.y + el.h / 2 + 4}
                          fill="#ffffff"
                          fontSize="9"
                          fontWeight="extrabold"
                          textAnchor="middle"
                          className="select-none pointer-events-none"
                        >
                          {plot.number.replace('P-', '')}
                        </text>
                      </g>
                    );
                  }

                  return null;
                })}
              </svg>
            </motion.div>

            {/* Float Tooltip */}
            <AnimatePresence>
              {hoveredPlot && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute bottom-4 right-4 bg-slate-900/95 text-white p-3.5 rounded-xl border border-slate-700 shadow-xl backdrop-blur-xs w-56 pointer-events-none"
                >
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="font-black text-sm text-blue-400">Plot {hoveredPlot.number}</span>
                    <span className="text-[10px] font-bold bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                      {hoveredPlot.type}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-slate-300">
                    <p className="flex justify-between">
                      <span className="text-slate-400 font-semibold">Status:</span>
                      <span className="font-extrabold" style={{ color: getStatusColor(resolvePlotLiveStatus(hoveredPlot)).fill }}>
                        {resolvePlotLiveStatus(hoveredPlot)}
                      </span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-slate-400 font-semibold">Area:</span>
                      <span className="font-bold">{hoveredPlot.size} sqft</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-slate-400 font-semibold">Facing:</span>
                      <span className="font-bold">{hoveredPlot.facing}</span>
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Map Compass & Legend Indicator */}
          <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200/50 p-4 rounded-xl shadow-xs">
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block sm:inline mr-2">Zoning Keys:</span>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <span className="w-3.5 h-3.5 rounded bg-emerald-500 border border-emerald-700"></span> Available
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <span className="w-3.5 h-3.5 rounded bg-red-500 border border-red-700"></span> Sold
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <span className="w-3.5 h-3.5 rounded bg-amber-500 border border-amber-700"></span> Hold
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <span className="w-3.5 h-3.5 rounded bg-blue-500 border border-blue-700"></span> Booked
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <span className="w-3.5 h-3.5 rounded bg-slate-500 border border-slate-700"></span> Reserved
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <span className="w-3.5 h-3.5 rounded bg-teal-500 border border-teal-700"></span> Resale
              </div>
            </div>
            <div className="text-slate-400 text-xs font-bold flex items-center gap-1">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              Indore Real Estate Gated Layout
            </div>
          </div>
        </div>

        {/* Selected Plot Live Details Sidebar */}
        <div className="xl:w-1/4">
          {selectedPlot ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative h-full flex flex-col">
              <button
                onClick={() => setSelectedPlot(null)}
                className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                &times;
              </button>
              
              <div className="mb-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full">
                  {selectedPlotLiveDetails?.block || (selectedPlot.number.includes('-') ? selectedPlot.number.split('-')[0] : 'Normal')} Block
                </span>
                <h3 className="text-2xl font-black text-slate-800 mt-2 flex items-center gap-2">
                  Plot {selectedPlot.number}
                </h3>
                <p className="text-xs text-slate-400 font-semibold mt-1">Project: {project.name}</p>
                {project.plotSizes && (
                  <div className="mt-3 bg-slate-50 border border-slate-200/60 p-2.5 rounded-xl">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Official Project Sizes</span>
                    <div className="flex flex-wrap gap-1">
                      {project.plotSizes.split(',').map((size) => (
                        <span key={size} className="bg-white text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold border border-slate-200">
                          🟢 {size.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3.5 flex-grow text-sm">
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Status</span>
                  <span
                    className="font-extrabold text-xs px-2.5 py-1 rounded-full text-white"
                    style={{ backgroundColor: getStatusColor(resolvePlotLiveStatus(selectedPlot)).fill }}
                  >
                    {resolvePlotLiveStatus(selectedPlot)}
                  </span>
                </div>

                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Category</span>
                  <span className="font-bold text-slate-800">
                    {selectedPlotLiveDetails?.category || selectedPlot.type}
                  </span>
                </div>

                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Plot Size</span>
                  <span className="font-bold text-slate-800">
                    {(selectedPlotLiveDetails?.size || selectedPlot.size) > 0 ? `${selectedPlotLiveDetails?.size || selectedPlot.size} sq.ft.` : 'Not Available'}
                  </span>
                </div>

                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Facing</span>
                  <span className="font-bold text-slate-800">
                    {selectedPlotLiveDetails?.facing || selectedPlot.facing}
                  </span>
                </div>

                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Sales Executive</span>
                  <span className="font-bold text-slate-700">
                    {selectedPlotLiveDetails?.salesExecutive || 'Not Assigned'}
                  </span>
                </div>

                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Customer Name</span>
                  <span className="font-bold text-slate-700">
                    {selectedPlotLiveDetails?.customerName || 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Booking Date</span>
                  <span className="font-bold text-slate-700">
                    {selectedPlotLiveDetails?.bookingDate || 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Last Updated</span>
                  <span className="font-bold text-xs text-slate-600">
                    {selectedPlotLiveDetails?.lastUpdated || lastSyncedTime || 'Local Sync'}
                  </span>
                </div>

                <div className="pt-2">
                  <span className="text-slate-400 text-xs font-semibold">Total Cost Estimate</span>
                  <p className="text-2xl font-black text-slate-800 mt-1">
                    ₹{(selectedPlotLiveDetails?.price || selectedPlot.price).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              {/* Booking Actions */}
              {onBookSiteVisit && (
                <button
                  onClick={() => onBookSiteVisit(project, selectedPlot)}
                  disabled={
                    resolvePlotLiveStatus(selectedPlot) !== PlotStatus.AVAILABLE &&
                    resolvePlotLiveStatus(selectedPlot) !== PlotStatus.RESALE
                  }
                  className="w-full mt-6 bg-blue-600 text-white font-extrabold py-3.5 rounded-xl hover:bg-blue-700 transition-colors shadow-md disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
                >
                  {resolvePlotLiveStatus(selectedPlot) === PlotStatus.AVAILABLE ||
                  resolvePlotLiveStatus(selectedPlot) === PlotStatus.RESALE
                    ? 'Book a Site Visit'
                    : `Plot is ${resolvePlotLiveStatus(selectedPlot)}`}
                </button>
              )}
            </div>
          ) : (
            <div className="bg-slate-100 border border-dashed border-slate-200 rounded-2xl p-6 text-center h-full flex flex-col justify-center items-center">
              <Icon name="map" className="w-10 h-10 text-slate-300 mb-2" />
              <p className="font-bold text-slate-700">Select any Plot</p>
              <p className="text-xs text-slate-400 mt-1">
                Click on any plot in the digital layout to load live pricing, facing details, and bookings.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Admin Google Sheets Configurator Row */}
      {isAdmin && (
        <div className="mt-8 border-t border-slate-200/60 pt-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Icon name="sheets" className="w-5 h-5 text-green-600" />
                  Google Sheets Live Configuration
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">
                  Connect your plot inventory to Google Sheets. Use the Spreadsheet ID alone (for public sheets) or deploy a secure Google Apps Script Web App with high-performance change detection.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSetupGuide(!showSetupGuide)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 underline cursor-pointer self-start md:self-auto"
              >
                {showSetupGuide ? 'Hide Apps Script Guide' : 'Show Apps Script Guide'}
              </button>
            </div>

            {showSetupGuide && (
              <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-3">
                <p className="font-bold text-slate-800 text-sm">Deploying Google Apps Script as a REST API (With Lightweight Sync Checking)</p>
                <ol className="list-decimal list-inside space-y-1 bg-white p-3 rounded-md border border-slate-100">
                  <li>Open your Google Sheet containing the plot inventory.</li>
                  <li>Click on <strong>Extensions &gt; Apps Script</strong>.</li>
                  <li>Clear all code and paste the script below.</li>
                  <li>Click <strong>Deploy &gt; New deployment</strong>.</li>
                  <li>Select type: <strong>Web app</strong>.</li>
                  <li>Execute as: <strong>Me</strong>.</li>
                  <li>Who has access: <strong>Anyone</strong> (this allows public browser access securely).</li>
                  <li>Click Deploy, copy the <strong>Web App URL</strong> and paste it below.</li>
                </ol>

                <div className="relative bg-slate-900 rounded-lg p-4 font-mono text-xs text-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      const code = `function doGet(e) {\n  try {\n    var spreadsheetId = e && e.parameter && e.parameter.spreadsheetId;\n    if (!spreadsheetId) {\n      spreadsheetId = "${spreadsheetId || 'YOUR_SPREADSHEET_ID_HERE'}";\n    }\n    \n    var ss = SpreadsheetApp.openById(spreadsheetId);\n    var lastUpdated = ss.getLastUpdated().getTime().toString();\n    \n    // Smart lightweight sync check: Skip downloading full sheet if unchanged\n    var clientLastUpdated = e && e.parameter && e.parameter.lastUpdated;\n    if (clientLastUpdated && clientLastUpdated === lastUpdated) {\n      return ContentService.createTextOutput(JSON.stringify({\n        success: true,\n        changed: false,\n        lastUpdated: lastUpdated\n      }))\n      .setMimeType(ContentService.MimeType.JSON)\n      .setHeader("Access-Control-Allow-Origin", "*");\n    }\n    \n    var sheet = ss.getSheets()[0];\n    var range = sheet.getDataRange();\n    var values = range.getValues();\n    \n    return ContentService.createTextOutput(JSON.stringify({\n      success: true,\n      changed: true,\n      lastUpdated: lastUpdated,\n      rows: values\n    }))\n    .setMimeType(ContentService.MimeType.JSON)\n    .setHeader("Access-Control-Allow-Origin", "*");\n  } catch (err) {\n    return ContentService.createTextOutput(JSON.stringify({\n      success: false,\n      error: err.toString()\n    }))\n    .setMimeType(ContentService.MimeType.JSON)\n    .setHeader("Access-Control-Allow-Origin", "*");\n  }\n}`;
                      navigator.clipboard.writeText(code);
                      alert('Advanced Apps Script template copied to clipboard!');
                    }}
                    className="absolute top-2 right-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-2 py-1 rounded border border-slate-700 text-[10px] cursor-pointer"
                  >
                    Copy Template Code
                  </button>
                  <pre className="overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed">
{`function doGet(e) {
  try {
    var spreadsheetId = e && e.parameter && e.parameter.spreadsheetId;
    if (!spreadsheetId) {
      spreadsheetId = "${spreadsheetId || 'YOUR_SPREADSHEET_ID'}";
    }
    
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var lastUpdated = ss.getLastUpdated().getTime().toString();
    
    // Smart lightweight sync check: Skip downloading full sheet if unchanged
    var clientLastUpdated = e && e.parameter && e.parameter.lastUpdated;
    if (clientLastUpdated && clientLastUpdated === lastUpdated) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        changed: false,
        lastUpdated: lastUpdated
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", "*");
    }
    
    var sheet = ss.getSheets()[0];
    var range = sheet.getDataRange();
    var values = range.getValues();
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      changed: true,
      lastUpdated: lastUpdated,
      rows: values
    }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*");
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*");
  }
}`}
                  </pre>
                </div>
              </div>
            )}

            <form onSubmit={handleLinkSheetSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Google Spreadsheet ID</label>
                  <input
                    type="text"
                    placeholder="e.g. 1BxiMVs0XRA5nFMdKv1OHkqjgBm5qR-z2X789abcd"
                    value={spreadsheetId}
                    onChange={e => setSpreadsheetId(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm shadow-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Google Apps Script URL (REST API Web App)</label>
                  <input
                    type="text"
                    placeholder="e.g. https://script.google.com/macros/s/.../exec"
                    value={appsScriptUrl}
                    onChange={e => setAppsScriptUrl(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm shadow-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 pt-2">
                <div className="text-[11px] text-slate-400 font-medium">
                  {lastSyncedTime && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse"></span>
                      Auto-synced background loop: Active (every 30s) • Last Synced: {lastSyncedTime}
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isSyncing}
                  className="bg-green-600 text-white font-extrabold px-6 py-2.5 rounded-lg text-sm shadow-sm hover:bg-green-700 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isSyncing ? 'Synchronizing...' : 'Save & Sync Sheet'}
                </button>
              </div>
            </form>

            {/* Production-Grade Live Inventory Audit Panel */}
            {isUsingLiveSync && (
              <div className="mt-5 pt-5 border-t border-slate-100 bg-slate-50/50 p-4 rounded-xl border border-slate-200/60">
                <h4 className="text-xs font-extrabold text-slate-700 mb-3 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  Live Sync Diagnostics & Audit Logs
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-3xs text-center">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">Sync Status</span>
                    <span className={`inline-flex items-center gap-1 text-xs font-extrabold mt-1 ${connectionStatus === 'live' ? 'text-green-600' : connectionStatus === 'syncing' ? 'text-amber-600 animate-pulse' : 'text-red-600'}`}>
                      {connectionStatus === 'live' ? '🟢 Live' : connectionStatus === 'syncing' ? '🟡 Syncing' : '🔴 Offline'}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-3xs text-center">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">Last Result</span>
                    <span className={`text-xs font-black mt-1 block ${syncSuccess ? 'text-emerald-600' : syncSuccess === false ? 'text-red-600' : 'text-slate-500'}`}>
                      {syncSuccess ? '✓ Success' : syncSuccess === false ? '✗ Failed' : 'Pending'}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-3xs text-center">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">Records Loaded</span>
                    <span className="text-xs font-extrabold text-slate-700 mt-1 block">
                      {totalRecordsLoaded} plots
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-3xs text-center">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">Response Time</span>
                    <span className="text-xs font-extrabold text-slate-700 mt-1 block">
                      {apiResponseTime !== null ? `${apiResponseTime}ms` : 'N/A'}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-3xs text-center">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">Sync Duration</span>
                    <span className="text-xs font-extrabold text-slate-700 mt-1 block">
                      {lastSyncDuration !== null ? `${(lastSyncDuration / 1000).toFixed(2)}s` : 'N/A'}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-3xs text-center">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">Updated Plots</span>
                    <span className={`text-xs font-black mt-1 block ${plotsUpdatedCount > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                      {plotsUpdatedCount}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-3xs text-center col-span-2">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">Last Modified Timestamp</span>
                    <span className="text-[10px] font-semibold text-slate-500 mt-1 block truncate" title={lastModifiedTimestamp || undefined}>
                      {lastModifiedTimestamp ? (lastModifiedTimestamp.includes('T') ? new Date(lastModifiedTimestamp).toLocaleTimeString() : lastModifiedTimestamp) : 'N/A'}
                    </span>
                  </div>
                </div>

                {sheetWarnings.length > 0 && (
                  <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
                    <h5 className="text-xs font-extrabold flex items-center gap-1.5 uppercase tracking-wider mb-2">
                      ⚠️ Sheet Sync Warnings ({sheetWarnings.length})
                    </h5>
                    <div className="max-h-28 overflow-y-auto space-y-1 text-[11px] font-mono leading-relaxed">
                      {sheetWarnings.map((warn, wIdx) => (
                        <div key={wIdx} className="bg-white/60 p-1.5 px-2 rounded border border-amber-100">
                          {warn}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Sync Notification / Conflict Resolution banner */}
      {syncNotification && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-slate-900 text-white rounded-xl shadow-2xl p-4 border border-slate-800/80 flex items-start gap-3 transition-transform animate-bounce">
          <div className="bg-blue-500/20 p-1.5 rounded-lg text-blue-400">
            <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 111.063.852l-.041.02a.75.75 0 01-1.063-.852zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
            </svg>
          </div>
          <div className="flex-grow">
            <p className="text-xs font-bold text-slate-200">Real-Time Inventory Alert</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed font-medium">{syncNotification}</p>
          </div>
          <button 
            type="button" 
            onClick={() => setSyncNotification(null)}
            className="text-slate-500 hover:text-white transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      </div>
    </div>
  );
};

export default InteractiveProjectMap;
