import React from 'react';

// Desserts — part de gâteau
export function DessertIcon({ size = 28, color = 'currentColor', ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 12.5 12 8l8 4.5v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3Z" />
      <path d="M4 12.5 12 17l8-4.5" />
      <path d="M12 8V4.5" />
      <circle cx="12" cy="3.3" r=".9" />
    </svg>
  );
}
export default DessertIcon;
