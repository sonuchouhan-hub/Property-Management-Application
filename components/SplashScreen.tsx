
import React from 'react';

const SplashScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-900 to-gray-900 flex flex-col items-center justify-center text-white z-50">
      <div className="text-4xl font-bold tracking-wider">Dhanshri</div>
      <div className="text-5xl font-extrabold text-amber-400">Properties</div>
      <div className="absolute bottom-10 text-gray-400 animate-pulse">
        Building Your Future...
      </div>
    </div>
  );
};

export default SplashScreen;
