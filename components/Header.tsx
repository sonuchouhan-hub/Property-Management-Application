
import React from 'react';
import Icon from './common/Icon';
import { UserProfile, View } from '../types';

interface HeaderProps {
  isAdmin: boolean;
  onToggleAdmin: () => void;
  onBack?: () => void;
  notificationCount: number;
  onNavigateToNotifications: () => void;
  user: UserProfile | null;
}

const Header: React.FC<HeaderProps> = ({ isAdmin, onToggleAdmin, onBack, notificationCount, onNavigateToNotifications, user }) => {
  return (
    <header className="fixed top-0 left-0 right-0 bg-white shadow-md z-40">
      <div className="container mx-auto px-4 h-16 flex justify-between items-center">
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100" aria-label="Go back">
              <Icon name="back" className="w-6 h-6 text-gray-800" />
            </button>
          )}
          <div className="text-xl font-bold text-blue-800">
            <span className="font-extrabold">Dhanshri</span> Properties
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 border-r pr-4">
            <span className="text-sm text-gray-600 hidden sm:block">{isAdmin ? 'Admin' : 'User'}</span>
            <label htmlFor="admin-toggle" className="flex items-center cursor-pointer">
              <div className="relative">
                <input type="checkbox" id="admin-toggle" className="sr-only" checked={isAdmin} onChange={onToggleAdmin} />
                <div className="block bg-gray-300 w-10 h-6 rounded-full"></div>
                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isAdmin ? 'transform translate-x-4 bg-blue-600' : ''}`}></div>
              </div>
            </label>
          </div>
          <button onClick={onNavigateToNotifications} className="relative p-2 rounded-full hover:bg-gray-100" aria-label="View notifications">
            <Icon name="bell" className="w-6 h-6 text-gray-600" />
            {notificationCount > 0 && (
              <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center ring-2 ring-white">
                {notificationCount}
              </span>
            )}
          </button>
          {user?.profileImage ? (
              <img src={user.profileImage} alt="User profile" className="w-9 h-9 rounded-full object-cover border-2 border-blue-200" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
              {user?.email.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
