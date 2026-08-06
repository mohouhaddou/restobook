import React from 'react';

// Viandes — pièce de viande avec os
export function MeatIcon({ size = 28, color = 'currentColor', ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8.5 6.5c3-1.8 7-1.2 8.6 1.6 1.6 2.8.5 6.6-2.5 8.4-2.6 1.6-5.8 1.3-7.6-.8" />
      <path d="M8.5 6.5c-1.6.9-2.6 2.2-2.3 3.6" />
      <path d="M6.2 10.1c-1.3.2-2.4 1-2.7 2.2-.3 1.3.4 2.5 1.7 2.9" />
      <path d="M6.9 15.7c.8-.6 1.7-.8 2.5-.6" />
      <circle cx="12.5" cy="10.5" r="1.6" />
    </svg>
  );
}
export default MeatIcon;
