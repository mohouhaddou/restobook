import React from 'react';

// Hygiène — savon avec goutte
export function HygieneIcon({ size = 28, color = 'currentColor', ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="11" width="14" height="7.5" rx="3" />
      <path d="M7 11V9a2 2 0 0 1 2-2h4" />
      <path d="M17 4.5c1 1.1 1 2.1 0 3.2-1-1.1-1-2.1 0-3.2Z" />
    </svg>
  );
}
export default HygieneIcon;
