import React from 'react';
import { Link } from 'react-router-dom';
import { PORTAL_CONFIG } from '../config';
import '../portal-brand-theme.css';

export function PortalBrand({ portal }) {
  const config = PORTAL_CONFIG[portal];
  return (
    <Link className="portal-brand" to={config.root} aria-label={config.name}>
      <img
        className="portal-brand-logo"
        src={'/brand/ifilino_' + portal + '.png'}
        alt={config.name}
        width="184"
        height="68"
      />
    </Link>
  );
}
