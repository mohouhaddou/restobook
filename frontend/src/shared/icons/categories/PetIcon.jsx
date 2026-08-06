import React from 'react';

// Animaux — empreinte de patte
export function PetIcon({ size = 28, color = 'currentColor', ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <ellipse cx="12" cy="16" rx="4.3" ry="3.6" />
      <ellipse cx="6.3" cy="10.8" rx="1.7" ry="2.1" />
      <ellipse cx="10.3" cy="7.5" rx="1.7" ry="2.1" />
      <ellipse cx="14.7" cy="7.5" rx="1.7" ry="2.1" />
      <ellipse cx="18.7" cy="10.8" rx="1.7" ry="2.1" />
    </svg>
  );
}
export default PetIcon;
