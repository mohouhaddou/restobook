import React from 'react';
import { Brain } from 'lucide-react';
import { KidsCardBase } from './KidsCardBase';

export function QuizCard(props) {
  return <KidsCardBase {...props} icon={Brain} accent="var(--portal-secondary)" />;
}
