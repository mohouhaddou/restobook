import React from 'react';
import { ComingSoonCard } from '../../components/dashboard/ComingSoonCard';

export default function GiftCardsPage() {
  return (
    <ComingSoonCard
      icon="🎁"
      title="Cartes cadeaux"
      description="Offrez ou recevez des cartes cadeaux iFilino, utilisables chez tous les commerçants partenaires."
      features={[
        'Achetez une carte cadeau pour un proche',
        'Montants libres ou préréglés',
        'Utilisable sur toute la marketplace',
        'Suivi du solde depuis votre Wallet',
      ]}
    />
  );
}
