
import React, { useState } from 'react';
import { Project } from '../types';
import Icon from './common/Icon';
import { getInvestmentAnalysis } from '../services/geminiService';

interface ProjectDetailsProps {
  project: Project;
  onViewPlots: (project: Project) => void;
  isSaved: boolean;
  onToggleSave: (projectId: number) => void;
}

const ProjectDetails: React.FC<ProjectDetailsProps> = ({ project, onViewPlots, isSaved, onToggleSave }) => {
  const [analysis, setAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeImageUrl, setActiveImageUrl] = useState(project.imageUrls[0] || 'https://picsum.photos/seed/placeholder/800/600');


  const handleAnalysisClick = async () => {
    setIsAnalyzing(true);
    setAnalysis('');
    const result = await getInvestmentAnalysis(project);
    setAnalysis(result);
    setIsAnalyzing(false);
  };
  
  return (
    <div className="bg-white rounded-lg shadow-xl overflow-hidden">
      <div className="relative">
        <img src={activeImageUrl} alt={project.name} className="w-full h-64 object-cover" />
         {project.imageUrls.length > 1 && (
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-black bg-opacity-50 flex justify-center gap-2">
                {project.imageUrls.map((url, index) => (
                    <button key={index} onClick={() => setActiveImageUrl(url)} className={`w-16 h-12 rounded-md overflow-hidden border-2 transition-all ${activeImageUrl === url ? 'border-white scale-110' : 'border-transparent opacity-70'}`}>
                        <img src={url} alt={`${project.name} thumbnail ${index + 1}`} className="w-full h-full object-cover" />
                    </button>
                ))}
            </div>
        )}
      </div>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-extrabold text-blue-900">{project.name}</h1>
            <p className="text-gray-500 flex items-center mt-2 text-lg">
              <Icon name="location" className="w-5 h-5 mr-2 text-gray-400" />
              {project.location}
            </p>
          </div>
          <button
            onClick={() => onToggleSave(project.id)}
            className={`p-3 rounded-full transition-colors duration-200 ${
                isSaved ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-600 hover:bg-red-50'
            }`}
            aria-label={isSaved ? 'Unsave project' : 'Save project'}
            >
            <Icon name="saved" className={`w-7 h-7 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>

        <p className="text-gray-700 text-base leading-relaxed">{project.description}</p>
        
        <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-2xl font-bold text-blue-800">{project.totalPlots}</p>
                <p className="text-sm text-gray-600">Total Plots</p>
            </div>
             <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-2xl font-bold text-green-800">{project.availablePlots}</p>
                <p className="text-sm text-gray-600">Available</p>
            </div>
        </div>

        <div>
          <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center">
             <Icon name="amenities" className="w-6 h-6 mr-3 text-blue-600" />
            Amenities
          </h3>
          <div className="flex flex-wrap gap-3">
            {project.amenities.map(amenity => (
              <span key={amenity} className="bg-gray-100 text-gray-700 text-sm font-medium px-3 py-1.5 rounded-full">
                {amenity}
              </span>
            ))}
          </div>
        </div>
        
        <div className="bg-indigo-50 border-l-4 border-indigo-400 p-4 rounded-r-lg">
          <h3 className="text-xl font-bold text-indigo-900 mb-2 flex items-center gap-2">
            <Icon name="gemini" className="w-6 h-6" />
            AI Investment Analysis (Thinking Mode)
          </h3>
          {analysis && !isAnalyzing && (
            <div className="text-indigo-800 whitespace-pre-wrap bg-indigo-100 p-3 rounded-md text-sm">{analysis}</div>
          )}
          {isAnalyzing && (
            <div className="text-indigo-800 animate-pulse">
                Generating summary... This may take a moment.
            </div>
          )}
          {!analysis && !isAnalyzing && <p className="text-indigo-700 text-sm">Click the button for a quick, AI-powered summary of this project's investment potential, including key strengths and risks.</p>}
          <button
            onClick={handleAnalysisClick}
            disabled={isAnalyzing}
            className="mt-4 bg-indigo-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-300 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? 'Generating...' : 'Generate AI Summary'}
          </button>
        </div>

        <button
          onClick={() => onViewPlots(project)}
          className="w-full bg-blue-600 text-white font-extrabold py-4 px-6 rounded-lg hover:bg-blue-700 transition-colors text-lg shadow-lg"
        >
          View Available Plots
        </button>
      </div>
    </div>
  );
};

export default ProjectDetails;
