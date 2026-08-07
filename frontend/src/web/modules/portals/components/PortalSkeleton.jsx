import React from 'react';

export function PortalSkeleton() {
  return (
    <div className="portal-grid" aria-busy="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="portal-skeleton" key={index}><span/><span/><span/></div>
      ))}
    </div>
  );
}
