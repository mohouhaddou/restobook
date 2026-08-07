import React from 'react';
import { PawPrint } from 'lucide-react';
import { KidsCardBase } from './KidsCardBase';

export function AnimalCard(props) {
  return <KidsCardBase {...props} icon={PawPrint} accent="var(--portal-highlight, var(--portal-accent))" />;
}
