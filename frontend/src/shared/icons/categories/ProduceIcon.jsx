import React from 'react';

// Fruits & légumes — carotte avec fanes
export function ProduceIcon({ size = 28, color = 'currentColor', ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M13.5 8.5c1.8 1.8 1.8 6-.9 8.7-2.7 2.7-6.9 2.7-8.7.9-1.8-1.8-1.8-6 .9-8.7 2.7-2.7 6.9-2.7 8.7-.9Z" />
      <path d="M13.5 8.5 19 3" />
      <path d="M15 4.5 19 3l-1.5 4" />
      <path d="M17 6.5 19 3" />
      <path d="M6 15.5l2.5-2.5" />
    </svg>
  );
}
export default ProduceIcon;
