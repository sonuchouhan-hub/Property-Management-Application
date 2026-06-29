
import React, { useEffect } from 'react';
import Icon from './Icon';

interface NotificationProps {
  message: string;
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000); // Auto-close after 4 seconds

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div 
      className="fixed top-20 right-4 z-50 bg-green-500 text-white p-4 rounded-lg shadow-lg flex items-center gap-4 animate-slide-in"
      role="alert"
    >
      <Icon name="status" className="w-6 h-6" />
      <span className="font-semibold">{message}</span>
      <button onClick={onClose} aria-label="Close notification" className="ml-auto p-1 rounded-full hover:bg-green-600 transition-colors">
        <Icon name="close" className="w-5 h-5" />
      </button>
    </div>
  );
};

export default Notification;
