import React from 'react';
import { GraduationCap } from 'lucide-react';
import { KidsCardBase } from './KidsCardBase';

export function LearningCard(props) {
  return <KidsCardBase {...props} icon={GraduationCap} accent="var(--portal-primary)" />;
}
