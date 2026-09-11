import React from 'react';

export function WorkSyncLogo({ className = 'h-8 w-auto', showText = true, textClassName = 'text-white font-bold text-lg tracking-tight' }) {
  return (
    <div className="flex items-center gap-2.5">
      {/* Hexagonal Interlocking Brand Logo SVG */}
      <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M32 18L14 48L32 78H46L28 48L46 18H32Z"
          fill="#0066FF"
        />
        <path
          d="M48 18H72L90 48L72 78H48L30 48L48 18ZM64 32H54L42 52L54 72H64L76 52L64 32Z"
          fill="#0066FF"
        />
      </svg>
      {showText && <span className={textClassName}>WorkSync</span>}
    </div>
  );
}
