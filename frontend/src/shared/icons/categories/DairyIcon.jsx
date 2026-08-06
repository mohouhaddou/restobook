import React from 'react';

// Produits laitiers — bouteille de lait
export function DairyIcon({ size = 28, color = 'currentColor', ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10 3h4v3.2l1.6 2.4c.3.4.4.9.4 1.4v8c0 1.1-.9 2-2 2h-4c-1.1 0-2-.9-2-2v-8c0-.5.1-1 .4-1.4L10 6.2V3Z" />
      <path d="M10 3h4" />
      <path d="M8.4 12.5h7.2" />
    </svg>
  );
}
export default DairyIcon;
