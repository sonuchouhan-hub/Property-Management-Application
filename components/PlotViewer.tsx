
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Project, Plot, PlotStatus, PlotFacing, PlotType } from '../types';
import Icon from './common/Icon';
import InteractiveProjectMap from './InteractiveProjectMap';
import { PlotMappingEngine } from './PlotMappingEngine';
import { doc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { 
  db, 
  sanitizeData, 
  trackedGetDocs as getDocs, 
  trackedSetDoc as setDoc, 
  trackedDeleteDoc as deleteDoc,
  trackedBatchWrite
} from '../services/firebaseService';
import { STATUS_COLORS, getNormalizedStatus, getStatusStyles } from '../constants';


const OFFICIAL_LAYOUT_MAP_FALLBACKS: Record<number, string> = {
  1: 'https://dhanshriinfrabulls.co.in/uploads/68396668b3090-1748592232.png',
  2: 'https://dhanshriinfrabulls.co.in/uploads/6851299cc7ddb-1750149532.png',
  3: 'https://dhanshriinfrabulls.co.in/uploads/68396cf598a5b-1748593909.png',
  4: 'https://dhanshriinfrabulls.co.in/uploads/6851309dba645-1750151325.jpg',
  5: 'https://dhanshriinfrabulls.co.in/uploads/68270ea3a5309-1747390115.png',
  6: 'https://dhanshriinfrabulls.co.in/uploads/68317ff24316a-1748074482.png',
  7: 'https://dhanshriinfrabulls.co.in/uploads/6833ffcf1db07-1748238287.png',
  8: 'https://dhanshriinfrabulls.co.in/uploads/68340f3103373-1748242225.jpeg',
  9: 'https://dhanshriinfrabulls.co.in/uploads/68396668b3090-1748592232.png',
  10: 'https://dhanshriinfrabulls.co.in/uploads/68270ea3a5309-1747390115.png',
  11: 'https://dhanshriinfrabulls.co.in/uploads/667bf7bc7154f-1719400380.jpg',
  12: 'https://dhanshriinfrabulls.co.in/uploads/68397ec5b9ecb-1748598469.jpg',
  13: 'https://dhanshriinfrabulls.co.in/uploads/6833ffcf1db07-1748238287.png',
  14: 'https://dhanshriinfrabulls.co.in/uploads/68396cf598a5b-1748593909.png',
  15: 'https://dhanshriinfrabulls.co.in/uploads/68340f3103373-1748242225.jpeg'
};

// --- Helper Components ---

const getStatusClasses = (status: any) => {
  const styles = getStatusStyles(status);
  return `${styles.bg} ${styles.border} ${styles.text} ${styles.hoverBg}`;
};

const PlotCard: React.FC<{ plot: Plot, isSelected: boolean, onClick: (plot: Plot) => void }> = ({ plot, isSelected, onClick }) => {
    const colorClasses = getStatusClasses(plot.status);
    const selectedClasses = isSelected ? 'ring-4 ring-blue-500 ring-offset-2 z-10' : '';
    const norm = getNormalizedStatus(plot.status);
    const styles = STATUS_COLORS[norm];

    const StatusIcon = () => {
      const iconMap: Record<string, string> = {
        available: 'status',
        booked: 'booked',
        sold: 'sold',
        investment: 'investment',
        'for resale': 'resale',
      };
      const iconName = iconMap[norm] || 'status';
      
      return <Icon name={iconName} className="w-4 h-4 absolute top-1.5 right-1.5" style={{ color: styles.fill }} aria-label={plot.status} />;
    };

    return (
        <div 
            id={`plot-card-${plot.id}`}
            onClick={() => onClick(plot)}
            className={`relative p-2 rounded-lg border-2 text-center transition-all duration-200 ${colorClasses} ${selectedClasses} cursor-pointer`}
        >
            <StatusIcon />
            <span className="absolute top-1 left-1 text-[10px] font-bold text-gray-600 bg-white/80 px-1 rounded shadow-2xs">{(plot.type as any) === 'EWA' ? 'EWS' : plot.type}</span>
            <p className="font-bold pt-3">{plot.number}</p>
            <p className="text-xs">{plot.size > 0 ? `${plot.size} sq.ft.` : 'Not Available'}</p>
            <p className="text-xs text-gray-500">{plot.dimensions}</p>
        </div>
    );
};

const StatusBadge: React.FC<{ status: PlotStatus | string }> = ({ status }) => {
  const norm = getNormalizedStatus(status);
  const styles = STATUS_COLORS[norm];
  
  const iconMap: Record<string, string> = {
    available: 'status',
    booked: 'booked',
    sold: 'sold',
    investment: 'investment',
    'for resale': 'resale',
  };
  const iconName = iconMap[norm] || 'status';

  return (
    <span className={`font-bold px-3 py-1 rounded-full inline-flex items-center gap-2 ${styles.badge}`}>
      <Icon name={iconName} className="w-4 h-4" />
      {status}
    </span>
  );
};

const SelectedPlotDetails: React.FC<{ plot: Plot | null, project: Project, onDeselect: () => void, onBookSiteVisit: () => void, onEdit: (plot: Plot) => void, isAdmin: boolean }> = ({ plot, project, onDeselect, onBookSiteVisit, onEdit, isAdmin }) => {
    if (!plot) {
        return (
            <div className="bg-gray-100 p-6 rounded-lg text-center h-full flex flex-col justify-center">
                <p className="font-semibold text-gray-700">Select a plot</p>
                <p className="text-sm text-gray-500">Details will be shown here.</p>
            </div>
        );
    }
    const isBookable = plot.status === PlotStatus.AVAILABLE || plot.status === PlotStatus.RESALE;
    return (
        <div className="bg-white p-6 rounded-lg shadow-lg relative h-full flex flex-col">
            <button onClick={onDeselect} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            <h3 className="text-2xl font-bold text-blue-800 mb-4">Plot {plot.number}</h3>
            <div className="space-y-3 flex-grow">
                <div className="flex justify-between items-center"><span className="font-semibold text-gray-600 flex items-center"><Icon name="status" className="w-4 h-4 mr-2" />Status:</span> <StatusBadge status={plot.status} /></div>
                <div className="flex justify-between items-center"><span className="font-semibold text-gray-600 flex items-center"><Icon name="projects" className="w-4 h-4 mr-2" />Type:</span> <span className="font-bold">{(plot.type as any) === 'EWA' ? 'EWS' : plot.type}</span></div>
                <div className="flex justify-between items-center"><span className="font-semibold text-gray-600 flex items-center"><Icon name="size" className="w-4 h-4 mr-2" />Size:</span> <span className="font-bold">{plot.size > 0 ? `${plot.size} sq.ft.` : 'Not Available'}</span></div>
                <div className="flex justify-between items-center"><span className="font-semibold text-gray-600 flex items-center"><Icon name="size" className="w-4 h-4 mr-2" />Dimensions:</span> <span className="font-bold">{plot.dimensions}</span></div>
                <div className="flex justify-between items-center"><span className="font-semibold text-gray-600 flex items-center"><Icon name="facing" className="w-4 h-4 mr-2" />Facing:</span> <span className="font-bold">{plot.facing}</span></div>
                <div className="flex justify-between items-center"><span className="font-semibold text-gray-600 flex items-center"><Icon name="mortgage" className="w-4 h-4 mr-2" />Mortgaged:</span> <span className={`font-bold ${plot.isMortgaged ? 'text-red-600' : 'text-green-600'}`}>{plot.isMortgaged ? 'Yes' : 'No'}</span></div>
                
                {plot.block && (
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-600 flex items-center"><Icon name="map" className="w-4 h-4 mr-2" />Block:</span>
                    <span className="font-bold text-slate-800">{plot.block} Block</span>
                  </div>
                )}
                {plot.customerName && (
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-600 flex items-center"><Icon name="profile" className="w-4 h-4 mr-2" />Customer Name:</span>
                    <span className="font-bold text-slate-800">{plot.customerName}</span>
                  </div>
                )}
                {plot.salesExecutive && (
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-600 flex items-center"><Icon name="executive" className="w-4 h-4 mr-2" />Sales Executive:</span>
                    <span className="font-bold text-slate-700">{plot.salesExecutive}</span>
                  </div>
                )}
                {plot.bookingDate && (
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-600 flex items-center"><Icon name="calendar" className="w-4 h-4 mr-2" />Booking Date:</span>
                    <span className="font-bold text-slate-700">{plot.bookingDate}</span>
                  </div>
                )}
                {plot.lastUpdated && (
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-600 flex items-center"><Icon name="time" className="w-4 h-4 mr-2" />Last Synced:</span>
                    <span className="font-bold text-xs text-slate-600">{plot.lastUpdated}</span>
                  </div>
                )}

                {project.plotSizes && (
                  <div className="border-t pt-3 mt-3">
                    <span className="font-bold text-xs text-gray-500 uppercase tracking-wider block mb-1.5">Official Project Sizes:</span>
                    <div className="flex flex-wrap gap-1">
                      {project.plotSizes.split(',').map((size) => (
                        <span key={size} className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-0.5">
                          🟢 {size.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t my-4"></div>
                <div className="flex justify-between items-center"><span className="font-semibold text-gray-600 flex items-center"><Icon name="price" className="w-4 h-4 mr-2" />Price:</span> <span className="text-xl font-extrabold text-gray-800">₹{plot.price.toLocaleString('en-IN')}</span></div>
            </div>
            {isAdmin ? (
                <button onClick={() => onEdit(plot)} className="w-full mt-4 bg-green-500 text-white font-bold py-3 rounded-lg hover:bg-green-600 transition-colors">
                    Edit Plot Details
                </button>
            ) : (
                <button 
                    onClick={onBookSiteVisit} 
                    disabled={!isBookable}
                    className="w-full mt-4 bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed">
                    {isBookable ? 'Book a Site Visit' : 'This plot has already been sold.'}
                </button>
            )}
        </div>
    )
};

// --- Filter Modal Component ---

interface FilterValues {
    status: PlotStatus | 'All';
    facing: PlotFacing | 'All';
    number: string;
}

interface FilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (filters: FilterValues) => void;
    initialFilters: FilterValues;
}

const FilterModal: React.FC<FilterModalProps> = ({ isOpen, onClose, onApply, initialFilters }) => {
    const [filters, setFilters] = useState<FilterValues>(initialFilters);

    if (!isOpen) return null;

    const handleApply = () => { onApply(filters); };
    
    const handleClear = () => {
        const clearedFilters = { status: 'All' as const, facing: 'All' as const, number: '' };
        setFilters(clearedFilters);
        onApply(clearedFilters);
        onClose();
    };

    return (
         <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="p-6 border-b"><div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-gray-800">Filter Plots</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div></div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <div><label className="block text-sm font-medium text-gray-700 mb-1">Status</label><select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value as FilterValues['status'] }))} className="w-full p-2 border border-gray-300 rounded-lg"><option value="All">All Status</option>{Object.values(PlotStatus).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Facing</label><select value={filters.facing} onChange={e => setFilters(f => ({ ...f, facing: e.target.value as FilterValues['facing'] }))} className="w-full p-2 border border-gray-300 rounded-lg"><option value="All">All Facings</option>{Object.values(PlotFacing).map(f => <option key={f} value={f}>{f}</option>)}</select></div>
                    </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 flex justify-between"><button onClick={handleClear} className="bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg hover:bg-gray-300">Clear All</button><button onClick={handleApply} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700">Apply Filters</button></div>
            </div>
        </div>
    );
};

// --- Admin Edit Plot Modal ---

interface EditPlotModalProps {
  plot: Plot;
  onClose: () => void;
  onSave: (updatedPlot: Plot) => void;
}

const EditPlotModal: React.FC<EditPlotModalProps> = ({ plot, onClose, onSave }) => {
  const [formData, setFormData] = useState<Plot>(plot);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const isNumericField = name === 'size' || name === 'price';
    
    setFormData(prev => ({
      ...prev,
      [name]: isNumericField ? (parseFloat(value) || 0) : value,
    }));
  };
  
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };


  const handleSave = () => { onSave(formData); };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">Edit Plot {plot.number}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Plot Number</label>
                    <input type="text" name="number" value={formData.number} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select name="status" value={formData.status} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-lg">{Object.values(PlotStatus).map(s => <option key={s} value={s}>{s}</option>)}</select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Size (sq.ft.)</label>
                    <input type="number" name="size" value={formData.size} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Facing</label>
                    <select name="facing" value={formData.facing} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-lg">{Object.values(PlotFacing).map(f => <option key={f} value={f}>{f}</option>)}</select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select name="type" value={formData.type} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-lg">{Object.values(PlotType).map(t => <option key={t} value={t}>{t}</option>)}</select>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dimensions (e.g., 20x50)</label>
                    <input type="text" name="dimensions" value={formData.dimensions} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-lg" />
                </div>
            </div>
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
                <input type="number" name="price" value={formData.price} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plot Image URL</label>
                <input type="text" name="imageUrl" placeholder="https://example.com/image.jpg" value={formData.imageUrl || ''} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-lg" />
            </div>
            <div className="flex items-center pt-2">
              <input type="checkbox" id="isMortgaged" name="isMortgaged" checked={formData.isMortgaged} onChange={handleCheckboxChange} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
              <label htmlFor="isMortgaged" className="ml-3 block text-sm font-medium text-gray-700">This plot is under mortgage</label>
            </div>
        </div>
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg hover:bg-gray-300">Cancel</button>
          <button onClick={handleSave} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700">Save Changes</button>
        </div>
      </div>
    </div>
  );
};

const AdminColorKey: React.FC = () => {
    const statuses = [
        PlotStatus.AVAILABLE,
        PlotStatus.HOLD,
        PlotStatus.BOOKED,
        PlotStatus.RESERVED,
        PlotStatus.PENDING,
        PlotStatus.SOLD,
        PlotStatus.INVESTMENT,
        PlotStatus.RESALE,
    ];
    return (
        <div className="bg-gray-100 p-3 rounded-lg mb-4 border border-gray-200">
            <h3 className="text-sm font-bold text-gray-700 mb-2">Admin Legend: Plot Status</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
                {statuses.map(st => {
                    const styles = getStatusStyles(st);
                    return (
                        <div key={st} className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: styles.fill, borderColor: styles.stroke }}></div>
                            <span className="text-xs text-gray-600 font-medium">{st}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


// --- Main PlotViewer Component ---

interface PlotViewerProps {
    project: Project;
    selectedPlot: Plot | null;
    onSelectPlot: (plot: Plot | null) => void;
    onBookSiteVisit: (project: Project, plot: Plot) => void;
    isAdmin: boolean;
    onUpdateProject: (project: Project, isLocalOnly?: boolean) => void;
}

const PlotViewer: React.FC<PlotViewerProps> = ({ project, selectedPlot, onSelectPlot, onBookSiteVisit, isAdmin, onUpdateProject }) => {
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [editingPlot, setEditingPlot] = useState<Plot | null>(null);
  const [activeFilters, setActiveFilters] = useState<FilterValues>({ status: 'All', facing: 'All', number: '' });
  
  // Layout map states
  const [isLayoutMapExpanded, setIsLayoutMapExpanded] = useState(true);
  const [zoomScale, setZoomScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isUploadingLayoutImage, setIsUploadingLayoutImage] = useState(false);
  const [layoutImageUploadError, setLayoutImageUploadError] = useState('');
  const [imageSrc, setImageSrc] = useState<string>(() => project.layoutMapImage || OFFICIAL_LAYOUT_MAP_FALLBACKS[project.id] || `/layouts/${project.name}.jpg` || '');
  
  // Interactive Coordinate Mapping States
  const [isEditCoordinatesMode, setIsEditCoordinatesMode] = useState(false);
  const [hoveredPlotForLayout, setHoveredPlotForLayout] = useState<Plot | null>(null);
  const [searchQueryForLayout, setSearchQueryForLayout] = useState('');
  const [isSavingCoordinates, setIsSavingCoordinates] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('');
  const [isDraggingActiveBox, setIsDraggingActiveBox] = useState<'move' | 'resize' | null>(null);
  const activeBoxDragStart = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0, startW: 0, startH: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Gesture & interaction tracking refs
  const dragDistance = useRef(0);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const touchStartDist = useRef<number | null>(null);
  const touchStartZoom = useRef<number>(1);

  useEffect(() => {
    setImageSrc(project.layoutMapImage || OFFICIAL_LAYOUT_MAP_FALLBACKS[project.id] || `/layouts/${project.name}.jpg`);
  }, [project.layoutMapImage, project.id, project.name]);

  // Load plot mappings from Firestore with live real-time sync on mount or project.id change
  useEffect(() => {
    let unsub: (() => void) | null = null;
    try {
      const q = query(collection(db, 'plot_mappings'), where('projectId', '==', project.id));
      unsub = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          const mappingsMap = new Map<string, any>();
          snap.forEach(docSnap => {
            const data = docSnap.data();
            mappingsMap.set(data.plotNumber, data);
          });

          // Merge loaded coordinates into project's layout array
          let hasChanges = false;
          const updatedLayout = (project.plots || project.layout).map(plot => {
            const mapping = mappingsMap.get(plot.number);
            if (mapping) {
              const xDiff = plot.layoutX !== mapping.layoutX;
              const yDiff = plot.layoutY !== mapping.layoutY;
              const wDiff = plot.layoutW !== mapping.layoutW;
              const hDiff = plot.layoutH !== mapping.layoutH;
              if (xDiff || yDiff || wDiff || hDiff) {
                hasChanges = true;
                return {
                  ...plot,
                  layoutX: mapping.layoutX,
                  layoutY: mapping.layoutY,
                  layoutW: mapping.layoutW,
                  layoutH: mapping.layoutH
                };
              }
            }
            return plot;
          });

          if (hasChanges) {
            console.log(`[PlotMapping] Live updated ${mappingsMap.size} custom plot coordinates from Firestore for project ${project.id}.`);
            onUpdateProject({
              ...project,
              layout: updatedLayout,
              plots: updatedLayout
            }, true); // local-only update
          }
        }
      }, (err) => {
        console.warn('[PlotMapping] Realtime error loading plot mappings:', err);
      });
    } catch (err) {
      console.warn('[PlotMapping] Failed to setup plot mappings listener:', err);
    }

    return () => {
      if (unsub) unsub();
    };
  }, [project.id]);

  // Global Mouse Move and Mouse Up Event Listeners for dragging/resizing boundary mapping box
  useEffect(() => {
    if (!isDraggingActiveBox) return;

    const handleMouseMoveGlobal = (e: MouseEvent) => {
      const dx = e.clientX - activeBoxDragStart.current.mouseX;
      const dy = e.clientY - activeBoxDragStart.current.mouseY;
      
      const wrapperId = isFullscreen ? 'layout-image-wrapper-fullscreen' : 'layout-image-wrapper';
      const wrapperEl = document.getElementById(wrapperId);
      if (wrapperEl && selectedPlot) {
        const rect = wrapperEl.getBoundingClientRect();
        const pctX = (dx / rect.width) * 100;
        const pctY = (dy / rect.height) * 100;
        
        const updatedLayout = (project.plots || project.layout).map(p => {
          if (p.id === selectedPlot.id) {
            if (isDraggingActiveBox === 'move') {
              return {
                ...p,
                layoutX: Math.max(0, Math.min(100 - (p.layoutW || 6), parseFloat((activeBoxDragStart.current.startX + pctX).toFixed(2)))),
                layoutY: Math.max(0, Math.min(100 - (p.layoutH || 6), parseFloat((activeBoxDragStart.current.startY + pctY).toFixed(2)))),
              };
            } else if (isDraggingActiveBox === 'resize') {
              return {
                ...p,
                layoutW: Math.max(1, Math.min(50, parseFloat((activeBoxDragStart.current.startW + pctX).toFixed(2)))),
                layoutH: Math.max(1, Math.min(50, parseFloat((activeBoxDragStart.current.startH + pctY).toFixed(2)))),
              };
            }
          }
          return p;
        });
        
        onUpdateProject({
          ...project,
          layout: updatedLayout,
          plots: updatedLayout,
        }, true); // local-only
      }
    };

    const handleMouseUpGlobal = () => {
      setIsDraggingActiveBox(null);
    };

    window.addEventListener('mousemove', handleMouseMoveGlobal);
    window.addEventListener('mouseup', handleMouseUpGlobal);

    return () => {
      window.removeEventListener('mousemove', handleMouseMoveGlobal);
      window.removeEventListener('mouseup', handleMouseUpGlobal);
    };
  }, [isDraggingActiveBox, selectedPlot, project, onUpdateProject, isFullscreen]);

  // Auto-centering and zoom effects when selecting a plot
  useEffect(() => {
    if (selectedPlot && selectedPlot.layoutX !== undefined && selectedPlot.layoutY !== undefined) {
      const x = selectedPlot.layoutX;
      const y = selectedPlot.layoutY;
      const w = selectedPlot.layoutW || 6;
      const h = selectedPlot.layoutH || 6;
      
      // Expand map section if collapsed
      setIsLayoutMapExpanded(true);
      
      // Smoothly zoom in on the selected plot
      const targetZoom = 1.8;
      setZoomScale(targetZoom);
      
      const width = containerRef.current?.clientWidth || 800;
      const height = containerRef.current?.clientHeight || 450;
      
      // Relative distance offset from the center (50%)
      const pxX = (50 - (x + w / 2)) * (width / 100);
      const pxY = (50 - (y + h / 2)) * (height / 100);
      
      setPanOffset({ x: pxX * targetZoom, y: pxY * targetZoom });

      // Highlight scroll target
      const scrollIdSuffix = isFullscreen ? 'fs' : 'normal';
      const el = document.getElementById(`layout-plot-node-${selectedPlot.id}-${scrollIdSuffix}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [selectedPlot, isFullscreen]);

  const handleActiveBoxMouseDown = (e: React.MouseEvent, type: 'move' | 'resize') => {
    e.stopPropagation();
    e.preventDefault();
    setIsDraggingActiveBox(type);
    
    if (selectedPlot) {
      activeBoxDragStart.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        startX: selectedPlot.layoutX ?? 45,
        startY: selectedPlot.layoutY ?? 45,
        startW: selectedPlot.layoutW ?? 6,
        startH: selectedPlot.layoutH ?? 6,
      };
    }
  };

  const updateSelectedPlotCoordinate = (key: 'layoutX' | 'layoutY' | 'layoutW' | 'layoutH', val: number) => {
    if (!selectedPlot) return;
    const updatedLayout = (project.plots || project.layout).map(p => {
      if (p.id === selectedPlot.id) {
        return {
          ...p,
          [key]: val,
        };
      }
      return p;
    });
    
    onUpdateProject({
      ...project,
      layout: updatedLayout,
      plots: updatedLayout,
    }, true); // Local-only till saved!
  };

  const nudgeSelectedPlot = (dim: 'x' | 'y' | 'w' | 'h', val: number) => {
    if (!selectedPlot) return;
    const k = dim === 'x' ? 'layoutX' : dim === 'y' ? 'layoutY' : dim === 'w' ? 'layoutW' : 'layoutH';
    const defaultVal = dim === 'x' || dim === 'y' ? 45 : 6;
    const currentVal = selectedPlot[k] ?? defaultVal;
    updateSelectedPlotCoordinate(k, parseFloat((currentVal + val).toFixed(1)));
  };

  const handleGenerateDefaultGrid = () => {
    const plotsCount = (project.plots || project.layout).length;
    const cols = 10;
    const rows = Math.ceil(plotsCount / cols);
    
    const updatedLayout = (project.plots || project.layout).map((p, idx) => {
      const colIdx = idx % cols;
      const rowIdx = Math.floor(idx / cols);
      
      const layoutX = 5 + colIdx * (85 / (cols - 1 || 1));
      const layoutY = 5 + rowIdx * (85 / (rows - 1 || 1));
      const layoutW = 6;
      const layoutH = 6;
      
      return {
        ...p,
        layoutX: parseFloat(layoutX.toFixed(2)),
        layoutY: parseFloat(layoutY.toFixed(2)),
        layoutW,
        layoutH,
      };
    });
    
    onUpdateProject({
      ...project,
      layout: updatedLayout,
    }, true); // local-only
    
    alert('Generated a default coordinate grid overlay! You can now drag, resize, or nudge individual plot boundaries directly over the background layout image, then click "Save Mapping" to persist.');
  };

  const handleSaveLayoutCoordinates = async () => {
    setIsSavingCoordinates(true);
    setSaveSuccessMessage('');
    try {
      // 1. Save mappings to the dedicated plot_mappings collection
      const batchPromises = (project.plots || project.layout)
        .filter(plot => plot.layoutX !== undefined && plot.layoutY !== undefined)
        .map(async (plot) => {
          const mappingId = `${project.id}_${plot.number}`;
          const mappingDocRef = doc(db, 'plot_mappings', mappingId);
          const mappingData = {
            projectId: project.id,
            plotNumber: plot.number,
            layoutX: plot.layoutX,
            layoutY: plot.layoutY,
            layoutW: plot.layoutW || 6,
            layoutH: plot.layoutH || 6
          };
          await setDoc(mappingDocRef, sanitizeData(mappingData));
        });

      // 2. Also handle any deleted or cleared mappings from Firestore
      const unmappedPlots = (project.plots || project.layout).filter(plot => plot.layoutX === undefined || plot.layoutY === undefined);
      const deletePromises = unmappedPlots.map(async (plot) => {
        const mappingId = `${project.id}_${plot.number}`;
        const mappingDocRef = doc(db, 'plot_mappings', mappingId);
        await deleteDoc(mappingDocRef).catch(() => {}); // ignore error if not exists
      });

      await Promise.all([...batchPromises, ...deletePromises]);

      // 3. Save the project to update coordinates inside project document too (for redundancy)
      await onUpdateProject(project, false); 
      
      setSaveSuccessMessage('Plot coordinate boundaries successfully saved to database!');
      setTimeout(() => setSaveSuccessMessage(''), 4000);
    } catch (err: any) {
      console.error('Failed to save plot coordinates:', err);
      alert('Failed to save plot coordinates: ' + (err.message || err));
    } finally {
      setIsSavingCoordinates(false);
    }
  };

  const isVisible = (plot: Plot) => {
    if (zoomScale <= 1.05) return true; // Always show when fully zoomed out
    
    const wrapperId = isFullscreen ? 'layout-image-wrapper-fullscreen' : 'layout-image-wrapper';
    const wrapperEl = document.getElementById(wrapperId);
    if (!wrapperEl) return true;
    
    const rect = wrapperEl.getBoundingClientRect();
    const wrapperW = rect.width;
    const wrapperH = rect.height;
    
    const containerEl = containerRef.current;
    const containerW = containerEl ? containerEl.clientWidth : window.innerWidth;
    const containerH = containerEl ? containerEl.clientHeight : window.innerHeight;
    
    const x = plot.layoutX ?? -10;
    const y = plot.layoutY ?? -10;
    const w = plot.layoutW ?? 6;
    const h = plot.layoutH ?? 6;
    
    if (x < 0 || y < 0) return false;
    
    // Calculate plot coordinates in pixels relative to viewport center
    const plotX = containerW / 2 + panOffset.x + ((x - 50) / 100) * wrapperW;
    const plotY = containerH / 2 + panOffset.y + ((y - 50) / 100) * wrapperH;
    const plotW = (w / 100) * wrapperW;
    const plotH = (h / 100) * wrapperH;
    
    // Intersection check with container viewport, adding an 80px buffer
    const buffer = 80;
    const overlapX = (plotX + plotW >= -buffer) && (plotX <= containerW + buffer);
    const overlapY = (plotY + plotH >= -buffer) && (plotY <= containerH + buffer);
    
    return overlapX && overlapY;
  };

  const getPlotColorClass = (status: PlotStatus) => {
    const s = String(status || '').toLowerCase();
    
    // Status colors mapping:
    // 🟢 Available -> Emerald
    // 🔴 Sold -> Red
    // 🟡 Hold -> Amber
    // 🔵 Booked -> Blue
    // 🟣 Reserved -> Purple (Investment)
    // ⚫ Blocked -> Slate/Black
    
    if (s.includes('avail') || s.includes('resale') || s.includes('free')) {
      return { fill: 'rgba(16, 185, 129, 0.45)', stroke: '#10b981', text: 'text-emerald-800', border: 'border-emerald-500' };
    }
    if (s.includes('sold')) {
      return { fill: 'rgba(239, 68, 68, 0.45)', stroke: '#ef4444', text: 'text-red-800', border: 'border-red-500' };
    }
    if (s.includes('hold')) {
      return { fill: 'rgba(245, 158, 11, 0.45)', stroke: '#f59e0b', text: 'text-amber-800', border: 'border-amber-500' };
    }
    if (s.includes('book')) {
      return { fill: 'rgba(59, 130, 246, 0.45)', stroke: '#3b82f6', text: 'text-blue-800', border: 'border-blue-500' };
    }
    if (s.includes('reserve') || s.includes('investment') || s.includes('invest')) {
      return { fill: 'rgba(139, 92, 246, 0.45)', stroke: '#8b5cf6', text: 'text-purple-800', border: 'border-purple-500' };
    }
    if (s.includes('block')) {
      return { fill: 'rgba(31, 41, 55, 0.65)', stroke: '#1f2937', text: 'text-gray-100', border: 'border-gray-900' };
    }
    
    return { fill: 'rgba(107, 114, 128, 0.45)', stroke: '#6b7280', text: 'text-gray-800', border: 'border-gray-500' };
  };

  const renderInteractiveMap = (isFullscreenMode: boolean) => {
    const hClass = isFullscreenMode ? "w-full h-full" : "w-full h-[320px] md:h-[500px]";
    const imgMaxHClass = isFullscreenMode ? "max-w-[95vw] max-h-[90vh]" : "max-w-full max-h-[320px] md:max-h-[500px]";
    
    return (
      <div 
        ref={isFullscreenMode ? null : containerRef}
        className={`relative overflow-hidden flex items-center justify-center select-none touch-none ${hClass} ${
          zoomScale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        onClick={(e) => {
          if (dragDistance.current > 5) {
            return;
          }
          if (zoomScale === 1 && panOffset.x === 0 && panOffset.y === 0) {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left - rect.width / 2;
            const clickY = e.clientY - rect.top - rect.height / 2;
            setZoomScale(1.8);
            setPanOffset({ x: -clickX * 1.8, y: -clickY * 1.8 });
          } else if (zoomScale > 1 && !isDragging) {
            handleResetZoom();
          }
        }}
      >
        <div 
          id={isFullscreenMode ? "layout-image-wrapper-fullscreen" : "layout-image-wrapper"}
          className="relative inline-block"
          style={{
            transform: `scale(${zoomScale}) translate(${panOffset.x / zoomScale}px, ${panOffset.y / zoomScale}px)`,
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
          onClick={(e) => {
            if (e.target !== e.currentTarget) {
              e.stopPropagation();
            }
          }}
        >
          <img 
            src={imageSrc || null} 
            alt={`${project.name} Official Layout Map`} 
            onError={handleImageError}
            referrerPolicy="no-referrer"
            className={`${imgMaxHClass} object-contain pointer-events-none block`}
          />
          
          {/* Coordinates layer container - absolutely covers the exact image area */}
          <div className="absolute inset-0 pointer-events-auto">
            <PlotMappingEngine
              project={project}
              selectedPlot={selectedPlot}
              onSelectPlot={onSelectPlot}
              isEditCoordinatesMode={isEditCoordinatesMode}
              onUpdateProject={onUpdateProject}
              zoomScale={zoomScale}
              panOffset={panOffset}
              isFullscreen={isFullscreenMode}
              hoveredPlotForLayout={hoveredPlotForLayout}
              setHoveredPlotForLayout={setHoveredPlotForLayout}
              containerRef={containerRef}
            />

            {/* Hover Tooltip */}
            {hoveredPlotForLayout && (
              <div 
                className="absolute bg-slate-950/95 border border-slate-700 p-3 rounded-xl text-white text-[11px] space-y-1 shadow-2xl z-50 pointer-events-none backdrop-blur-md w-[190px]"
                style={{
                  left: `${(hoveredPlotForLayout.layoutX || 0) + (hoveredPlotForLayout.layoutW || 6) / 2}%`,
                  top: `${(hoveredPlotForLayout.layoutY || 0) - 1.5}%`,
                  transform: 'translate(-50%, -105%)',
                }}
              >
                <div className="font-extrabold text-blue-400 border-b border-slate-700/80 pb-1 mb-1.5 flex justify-between items-center">
                  <span>Plot {hoveredPlotForLayout.number}</span>
                  <span className="text-[9px] font-bold text-slate-300 uppercase bg-slate-800 px-1.5 py-0.2 rounded-full">
                    {(hoveredPlotForLayout.type as any) === 'EWA' ? 'EWS' : hoveredPlotForLayout.type}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span 
                    className="font-extrabold"
                    style={{ color: getStatusStyles(hoveredPlotForLayout.status).fill }}
                  >
                    {hoveredPlotForLayout.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Size:</span>
                  <span className="font-bold">{hoveredPlotForLayout.size > 0 ? `${hoveredPlotForLayout.size} sq.ft` : 'Not Available'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Dimensions:</span>
                  <span className="font-bold text-slate-200">{hoveredPlotForLayout.dimensions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Facing:</span>
                  <span className="font-bold text-slate-200">{hoveredPlotForLayout.facing}</span>
                </div>

                {hoveredPlotForLayout.customerName && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Customer:</span>
                    <span className="font-bold text-slate-200 truncate max-w-[100px]" title={hoveredPlotForLayout.customerName}>
                      {hoveredPlotForLayout.customerName}
                    </span>
                  </div>
                )}
                {hoveredPlotForLayout.salesExecutive && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Executive:</span>
                    <span className="font-bold text-slate-200 truncate max-w-[100px]" title={hoveredPlotForLayout.salesExecutive}>
                      {hoveredPlotForLayout.salesExecutive}
                    </span>
                  </div>
                )}
                {hoveredPlotForLayout.bookingDate && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Booked On:</span>
                    <span className="font-bold text-slate-200 truncate max-w-[100px]" title={hoveredPlotForLayout.bookingDate}>
                      {hoveredPlotForLayout.bookingDate}
                    </span>
                  </div>
                )}

                <div className="pt-1.5 border-t border-slate-800 flex justify-between items-center font-extrabold text-emerald-400 text-xs">
                  <span>Price:</span>
                  <span>₹{hoveredPlotForLayout.price.toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const handleImageError = () => {
    const fallback = OFFICIAL_LAYOUT_MAP_FALLBACKS[project.id];
    if (fallback && imageSrc !== fallback) {
      setImageSrc(fallback);
    } else if (imageSrc !== 'https://picsum.photos/seed/layout/800/600') {
      setImageSrc('https://picsum.photos/seed/layout/800/600');
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragDistance.current = 0;
    if (zoomScale === 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;
    dragDistance.current = Math.sqrt(dx * dx + dy * dy);
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    dragDistance.current = 0;
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setDragStart({ x: e.touches[0].clientX - panOffset.x, y: e.touches[0].clientY - panOffset.y });
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDist.current = dist;
      touchStartZoom.current = zoomScale;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1) {
      const dx = e.touches[0].clientX - dragStartPos.current.x;
      const dy = e.touches[0].clientY - dragStartPos.current.y;
      dragDistance.current = Math.sqrt(dx * dx + dy * dy);
      setPanOffset({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      });
    } else if (e.touches.length === 2 && touchStartDist.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = dist / touchStartDist.current;
      const nextZoom = Math.max(1, Math.min(touchStartZoom.current * scale, 4));
      setZoomScale(nextZoom);
      if (nextZoom === 1) setPanOffset({ x: 0, y: 0 });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchStartDist.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;

    const zoomFactor = 1.15;
    setZoomScale(prev => {
      const next = e.deltaY < 0 ? prev * zoomFactor : prev / zoomFactor;
      const clamped = Math.max(1, Math.min(next, 4));
      
      if (clamped === 1) {
        setPanOffset({ x: 0, y: 0 });
      } else {
        const ratio = clamped / prev;
        setPanOffset(p => ({
          x: mouseX - (mouseX - p.x) * ratio,
          y: mouseY - (mouseY - p.y) * ratio
        }));
      }
      return clamped;
    });
  };

  const handleZoomIn = () => setZoomScale(prev => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => {
    setZoomScale(prev => {
      const next = Math.max(prev - 0.25, 1);
      if (next === 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  };
  const handleResetZoom = () => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleLayoutImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setLayoutImageUploadError('Please select an image file (PNG, JPG, JPEG, WebP).');
      return;
    }

    setIsUploadingLayoutImage(true);
    setLayoutImageUploadError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH || height > MAX_HEIGHT) {
            if (width > height) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            } else {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Canvas 2D context not available');
          }

          // Fill with white background (useful for transparent PNGs converted to JPEG)
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Highly compress image using JPEG format at 0.65 quality
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.65);

          onUpdateProject({
            ...project,
            layoutMapImage: compressedDataUrl
          });
          setIsUploadingLayoutImage(false);
        } catch (err: any) {
          console.error('Error compressing image:', err);
          const base64Data = event.target?.result as string;
          // Fallback to original Base64 if small enough, otherwise show error
          if (base64Data.length > 800 * 1024) {
            setLayoutImageUploadError('Failed to compress image and the file is too large. Please select a smaller or lower resolution image.');
            setIsUploadingLayoutImage(false);
          } else {
            onUpdateProject({
              ...project,
              layoutMapImage: base64Data
            });
            setIsUploadingLayoutImage(false);
          }
        }
      };
      img.onerror = () => {
        setLayoutImageUploadError('Failed to load image for compression.');
        setIsUploadingLayoutImage(false);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setLayoutImageUploadError('Failed to read file.');
      setIsUploadingLayoutImage(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteLayoutImage = () => {
    if (window.confirm('Are you sure you want to delete the custom layout map image? This will restore the default layout map.')) {
      onUpdateProject({
        ...project,
        layoutMapImage: undefined
      });
      setImageSrc(`/layouts/${project.name}.jpg`);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    if (isFullscreen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  const filteredPlots = useMemo(() => {
    return (project.plots || project.layout).filter(plot => {
      const { status, facing, number } = activeFilters;
      const statusMatch = status === 'All' || plot.status === status;
      const facingMatch = facing === 'All' || plot.facing === facing;
      const numberMatch = plot.number.toLowerCase().includes(number.toLowerCase());
      return statusMatch && facingMatch && numberMatch;
    });
  }, [project.plots, project.layout, activeFilters]);

  const isSearchBeyondLimit = useMemo(() => {
    if (activeFilters.number.trim()) {
      const searchNumStr = activeFilters.number.toLowerCase()
        .replace('p-', '')
        .replace('plot', '')
        .trim();
      const num = parseInt(searchNumStr);
      if (!isNaN(num)) {
        return num > project.totalPlots || num < 1;
      }
    }
    return false;
  }, [project.id, project.totalPlots, activeFilters.number]);

  const handleApplyFilters = (newFilters: FilterValues) => {
    setActiveFilters(newFilters);
    setIsFilterModalOpen(false);
  };
  
  const handlePlotClick = (plot: Plot) => {
    if (isAdmin) {
      setEditingPlot(plot);
    } else {
      onSelectPlot(plot);
    }
  };
  
  const handleSavePlot = (updatedPlot: Plot) => {
    const updatedLayout = (project.plots || project.layout).map(p => p.id === updatedPlot.id ? updatedPlot : p);
    
    // Recalculate available plots to ensure data consistency
    const availablePlotsCount = updatedLayout.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length;

    onUpdateProject({ 
        ...project, 
        layout: updatedLayout,
        plots: updatedLayout,
        availablePlots: availablePlotsCount,
    });
    setEditingPlot(null);
    // If the currently selected plot was the one being edited, update it
    if(selectedPlot?.id === updatedPlot.id) {
      onSelectPlot(updatedPlot);
    }
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeFilters.status !== 'All') count++;
    if (activeFilters.facing !== 'All') count++;
    if (activeFilters.number) count++;
    return count;
  }, [activeFilters]);

  useEffect(() => {
    if (selectedPlot) {
      const el = document.getElementById(`plot-card-${selectedPlot.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedPlot]);

  return (
    <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{project.name}</h1>
              <p className="text-gray-500">Interactive Layout {isAdmin && <span className="text-sm font-semibold text-green-600">(Admin Mode)</span>}</p>
              {project.plotSizes && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-gray-600">Available Plot Sizes:</span>
                  {project.plotSizes.split(',').map((size) => (
                    <span key={size.trim()} className="bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-2xs">
                      🟢 {size.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
                 <div className="relative flex-grow">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"><Icon name="search" className="w-5 h-5 text-gray-400" /></div>
                    <input type="text" placeholder="Search by Plot No..." value={activeFilters.number} onChange={e => setActiveFilters(f => ({ ...f, number: e.target.value }))} className="w-full p-2 pl-10 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <button onClick={() => setIsFilterModalOpen(true)} className="relative flex items-center gap-2 bg-white font-semibold text-gray-700 px-4 py-2 rounded-lg shadow hover:bg-gray-100 transition-colors">
                  <Icon name="filter" className="w-5 h-5"/><span>Filter</span>
                  {activeFilterCount > 0 && (<span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{activeFilterCount}</span>)}
                </button>
            </div>
        </div>
        
        <FilterModal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} onApply={handleApplyFilters} initialFilters={activeFilters} />
        {editingPlot && <EditPlotModal plot={editingPlot} onClose={() => setEditingPlot(null)} onSave={handleSavePlot} />}
        
        {isAdmin && <AdminColorKey />}

        <div className="flex flex-col lg:flex-row gap-8 mb-8">
            <div className="lg:w-2/3 bg-gray-50 p-4 rounded-lg shadow-inner">
                {isSearchBeyondLimit ? (
                    <div className="text-center py-10 px-4 text-red-600 bg-red-50 border border-red-100 rounded-xl">
                        <p className="font-extrabold text-base">Plot does not exist in {project.name}.</p>
                        <p className="text-xs text-red-500 mt-1">
                          This project strictly contains {project.totalPlots} valid plots only (numbered 1 to {project.totalPlots}).
                        </p>
                    </div>
                ) : filteredPlots.length > 0 ? (
                    <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                        {filteredPlots.map(plot => (<PlotCard key={plot.id} plot={plot} isSelected={selectedPlot?.id === plot.id} onClick={handlePlotClick} />))}
                    </div>
                ) : (
                    <div className="text-center py-10 text-gray-500"><p className="font-semibold">No plots match your criteria.</p><p className="text-sm">Try adjusting your filters.</p></div>
                )}
            </div>
            <div className="lg:w-1/3">
                <SelectedPlotDetails
                    plot={selectedPlot}
                    project={project}
                    onDeselect={() => onSelectPlot(null)}
                    onBookSiteVisit={() => selectedPlot && onBookSiteVisit(project, selectedPlot)}
                    isAdmin={isAdmin}
                    onEdit={setEditingPlot}
                />
            </div>
        </div>

        {/* Interactive Gated Map (Based on PDF blueprint layouts) */}
        <div className="mb-8">
          <InteractiveProjectMap
            project={project}
            isAdmin={isAdmin}
            onUpdateProject={onUpdateProject}
            onBookSiteVisit={onBookSiteVisit}
            selectedPlot={selectedPlot}
            onSelectPlot={onSelectPlot}
            externalSearchQuery={activeFilters.number}
            externalStatusFilter={activeFilters.status}
            externalFacingFilter={activeFilters.facing}
          />
        </div>

        {/* Collapsible Official Project Layout Map Section */}
        <div id="official-project-layout-map" className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-8 mt-4">
          <button 
            type="button"
            onClick={() => setIsLayoutMapExpanded(!isLayoutMapExpanded)}
            className="w-full flex justify-between items-center p-5 bg-gray-50 hover:bg-gray-100/80 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">🗺️</span>
              <h3 className="text-lg font-bold text-gray-800 font-sans tracking-tight">Official Project Layout Map</h3>
              {saveSuccessMessage && (
                <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 animate-pulse ml-2">
                  {saveSuccessMessage}
                </span>
              )}
            </div>
            <svg 
              className={`w-5 h-5 text-gray-500 transform transition-transform duration-200 ${isLayoutMapExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {isLayoutMapExpanded && (
            <div className="p-5 space-y-4">
              {/* Toolbar: Search, Filters & Admin Boundary Editor Mode */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 border border-gray-200 rounded-xl p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-gray-700">Filter Layout:</span>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search plot (e.g. 101)..."
                      value={searchQueryForLayout}
                      onChange={(e) => {
                        setSearchQueryForLayout(e.target.value);
                        const q = e.target.value.trim().toLowerCase();
                        if (q) {
                          const found = (project.plots || project.layout).find(
                            p => p.number.toLowerCase().includes(q) || p.number.replace('P-', '').toLowerCase() === q
                          );
                          if (found) {
                            onSelectPlot(found);
                          }
                        }
                      }}
                      className="pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 w-[200px] bg-white"
                    />
                    <span className="absolute left-2.5 top-1.5 text-xs text-gray-400">🔍</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Legend Indicator */}
                  <div className="flex items-center gap-2 text-[10px] text-gray-500 mr-2">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500/50 border border-green-500"></span> Avail</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500/50 border border-red-500"></span> Sold</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500/50 border border-yellow-500"></span> Hold</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500/50 border border-blue-500"></span> Booked</span>
                  </div>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditCoordinatesMode(!isEditCoordinatesMode);
                        if (!isEditCoordinatesMode && !selectedPlot && (project.plots || project.layout).length > 0) {
                          // Select first plot automatically to edit
                          onSelectPlot((project.plots || project.layout)[0]);
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer ${
                        isEditCoordinatesMode 
                          ? 'bg-yellow-500 text-slate-900 border-yellow-600 hover:bg-yellow-600' 
                          : 'bg-white text-slate-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span>🛠️</span>
                      {isEditCoordinatesMode ? 'Exit Boundary Editor' : 'Edit Plot Boundaries'}
                    </button>
                  )}
                </div>
              </div>

              {project.plotSizes && (
                <div className="bg-emerald-50/30 border border-emerald-100 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold text-sm">🟢</span>
                    <span className="font-extrabold text-slate-700">Official Project Layout Dimensions:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {project.plotSizes.split(',').map((size) => (
                      <span key={size} className="bg-white border border-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-2xs">
                        {size.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Boundary Editor Drawer Panel (Only visible to Admin) */}
              {isEditCoordinatesMode && (
                <div className="bg-yellow-50/50 border border-yellow-200 rounded-xl p-4 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-yellow-200 pb-2">
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <span>📐</span> Plot Boundary Editor
                    </h4>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleGenerateDefaultGrid}
                        className="px-2 py-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
                        title="Distribute all plots in a neat default grid for quick alignment"
                      >
                        ⚡ Auto-Distribute Plots Grid
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveLayoutCoordinates}
                        disabled={isSavingCoordinates}
                        className="px-3 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50"
                      >
                        💾 {isSavingCoordinates ? 'Saving...' : 'Save Mapping'}
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-700">
                    {/* Column 1: Select Plot */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-600 block">1. Select Plot to Map:</label>
                      <select
                        value={selectedPlot?.id || ''}
                        onChange={(e) => {
                          const plotId = parseInt(e.target.value);
                          const found = (project.plots || project.layout).find(p => p.id === plotId);
                          if (found) {
                            onSelectPlot(found);
                          }
                        }}
                        className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="">-- Choose Plot --</option>
                        {(project.plots || project.layout).map(p => (
                          <option key={p.id} value={p.id}>
                            {p.number} ({p.layoutX !== undefined ? 'Mapped' : 'Unmapped 🛑'})
                          </option>
                        ))}
                      </select>
                      
                      {selectedPlot && (
                        <div className="flex gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              // Initialize at center
                              const updatedLayout = (project.plots || project.layout).map(p => {
                                if (p.id === selectedPlot.id) {
                                  return { ...p, layoutX: 45, layoutY: 45, layoutW: 8, layoutH: 8 };
                                }
                                return p;
                              });
                              onUpdateProject({ ...project, layout: updatedLayout, plots: updatedLayout }, true);
                            }}
                            className="px-2 py-1 text-[10px] font-semibold bg-white border rounded hover:bg-slate-50 flex-grow"
                          >
                            📍 Set to Center
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              // Remove mapping
                              const updatedLayout = (project.plots || project.layout).map(p => {
                                if (p.id === selectedPlot.id) {
                                  const copy = { ...p };
                                  delete copy.layoutX;
                                  delete copy.layoutY;
                                  delete copy.layoutW;
                                  delete copy.layoutH;
                                  return copy;
                                }
                                return p;
                              });
                              onUpdateProject({ ...project, layout: updatedLayout, plots: updatedLayout }, true);
                            }}
                            className="px-2 py-1 text-[10px] font-semibold bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100"
                          >
                            🗑️ Clear
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Column 2: Coordinate sliders */}
                    <div className="space-y-2">
                      <span className="font-bold text-slate-600 block">2. Tweak Coordinates:</span>
                      {selectedPlot ? (
                        <div className="space-y-2.5">
                          <div>
                            <div className="flex justify-between text-[10px] mb-0.5">
                              <span>Left Position (X): <strong>{selectedPlot.layoutX?.toFixed(1) ?? '--'}%</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => nudgeSelectedPlot('x', -0.5)}
                                className="w-5 h-5 bg-white border border-slate-300 rounded hover:bg-slate-50 flex items-center justify-center font-bold"
                              >-</button>
                              <input
                                type="range"
                                min="0"
                                max="95"
                                step="0.1"
                                value={selectedPlot.layoutX ?? 45}
                                onChange={(e) => updateSelectedPlotCoordinate('layoutX', parseFloat(e.target.value))}
                                className="flex-grow accent-blue-500"
                              />
                              <button
                                type="button"
                                onClick={() => nudgeSelectedPlot('x', 0.5)}
                                className="w-5 h-5 bg-white border border-slate-300 rounded hover:bg-slate-50 flex items-center justify-center font-bold"
                              >+</button>
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-[10px] mb-0.5">
                              <span>Top Position (Y): <strong>{selectedPlot.layoutY?.toFixed(1) ?? '--'}%</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => nudgeSelectedPlot('y', -0.5)}
                                className="w-5 h-5 bg-white border border-slate-300 rounded hover:bg-slate-50 flex items-center justify-center font-bold"
                              >-</button>
                              <input
                                type="range"
                                min="0"
                                max="95"
                                step="0.1"
                                value={selectedPlot.layoutY ?? 45}
                                onChange={(e) => updateSelectedPlotCoordinate('layoutY', parseFloat(e.target.value))}
                                className="flex-grow accent-blue-500"
                              />
                              <button
                                type="button"
                                onClick={() => nudgeSelectedPlot('y', 0.5)}
                                className="w-5 h-5 bg-white border border-slate-300 rounded hover:bg-slate-50 flex items-center justify-center font-bold"
                              >+</button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-400 text-xs italic">Select a plot to edit coordinates</p>
                      )}
                    </div>

                    {/* Column 3: Dimension sliders & keyboard nudging */}
                    <div className="space-y-2">
                      <span className="font-bold text-slate-600 block">3. Adjust Sizes:</span>
                      {selectedPlot ? (
                        <div className="space-y-2.5">
                          <div>
                            <div className="flex justify-between text-[10px] mb-0.5">
                              <span>Width (W): <strong>{selectedPlot.layoutW?.toFixed(1) ?? '--'}%</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => nudgeSelectedPlot('w', -0.5)}
                                className="w-5 h-5 bg-white border border-slate-300 rounded hover:bg-slate-50 flex items-center justify-center font-bold"
                              >-</button>
                              <input
                                type="range"
                                min="1"
                                max="30"
                                step="0.1"
                                value={selectedPlot.layoutW ?? 6}
                                onChange={(e) => updateSelectedPlotCoordinate('layoutW', parseFloat(e.target.value))}
                                className="flex-grow accent-blue-500"
                              />
                              <button
                                type="button"
                                onClick={() => nudgeSelectedPlot('w', 0.5)}
                                className="w-5 h-5 bg-white border border-slate-300 rounded hover:bg-slate-50 flex items-center justify-center font-bold"
                              >+</button>
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-[10px] mb-0.5">
                              <span>Height (H): <strong>{selectedPlot.layoutH?.toFixed(1) ?? '--'}%</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => nudgeSelectedPlot('h', -0.5)}
                                className="w-5 h-5 bg-white border border-slate-300 rounded hover:bg-slate-50 flex items-center justify-center font-bold"
                              >-</button>
                              <input
                                type="range"
                                min="1"
                                max="30"
                                step="0.1"
                                value={selectedPlot.layoutH ?? 6}
                                onChange={(e) => updateSelectedPlotCoordinate('layoutH', parseFloat(e.target.value))}
                                className="flex-grow accent-blue-500"
                              />
                              <button
                                type="button"
                                onClick={() => nudgeSelectedPlot('h', 0.5)}
                                className="w-5 h-5 bg-white border border-slate-300 rounded hover:bg-slate-50 flex items-center justify-center font-bold"
                              >+</button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-400 text-xs italic">Select a plot to edit coordinates</p>
                      )}
                    </div>
                  </div>

                  {/* Dynamic Keyboard Assistance Hint */}
                  <div className="text-[10px] bg-white border border-yellow-200/50 p-2 rounded-lg flex justify-between items-center text-slate-500">
                    <span>💡 <strong>Visual Drag:</strong> Drag the box on the layout image to reposition. Drag the bottom-right corner circle to resize.</span>
                    <span>⭐ Keyboard nudging supported when sliders are focused.</span>
                  </div>
                </div>
              )}

              {/* Main Interactive Map Stage */}
              <div className="relative border border-gray-100 rounded-xl bg-slate-900 overflow-hidden min-h-[320px] md:min-h-[500px]">
                
                {/* Render the interactive layout map */}
                {renderInteractiveMap(false)}

                 {/* Floating Interactive Controls - Consistent with Digital Map Experience */}
                <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
                    className="w-10 h-10 bg-white hover:bg-slate-100 text-slate-700 font-extrabold rounded-xl border border-slate-200 shadow-md flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
                    title="Zoom In"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
                    className="w-10 h-10 bg-white hover:bg-slate-100 text-slate-700 font-extrabold rounded-xl border border-slate-200 shadow-md flex items-center justify-center transition-transform hover:scale-105 cursor-pointer disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                    title="Zoom Out"
                    disabled={zoomScale === 1}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleResetZoom(); }}
                    className="w-10 h-10 bg-white hover:bg-slate-100 text-slate-700 font-extrabold rounded-xl border border-slate-200 shadow-md flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
                    title="Auto-Fit Map"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 0h-4m4 0l-5-5" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleResetZoom(); }}
                    className="w-10 h-10 bg-white hover:bg-slate-100 text-slate-700 font-extrabold rounded-xl border border-slate-200 shadow-md flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
                    title="Reset View"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15H19" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setIsFullscreen(true); }}
                    className="w-10 h-10 bg-white hover:bg-slate-100 text-slate-700 font-extrabold rounded-xl border border-slate-200 shadow-md flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
                    title="View Fullscreen"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                    </svg>
                  </button>
                </div>

                {/* Overlay Instruction */}
                <div className="absolute bottom-3 left-3 bg-black/60 px-3 py-1.5 rounded-lg backdrop-blur-sm text-[11px] font-medium text-white/95 pointer-events-none z-10">
                  {zoomScale > 1 ? '🖱️ Drag to pan • Hover plots for info' : '🔍 Hover plots for details • Double click or use controls to zoom'}
                </div>
              </div>

              {/* Admin Actions (Replace / Delete Layout Image) */}
              {isAdmin && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="flex flex-col gap-1 flex-grow">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <span>🖼️</span> Admin Controls: <span className="font-semibold text-slate-800">Map Image Asset URL</span>
                    </span>
                    <p className="text-[10px] text-slate-500">Store project layout images in assets or Storage. Paste lightweight URL string below.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <input
                      type="text"
                      placeholder="e.g., https://example.com/layout.jpg"
                      value={project.layoutMapImage || ''}
                      onChange={(e) => {
                        onUpdateProject({
                          ...project,
                          layoutMapImage: e.target.value.trim() || undefined
                        }, true); // local-only
                      }}
                      className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white flex-grow md:w-[320px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveLayoutCoordinates}
                        disabled={isSavingCoordinates}
                        className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-50 whitespace-nowrap"
                      >
                        {isSavingCoordinates ? 'Saving...' : 'Save Image URL'}
                      </button>
                      {project.layoutMapImage && (
                        <button
                          type="button"
                          onClick={handleDeleteLayoutImage}
                          className="px-3 py-1.5 text-xs font-bold text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shadow-sm whitespace-nowrap"
                        >
                          Restore Default
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {layoutImageUploadError && (
                <p className="text-red-500 text-xs font-semibold mt-1">{layoutImageUploadError}</p>
              )}
            </div>
          )}
        </div>

        {/* Hidden upload inputs for replace layout map image */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => { if (e.target.files?.[0]) handleLayoutImageUpload(e.target.files[0]); }}
          accept="image/*"
          className="hidden"
        />

        {/* Fullscreen Overlay Portal */}
        {isFullscreen && (
          <div className="fixed inset-0 bg-slate-950/98 z-50 flex flex-col items-center justify-center p-4 select-none">
            {/* Header controls inside Fullscreen */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white z-10">
              <span className="font-bold text-sm md:text-base tracking-tight bg-black/40 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                {project.name} - Official Layout Map
              </span>
              <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-lg backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => handleZoomIn()}
                  className="p-2 hover:bg-white/10 rounded transition-colors text-white animate-none"
                  title="Zoom In"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleZoomOut()}
                  className="p-2 hover:bg-white/10 rounded transition-colors text-white animate-none"
                  title="Zoom Out"
                  disabled={zoomScale === 1}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleResetZoom()}
                  className="px-3 py-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 rounded transition-colors text-white"
                  title="Auto Fit"
                >
                  Auto Fit
                </button>
                <button
                  type="button"
                  onClick={() => handleResetZoom()}
                  className="px-3 py-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 rounded transition-colors text-white"
                  title="Reset"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  className="p-2 hover:bg-white/10 rounded transition-colors text-white ml-2 border border-white/20"
                  title="Close Fullscreen"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Main Interactive Zoom Panel inside Fullscreen */}
            <div className="w-full h-full flex items-center justify-center overflow-hidden">
              {renderInteractiveMap(true)}
            </div>

            {/* Instruction Footer inside Fullscreen */}
            <div className="absolute bottom-4 bg-black/40 px-4 py-2 rounded-lg backdrop-blur-sm text-xs font-medium text-white/80 pointer-events-none">
              {zoomScale > 1 ? '🖱️ Drag to pan • Hover plots for info' : '🔍 Hover plots for details • Double click to zoom • ESC to exit'}
            </div>
          </div>
        )}
    </div>
  );
};

export default PlotViewer;