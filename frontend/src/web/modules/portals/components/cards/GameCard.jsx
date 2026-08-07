import React from 'react';
import { Gamepad2 } from 'lucide-react';
import { KidsCardBase } from './KidsCardBase';

export function GameCard(props) {
  return <KidsCardBase {...props} icon={Gamepad2} accent="var(--portal-accent)" />;
}
