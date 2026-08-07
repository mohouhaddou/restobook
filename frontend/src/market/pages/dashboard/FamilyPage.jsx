import React from 'react';
import { ComingSoonCard } from '../../components/dashboard/ComingSoonCard';

export default function FamilyPage() {
  return (
    <ComingSoonCard
      icon="👨‍👩‍👧"
      title="Espace Famille"
      description="Partagez votre compte iFilino avec vos proches : budget, points et cashback communs, pour une famille connectée."
      features={[
        'Invitez les membres de votre famille',
        'Budget partagé avec suivi des dépenses',
        'Points de fidélité et cashback mutualisés',
        'Listes de courses partagées',
        'Commandes des enfants avec validation parentale',
        'Historique familial centralisé',
      ]}
    />
  );
}
