
import React from 'react';
import { View } from '../types';
import Icon from './common/Icon';

interface BottomNavProps {
  currentView: View;
  setCurrentView: (view: View) => void;
}

const NavItem: React.FC<{
  view: View;
  label: string;
  icon: string;
  currentView: View;
  setCurrentView: (view: View) => void;
}> = ({ view, label, icon, currentView, setCurrentView }) => {
  const isActive = currentView === view;
  return (
    <button
      onClick={() => setCurrentView(view)}
      className={`flex flex-col items-center justify-center w-full pt-2 pb-1 transition-colors duration-200 ${
        isActive ? 'text-blue-600' : 'text-gray-500 hover:text-blue-500'
      }`}
    >
      <Icon name={icon} className="w-6 h-6 mb-1" />
      <span className={`text-xs font-medium ${isActive ? 'font-bold' : ''}`}>{label}</span>
    </button>
  );
};

const BottomNav: React.FC<BottomNavProps> = ({ currentView, setCurrentView }) => {
  const navItems = [
    { view: View.DASHBOARD, label: 'Home', icon: 'home' },
    { view: View.PROJECTS, label: 'Search', icon: 'search' },
    { view: View.SAVED, label: 'Saved', icon: 'saved' },
    { view: View.CONTACT, label: 'Chat', icon: 'chat' },
    { view: View.PROFILE, label: 'Profile', icon: 'profile' },
  ];
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-2px_5px_rgba(0,0,0,0.1)] z-40 md:hidden">
      <div className="flex justify-around items-center h-16">
        {navItems.map(item => (
          <NavItem key={item.view} {...item} currentView={currentView} setCurrentView={setCurrentView} />
        ))}
      </div>
    </div>
  );
};

export default BottomNav;
