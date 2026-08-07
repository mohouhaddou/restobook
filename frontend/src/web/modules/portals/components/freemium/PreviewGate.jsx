import React from 'react';
import { BookOpenCheck, Crown, Download, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import './preview-gate.css';

const COPY = {
  fr: { eyebrow: 'Aperçu terminé', title: 'Continue l’aventure avec Premium', description: 'Débloque la suite de cette publication et profite de toute la bibliothèque iFilino Kids.', benefits: ['Toutes les publications Premium', 'Lecture complète sans interruption', 'Ressources éducatives à télécharger'], action: "S'abonner", illustration: 'Contenu Premium verrouillé' },
  en: { eyebrow: 'Preview complete', title: 'Continue the adventure with Premium', description: 'Unlock the rest of this publication and enjoy the entire iFilino Kids library.', benefits: ['All Premium publications', 'Complete, uninterrupted reading', 'Downloadable learning resources'], action: 'Subscribe', illustration: 'Premium content locked' },
  ar: { eyebrow: 'انتهت المعاينة', title: 'واصل المغامرة مع Premium', description: 'افتح بقية هذا المحتوى واستمتع بمكتبة iFilino Kids كاملة.', benefits: ['كل منشورات Premium', 'قراءة كاملة دون انقطاع', 'موارد تعليمية قابلة للتنزيل'], action: 'اشترك الآن', illustration: 'محتوى Premium مقفل' },
};

/** Frontière visuelle réutilisable. La sécurité reste assurée par l'API. */
export default function PreviewGate({ language = 'en', section = 'learn', subscribeTo }) {
  const copy = COPY[language] || COPY.en;
  const target = subscribeTo || ('/kids/' + language + '/premium');
  return (
    <section className={`preview-gate preview-gate--${section}`} aria-labelledby="preview-gate-title">
      <div className="preview-gate__illustration" role="img" aria-label={copy.illustration}>
        <span className="preview-gate__orbit preview-gate__orbit--one" aria-hidden="true"><Sparkles /></span>
        <span className="preview-gate__orbit preview-gate__orbit--two" aria-hidden="true"><BookOpenCheck /></span>
        <span className="preview-gate__crown" aria-hidden="true"><Crown /></span>
      </div>
      <div className="preview-gate__content">
        <span className="preview-gate__eyebrow">{copy.eyebrow}</span>
        <h2 id="preview-gate-title">{copy.title}</h2>
        <p>{copy.description}</p>
        <ul>{copy.benefits.map((benefit, index) => <li key={benefit}>{index === 2 ? <Download aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}<span>{benefit}</span></li>)}</ul>
        <Link className="preview-gate__action" to={target}><Crown aria-hidden="true" />{copy.action}</Link>
      </div>
    </section>
  );
}
