
import React from 'react';
import Icon from './common/Icon';
import { UserProfile, View } from '../types';
import { isSuperAdminEmail } from '../services/firebaseService';

interface HeaderProps {
  isAdmin: boolean;
  onToggleAdmin: () => void;
  onBack?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToAdmin?: () => void;
  user: UserProfile | null;
}

const Header: React.FC<HeaderProps> = ({
  isAdmin,
  onToggleAdmin,
  onBack,
  onNavigateToProfile,
  onNavigateToAdmin,
  user
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 bg-white shadow-md z-40">
      <div className="container mx-auto px-4 h-16 flex justify-between items-center">
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100" aria-label="Go back">
              <Icon name="back" className="w-6 h-6 text-gray-800" />
            </button>
          )}
          <div className="text-xl font-bold text-blue-800 cursor-pointer" onClick={onBack}>
            <span className="font-extrabold">Dhanshri</span> Properties
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {isAdmin && onNavigateToAdmin && (
            <button
              onClick={onNavigateToAdmin}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
            >
              <Icon name="lock" className="w-4 h-4" />
              <span>Admin Panel</span>
            </button>
          )}

          {user && (isSuperAdminEmail(user.email) || user.role === 'admin' || isAdmin) && (
            <div className="flex items-center space-x-2 border-r pr-3">
              <span className="text-xs font-medium text-gray-600 hidden sm:block">{isAdmin ? 'Admin' : 'User'}</span>
              <label htmlFor="admin-toggle" className="flex items-center cursor-pointer" title="Toggle Admin Mode">
                <div className="relative">
                  <input type="checkbox" id="admin-toggle" className="sr-only" checked={isAdmin} onChange={onToggleAdmin} />
                  <div className="block bg-gray-300 w-9 h-5 rounded-full"></div>
                  <div className={`dot absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform ${isAdmin ? 'transform translate-x-4 bg-blue-600' : ''}`}></div>
                </div>
              </label>
            </div>
          )}

          <button
            onClick={onNavigateToProfile}
            className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
            title="User Profile / Account Panel"
          >
            {user?.profileImage ? (
              <img src={user.profileImage} alt="User profile" className="w-9 h-9 rounded-full object-cover border-2 border-blue-200" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
