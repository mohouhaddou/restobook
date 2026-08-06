import React from 'react';
import { Landmark } from 'lucide-react';
import { KidsCardBase } from './KidsCardBase';

export function HistoryCard(props) {
  return <KidsCardBase {...props} icon={Landmark} accent="var(--portal-primary-strong, var(--portal-primary))" />;
}
