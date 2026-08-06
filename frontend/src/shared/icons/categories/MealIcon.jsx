import React from 'react';

// Repas — assiette + volutes de vapeur
export function MealIcon({ size = 28, color = 'currentColor', ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <ellipse cx="12" cy="15.5" rx="8" ry="3.2" />
      <ellipse cx="12" cy="14.5" rx="8" ry="3.2" />
      <path d="M6.5 14.3c0-1.6 2.5-2.8 5.5-2.8s5.5 1.2 5.5 2.8" />
      <path d="M9 6c-.7.9-.7 1.9 0 2.8" />
      <path d="M12 5.2c-.7.9-.7 1.9 0 2.8" />
      <path d="M15 6c-.7.9-.7 1.9 0 2.8" />
    </svg>
  );
}
export default MealIcon;
