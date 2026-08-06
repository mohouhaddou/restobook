import React from 'react';
import { BookOpen } from 'lucide-react';
import { KidsCardBase } from './KidsCardBase';

export function StoryCard(props) {
  return <KidsCardBase {...props} icon={BookOpen} accent="var(--portal-secondary)" />;
}
