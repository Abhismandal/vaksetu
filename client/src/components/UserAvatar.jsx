import React from 'react';

const sizeMap = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

const badgeSizeMap = {
  xs: 'w-2 h-2',
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-3.5 h-3.5',
  xl: 'w-4 h-4',
};

export const UserAvatar = ({
  src,
  name = 'User',
  size = 'md',
  isOnline = false,
  showStatus = true,
  className = '',
}) => {
  const sizeClasses = sizeMap[size] || sizeMap.md;
  const badgeClasses = badgeSizeMap[size] || badgeSizeMap.md;

  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  const defaultAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
    name
  )}&backgroundColor=6366f1`;

  return (
    <div className={`relative inline-block flex-shrink-0 ${className}`}>
      <img
        src={src || defaultAvatar}
        alt={name}
        className={`${sizeClasses} rounded-2xl object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 shadow-sm`}
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = defaultAvatar;
        }}
      />

      {showStatus && (
        <span
          className={`absolute bottom-0 right-0 ${badgeClasses} rounded-full border-2 border-white dark:border-slate-900 ${
            isOnline ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600'
          }`}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
};

export default UserAvatar;
