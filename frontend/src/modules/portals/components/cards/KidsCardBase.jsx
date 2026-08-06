import React from 'react';
import { CircleCheck, LockKeyhole } from 'lucide-react';
import { PortalCard } from '../PortalCard';

/** Shared Kids card wrapper; badges are overlays and never affect card layout. */
export function KidsCardBase({ portal, item, featured, language, icon: Icon, accent }) {
  const premium = Boolean(item.isPremium || item.premium || item.metadata?.premium);
  const freeLabel = language === 'fr' ? 'Gratuit' : language === 'ar' ? 'مجاني' : 'Free';
  const premiumLabel = item.premiumBadge || (language === 'ar' ? 'مميز' : 'Premium');
  return (
    <div className="kids-card" style={accent ? { '--kids-card-accent': accent } : undefined}>
      {Icon && <span className="kids-card-icon" aria-hidden="true"><Icon size={18} /></span>}
      <span className={`kids-card-freemium ${premium ? 'is-premium' : 'is-free'}`}>
        {premium ? <LockKeyhole size={12} aria-hidden="true"/> : <CircleCheck size={12} aria-hidden="true"/>}
        {premium ? premiumLabel : freeLabel}
      </span>
      <PortalCard portal={portal} item={item} featured={featured} language={language} />
    </div>
  );
}
