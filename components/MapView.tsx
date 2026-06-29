import React from 'react';
import { Project } from '../types';
import Icon from './common/Icon';

interface MapViewProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
}

// These are example coordinates to spread pins across a sample image.
// In a real scenario, you'd calculate these based on actual map bounds.
const pinPositions: { [key: number]: { top: string, left: string } } = {
  1: { top: '75%', left: '45%' },  // Vrindavan (Rau)
  2: { top: '20%', left: '55%' },  // Keshvam (Ujjain Rd)
  3: { top: '80%', left: '50%' },  // Divine (Pigdambar)
  4: { top: '78%', left: '40%' },  // Maa Ginni Ext (Rau)
  5: { top: '72%', left: '50%' },  // Maa Ginni (Rau)
  6: { top: '70%', left: '42%' },  // GreenWood (Rau)
  7: { top: '82%', left: '45%' },  // Red Wood (Pigdambar)
  8: { top: '75%', left: '20%' },  // Shivaji (Pithampur)
};


const MapView: React.FC<MapViewProps> = ({ projects, onSelectProject }) => {
  return (
    <div>
      <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Project Locations</h1>
      <p className="text-center text-gray-500 mb-6">Explore our projects on the map.</p>
      
      <div className="relative w-full max-w-4xl mx-auto rounded-lg shadow-xl overflow-hidden aspect-video">
        <img 
          src="https://picsum.photos/seed/indore-map/1200/800" 
          alt="Map of Indore Area" 
          className="w-full h-full object-cover"
        />
        {projects.map(project => (
          <div
            key={project.id}
            className="absolute transform -translate-x-1/2 -translate-y-full cursor-pointer group"
            style={pinPositions[project.id] || { top: '50%', left: '50%' }}
            onClick={() => onSelectProject(project)}
          >
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white p-2 rounded-lg shadow-md text-center w-40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
              <p className="font-bold text-sm text-blue-800">{project.name}</p>
              <p className="text-xs text-gray-600">{project.location}</p>
            </div>
            <Icon name="location" className="w-10 h-10 text-red-500 drop-shadow-lg group-hover:scale-125 transition-transform" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default MapView;