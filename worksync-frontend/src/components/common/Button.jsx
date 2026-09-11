import React from 'react';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  className = '',
  disabled = false,
  ...props
}) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none';

  const variants = {
    primary:
      'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm focus:ring-blue-500',
    secondary:
      'bg-slate-100 hover:bg-slate-200 text-slate-700 focus:ring-slate-400',
    outline:
      'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs focus:ring-slate-300',
    ghost:
      'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900',
    danger:
      'bg-red-600 hover:bg-red-700 text-white shadow-sm focus:ring-red-500',
    navy:
      'bg-[#0C1F6B] hover:bg-[#091752] text-white shadow-sm focus:ring-[#0C1F6B]'
  };

  const sizes = {
    sm: 'px-2.5 py-1.5 text-xs gap-1.5',
    md: 'px-3.5 py-2 text-sm gap-2',
    lg: 'px-4.5 py-2.5 text-base gap-2.5'
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      disabled={disabled}
      {...props}
    >
      {Icon && <Icon className={`flex-shrink-0 ${size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'}`} />}
      {children}
    </button>
  );
}
