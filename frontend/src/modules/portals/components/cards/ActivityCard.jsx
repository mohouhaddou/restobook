import React from 'react';
import { Palette } from 'lucide-react';
import { KidsCardBase } from './KidsCardBase';

export function ActivityCard(props) {
  return <KidsCardBase {...props} icon={Palette} accent="var(--portal-highlight, var(--portal-secondary))" />;
}
