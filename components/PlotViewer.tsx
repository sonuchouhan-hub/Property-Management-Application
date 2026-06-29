
import React, { useState, useMemo } from 'react';
import { Project, Plot, PlotStatus, PlotFacing, PlotType } from '../types';
import Icon from './common/Icon';

// --- Helper Components ---

const getStatusClasses = (status: PlotStatus) => {
  switch (status) {
    case PlotStatus.AVAILABLE:
      return 'bg-green-100 border-green-500 text-green-800 hover:bg-green-200';
    case PlotStatus.BOOKED:
      return 'bg-yellow-100 border-yellow-500 text-yellow-800 cursor-not-allowed opacity-75';
    case PlotStatus.SOLD:
      return 'bg-red-100 border-red-500 text-red-800 cursor-not-allowed opacity-75 filter grayscale';
    case PlotStatus.INVESTMENT:
        return 'bg-purple-100 border-purple-500 text-purple-800 cursor-not-allowed opacity-75';
    case PlotStatus.RESALE:
        return 'bg-teal-100 border-teal-500 text-teal-800 hover:bg-teal-200';
  }
};

const PlotCard: React.FC<{ plot: Plot, isSelected: boolean, onClick: (plot: Plot) => void }> = ({ plot, isSelected, onClick }) => {
    const colorClasses = getStatusClasses(plot.status);
    const selectedClasses = isSelected ? 'ring-4 ring-blue-500' : '';

    const StatusIcon = () => {
      switch(plot.status) {
        case PlotStatus.AVAILABLE: return <Icon name="status" className="w-4 h-4 text-green-600 absolute top-1 right-1" aria-label="Available" />;
        case PlotStatus.BOOKED: return <Icon name="booked" className="w-4 h-4 text-yellow-600 absolute top-1 right-1" aria-label="Booked" />;
        case PlotStatus.SOLD: return <Icon name="sold" className="w-4 h-4 text-red-600 absolute top-1 right-1" aria-label="Sold" />;
        case PlotStatus.INVESTMENT: return <Icon name="investment" className="w-4 h-4 text-purple-600 absolute top-1 right-1" aria-label="Investment" />;
        case PlotStatus.RESALE: return <Icon name="resale" className="w-4 h-4 text-teal-600 absolute top-1 right-1" aria-label="For Resale" />;
        default: return null;
      }
    };

    return (
        <div 
            onClick={() => onClick(plot)}
            className={`relative p-2 rounded-lg border-2 text-center transition-all duration-200 ${colorClasses} ${selectedClasses} cursor-pointer`}
        >
            <StatusIcon />
            <span className="absolute top-1 left-1 text-[10px] font-bold text-gray-600 bg-white/60 px-1 rounded">{plot.type}</span>
            <p className="font-bold pt-3">{plot.number}</p>
            <p className="text-xs">{plot.size} sq.ft.</p>
            <p className="text-xs text-gray-500">{plot.dimensions}</p>
        </div>
    );
};

const StatusBadge: React.FC<{ status: PlotStatus }> = ({ status }) => {
  const visuals = {
    [PlotStatus.AVAILABLE]: { classes: 'text-green-800 bg-green-100', icon: 'status' },
    [PlotStatus.BOOKED]: { classes: 'text-yellow-800 bg-yellow-100', icon: 'booked' },
    [PlotStatus.SOLD]: { classes: 'text-red-800 bg-red-100', icon: 'sold' },
    [PlotStatus.INVESTMENT]: { classes: 'text-purple-800 bg-purple-100', icon: 'investment' },
    [PlotStatus.RESALE]: { classes: 'text-teal-800 bg-teal-100', icon: 'resale' },
  }[status];

  return (
    <span className={`font-bold px-3 py-1 rounded-full inline-flex items-center gap-2 ${visuals.classes}`}>
      <Icon name={visuals.icon} className="w-4 h-4" />
      {status}
    </span>
  );
};

const SelectedPlotDetails: React.FC<{ plot: Plot | null, onDeselect: () => void, onBookSiteVisit: () => void, onEdit: (plot: Plot) => void, isAdmin: boolean }> = ({ plot, onDeselect, onBookSiteVisit, onEdit, isAdmin }) => {
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
                <div className="flex justify-between items-center"><span className="font-semibold text-gray-600 flex items-center"><Icon name="projects" className="w-4 h-4 mr-2" />Type:</span> <span className="font-bold">{plot.type}</span></div>
                <div className="flex justify-between items-center"><span className="font-semibold text-gray-600 flex items-center"><Icon name="size" className="w-4 h-4 mr-2" />Size:</span> <span className="font-bold">{plot.size} sq.ft.</span></div>
                <div className="flex justify-between items-center"><span className="font-semibold text-gray-600 flex items-center"><Icon name="size" className="w-4 h-4 mr-2" />Dimensions:</span> <span className="font-bold">{plot.dimensions}</span></div>
                <div className="flex justify-between items-center"><span className="font-semibold text-gray-600 flex items-center"><Icon name="facing" className="w-4 h-4 mr-2" />Facing:</span> <span className="font-bold">{plot.facing}</span></div>
                <div className="flex justify-between items-center"><span className="font-semibold text-gray-600 flex items-center"><Icon name="mortgage" className="w-4 h-4 mr-2" />Mortgaged:</span> <span className={`font-bold ${plot.isMortgaged ? 'text-red-600' : 'text-green-600'}`}>{plot.isMortgaged ? 'Yes' : 'No'}</span></div>
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
                    {isBookable ? 'Book a Site Visit' : `Plot is ${plot.status}`}
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
                         <div><label className="block text-sm font-medium text-gray-700 mb-1">Status</label><select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value as FilterValues['status'] }))} className="w-full p-2 border border-gray-300 rounded-lg"><option value="All">All Statuses</option>{Object.values(PlotStatus).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
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
        { name: PlotStatus.AVAILABLE, classes: 'bg-green-100 border-green-500' },
        { name: PlotStatus.BOOKED, classes: 'bg-yellow-100 border-yellow-500' },
        { name: PlotStatus.SOLD, classes: 'bg-red-100 border-red-500' },
        { name: PlotStatus.INVESTMENT, classes: 'bg-purple-100 border-purple-500' },
        { name: PlotStatus.RESALE, classes: 'bg-teal-100 border-teal-500' },
    ];
    return (
        <div className="bg-gray-100 p-3 rounded-lg mb-4 border border-gray-200">
            <h3 className="text-sm font-bold text-gray-700 mb-2">Admin Legend: Plot Status</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
                {statuses.map(status => (
                    <div key={status.name} className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border ${status.classes}`}></div>
                        <span className="text-xs text-gray-600 font-medium">{status.name}</span>
                    </div>
                ))}
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
    onUpdateProject: (project: Project) => void;
}

const PlotViewer: React.FC<PlotViewerProps> = ({ project, selectedPlot, onSelectPlot, onBookSiteVisit, isAdmin, onUpdateProject }) => {
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [editingPlot, setEditingPlot] = useState<Plot | null>(null);
  const [activeFilters, setActiveFilters] = useState<FilterValues>({ status: 'All', facing: 'All', number: '' });

  const filteredPlots = useMemo(() => {
    return project.layout.filter(plot => {
      const { status, facing, number } = activeFilters;
      const statusMatch = status === 'All' || plot.status === status;
      const facingMatch = facing === 'All' || plot.facing === facing;
      const numberMatch = plot.number.toLowerCase().includes(number.toLowerCase());
      return statusMatch && facingMatch && numberMatch;
    });
  }, [project.layout, activeFilters]);

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
    const updatedLayout = project.layout.map(p => p.id === updatedPlot.id ? updatedPlot : p);
    
    // Recalculate available plots to ensure data consistency
    const availablePlotsCount = updatedLayout.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length;

    onUpdateProject({ 
        ...project, 
        layout: updatedLayout,
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

  return (
    <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
            <div><h1 className="text-3xl font-bold text-gray-800">{project.name}</h1><p className="text-gray-500">Interactive Layout {isAdmin && <span className="text-sm font-semibold text-green-600">(Admin Mode)</span>}</p></div>
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

        <div className="flex flex-col lg:flex-row gap-8">
            <div className="lg:w-2/3 bg-gray-50 p-4 rounded-lg shadow-inner">
                {filteredPlots.length > 0 ? (
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
                    onDeselect={() => onSelectPlot(null)}
                    onBookSiteVisit={() => selectedPlot && onBookSiteVisit(project, selectedPlot)}
                    isAdmin={isAdmin}
                    onEdit={setEditingPlot}
                />
            </div>
        </div>
    </div>
  );
};

export default PlotViewer;