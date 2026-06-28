import React from 'react';

export function EmptyState({ icon = '📭', title, subtitle, action }) {
  return (
    <div className="text-center py-5 text-secondary">
      <div style={{ fontSize: 48, marginBottom: 8 }}>{icon}</div>
      <div className="fw-semibold mb-1">{title}</div>
      {subtitle && <div className="small mb-3">{subtitle}</div>}
      {action}
    </div>
  );
}
