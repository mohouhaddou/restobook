import React from 'react';
import { BRAND_ASSETS } from '../../utils/brandAssets';
import { BRAND } from '../../../config/branding';

const HEIGHTS = {
  xs:  { full: 40,  footer: 36,  icon: 28, discover: 40 },
  sm:  { full: 64,  footer: 56,  icon: 40, discover: 64 },
  md:  { full: 88,  footer: 72,  icon: 56, discover: 88 },
  lg:  { full: 112, footer: 96,  icon: 72, discover: 112 },
  xl:  { full: 150, footer: 120, icon: 96, discover: 150 },
};

export function BrandLogo({ variant = 'full', theme = 'light', size = 'md', className = '', style = {} }) {
  let src;
  if (variant === 'discover') {
    src = '/brand/ifilino_discover.png';
  } else if (variant === 'icon') {
    src = BRAND_ASSETS.icon;
  } else if (variant === 'footer') {
    src = theme === 'dark' ? BRAND_ASSETS.footerDark : BRAND_ASSETS.footerLight;
  } else {
    src = theme === 'dark' ? BRAND_ASSETS.logoDark : BRAND_ASSETS.logoLight;
  }

  const h = (HEIGHTS[size] ?? HEIGHTS.md)[variant] ?? (HEIGHTS[size] ?? HEIGHTS.md).full;

  return (
    <img
      src={src}
      alt={BRAND.APP_NAME}
      className={className}
      style={{ objectFit: 'contain', display: 'block', height: h, width: 'auto', ...style }}
    />
  );
}
