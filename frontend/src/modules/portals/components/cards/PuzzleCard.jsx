import React from 'react';
import { Puzzle } from 'lucide-react';
import { KidsCardBase } from './KidsCardBase';

export function PuzzleCard(props) {
  return <KidsCardBase {...props} icon={Puzzle} accent="var(--portal-primary)" />;
}
