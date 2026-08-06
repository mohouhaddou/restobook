import { PremiumIconBadge } from '../../shared/components/ui/PremiumIcon';
import React from 'react';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { AssistantWidget } from '../../shared/components/dashboard/AssistantWidget';

export default function AssistantPage() {
  const { authHeader } = useCustomerAuth();

  return (
    <div className="mk-fade-up" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ display:'grid', placeItems:'center', color:'var(--mk-orange)', marginBottom:8 }}><PremiumIconBadge name="sparkles" size={34} /></div>
        <h1 style={{ fontSize: 19, fontWeight: 900, color: 'var(--mk-text)', margin: '0 0 6px' }}>Assistant iFilino</h1>
        <p style={{ fontSize: 13, color: 'var(--mk-muted)', margin: 0 }}>
          Bientôt : génération de listes de courses, recherche de pharmacie de garde, comparaison de prix et bien plus.
        </p>
      </div>
      <AssistantWidget authHeader={authHeader} />
    </div>
  );
}
