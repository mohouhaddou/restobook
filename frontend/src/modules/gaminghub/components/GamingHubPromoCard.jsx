import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Gamepad2 } from 'lucide-react';
import { useI18n } from '../../../i18n/config';
import '../gaminghub.css';

// Carte premium "🎮 Gaming Hub" — utilisée sur la home marketplace (carte
// complète) et en bandeau compact sur PlayHomePage (accès très visible
// depuis iFilino Play). Design sombre dégradé cyan/magenta volontairement
// distinct du thème marketplace, cohérent avec l'identité iFilino Play.
export default function GamingHubPromoCard({ compact = false }) {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div className={`gh-promo-card${compact ? ' compact' : ''}`}>
      <div>
        <p className="kicker"><Gamepad2 size={compact ? 18 : 22} /> {t('gaminghub.promo.title')}</p>
        <p>{t('gaminghub.promo.description')}</p>
      </div>
      <button type="button" className="gh-promo-cta" onClick={() => navigate('/gaming')}>
        {t('gaminghub.promo.cta')} <ArrowRight size={16} />
      </button>
    </div>
  );
}
