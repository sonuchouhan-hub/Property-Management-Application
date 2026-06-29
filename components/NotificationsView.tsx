
import React from 'react';
import { AppNotification } from '../types';
import Icon from './common/Icon';

interface NotificationsViewProps {
  notifications: AppNotification[];
  onNotificationClick: (notification: AppNotification) => void;
}

const NotificationsView: React.FC<NotificationsViewProps> = ({ notifications, onNotificationClick }) => {

  const getIconForNotification = (text: string) => {
    if (text.toLowerCase().includes('new project')) return 'add';
    if (text.toLowerCase().includes('update')) return 'projects';
    if (text.toLowerCase().includes('insight') || text.toLowerCase().includes('article')) return 'insights';
    if (text.toLowerCase().includes('removed')) return 'delete';
    return 'bell';
  };
    
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Notifications</h1>
      {notifications.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
            <Icon name="bell" className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="font-semibold">You're all caught up!</p>
          <p>New notifications will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map(notification => (
            <div
              key={notification.id}
              onClick={() => onNotificationClick(notification)}
              className={`p-4 rounded-lg shadow-md flex items-start gap-4 cursor-pointer transition-colors ${
                notification.read ? 'bg-white hover:bg-gray-50' : 'bg-blue-50 hover:bg-blue-100 border border-blue-200'
              }`}
            >
              <div className={`mt-1 p-2 rounded-full ${notification.read ? 'bg-gray-100' : 'bg-blue-200'}`}>
                <Icon name={getIconForNotification(notification.text)} className={`w-6 h-6 ${notification.read ? 'text-gray-500' : 'text-blue-600'}`} />
              </div>
              <div className="flex-1">
                <p className={`text-gray-800 ${!notification.read ? 'font-semibold' : ''}`}>{notification.text}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(notification.timestamp).toLocaleString()}
                </p>
              </div>
              {!notification.read && (
                <div className="w-3 h-3 bg-blue-500 rounded-full mt-2" aria-label="Unread"></div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsView;
