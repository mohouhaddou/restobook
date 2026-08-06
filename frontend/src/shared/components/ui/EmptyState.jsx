import React from 'react';
import { useI18n } from '../../../i18n/config';
import { DashboardIcon } from './DashboardIcon';

export function EmptyState({ icon = 'inbox', title, subtitle, action, titleKey, subtitleKey }) {
  const { t } = useI18n();
  const finalTitle = titleKey ? t(titleKey) : title;
  const finalSubtitle = subtitleKey ? t(subtitleKey) : subtitle;
  return (
    <div className="text-center py-5 text-secondary">
      <div style={{ display: 'grid', placeItems: 'center', marginBottom: 8, color: 'var(--mk-orange, var(--il-primary, currentColor))' }}><DashboardIcon icon={icon} size={42} badge /></div>
      <div className="fw-semibold mb-1">{finalTitle}</div>
      {finalSubtitle && <div className="small mb-3">{finalSubtitle}</div>}
      {action}
    </div>
  );
}
