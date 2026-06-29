
import React, { useState } from 'react';
import { Project } from '../types';
import Icon from './common/Icon';
import { generateProjectDescription } from '../services/geminiService';

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
    const initialData = project || {
        name: '', location: '', description: '', imageUrls: [], amenities: [], totalPlots: 50,
    };
    const [formData, setFormData] = useState(initialData);
    const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'totalPlots' ? parseInt(value, 10) || 0 : value }));
    };

    const handleArrayChange = (e: React.ChangeEvent<HTMLTextAreaElement>, field: 'imageUrls' | 'amenities') => {
        setFormData(prev => ({ ...prev, [field]: e.target.value.split(',').map(item => item.trim()) }));
    };

    const handleSave = () => {
        const dataToSave = { ...formData, imageUrls: formData.imageUrls.filter(url => url) };
        onSave(dataToSave);
    };

    const handleGenerateDescription = async () => {
        setIsGeneratingDesc(true);
        const generatedDesc = await generateProjectDescription(formData as Project);
        setFormData(prev => ({ ...prev, description: generatedDesc }));
        setIsGeneratingDesc(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-full overflow-y-auto">
            <div className="p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">{isAdding ? 'Add New Project' : 'Edit Project'}</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><Icon name="close" className="w-6 h-6"/></button>
            </div>
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700">Project Name</label><input type="text" name="name" value={formData.name} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" /></div>
                    <div><label className="block text-sm font-medium text-gray-700">Location</label><input type="text" name="location" value={formData.location} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" /></div>
                </div>
                <div>
                <div className="flex justify-between items-center"><label className="block text-sm font-medium text-gray-700">Description</label><button onClick={handleGenerateDescription} disabled={isGeneratingDesc} className="text-sm text-blue-600 hover:text-blue-800 font-semibold disabled:text-gray-400 flex items-center gap-1"><Icon name="gemini" className="w-4 h-4" />{isGeneratingDesc ? 'Generating...' : 'Generate with AI'}</button></div>
                <textarea name="description" rows={4} value={formData.description} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                </div>
                {isAdding && <div><label className="block text-sm font-medium text-gray-700">Total Plots</label><input type="number" name="totalPlots" value={(formData as any).totalPlots} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" /></div>}
                <div><label className="block text-sm font-medium text-gray-700">Amenities (comma-separated)</label><textarea name="amenities" rows={3} value={formData.amenities.join(', ')} onChange={(e) => handleArrayChange(e, 'amenities')} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700">Image URLs (comma-separated)</label><textarea name="imageUrls" rows={3} value={formData.imageUrls.join(', ')} onChange={(e) => handleArrayChange(e, 'imageUrls')} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" /></div>
            </div>
            </div>
            <div className="bg-gray-50 px-6 py-3 flex justify-end space-x-3"><button onClick={onClose} className="bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg hover:bg-gray-300">Cancel</button><button onClick={handleSave} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700">{isAdding ? 'Add Project' : 'Save Changes'}</button></div>
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
}> = ({ project, onSelectProject, onEdit, onDelete, isAdmin, isSaved, onToggleSave }) => (
  <div className="bg-white rounded-lg shadow-lg overflow-hidden transform hover:-translate-y-1 transition-transform duration-300 flex flex-col">
    <div className="relative">
      <img src={project.imageUrls[0] || 'https://picsum.photos/seed/default/400/300'} alt={project.name} className="w-full h-56 object-cover" />
       <div className="absolute top-0 inset-x-0 m-2 flex justify-between items-start">
        <div className="bg-blue-800 text-white text-sm font-semibold px-3 py-1 rounded-full">
          {project.availablePlots}/{project.totalPlots} Available
        </div>
        <button onClick={(e) => { e.stopPropagation(); onToggleSave(project.id); }} className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isSaved ? 'bg-red-500 text-white' : 'bg-white/80 text-gray-700 hover:bg-white'}`}><Icon name="saved" className={`w-6 h-6 ${isSaved ? 'fill-current' : ''}`} /></button>
      </div>
    </div>
    <div className="p-5 flex flex-col flex-grow">
      <h3 className="text-2xl font-bold text-gray-800">{project.name}</h3>
      <p className="text-gray-500 flex items-center mt-1"><Icon name="location" className="w-4 h-4 mr-2 text-gray-400" />{project.location}</p>
      <p className="text-gray-600 mt-3 h-20 overflow-hidden flex-grow">{project.description}</p>
      <div className="mt-4 flex justify-between items-center gap-2">
        <button onClick={() => onSelectProject(project)} className="flex-grow bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">View Details</button>
        {isAdmin && (
            <>
                <button onClick={(e)=>{e.stopPropagation(); onEdit(project);}} className="bg-green-500 text-white p-2 rounded-lg hover:bg-green-600"><Icon name="camera"/></button>
                <button onClick={(e)=>{e.stopPropagation(); onDelete(project.id);}} className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600"><Icon name="delete"/></button>
            </>
        )}
      </div>
    </div>
  </div>
);

const ProjectList: React.FC<ProjectListProps> = ({ projects, onSelectProject, isAdmin, onUpdateProject, onAddProject, onDeleteProject, savedProjectIds, onToggleSave, title = "Our Projects", isSavedList = false }) => {
  const [modalState, setModalState] = useState<{ type: 'add' | 'edit' | null; project?: Project }>({ type: null });

  const handleEditClick = (project: Project) => setModalState({ type: 'edit', project });
  const handleAddClick = () => setModalState({ type: 'add' });
  const handleCloseModal = () => setModalState({ type: null });

  const handleSave = (data: any) => {
    if (modalState.type === 'edit') onUpdateProject(data as Project);
    if (modalState.type === 'add') onAddProject(data);
    handleCloseModal();
  };

  if (isSavedList && projects.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Icon name="saved" className="w-16 h-16 text-gray-300 mb-4" />
          <h1 className="text-3xl font-bold text-gray-800">No Saved Projects</h1>
          <p className="text-gray-500 mt-2">You haven't saved any projects yet. Start exploring!</p>
        </div>
      );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">{title}</h1>
        {isAdmin && !isSavedList && <button onClick={handleAddClick} className="flex items-center gap-2 bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700"><Icon name="add" className="w-5 h-5"/>Add Project</button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {projects.map(project => (
          <ProjectCard key={project.id} project={project} onSelectProject={onSelectProject} isAdmin={isAdmin} onEdit={handleEditClick} onDelete={onDeleteProject} isSaved={savedProjectIds.includes(project.id)} onToggleSave={onToggleSave}/>
        ))}
      </div>
      {modalState.type && <ProjectModal isAdding={modalState.type === 'add'} project={modalState.project} onClose={handleCloseModal} onSave={handleSave} />}
    </div>
  );
};

export default ProjectList;
