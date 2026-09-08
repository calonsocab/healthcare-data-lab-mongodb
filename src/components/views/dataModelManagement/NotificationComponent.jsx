// src/components/views/dataModelManagement/NotificationComponent.jsx
"use client";

import React from 'react';
import PropTypes from 'prop-types';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';

const NotificationComponent = ({ notification, onClose }) => {

  if (!notification.visible) {
    return null;
  }

  // Check if any details contain skipped/warning items (marked with !)
  const hasSkippedItems = notification.details?.some(d => d.startsWith('! '));

  // Determine icon and styles based on notification type
  // Using subtle, monochrome styling without colored icons
  // If there are skipped items, use warning/orange accent
  let Icon, bgColor, borderColor, accentClass;
  switch (notification.type) {
    case 'error':
      Icon = AlertCircle;
      bgColor = 'bg-surface/80';
      borderColor = 'border-theme/20';
      accentClass = 'before:bg-error';
      break;
    case 'success':
      Icon = CheckCircle;
      bgColor = 'bg-surface/80';
      borderColor = 'border-theme/20';
      accentClass = hasSkippedItems ? 'before:bg-warning' : 'before:bg-success';
      break;
    case 'info':
    default:
      Icon = Info;
      bgColor = 'bg-surface/80';
      borderColor = 'border-theme/20';
      accentClass = hasSkippedItems ? 'before:bg-warning' : 'before:bg-primary';
      break;
  }

  return (
    <div className={`
      relative overflow-hidden
      p-4 rounded-lg mb-4 flex items-start
      ${bgColor} border ${borderColor}
      backdrop-blur-sm
      before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] ${accentClass}
      z-50
    `}>
      <div className="mr-3 flex-shrink-0 text-theme-secondary">
        <Icon size={18} strokeWidth={1.5} />
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-theme-primary mb-1">
          {notification.type === 'error' ? 'Error' :
           notification.type === 'success' ? 'Success' : 'Information'}
        </h3>
        <p className="text-sm text-theme-secondary">{notification.message}</p>

        {notification.details && notification.details.length > 0 && (
          <div className="mt-3 max-h-40 overflow-y-auto scrollbar-subtle space-y-1">
            {notification.details.map((detail, index) => {
              // Detect if this is a success item (✓) or skipped/warning item (!)
              const isSuccess = detail.startsWith('✓ ');
              const isSkipped = detail.startsWith('! ');

              return (
                <div
                  key={index}
                  className={`text-xs py-1.5 px-2.5 rounded-md ${
                    isSuccess
                      ? 'text-theme-secondary bg-success/5'
                      : isSkipped
                        ? 'text-warning bg-warning/10'
                        : 'text-theme-secondary bg-surface/50'
                  }`}
                >
                  {detail}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={onClose}
        className="ml-3 p-1 text-theme-tertiary hover:text-theme-secondary hover:bg-theme/5 rounded transition-colors flex-shrink-0"
        aria-label="Close notification"
      >
        <X size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
};

NotificationComponent.propTypes = {
  notification: PropTypes.shape({
    type: PropTypes.oneOf(['error', 'success', 'info']),
    message: PropTypes.string,
    details: PropTypes.arrayOf(PropTypes.string),
    visible: PropTypes.bool
  }).isRequired,
  onClose: PropTypes.func.isRequired
};

export default NotificationComponent;
