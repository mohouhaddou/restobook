import React from 'react';
import { FlaskConical } from 'lucide-react';
import { KidsCardBase } from './KidsCardBase';

export function ScienceCard(props) {
  return <KidsCardBase {...props} icon={FlaskConical} accent="var(--portal-accent)" />;
}
