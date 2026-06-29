
import React, { useState, useRef } from 'react';
import Icon from './common/Icon';
import { UserProfile } from '../types';

interface ProfileViewProps {
  currentUser: UserProfile | null;
  onRegister: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  onLogin: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  onLogout: () => void;
  onUpdateProfile: (profile: UserProfile) => void;
}

// --- Authentication Form (Login/Sign Up) ---
const AuthForm: React.FC<Omit<ProfileViewProps, 'currentUser' | 'onLogout' | 'onUpdateProfile'>> = ({ onRegister, onLogin }) => {
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    if (isLoginView) {
      const result = await onLogin(email, password);
      if (!result.success) setError(result.message);
    } else {
      if (password !== confirmPassword) { setError("Passwords do not match."); setIsLoading(false); return; }
      if (password.length < 6) { setError("Password must be at least 6 characters long."); setIsLoading(false); return; }
      const result = await onRegister(email, password);
      if (!result.success) setError(result.message);
    }
    setIsLoading(false);
  };

  const TabButton: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
    <button type="button" onClick={onClick} className={`w-1/2 py-3 text-center font-semibold text-lg transition-colors ${active ? 'text-blue-600 border-b-4 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
      {label}
    </button>
  );

  return (
    <div className="max-w-md mx-auto mt-8"><div className="bg-white rounded-lg shadow-2xl overflow-hidden"><div className="flex">
        <TabButton label="Login" active={isLoginView} onClick={() => { setIsLoginView(true); setError(''); }} /><TabButton label="Sign Up" active={!isLoginView} onClick={() => { setIsLoginView(false); setError(''); }} />
        </div><div className="p-8"><h2 className="text-2xl font-bold text-center text-gray-800 mb-6">{isLoginView ? 'Welcome Back!' : 'Create Your Account'}</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
            <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {!isLoginView && (<input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />)}
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300">{isLoading ? 'Processing...' : (isLoginView ? 'Login' : 'Sign Up')}</button>
            
            <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink mx-4 text-gray-400 text-sm">or</span>
                <div className="flex-grow border-t border-gray-200"></div>
            </div>
            
            <button
              type="button"
              onClick={async () => {
                setEmail('demo@example.com');
                setPassword('password123');
                setIsLoading(true);
                const users = JSON.parse(localStorage.getItem('dhanshri_users') || '[]');
                if (!users.some((u: any) => u.email === 'demo@example.com')) {
                  users.push({ email: 'demo@example.com', password: 'password123', mobile: '9876543210', profileImage: '' });
                  localStorage.setItem('dhanshri_users', JSON.stringify(users));
                }
                const result = await onLogin('demo@example.com', 'password123');
                if (!result.success) setError(result.message);
                setIsLoading(false);
              }}
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:bg-emerald-300 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              Sign in with Demo Account
            </button>
        </form></div></div></div>
  );
};

// --- Logged In User Profile View ---
const LoggedInView: React.FC<{ currentUser: UserProfile; onLogout: () => void; onUpdateProfile: (profile: UserProfile) => void; }> = ({ currentUser, onLogout, onUpdateProfile }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<UserProfile>(currentUser);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, profileImage: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleSave = () => {
        onUpdateProfile(formData);
        setIsEditing(false);
    };

    return (
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-xl p-8">
        <div className="flex flex-col items-center">
            <div className="relative">
                <img src={formData.profileImage || `https://ui-avatars.com/api/?name=${formData.email}&background=0D8ABC&color=fff&size=128`} alt="Profile" className="w-32 h-32 rounded-full object-cover border-4 border-blue-200" />
                {isEditing && (
                    <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors"><Icon name="camera" className="w-5 h-5" /></button>
                )}
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mt-4">{currentUser.email}</h1>
            
            {isEditing ? (
                <div className="w-full mt-6 space-y-4">
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    <div><label className="block text-sm font-medium text-gray-700">Mobile Number</label><input type="tel" value={formData.mobile || ''} onChange={(e) => setFormData(p => ({...p, mobile: e.target.value}))} className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Your mobile number" /></div>
                    <div className="flex gap-4">
                        <button onClick={() => setIsEditing(false)} className="flex-1 bg-gray-200 text-gray-700 font-bold py-2 px-6 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button onClick={handleSave} className="flex-1 bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700">Save</button>
                    </div>
                </div>
            ) : (
                <div className="text-center mt-4">
                    <p className="text-gray-500">{currentUser.mobile || 'No mobile number added'}</p>
                    <p className="text-gray-500 mt-4 max-w-md">Manage your account settings and preferences here.</p>
                    <div className="flex gap-4 mt-8">
                        <button onClick={() => setIsEditing(true)} className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700">Edit Profile</button>
                        <button onClick={onLogout} className="bg-red-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-600">Logout</button>
                    </div>
                </div>
            )}
        </div>
      </div>
    );
};


const ProfileView: React.FC<ProfileViewProps> = ({ currentUser, onRegister, onLogin, onLogout, onUpdateProfile }) => {
  if (currentUser) {
    return <LoggedInView currentUser={currentUser} onLogout={onLogout} onUpdateProfile={onUpdateProfile} />;
  }
  return <AuthForm onRegister={onRegister} onLogin={onLogin} />;
};

export default ProfileView;
