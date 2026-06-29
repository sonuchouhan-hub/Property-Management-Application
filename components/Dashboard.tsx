import React from 'react';
import { View, Project } from '../types';
import Icon from './common/Icon';

interface DashboardProps {
  projects: Project[];
  navigateTo: (view: View) => void;
  selectProject: (project: Project) => void;
  savedProjectIds: number[];
  onToggleSave: (projectId: number) => void;
}

const FeatureCard: React.FC<{ title: string; icon: string; view: View; onClick: (view: View) => void }> = ({ title, icon, view, onClick }) => (
    <div
        onClick={() => onClick(view)}
        className="bg-white p-4 rounded-xl shadow-lg hover:shadow-xl transition-shadow cursor-pointer flex flex-col items-center justify-center text-center transform hover:-translate-y-1"
    >
        <div className="p-3 bg-blue-100 rounded-full mb-3">
            <Icon name={icon} className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="font-semibold text-gray-700">{title}</h3>
    </div>
);


const Dashboard: React.FC<DashboardProps> = ({ projects, navigateTo, selectProject, savedProjectIds, onToggleSave }) => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Welcome to Dhanshri Properties</h1>
        <p className="text-gray-500 mt-1">Your trusted partner in real estate investment.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          <FeatureCard title="Plot Bookings" icon="check" view={View.PLOT_BOOKINGS} onClick={navigateTo} />
          <FeatureCard title="All Projects" icon="projects" view={View.PROJECTS} onClick={navigateTo} />
          <FeatureCard title="Property Insights" icon="insights" view={View.INSIGHTS} onClick={navigateTo} />
          <FeatureCard title="Financial Tools" icon="calculator" view={View.CALCULATORS} onClick={navigateTo} />
          <FeatureCard title="Contact Us" icon="contact" view={View.CONTACT} onClick={navigateTo} />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Featured Projects</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.slice(0, 3).map(project => {
            const isSaved = savedProjectIds.includes(project.id);
            return (
              <div key={project.id} onClick={() => selectProject(project)} className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer group">
                <div className="relative">
                  <img src={project.imageUrls[0]} alt={project.name} className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSave(project.id);
                    }}
                    className={`absolute top-2 right-2 w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-200 ${
                      isSaved ? 'bg-red-500 text-white' : 'bg-white/80 text-gray-700 hover:bg-white'
                    }`}
                    aria-label={isSaved ? 'Unsave project' : 'Save project'}
                  >
                    <Icon name="saved" className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
                  </button>
                </div>
                <div className="p-4">
                  <h3 className="text-xl font-bold text-blue-800">{project.name}</h3>
                  <p className="text-gray-600 flex items-center mt-1">
                    <Icon name="location" className="w-4 h-4 mr-2 text-gray-400" />
                    {project.location}
                  </p>
                  <div className="mt-4 flex justify-between items-center">
                      <span className="text-sm font-semibold text-green-600 bg-green-100 px-3 py-1 rounded-full">{project.availablePlots} plots available</span>
                      <button className="text-blue-600 font-semibold text-sm">View Details →</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

       <div className="bg-blue-800 text-white p-6 rounded-lg text-center">
            <h2 className="text-2xl font-bold mb-2">Why Invest With Us?</h2>
            <p className="mb-4">Real estate is more than just property; it's a foundation for your future. We provide expert guidance to help you make secure and profitable investments.</p>
            <button onClick={() => navigateTo(View.INSIGHTS)} className="bg-white text-blue-800 font-bold py-2 px-6 rounded-full hover:bg-gray-100 transition-colors">
                Learn More
            </button>
        </div>
    </div>
  );
};

export default Dashboard;