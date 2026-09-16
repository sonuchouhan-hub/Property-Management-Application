import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Project, Plot, PlotStatus } from '../types';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, sanitizeData } from '../services/firebaseService';
import { STATUS_COLORS, getNormalizedStatus, getStatusStyles } from '../constants';

const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

interface PlotMappingEngineProps {
  project: Project;
  selectedPlot: Plot | null;
  onSelectPlot: (plot: Plot | null) => void;
  isEditCoordinatesMode: boolean;
  onUpdateProject: (project: Project, isLocalOnly?: boolean) => void;
  zoomScale: number;
  panOffset: { x: number; y: number };
  isFullscreen: boolean;
  hoveredPlotForLayout: Plot | null;
  setHoveredPlotForLayout: (plot: Plot | null) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

export const PlotMappingEngine: React.FC<PlotMappingEngineProps> = ({
  project,
  selectedPlot,
  onSelectPlot,
  isEditCoordinatesMode,
  onUpdateProject,
  zoomScale,
  panOffset,
  isFullscreen,
  hoveredPlotForLayout,
  setHoveredPlotForLayout,
  containerRef,
}) => {
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [tempBox, setTempBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  
  // Assignment state
  const [drawnBoxToAssign, setDrawnBoxToAssign] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [selectedAssignPlotId, setSelectedAssignPlotId] = useState<number | ''>('');

  // Dragging and resizing state of existing active box
  const [activeBoxDragging, setActiveBoxDragging] = useState<'move' | 'resize' | null>(null);
  const activeBoxDragStart = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0, startW: 0, startH: 0 });

  const svgRef = useRef<SVGSVGElement>(null);

  // Performance Optimization: Viewport culling to check if a plot is currently visible
  const isPlotVisible = (plot: Plot) => {
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
    
    const plotX = containerW / 2 + panOffset.x + ((x - 50) / 100) * wrapperW;
    const plotY = containerH / 2 + panOffset.y + ((y - 50) / 100) * wrapperH;
    const plotW = (w / 100) * wrapperW;
    const plotH = (h / 100) * wrapperH;
    
    const buffer = 80;
    const overlapX = (plotX + plotW >= -buffer) && (plotX <= containerW + buffer);
    const overlapY = (plotY + plotH >= -buffer) && (plotY <= containerH + buffer);
    
    return overlapX && overlapY;
  };

  const getPlotColor = (status: any) => {
    const norm = getNormalizedStatus(status);
    const styles = STATUS_COLORS[norm];
    const fillRgb = hexToRgba(styles.fill, 0.45);
    
    // text/label color
    let textColorClass = 'text-green-400';
    if (norm === 'sold') textColorClass = 'text-red-400';
    else if (norm === 'booked') textColorClass = 'text-amber-400';
    else if (norm === 'investment') textColorClass = 'text-purple-400';
    else if (norm === 'for resale') textColorClass = 'text-cyan-400';
    else if (norm === 'fallback') textColorClass = 'text-gray-400';

    return { fill: fillRgb, stroke: styles.fill, text: textColorClass };
  };

  // Convert client pointer coordinate to percentage coordinates (0 to 100) relative to SVG wrapper
  const getPercentageCoords = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return {
      x: parseFloat(Math.max(0, Math.min(100, x)).toFixed(2)),
      y: parseFloat(Math.max(0, Math.min(100, y)).toFixed(2))
    };
  };

  // Dragging and resizing event handlers for the active box
  useEffect(() => {
    if (!activeBoxDragging) return;

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
            if (activeBoxDragging === 'move') {
              return {
                ...p,
                layoutX: Math.max(0, Math.min(100 - (p.layoutW || 6), parseFloat((activeBoxDragStart.current.startX + pctX).toFixed(2)))),
                layoutY: Math.max(0, Math.min(100 - (p.layoutH || 6), parseFloat((activeBoxDragStart.current.startY + pctY).toFixed(2)))),
              };
            } else if (activeBoxDragging === 'resize') {
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
        }, true); // local-only update
      }
    };

    const handleMouseUpGlobal = () => {
      setActiveBoxDragging(null);
    };

    window.addEventListener('mousemove', handleMouseMoveGlobal);
    window.addEventListener('mouseup', handleMouseUpGlobal);

    return () => {
      window.removeEventListener('mousemove', handleMouseMoveGlobal);
      window.removeEventListener('mouseup', handleMouseUpGlobal);
    };
  }, [activeBoxDragging, selectedPlot, project, onUpdateProject, isFullscreen]);

  const handleActiveBoxMouseDown = (e: React.MouseEvent, type: 'move' | 'resize') => {
    e.stopPropagation();
    e.preventDefault();
    setActiveBoxDragging(type);
    
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

  // Drawing event handlers on the SVG overlay
  const handleSVGMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isEditCoordinatesMode) return;
    
    // If clicking a resize handle or active box, ignore drawing
    const target = e.target as HTMLElement;
    if (target.closest('.active-boundary-box') || target.closest('.resize-handle')) {
      return;
    }

    e.stopPropagation();
    e.preventDefault();

    const coords = getPercentageCoords(e.clientX, e.clientY);
    setIsDrawing(true);
    setDrawStart(coords);
    setTempBox({ x: coords.x, y: coords.y, w: 0, h: 0 });
    setDrawnBoxToAssign(null);
  };

  const handleSVGMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawing || !drawStart) return;
    e.stopPropagation();

    const coords = getPercentageCoords(e.clientX, e.clientY);
    const x = Math.min(drawStart.x, coords.x);
    const y = Math.min(drawStart.y, coords.y);
    const w = Math.abs(coords.x - drawStart.x);
    const h = Math.abs(coords.y - drawStart.y);

    setTempBox({ x, y, w, h });
  };

  const handleSVGMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawing) return;
    e.stopPropagation();
    setIsDrawing(false);

    if (tempBox && tempBox.w > 1 && tempBox.h > 1) {
      // Valid rectangle drawn! Show assignment popup
      setDrawnBoxToAssign(tempBox);
      
      // Auto pre-select current selectedPlotId if it is unmapped, or keep empty
      if (selectedPlot && selectedPlot.layoutX === undefined) {
        setSelectedAssignPlotId(selectedPlot.id);
      } else {
        setSelectedAssignPlotId('');
      }
    } else {
      // Just a click on empty area, clear selected plot if click was on nothing
      const target = e.target as SVGElement;
      if (target.tagName === 'svg' || target.classList.contains('canvas-background')) {
        onSelectPlot(null);
      }
    }
    setTempBox(null);
    setDrawStart(null);
  };

  // Handle assigning the drawn rectangle to a plot
  const handleConfirmAssignment = () => {
    if (!drawnBoxToAssign || selectedAssignPlotId === '') return;

    const targetPlot = (project.plots || project.layout).find(p => p.id === selectedAssignPlotId);
    if (!targetPlot) return;

    const updatedLayout = (project.plots || project.layout).map(p => {
      if (p.id === targetPlot.id) {
        return {
          ...p,
          layoutX: parseFloat(drawnBoxToAssign.x.toFixed(2)),
          layoutY: parseFloat(drawnBoxToAssign.y.toFixed(2)),
          layoutW: parseFloat(drawnBoxToAssign.w.toFixed(2)),
          layoutH: parseFloat(drawnBoxToAssign.h.toFixed(2)),
        };
      }
      return p;
    });

    onUpdateProject({
      ...project,
      layout: updatedLayout,
      plots: updatedLayout,
    }, true); // Update local layout state

    // Select the newly mapped plot
    const freshMappedPlot = updatedLayout.find(p => p.id === targetPlot.id) || targetPlot;
    onSelectPlot(freshMappedPlot);

    // Reset drawn states
    setDrawnBoxToAssign(null);
    setAssignmentSearch('');
    setSelectedAssignPlotId('');
  };

  // Filter plots list for search within the assignment popover
  const assignablePlots = useMemo(() => {
    return (project.plots || project.layout).filter(p => {
      const isUnmapped = p.layoutX === undefined || p.layoutY === undefined;
      const matchesSearch = p.number.toLowerCase().includes(assignmentSearch.toLowerCase());
      return matchesSearch;
    }).sort((a, b) => {
      // Put unmapped plots at the top
      const aUnmapped = a.layoutX === undefined ? 1 : 0;
      const bUnmapped = b.layoutX === undefined ? 1 : 0;
      if (aUnmapped !== bUnmapped) return bUnmapped - aUnmapped;
      return a.number.localeCompare(b.number, undefined, { numeric: true });
    });
  }, [project.plots, project.layout, assignmentSearch]);

  return (
    <div className="absolute inset-0 pointer-events-auto select-none">
      <svg
        ref={svgRef}
        className={`absolute inset-0 w-full h-full ${
          isEditCoordinatesMode ? (isDrawing ? 'cursor-crosshair' : 'cursor-crosshair') : ''
        }`}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        onMouseDown={handleSVGMouseDown}
        onMouseMove={handleSVGMouseMove}
        onMouseUp={handleSVGMouseUp}
      >
        {/* Transparent catch-all background for drawing over empty areas */}
        {isEditCoordinatesMode && (
          <rect
            className="canvas-background"
            width="100"
            height="100"
            fill="transparent"
          />
        )}

        {/* 1. Draw existing mapped plot boundary rectangles */}
        {(project.plots || project.layout).map((plot) => {
          const hasCoords = plot.layoutX !== undefined && plot.layoutY !== undefined;
          const x = plot.layoutX !== undefined ? plot.layoutX : -10;
          const y = plot.layoutY !== undefined ? plot.layoutY : -10;
          const w = plot.layoutW !== undefined ? plot.layoutW : 6;
          const h = plot.layoutH !== undefined ? plot.layoutH : 6;

          if (!hasCoords && !isEditCoordinatesMode) return null;

          const isSelected = selectedPlot?.id === plot.id;
          const isHovered = hoveredPlotForLayout?.id === plot.id;

          // Viewport culling for performance
          if (!isPlotVisible(plot) && !isSelected) return null;

          const color = getPlotColor(plot.status);

          // Customize styling when selected or hovered, keeping it beautifully transparent and color-coded by status
          const fill = isSelected
            ? 'rgba(59, 130, 246, 0.45)' // Highlight selected
            : isHovered
            ? color.fill.replace('0.45', '0.65') // Stronger color on hover
            : color.fill; // Transparent status color overlay (0.45 opacity emerald, red, amber, blue, purple)
          
          const stroke = isSelected
            ? '#eab308' // Yellow border for selected plot
            : isHovered
            ? '#ffffff' // White border on hover
            : color.stroke;

          const strokeWidth = isSelected ? 0.6 : isHovered ? 0.4 : 0.2;

          return (
            <g
              key={`mapping-plot-g-${plot.id}-${isFullscreen ? 'fs' : 'normal'}`}
              id={`layout-plot-node-${plot.id}-${isFullscreen ? 'fs' : 'normal'}`}
              className="cursor-pointer group select-none"
              onClick={(e) => {
                e.stopPropagation();
                onSelectPlot(plot);
              }}
              onMouseEnter={() => setHoveredPlotForLayout(plot)}
              onMouseLeave={() => setHoveredPlotForLayout(null)}
            >
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                rx={0.3}
                className="transition-all duration-150"
              />
              
              {/* Only show label if hovered, selected or if zoomed in and layout has coords */}
              {(isHovered || isSelected || (zoomScale > 1.5 && hasCoords)) && (
                <text
                  x={x + w / 2}
                  y={y + h / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#ffffff"
                  fontSize={Math.max(1.1, w * 0.22)}
                  fontWeight="bold"
                  className="pointer-events-none select-none font-sans"
                  style={{ filter: 'drop-shadow(0px 1px 1px rgba(0,0,0,0.85))' }}
                >
                  {plot.number.replace('P-', '')}
                </text>
              )}
            </g>
          );
        })}

        {/* 2. Render temporary rectangle while actively drawing */}
        {isDrawing && tempBox && (
          <rect
            x={tempBox.x}
            y={tempBox.y}
            width={tempBox.w}
            height={tempBox.h}
            fill="rgba(234, 179, 8, 0.15)"
            stroke="#eab308"
            strokeWidth="0.4"
            strokeDasharray="1,1"
            rx="0.3"
          />
        )}

        {/* 3. Render the highlighted box currently being assigned */}
        {drawnBoxToAssign && (
          <rect
            x={drawnBoxToAssign.x}
            y={drawnBoxToAssign.y}
            width={drawnBoxToAssign.w}
            height={drawnBoxToAssign.h}
            fill="rgba(59, 130, 246, 0.2)"
            stroke="#2563eb"
            strokeWidth="0.5"
            strokeDasharray="1.5,1.5"
            rx="0.3"
          />
        )}
      </svg>

      {/* 4. Active interactive drag/resize helper overlay box for Admin mapping adjustments */}
      {isEditCoordinatesMode && selectedPlot && selectedPlot.layoutX !== undefined && selectedPlot.layoutY !== undefined && (
        <div
          className="absolute border-2 border-dashed border-yellow-400 bg-yellow-500/10 z-40 active-boundary-box"
          style={{
            left: `${selectedPlot.layoutX}%`,
            top: `${selectedPlot.layoutY}%`,
            width: `${selectedPlot.layoutW || 6}%`,
            height: `${selectedPlot.layoutH || 6}%`,
          }}
          onMouseDown={(e) => handleActiveBoxMouseDown(e, 'move')}
        >
          {/* Resize handle bottom-right */}
          <div
            className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-yellow-400 border border-slate-900 rounded-full cursor-se-resize flex items-center justify-center z-50 shadow-md hover:scale-110 active:scale-95 transition-transform resize-handle"
            onMouseDown={(e) => handleActiveBoxMouseDown(e, 'resize')}
          />
          
          {/* Tag Title */}
          <div className="absolute -top-6 left-0 bg-yellow-400 text-slate-900 text-[10px] font-extrabold px-1.5 py-0.5 rounded shadow-md whitespace-nowrap pointer-events-none">
            Plot {selectedPlot.number} (Drag inside to move / Corner to resize)
          </div>
        </div>
      )}

      {/* 5. Sleek floating interactive Popover for assigning drawn rectangle to a plot */}
      {isEditCoordinatesMode && drawnBoxToAssign && (
        <div
          className="absolute bg-slate-900 border border-slate-700/80 p-4 rounded-xl shadow-2xl z-50 max-w-[280px] w-full text-white backdrop-blur-md space-y-3 font-sans"
          style={{
            left: `${Math.min(72, Math.max(2, drawnBoxToAssign.x + drawnBoxToAssign.w / 2))}%`,
            top: `${Math.min(68, Math.max(2, drawnBoxToAssign.y + drawnBoxToAssign.h + 2))}%`,
          }}
          onClick={(e) => e.stopPropagation()} // Prevent closing/zooming
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <h5 className="text-xs font-bold text-yellow-400 flex items-center gap-1">
              <span>🎯</span> Map Drawn Boundary
            </h5>
            <button
              onClick={() => setDrawnBoxToAssign(null)}
              className="text-slate-400 hover:text-white transition-colors text-xs font-bold"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2 text-xs">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search Plot No..."
                value={assignmentSearch}
                onChange={(e) => setAssignmentSearch(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded p-1.5 pl-6 text-white placeholder-slate-400 text-xs focus:outline-none focus:border-blue-500"
              />
              <span className="absolute left-1.5 top-2">🔍</span>
            </div>

            {/* Selection Dropdown */}
            <div>
              <label className="block text-[10px] text-slate-400 font-bold mb-1">Assign to Plot Number:</label>
              <select
                value={selectedAssignPlotId}
                onChange={(e) => setSelectedAssignPlotId(e.target.value === '' ? '' : parseInt(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white text-xs focus:outline-none focus:border-blue-500 max-h-[120px]"
              >
                <option value="">-- Select Plot Number --</option>
                {assignablePlots.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.number} {p.layoutX !== undefined ? '(Overwrites Existing ⚠️)' : '(Unmapped 🟢)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDrawnBoxToAssign(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-1.5 px-2 rounded text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAssignment}
                disabled={selectedAssignPlotId === ''}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white font-bold py-1.5 px-2 rounded text-xs transition-colors shadow-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Admin helper text display */}
      {isEditCoordinatesMode && !drawnBoxToAssign && !isDrawing && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-yellow-500/30 text-[10px] text-yellow-400 px-3 py-1 rounded-full shadow-lg pointer-events-none tracking-wide backdrop-blur-xs font-semibold uppercase animate-pulse flex items-center gap-1 z-30">
          <span>🖱️</span> Click & Drag to DRAW a new boundary over the layout
        </div>
      )}
    </div>
  );
};
