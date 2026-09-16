
import React, { useState } from 'react';
import { Project, PlotStatus } from '../types';
import Icon from './common/Icon';
import { generateProjectDescription } from '../services/geminiService';
import { ProjectManagementPanel } from './ProjectManagementPanel';
import { getProjectMicroMarket, getNormalizedProjectStatus } from '../constants';

interface ProjectListProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  isAdmin: boolean;
  onUpdateProject: (project: Project) => void;
  onAddProject: (newProjectData: Omit<Project, 'id' | 'layout'| 'availablePlots'> & {totalPlots: number}) => void;
  onDeleteProject: (projectId: number) => void;
  savedProjectIds: number[];
  onToggleSave: (projectId: number) => void;
  title?: string;
  isSavedList?: boolean;
}

const ProjectModal: React.FC<{
  project?: Project;
  onClose: () => void;
  onSave: (data: any) => void;
  isAdding: boolean;
}> = ({ project, onClose, onSave, isAdding }) => {
    const initialData = project ? {
        ...project,
        projectCode: project.projectCode || '',
        status: project.status || 'Ongoing',
        propertyType: project.propertyType || 'Plots',
        category: project.category || 'Residential',
        approval: project.approval || 'TNCP & RERA Approved',
        specialFeature: project.specialFeature || '',
        plotSizes: project.plotSizes || '',
        plotDimensions: project.plotDimensions || '',
        residentialRate: project.residentialRate || '',
        commercialRate: project.commercialRate || '',
        paymentOptions: project.paymentOptions || '',
        isActive: project.isActive !== false,
        featuredProject: project.featuredProject === true,
        displayOrder: project.displayOrder || 1,
    } : {
        name: '', 
        location: '', 
        description: '', 
        imageUrls: [], 
        amenities: [], 
        totalPlots: 50,
        projectCode: '',
        status: 'Ongoing',
        propertyType: 'Plots',
        category: 'Residential',
        approval: 'TNCP & RERA Approved',
        specialFeature: '',
        plotSizes: '',
        plotDimensions: '',
        residentialRate: '',
        commercialRate: '',
        paymentOptions: '',
        isActive: true,
        featuredProject: false,
        displayOrder: 1,
    };
    const [formData, setFormData] = useState(initialData);
    const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        
        let finalValue: any = value;
        if (type === 'checkbox') {
            finalValue = (e.target as HTMLInputElement).checked;
        } else if (name === 'totalPlots' || name === 'displayOrder') {
            finalValue = parseInt(value, 10) || 0;
        }

        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleArrayChange = (e: React.ChangeEvent<HTMLTextAreaElement>, field: 'imageUrls' | 'amenities') => {
        setFormData(prev => ({ ...prev, [field]: e.target.value.split(',').map(item => item.trim()).filter(Boolean) }));
    };

    const handleSave = () => {
        const dataToSave = { 
            ...formData, 
            imageUrls: formData.imageUrls.filter(url => url),
            projectCode: formData.projectCode || formData.name.substring(0, 3).toUpperCase() + '-' + Math.floor(Math.random() * 900 + 100)
        };
        onSave(dataToSave);
    };

    const handleGenerateDescription = async () => {
        setIsGeneratingDesc(true);
        const generatedDesc = await generateProjectDescription(formData as Project);
        setFormData(prev => ({ ...prev, description: generatedDesc }));
        setIsGeneratingDesc(false);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 sticky top-0 bg-white z-10 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">{isAdding ? 'Create New Development' : 'Modify Development Details'}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Edit administrative and marketing configurations for the township</p>
                </div>
                <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><Icon name="close" className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-6">
                {/* Visual Image URLs */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Township Renderings / Photography (comma-separated URLs)</label>
                    <textarea 
                        name="imageUrls" 
                        rows={2} 
                        value={formData.imageUrls.join(', ')} 
                        onChange={(e) => handleArrayChange(e, 'imageUrls')} 
                        placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
                        className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600" 
                    />
                </div>

                {/* Grid Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Project Name</label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Project Code</label>
                        <input type="text" name="projectCode" placeholder="e.g. SV-IND" value={formData.projectCode} onChange={handleChange} className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Location</label>
                        <input type="text" name="location" value={formData.location} onChange={handleChange} className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Status</label>
                        <select name="status" value={formData.status} onChange={handleChange} className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600">
                            <option value="Upcoming">Upcoming</option>
                            <option value="Ongoing">Ongoing</option>
                            <option value="Completed">Completed</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Property Type</label>
                        <input type="text" name="propertyType" placeholder="e.g. Plots, Plots & Duplexes" value={formData.propertyType} onChange={handleChange} className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Category</label>
                        <input type="text" name="category" placeholder="e.g. Residential, Residential & Commercial" value={formData.category} onChange={handleChange} className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Approval</label>
                        <input type="text" name="approval" placeholder="e.g. TNCP & RERA Approved" value={formData.approval} onChange={handleChange} className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Special Feature</label>
                        <input type="text" name="specialFeature" placeholder="e.g. Near Proposed Metro Station" value={formData.specialFeature} onChange={handleChange} className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Plot Sizes Available</label>
                        <input type="text" name="plotSizes" placeholder="e.g. 1000, 1200, 1500 Sq. Ft." value={formData.plotSizes} onChange={handleChange} className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Plot Dimensions</label>
                        <input type="text" name="plotDimensions" placeholder="e.g. 20x50, 30x40, 30x50" value={formData.plotDimensions} onChange={handleChange} className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Residential Rate</label>
                        <input type="text" name="residentialRate" placeholder="e.g. ₹1,850 - ₹2,100 per Sq. Ft." value={formData.residentialRate} onChange={handleChange} className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Commercial Rate</label>
                        <input type="text" name="commercialRate" placeholder="e.g. ₹2,800 - ₹3,200 per Sq. Ft." value={formData.commercialRate} onChange={handleChange} className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Payment Options</label>
                        <input type="text" name="paymentOptions" placeholder="e.g. 80% Bank Loan Approved, Easy EMIs" value={formData.paymentOptions} onChange={handleChange} className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Display Order</label>
                        <input type="number" name="displayOrder" value={formData.displayOrder} onChange={handleChange} className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600" />
                    </div>
                    {isAdding && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Total Plots in Township</label>
                            <input type="number" name="totalPlots" value={(formData as any).totalPlots} onChange={handleChange} className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600" />
                        </div>
                    )}
                </div>

                {/* Amenities */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Amenities (comma-separated list)</label>
                    <textarea 
                        name="amenities" 
                        rows={2} 
                        value={formData.amenities.join(', ')} 
                        onChange={(e) => handleArrayChange(e, 'amenities')} 
                        placeholder="Grand Entrance Gate, 24x7 Security, Wide Concrete Roads, Underground Cabling"
                        className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600" 
                    />
                </div>

                {/* Description and Gemini AI Tool */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Detailed Description</label>
                        <button 
                            onClick={handleGenerateDescription} 
                            disabled={isGeneratingDesc} 
                            type="button"
                            className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:bg-gray-50 disabled:text-gray-400 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors border border-blue-100/30"
                        >
                            <Icon name="gemini" className="w-3.5 h-3.5" />
                            {isGeneratingDesc ? 'Crafting Summary...' : 'Enrich Description with AI'}
                        </button>
                    </div>
                    <textarea 
                        name="description" 
                        rows={4} 
                        value={formData.description} 
                        onChange={handleChange} 
                        className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600" 
                    />
                </div>

                {/* Boolean Toggles */}
                <div className="bg-gray-50 p-4 rounded-xl flex items-center justify-between gap-6">
                    <label className="flex items-center gap-2.5 text-sm font-bold text-gray-700 cursor-pointer">
                        <input 
                            type="checkbox" 
                            name="featuredProject"
                            checked={formData.featuredProject} 
                            onChange={(e) => setFormData(prev => ({ ...prev, featuredProject: e.target.checked }))}
                            className="w-4.5 h-4.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 transition-all cursor-pointer"
                        />
                        <div>
                            <span>Mark as Featured Project</span>
                            <p className="text-[10px] text-gray-400 font-normal mt-0.5">Places development at the top of lists and dashboard showcases</p>
                        </div>
                    </label>

                    <label className="flex items-center gap-2.5 text-sm font-bold text-gray-700 cursor-pointer">
                        <input 
                            type="checkbox" 
                            name="isActive"
                            checked={formData.isActive} 
                            onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                            className="w-4.5 h-4.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 transition-all cursor-pointer"
                        />
                        <div>
                            <span>Activate Public Listing</span>
                            <p className="text-[10px] text-gray-400 font-normal mt-0.5">Allow public users to browse and make hold requests</p>
                        </div>
                    </label>
                </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 sticky bottom-0 z-10 flex justify-end gap-3">
                <button onClick={onClose} className="bg-white border border-gray-200 text-gray-700 font-bold py-2.5 px-5 rounded-xl hover:bg-gray-50 text-sm transition-colors">Cancel</button>
                <button onClick={handleSave} className="bg-blue-600 text-white font-bold py-2.5 px-5 rounded-xl hover:bg-blue-700 text-sm shadow-sm hover:shadow transition-all">{isAdding ? 'Publish Development' : 'Apply Changes'}</button>
            </div>
        </div>
        </div>
    );
};

const ProjectCard: React.FC<{ 
  project: Project; 
  onSelectProject: (project: Project) => void; 
  onEdit: (project: Project) => void; 
  onDelete: (projectId: number) => void;
  isAdmin: boolean;
  isSaved: boolean;
  onToggleSave: (projectId: number) => void;
  isComparingSelected: boolean;
  onToggleCompare: (projectId: number) => void;
}> = ({ project, onSelectProject, onEdit, onDelete, isAdmin, isSaved, onToggleSave, isComparingSelected, onToggleCompare }) => {
  const [isReadMoreExpanded, setIsReadMoreExpanded] = useState(false);
  
  // Custom Status Badge Styles
  const getStatusBadge = (status?: string) => {
    const s = getNormalizedProjectStatus(status);
    switch (s) {
      case 'Upcoming':
        return <span className="bg-amber-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm">Upcoming</span>;
      case 'Completed':
        return <span className="bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm">Completed</span>;
      default:
        return <span className="bg-blue-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm">Ongoing</span>;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden transform hover:-translate-y-1 transition-all duration-300 flex flex-col relative group">
      {/* Top Media Container */}
      <div className="relative overflow-hidden aspect-[4/3]">
        <img 
          src={project.imageUrls[0] || 'https://picsum.photos/seed/default/400/300'} 
          alt={project.name} 
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
        />
        {/* Badges Layout Over Image */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-80 pointer-events-none" />
        
        <div className="absolute top-3.5 left-3.5 flex flex-col gap-1.5 items-start">
          {getStatusBadge(project.status)}
          {project.featuredProject && (
            <span className="bg-yellow-400 text-yellow-950 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow flex items-center gap-1">
              ★ Featured
            </span>
          )}
        </div>

        <div className="absolute top-3.5 right-3.5 flex items-center gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); onToggleSave(project.id); }} 
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md ${isSaved ? 'bg-red-500 text-white' : 'bg-white/90 text-gray-700 hover:bg-white hover:scale-105'}`}
          >
            <Icon name="saved" className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Available Plots Floating Tag */}
        {(() => {
          const plotsList = project.plots || project.layout || [];
          const availCount = plotsList.length > 0 
            ? plotsList.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length
            : project.availablePlots;

          if (availCount > 0) {
            return (
              <div className="absolute bottom-3.5 left-3.5 bg-emerald-950/80 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-xl border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <strong>🟢 {availCount} Available Plots</strong>
              </div>
            );
          } else {
            return (
              <div className="absolute bottom-3.5 left-3.5 bg-black/75 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <strong>🔴 Sold Out</strong>
              </div>
            );
          }
        })()}
      </div>

      {/* Content Area */}
      <div className="p-5 flex flex-col flex-grow">
        {/* Header Block */}
        <div className="flex justify-between items-start gap-2">
          <div>
            <span className="text-[10px] font-mono font-bold text-gray-400 tracking-wider block mb-0.5">CODE: {project.projectCode || 'N/A'}</span>
            <h3 className="text-xl font-bold text-gray-900 leading-tight tracking-tight group-hover:text-blue-700 transition-colors">{project.name}</h3>
          </div>
          {project.approval && (
            <span className="shrink-0 text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-md mt-1 border border-gray-200/50">
              {project.approval}
            </span>
          )}
        </div>

        {/* Location Row */}
        <p className="text-gray-500 text-xs font-medium flex items-center mt-2.5">
          <Icon name="location" className="w-4 h-4 mr-1.5 text-blue-500 shrink-0" />
          {project.location}
        </p>

        {/* Detailed Spec Grid */}
        <div className="grid grid-cols-2 gap-3 mt-4 p-3 bg-gray-50/50 rounded-xl border border-gray-100 text-xs">
          <div>
            <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">Property Type</span>
            <span className="font-semibold text-gray-700 mt-0.5 block">{project.propertyType || 'Residential Plots'}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">Plot Sizes</span>
            <div className="flex flex-wrap gap-1 mt-1 max-h-[40px] overflow-y-auto pr-1">
              {project.plotSizes ? (
                project.plotSizes.split(',').slice(0, 3).map((size) => (
                  <span key={size} className="bg-emerald-50 text-emerald-800 text-[9px] font-black px-1.5 py-0.5 rounded-md border border-emerald-100 flex items-center gap-0.5 whitespace-nowrap">
                    🟢{size.trim()}
                  </span>
                ))
              ) : (
                <span className="font-semibold text-gray-700">Contact Us</span>
              )}
              {project.plotSizes && project.plotSizes.split(',').length > 3 && (
                <span className="text-[9px] font-extrabold text-slate-400 self-center">+{project.plotSizes.split(',').length - 3} more</span>
              )}
            </div>
          </div>
          <div className="border-t border-gray-200/50 pt-2">
            <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">Residential Rate</span>
            <span className="font-semibold text-blue-700 mt-0.5 block truncate" title={project.residentialRate}>{project.residentialRate || 'On Request'}</span>
          </div>
          <div className="border-t border-gray-200/50 pt-2">
            <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">Commercial Rate</span>
            <span className="font-semibold text-teal-700 mt-0.5 block truncate" title={project.commercialRate}>{project.commercialRate || 'On Request'}</span>
          </div>
        </div>

        {/* Description & Collapsible Read More Block */}
        <div className="mt-4 flex-grow relative">
          <div className={`text-xs text-gray-600 leading-relaxed font-normal ${!isReadMoreExpanded ? 'line-clamp-3' : ''}`}>
            {project.description}
          </div>
          
          {/* Read More Trigger Overlay */}
          <div className="mt-1 flex justify-end">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsReadMoreExpanded(!isReadMoreExpanded);
              }}
              className="text-[11px] text-blue-600 hover:text-blue-800 font-bold hover:underline transition-colors focus:outline-none"
            >
              {isReadMoreExpanded ? 'Show Less ↑' : 'Read Full Description ↓'}
            </button>
          </div>
        </div>
        
        {/* Amenities Highlights Pills */}
        {project.amenities && project.amenities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1 border-t border-gray-100 pt-3">
            {project.amenities.slice(0, 3).map((amenity, i) => (
              <span key={i} className="text-[10px] bg-blue-50/70 border border-blue-100/30 text-blue-700 px-2 py-0.5 rounded-md font-medium truncate max-w-[130px]" title={amenity}>
                {amenity}
              </span>
            ))}
            {project.amenities.length > 3 && (
              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md font-bold">
                +{project.amenities.length - 3} More
              </span>
            )}
          </div>
        )}

        {/* Compare Project Checkbox */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center">
          <label className="flex items-center gap-2 text-[11px] font-bold text-gray-500 cursor-pointer hover:text-blue-600 select-none">
            <input 
              type="checkbox" 
              checked={isComparingSelected} 
              onChange={() => onToggleCompare(project.id)} 
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer transition-all"
            />
            <span>Add to Compare Development</span>
          </label>
        </div>

        {/* Action Controls */}
        <div className="mt-4 flex justify-between items-center gap-2">
          <button 
            onClick={() => onSelectProject(project)} 
            className="flex-grow bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-center shadow-sm hover:shadow transition-all text-xs"
          >
            View Details & Layout Map
          </button>
          {isAdmin && (
              <div className="flex gap-1.5 shrink-0">
                  <button 
                    onClick={(e)=>{e.stopPropagation(); onEdit(project);}} 
                    className="bg-amber-50 border border-amber-200 text-amber-700 font-bold px-3 py-2 rounded-xl text-xs hover:bg-amber-100 flex items-center gap-1 transition-all"
                    title="✏️ Edit Project"
                  >
                    ✏️ Edit Project
                  </button>
                  <button 
                    onClick={(e)=>{e.stopPropagation(); onDelete(project.id);}} 
                    className="bg-rose-50 border border-rose-100 text-rose-600 p-2 rounded-xl hover:bg-rose-100 hover:text-rose-700 transition-colors"
                    title="Delete project"
                  >
                    <Icon name="delete" className="w-4 h-4" />
                  </button>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ComparisonModal: React.FC<{
  selectedProjects: Project[];
  onClose: () => void;
  onSelectProject: (project: Project) => void;
}> = ({ selectedProjects, onClose, onSelectProject }) => {
  // Helper to calculate pricing per sq.ft.
  const getPriceStats = (project: Project) => {
    if (project.residentialRate || project.commercialRate) {
      return {
        avg: project.residentialRate || 'Contact Us',
        range: project.commercialRate ? `Comm: ${project.commercialRate}` : 'Plots Only',
      };
    }
    if (!project.layout || project.layout.length === 0) return { avg: 'N/A', range: 'N/A' };
    const rates = project.layout.filter(p => p.size > 0 && p.price > 0).map(p => p.price / p.size);
    if (rates.length === 0) return { avg: 'N/A', range: 'N/A' };
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    return {
      avg: `₹${Math.round(avg).toLocaleString('en-IN')}/sqft`,
      range: `₹${Math.round(min).toLocaleString('en-IN')} - ₹${Math.round(max).toLocaleString('en-IN')}/sqft`,
    };
  };

  // Helper to get size range
  const getSizeRange = (project: Project) => {
    if (project.plotSizes) return project.plotSizes;
    if (!project.layout || project.layout.length === 0) return 'N/A';
    const sizes = project.layout.filter(p => p.size > 0).map(p => p.size);
    if (sizes.length === 0) return 'N/A';
    const min = Math.min(...sizes);
    const max = Math.max(...sizes);
    return min === max ? `${min} sqft` : `${min} - ${max} sqft`;
  };

  // Gather all unique amenities across compared projects
  const allAmenities = Array.from(new Set(selectedProjects.flatMap(p => p.amenities || [])));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-8 overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="bg-blue-900 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Icon name="insights" className="w-6 h-6 text-blue-300" />
              Side-by-Side Project Comparison
            </h2>
            <p className="text-xs text-blue-200 mt-1">Comparing {selectedProjects.length} selected property developments in Rau, Indore</p>
          </div>
          <button onClick={onClose} className="p-2 text-blue-200 hover:text-white bg-blue-850 hover:bg-blue-800 rounded-lg transition-all">
            <Icon name="close" className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable table container */}
        <div className="p-6 overflow-x-auto max-h-[70vh]">
          <table className="w-full min-w-[700px] border-collapse text-left">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="w-1/4 pb-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Features</th>
                {selectedProjects.map(project => (
                  <th key={project.id} className="pb-4 px-4 text-center">
                    <div className="space-y-2">
                      <img src={project.imageUrls[0] || 'https://picsum.photos/seed/default/400/300'} alt={project.name} referrerPolicy="no-referrer" className="w-36 h-24 object-cover rounded-lg mx-auto border border-gray-200 shadow-sm" />
                      <h4 className="font-bold text-gray-950 text-base">{project.name}</h4>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
              {/* Location row */}
              <tr>
                <td className="py-4 font-bold text-gray-900 flex items-center gap-1.5">
                  <Icon name="location" className="w-4 h-4 text-blue-600" />
                  Location
                </td>
                {selectedProjects.map(project => (
                  <td key={project.id} className="py-4 px-4 text-center font-medium text-gray-600">
                    {project.location}
                  </td>
                ))}
              </tr>

              {/* Price per sqft row */}
              <tr>
                <td className="py-4 font-bold text-gray-900 flex items-center gap-1.5">
                  <Icon name="price" className="w-4 h-4 text-blue-600" />
                  Avg. Price / rates
                </td>
                {selectedProjects.map(project => {
                  const stats = getPriceStats(project);
                  return (
                    <td key={project.id} className="py-4 px-4 text-center">
                      <div className="font-bold text-blue-700 text-base">{stats.avg}</div>
                      <div className="text-[11px] text-gray-400 font-medium mt-0.5">{stats.range}</div>
                    </td>
                  );
                })}
              </tr>

              {/* Plot size row */}
              <tr>
                <td className="py-4 font-bold text-gray-900 flex items-center gap-1.5">
                  <Icon name="size" className="w-4 h-4 text-blue-600" />
                  Plot Sizes
                </td>
                {selectedProjects.map(project => (
                  <td key={project.id} className="py-4 px-4 text-center font-semibold text-gray-700">
                    {getSizeRange(project)}
                  </td>
                ))}
              </tr>

              {/* Approval Row */}
              <tr>
                <td className="py-4 font-bold text-gray-900 flex items-center gap-1.5">
                  <Icon name="lock" className="w-4 h-4 text-blue-600" />
                  Approval Status
                </td>
                {selectedProjects.map(project => (
                  <td key={project.id} className="py-4 px-4 text-center font-semibold text-gray-700">
                    {project.approval || 'TNCP & RERA'}
                  </td>
                ))}
              </tr>

              {/* Special Feature Row */}
              <tr>
                <td className="py-4 font-bold text-gray-900 flex items-center gap-1.5">
                  <Icon name="gemini" className="w-4 h-4 text-blue-600" />
                  Special Feature
                </td>
                {selectedProjects.map(project => (
                  <td key={project.id} className="py-4 px-4 text-center text-xs text-gray-500 font-medium italic">
                    {project.specialFeature || 'N/A'}
                  </td>
                ))}
              </tr>

              {/* Booking & Inventory row */}
              <tr>
                <td className="py-4 font-bold text-gray-900 flex items-center gap-1.5">
                  <Icon name="status" className="w-4 h-4 text-blue-600" />
                  Inventory Status
                </td>
                {selectedProjects.map(project => {
                  const plotsList = project.plots || project.layout || [];
                  const total = plotsList.length || project.totalPlots || 1;
                  const avail = plotsList.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length;
                  const soldAndBooked = plotsList.filter(p => p.status === PlotStatus.SOLD || p.status === PlotStatus.BOOKED).length;
                  const ratio = Math.round((soldAndBooked / total) * 100);

                  return (
                    <td key={project.id} className="py-4 px-4 text-center">
                      <div className={`font-bold ${avail > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {avail > 0 ? `🟢 ${avail} Available` : '🔴 Sold Out'}
                      </div>
                      <div className="flex items-center justify-center gap-1.5 mt-1.5">
                        <div className="w-20 bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div className="bg-blue-600 h-full rounded-full" style={{ width: `${ratio}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-500 font-bold">{ratio}% booked</span>
                      </div>
                    </td>
                  );
                })}
              </tr>

              {/* Amenities Breakdown Title Row */}
              <tr className="bg-gray-50/50">
                <td colSpan={selectedProjects.length + 1} className="py-2.5 px-2 font-bold text-gray-800 text-xs uppercase tracking-wider border-b border-gray-100">
                  Amenities Breakdown
                </td>
              </tr>

              {/* Dynamic Amenities rows */}
              {allAmenities.slice(0, 15).map(amenity => (
                <tr key={amenity} className="hover:bg-gray-50/20">
                  <td className="py-3 pl-2 text-xs font-semibold text-gray-600 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                    {amenity}
                  </td>
                  {selectedProjects.map(project => {
                    const hasAmenity = project.amenities?.includes(amenity);
                    return (
                      <td key={project.id} className="py-3 px-4 text-center">
                        {hasAmenity ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 bg-emerald-100 text-emerald-800 rounded-full">
                            <Icon name="check" className="w-4 h-4" />
                          </span>
                        ) : (
                          <span className="text-gray-300 text-lg font-bold">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer actions */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3 justify-end items-center">
          <p className="text-xs text-gray-500 font-medium mr-auto text-center sm:text-left">
            💡 Select individual details below to view complete interactive plot layout maps.
          </p>
          <div className="flex gap-2.5">
            {selectedProjects.map(project => (
              <button
                key={project.id}
                onClick={() => {
                  onSelectProject(project);
                  onClose();
                }}
                className="bg-white border border-blue-200 hover:border-blue-300 text-blue-700 text-xs font-bold px-3 py-2 rounded-xl shadow-sm transition-all flex items-center gap-1 cursor-pointer"
              >
                Go to {project.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ProjectList: React.FC<ProjectListProps> = ({ projects, onSelectProject, isAdmin, onUpdateProject, onAddProject, onDeleteProject, savedProjectIds, onToggleSave, title = "Our Projects", isSavedList = false }) => {
  const [modalState, setModalState] = useState<{ type: 'add' | 'edit' | null; project?: Project }>({ type: null });
  const [selectedCompareIds, setSelectedCompareIds] = useState<number[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('All');
  const [approvalFilter, setApprovalFilter] = useState('All');
  const [rateSearch, setRateSearch] = useState('');
  const [plotSizeSearch, setPlotSizeSearch] = useState('');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  const handleEditClick = (project: Project) => setModalState({ type: 'edit', project });
  const handleAddClick = () => setModalState({ type: 'add' });
  const handleCloseModal = () => setModalState({ type: null });

  const handleSave = (data: any) => {
    if (modalState.type === 'edit') onUpdateProject(data as Project);
    if (modalState.type === 'add') onAddProject(data);
    handleCloseModal();
  };

  const handleToggleCompare = (id: number) => {
    setSelectedCompareIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      } else {
        if (prev.length >= 3) {
          return prev;
        }
        return [...prev, id];
      }
    });
  };

  const selectedProjectsForCompare = projects.filter(p => selectedCompareIds.includes(p.id));

  // Collect unique values dynamically for filter options (fallback default options)
  const uniqueLocations = Array.from(new Set(projects.map(p => getProjectMicroMarket(p.location)))).filter(Boolean).sort();
  const uniquePropertyTypes = Array.from(new Set(projects.map(p => p.propertyType).filter(Boolean))) as string[];

  // Execute Search & Filtering Logic
  const filteredProjects = projects.filter(project => {
    // 1. Search term (matches name, location or project code)
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term || 
      project.name.toLowerCase().includes(term) ||
      project.location.toLowerCase().includes(term) ||
      (project.projectCode && project.projectCode.toLowerCase().includes(term));

    // 2. Status Filter
    const normalizedStatus = getNormalizedProjectStatus(project.status);
    const matchesStatus = statusFilter === 'All' || 
      normalizedStatus.toLowerCase() === statusFilter.toLowerCase() ||
      (project.status && project.status.toLowerCase() === statusFilter.toLowerCase());

    // 3. Location Filter
    const microMarket = getProjectMicroMarket(project.location);
    const matchesLocation = locationFilter === 'All' || 
      microMarket.toLowerCase() === locationFilter.toLowerCase() ||
      project.location.toLowerCase().includes(locationFilter.toLowerCase());

    // 4. Property Type Filter
    const matchesPropType = propertyTypeFilter === 'All' || 
      (project.propertyType && project.propertyType.toLowerCase() === propertyTypeFilter.toLowerCase());

    // 5. Approval Filter
    const matchesApproval = approvalFilter === 'All' || 
      (project.approval && project.approval.toLowerCase().includes(approvalFilter.toLowerCase()));

    // 6. Rates Filter (checks in residentialRate or commercialRate string)
    const rateTerm = rateSearch.toLowerCase();
    const matchesRates = !rateTerm || 
      (project.residentialRate && project.residentialRate.toLowerCase().includes(rateTerm)) ||
      (project.commercialRate && project.commercialRate.toLowerCase().includes(rateTerm));

    // 7. Plot Size Filter (matches text search in plotSizes)
    const sizeTerm = plotSizeSearch.toLowerCase();
    const matchesPlotSize = !sizeTerm || 
      (project.plotSizes && project.plotSizes.toLowerCase().includes(sizeTerm));

    // 8. Featured toggle
    const matchesFeatured = !featuredOnly || project.featuredProject === true;

    // 9. Ensure active projects are shown to public (or admin sees all)
    const matchesActive = isAdmin || project.isActive !== false;

    return matchesSearch && matchesStatus && matchesLocation && matchesPropType && 
           matchesApproval && matchesRates && matchesPlotSize && matchesFeatured && matchesActive;
  });

  if (isSavedList && filteredProjects.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Icon name="saved" className="w-16 h-16 text-gray-300 mb-4" />
          <h1 className="text-3xl font-bold text-gray-800">No Saved Projects</h1>
          <p className="text-gray-500 mt-2">You haven't saved any projects yet. Start exploring!</p>
        </div>
      );
  }

  return (
    <div className="relative pb-24">
      {/* Page Title & Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{title}</h1>
          <p className="text-xs text-gray-500 mt-1">Explore our fully RERA-approved township developments in Indore</p>
        </div>
        {isAdmin && !isSavedList && (
          <button 
            onClick={handleAddClick} 
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-all shadow-sm"
          >
            <Icon name="add" className="w-5 h-5"/>
            Add Development
          </button>
        )}
      </div>

      {/* --- State of the art Search & Multi-Filter Control Box --- */}
      {!isSavedList && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 mb-8">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Primary Text Search */}
            <div className="relative flex-grow">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Icon name="search" className="w-5 h-5" />
              </span>
              <input 
                type="text" 
                placeholder="Search township name, location, or project code (e.g. Shanti Vihar, Rau, SV-IND)..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
              />
            </div>
            
            {/* Toggle Expand Filters Button */}
            <button 
              onClick={() => setIsFilterExpanded(!isFilterExpanded)}
              className={`px-4 py-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer select-none ${isFilterExpanded ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              <Icon name="filter" className="w-4 h-4" />
              {isFilterExpanded ? 'Hide Advanced Filters' : 'Show Advanced Filters'}
            </button>
          </div>

          {/* Collapsible Advanced Filters Panel */}
          {isFilterExpanded && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100 animate-fadeIn">
              {/* Status Select */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Development Status</label>
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 text-gray-700"
                >
                  <option value="All">All Status</option>
                  <option value="Upcoming">Upcoming</option>
                  <option value="Ongoing">Ongoing</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              {/* Location Select */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Micro-Market Location</label>
                <select 
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 text-gray-700"
                >
                  <option value="All">All Regions</option>
                  {uniqueLocations.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              {/* Property Type Select */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Property Configuration</label>
                <select 
                  value={propertyTypeFilter}
                  onChange={(e) => setPropertyTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 text-gray-700"
                >
                  <option value="All">All Configurations</option>
                  {uniquePropertyTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Approval Filter select */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Regulatory Approvals</label>
                <select 
                  value={approvalFilter}
                  onChange={(e) => setApprovalFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 text-gray-700"
                >
                  <option value="All">All Approvals</option>
                  <option value="RERA">RERA Approved Only</option>
                  <option value="TNCP">TNCP Approved Only</option>
                </select>
              </div>

              {/* Rates Search filter */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Rate / Price Filter</label>
                <input 
                  type="text"
                  placeholder="e.g. ₹1,850 or Request"
                  value={rateSearch}
                  onChange={(e) => setRateSearch(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 text-gray-700 placeholder:text-gray-400"
                />
              </div>

              {/* Plot Size Filter */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Plot Size Dimension</label>
                <input 
                  type="text"
                  placeholder="e.g. 1000 or 1200"
                  value={plotSizeSearch}
                  onChange={(e) => setPlotSizeSearch(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 text-gray-700 placeholder:text-gray-400"
                />
              </div>

              {/* Checkboxes Row */}
              <div className="sm:col-span-2 flex items-center gap-4 pt-3.5">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={featuredOnly}
                    onChange={(e) => setFeaturedOnly(e.target.checked)}
                    className="w-4.5 h-4.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 transition-all cursor-pointer"
                  />
                  <span>Show Featured Projects Only</span>
                </label>

                {/* Reset Filters Trigger */}
                {(searchTerm || statusFilter !== 'All' || locationFilter !== 'All' || propertyTypeFilter !== 'All' || approvalFilter !== 'All' || rateSearch || plotSizeSearch || featuredOnly) && (
                  <button 
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('All');
                      setLocationFilter('All');
                      setPropertyTypeFilter('All');
                      setApprovalFilter('All');
                      setRateSearch('');
                      setPlotSizeSearch('');
                      setFeaturedOnly(false);
                    }}
                    className="text-xs text-red-600 hover:text-red-800 font-bold hover:underline transition-colors ml-auto flex items-center gap-1"
                  >
                    <Icon name="close" className="w-3.5 h-3.5" />
                    Reset All Filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grid of Cards */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-12 text-center my-8">
          <div className="bg-gray-100 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-4 text-gray-400">
            <Icon name="search" className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-gray-800">No matching developments found</h3>
          <p className="text-gray-500 text-xs mt-1.5 max-w-md mx-auto">Try adjusting your filters, selecting a different region, or typing a simpler search query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProjects.map(project => (
            <ProjectCard 
              key={project.id} 
              project={project} 
              onSelectProject={onSelectProject} 
              isAdmin={isAdmin} 
              onEdit={handleEditClick} 
              onDelete={onDeleteProject} 
              isSaved={savedProjectIds.includes(project.id)} 
              onToggleSave={onToggleSave}
              isComparingSelected={selectedCompareIds.includes(project.id)}
              onToggleCompare={handleToggleCompare}
            />
          ))}
        </div>
      )}

      {modalState.type === 'edit' && modalState.project && (
        <ProjectManagementPanel
          project={modalState.project}
          isAdmin={isAdmin}
          onClose={handleCloseModal}
          onSave={(updated) => {
            onUpdateProject(updated);
            handleCloseModal();
          }}
          onDuplicate={(proj) => {
            onAddProject({
              ...proj,
              id: undefined as any,
              name: `${proj.name} (Copy)`,
              projectCode: `${proj.projectCode || 'DUP'}-COPY`,
            });
            handleCloseModal();
          }}
          onDelete={(id) => {
            onDeleteProject(id);
            handleCloseModal();
          }}
          onApplyChangesEverywhere={(updated) => {
            onUpdateProject(updated);
          }}
        />
      )}

      {modalState.type === 'add' && (
        <ProjectModal 
          isAdding={true} 
          project={undefined} 
          onClose={handleCloseModal} 
          onSave={handleSave} 
        />
      )}

      {/* Sticky Bottom Compare Bar */}
      {selectedCompareIds.length > 0 && (
        <div className="fixed bottom-16 md:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-2xl bg-white/95 backdrop-blur border border-blue-100 rounded-2xl shadow-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-slideUp">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2.5 rounded-xl text-blue-600 shrink-0">
              <Icon name="insights" className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900 text-sm">Compare Developments</h4>
              <p className="text-xs text-gray-500 font-medium">
                {selectedCompareIds.length === 1 
                  ? 'Select 1 more project (max 3) to enable comparison' 
                  : `${selectedCompareIds.length} projects selected (max 3)`
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={() => setSelectedCompareIds([])}
              className="text-xs font-bold text-gray-500 hover:text-gray-800 hover:bg-gray-100 px-3 py-2 rounded-lg transition-all cursor-pointer"
            >
              Clear All
            </button>
            <button 
              disabled={selectedCompareIds.length < 2}
              onClick={() => setShowCompareModal(true)}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition-all inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Icon name="status" className="w-4 h-4" />
              Compare Now
            </button>
          </div>
        </div>
      )}

      {/* Comparison Modal */}
      {showCompareModal && (
        <ComparisonModal 
          selectedProjects={selectedProjectsForCompare} 
          onClose={() => setShowCompareModal(false)} 
          onSelectProject={onSelectProject}
        />
      )}
    </div>
  );
};

export default ProjectList;
