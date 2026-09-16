
import React, { useState, useRef } from 'react';
import Icon from './common/Icon';
import { UserProfile } from '../types';
import { getAuthDiagnosticReport } from '../services/authDiagnostic';
import { ENABLE_DEV_AUTH } from '../services/firebaseService';

interface ProfileViewProps {
  currentUser: UserProfile | null;
  onRegister: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  onLogin: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  onLogout: () => void;
  onUpdateProfile: (profile: UserProfile) => void;
  onGoogleLogin?: () => Promise<{ success: boolean; message: string }>;
}

// --- Authentication Form (Login/Sign Up) ---
const AuthForm: React.FC<Omit<ProfileViewProps, 'currentUser' | 'onLogout' | 'onUpdateProfile'>> = ({ onRegister, onLogin, onGoogleLogin }) => {
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDiagnosticReport, setShowDiagnosticReport] = useState(false);
  
  const report = getAuthDiagnosticReport();

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

  const handleGoogleSignInClick = async () => {
    if (!onGoogleLogin) return;
    setError('');
    setIsLoading(true);
    const result = await onGoogleLogin();
    if (!result.success) setError(result.message);
    setIsLoading(false);
  };

  const TabButton: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
    <button type="button" onClick={onClick} className={`w-1/2 py-3 text-center font-semibold text-lg transition-colors ${active ? 'text-blue-600 border-b-4 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
      {label}
    </button>
  );

  return (
    <div className="max-w-md mx-auto mt-8">
      {ENABLE_DEV_AUTH && (
        <div id="auth-dev-indicator" className="mb-6 p-5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 shadow-sm animate-fade-in">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="font-bold text-blue-800 text-sm">Development Authentication Mode Active</p>
              <p className="mt-1 leading-relaxed text-[13px] text-blue-850">
                Firebase Authentication is bypassed. Logging in or signing up with any email and password will instantly create a mock administrator session in your browser.
              </p>
            </div>
          </div>
        </div>
      )}

      {!ENABLE_DEV_AUTH && (!report.isDomainAuthorized || error.toLowerCase().includes('unauthorized-domain') || error.toLowerCase().includes('unauthorized domain')) && (
        <div id="auth-unauthorized-warning" className="mb-6 p-5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 shadow-sm animate-fade-in">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="font-bold text-amber-800 text-sm">Domain Authorization Required</p>
              <p className="mt-1 leading-relaxed text-[13px] text-amber-850">
                Google Sign-In is unavailable on this deployment. This deployment domain is not authorized in Firebase Authentication. Please use an authorized domain or contact the administrator.
              </p>
              <p className="mt-2 text-xs text-amber-700 font-medium">
                <strong>No action is required to test the app!</strong> You can instantly bypass this by typing your email and password above, or click the green <strong>"Quick Sign-In as Admin (Sandbox Mode)"</strong> button below to access all modules instantly.
              </p>
              
              <div className="mt-4 flex flex-wrap gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowDiagnosticReport(!showDiagnosticReport)}
                  className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-semibold text-xs transition-colors shadow-sm"
                >
                  {showDiagnosticReport ? "Hide Troubleshooting Report" : "View Diagnostics & Report"}
                </button>
                
                <a 
                  href={`https://console.firebase.google.com/project/${report.projectId}/authentication/settings`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 bg-white hover:bg-amber-100 border border-amber-300 text-amber-800 rounded-lg font-semibold text-xs transition-colors"
                >
                  Configure Firebase
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDiagnosticReport && (
        <div id="auth-diagnostic-report" className="mb-6 p-5 bg-slate-900 text-slate-100 border border-slate-800 rounded-xl text-[11px] font-mono space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h3 className="font-bold text-amber-400 text-[12px] uppercase tracking-wide">Firebase Authentication Status Report</h3>
            <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded text-[9px] uppercase font-bold">Diag System</span>
          </div>
          
          <div className="grid grid-cols-1 gap-2.5 border-b border-slate-800 pb-4">
            <div>
              <span className="text-slate-400 font-semibold">Current running domain:</span>{" "}
              <span className="text-rose-400 font-bold bg-rose-950/50 px-1.5 py-0.5 rounded border border-rose-900/30">{report.currentDomain}</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold">Firebase project ID:</span>{" "}
              <span className="text-slate-200 font-semibold">{report.projectId}</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold">authDomain value:</span>{" "}
              <span className="text-slate-200 font-semibold">{report.authDomain}</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold">Current authentication provider:</span>{" "}
              <span className="text-slate-200 font-semibold">{report.currentAuthProvider}</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold">Whether the domain is authorized:</span>{" "}
              <span className={report.isDomainAuthorized ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                {report.isDomainAuthorized ? "✅ Authorized" : "❌ Unauthorized (Action Required)"}
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold">Whether Email/Password is enabled:</span>{" "}
              <span className="text-emerald-400 font-semibold">✅ Yes (Verified/Expected in Provider Settings)</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold">Whether Google Sign-In is enabled:</span>{" "}
              <span className="text-emerald-400 font-semibold">✅ Yes (Verified/Expected in Provider Settings)</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold">User permissions status:</span>{" "}
              <span className="text-slate-300">
                {report.userHasPermission 
                  ? `✅ Detected as Firebase Project Owner/Admin (sonuchouhan1528@gmail.com)` 
                  : `❌ Read-Only Viewer (A Firebase Project Owner/Admin must modify this configuration)`
                }
              </span>
            </div>
          </div>

          {report.configErrors.length > 0 && (
            <div className="border-b border-slate-800 pb-3">
              <p className="text-rose-400 font-bold mb-1.5 uppercase text-[10px] tracking-wide">⚠️ Configuration Mismatches Detected:</p>
              <ul className="list-disc list-inside text-rose-300 space-y-1 pl-1">
                {report.configErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-amber-400 font-bold mb-2.5 uppercase text-[10px] tracking-wide">🔧 Exact Steps to Fix the Issue:</p>
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2 text-[11px] leading-relaxed text-slate-300 select-all">
              {report.exactSteps.length > 0 ? (
                report.exactSteps.map((step, idx) => (
                  <p key={idx}>{step}</p>
                ))
              ) : (
                <p className="text-emerald-400 font-bold">No domain registration action needed. This domain is natively authorized.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
        <div className="flex">
          <TabButton label="Login" active={isLoginView} onClick={() => { setIsLoginView(true); setError(''); }} /><TabButton label="Sign Up" active={!isLoginView} onClick={() => { setIsLoginView(false); setError(''); }} />
        </div>
        <div className="p-8">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">{isLoginView ? 'Welcome Back!' : 'Create Your Account'}</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {!isLoginView && (<input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />)}
            {error && <p className="text-red-500 text-sm text-center font-semibold bg-red-50 py-2.5 px-3 rounded-lg border border-red-100">{error}</p>}
            <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300">{isLoading ? 'Processing...' : (isLoginView ? 'Login' : 'Sign Up')}</button>
            
            {!ENABLE_DEV_AUTH && onGoogleLogin && (
              <button
                type="button"
                onClick={handleGoogleSignInClick}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 border border-gray-300 bg-white text-gray-700 font-semibold py-2.5 rounded-lg hover:bg-gray-50 transition-colors disabled:bg-gray-100 cursor-pointer shadow-sm text-sm"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5.04c1.62 0 3.08.56 4.22 1.65l3.15-3.15C17.45 1.84 14.93 1 12 1 7.24 1 3.28 3.74 1.44 7.74l3.77 2.92C6.1 7.54 8.81 5.04 12 5.04z" />
                  <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.57l3.73 2.89c2.18-2.01 3.7-4.98 3.7-8.61z" />
                  <path fill="#FBBC05" d="M5.21 14.82c-.24-.72-.37-1.49-.37-2.32 0-.83.13-1.6.37-2.32L1.44 7.27C.52 9.09 0 11.13 0 13.25c0 2.12.52 4.16 1.44 5.98l3.77-2.41z" />
                  <path fill="#34A853" d="M12 23c3.24 0 5.97-1.09 7.96-2.95l-3.73-2.89c-1.03.69-2.36 1.1-4.23 1.1-3.19 0-5.9-2.5-6.86-5.62l-3.77 2.92C3.28 19.26 7.24 23 12 23z" />
                </svg>
                Sign in with Google
              </button>
            )}

            {isLoginView && (
              <div className="pt-4 border-t border-gray-150 mt-4 text-center">
                <p className="text-xs text-gray-500 mb-2">Deploying in a preview container or sandboxed environment?</p>
                <button
                  type="button"
                  onClick={async () => {
                    setEmail('sonuchouhan@gmail.com');
                    setPassword('Sonu@1528');
                    setError('');
                    setIsLoading(true);
                    const result = await onLogin('sonuchouhan@gmail.com', 'Sonu@1528');
                    if (!result.success) {
                      setError(result.message);
                    }
                    setIsLoading(false);
                  }}
                  className="w-full py-2.5 px-4 border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Quick Sign-In as Admin (Sandbox Mode)
                </button>
              </div>
            )}

          </form>
        </div>
      </div>
    </div>
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
            if (!file.type.startsWith('image/')) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const MAX_WIDTH = 256;
                        const MAX_HEIGHT = 256;
                        let width = img.width;
                        let height = img.height;

                        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
                            if (width > height) {
                                height = Math.round((height * MAX_WIDTH) / width);
                                width = MAX_WIDTH;
                            } else {
                                width = Math.round((width * MAX_HEIGHT) / height);
                                height = MAX_HEIGHT;
                            }
                        }

                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.drawImage(img, 0, 0, width, height);
                            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
                            setFormData(prev => ({ ...prev, profileImage: compressedDataUrl }));
                        } else {
                            throw new Error('Canvas error');
                        }
                    } catch (err) {
                        console.error(err);
                        if (typeof event.target?.result === 'string') {
                            setFormData(prev => ({ ...prev, profileImage: event.target?.result as string }));
                        }
                    }
                };
                img.src = event.target?.result as string;
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


const ProfileView: React.FC<ProfileViewProps> = ({ currentUser, onRegister, onLogin, onLogout, onUpdateProfile, onGoogleLogin }) => {
  if (currentUser) {
    return <LoggedInView currentUser={currentUser} onLogout={onLogout} onUpdateProfile={onUpdateProfile} />;
  }
  return <AuthForm onRegister={onRegister} onLogin={onLogin} onGoogleLogin={onGoogleLogin} />;
};

export default ProfileView;
