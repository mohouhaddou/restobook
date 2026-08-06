import React from 'react';

// Boulangerie — baguette avec entailles
export function BreadIcon({ size = 28, color = 'currentColor', ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4.5 15.5c-1-3.5 1-8 5-9.7 4.3-1.8 8.6-.2 10 2.6 1.3 2.7-.5 6-3.9 7.9-4.2 2.4-9.7 2.4-11.1-.8Z" />
      <path d="M8.5 8.8c.6.9.6 1.9 0 2.8" />
      <path d="M11.8 7.3c.6.9.6 1.9 0 2.8" />
      <path d="M15 6.6c.6.9.6 1.9 0 2.8" />
    </svg>
  );
}
export default BreadIcon;
