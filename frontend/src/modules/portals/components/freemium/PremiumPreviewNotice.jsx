import React from 'react';
import { LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';

const COPY = {
  en: { title: 'Premium preview', text: 'Sign in to continue reading the full publication.', action: 'Sign in to continue' },
  fr: { title: 'Aperçu Premium', text: 'Connectez-vous pour continuer et lire la publication complète.', action: 'Se connecter pour continuer' },
  ar: { title: 'معاينة مميزة', text: 'سجّل الدخول لمتابعة قراءة المنشور كاملاً.', action: 'تسجيل الدخول للمتابعة' },
};
export default function PremiumPreviewNotice({ item, language = 'en' }) {
  if (!item?.access?.isPreview) return null;
  const copy = COPY[language] || COPY.en;
  return <aside className="premium-preview-notice" aria-labelledby="premium-preview-title" role="note">
    <LockKeyhole aria-hidden="true" />
    <div><strong id="premium-preview-title">{item.premiumBadge || copy.title}</strong><p>{copy.text}</p></div>
    <Link to={`/kids/${language}/login`}>{copy.action}</Link>
  </aside>;
}
