import React from 'react';

// Boissons — gobelet avec paille
export function DrinkIcon({ size = 28, color = 'currentColor', ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15.5 3.5 14 4.8" />
      <path d="M14 4.8V9" />
      <path d="M6.5 9h11l-1.1 10a2 2 0 0 1-2 1.8H9.6a2 2 0 0 1-2-1.8L6.5 9Z" />
      <path d="M7.2 12.5h9.6" />
    </svg>
  );
}
export default DrinkIcon;
