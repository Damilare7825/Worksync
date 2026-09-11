import React from 'react';

export function Avatar({
  name = 'User',
  initials = 'US',
  color = '#818CF8',
  size = 'md',
  className = ''
}) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-xs font-semibold',
    lg: 'w-10 h-10 text-sm font-semibold'
  };

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white flex-shrink-0 shadow-2xs ${sizeClasses[size] || sizeClasses.md} ${className}`}
      style={{ backgroundColor: color }}
      title={name}
    >
      {initials}
    </div>
  );
}

export function AvatarGroup({ members = [], max = 3, size = 'sm' }) {
  const visibleMembers = members.slice(0, max);
  const extraCount = members.length - max;

  return (
    <div className="flex items-center -space-x-1.5 overflow-hidden">
      {visibleMembers.map((m, idx) => (
        <Avatar
          key={idx}
          name={m.name || m.initials}
          initials={m.initials}
          color={m.color}
          size={size}
          className="ring-2 ring-white"
        />
      ))}
      {extraCount > 0 && (
        <div
          className={`rounded-full bg-slate-100 ring-2 ring-white flex items-center justify-center text-slate-500 font-medium ${size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs'}`}
        >
          +{extraCount}
        </div>
      )}
    </div>
  );
}
