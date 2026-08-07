import React, { useEffect, useState } from 'react';
import { ArrowRight, CircleCheck, Clock3, Heart, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ASSET } from '../../../shared/services/api';
import './premium-library.css';

const COPY = {
  en: { open: 'Open', favorite: 'Add to favorites', remove: 'Remove from favorites', premium: 'Premium', free: 'Free' },
  fr: { open: 'Découvrir', favorite: 'Ajouter aux favoris', remove: 'Retirer des favoris', premium: 'Premium', free: 'Gratuit' },
  ar: { open: 'استكشف', favorite: 'أضف إلى المفضلة', remove: 'إزالة من المفضلة', premium: 'مميز', free: 'مجاني' },
};

function storageKey(item) { return `ifilino:kids:favorite:${item.type || 'content'}:${item.slug}`; }

export default function KidsLibraryCard({ item, language }) {
  const copy = COPY[language] || COPY.en;
  const metadata = item.metadata || {};
  const image = item.image_url || item.thumbnailUrl || item.coverImageUrl;
  const duration = item.estimatedDurationMinutes || metadata.readingMinutes || metadata.duration;
  const age = item.age || metadata.ageRange || metadata.age;
  const difficulty = item.difficulty || metadata.difficulty;
  const premium = Boolean(item.isPremium || item.premium || metadata.premium);
  const progress = Number(item.progress?.percent ?? item.progressPercent ?? 0);
  const href = item.type === 'stories'
    ? `/kids/${language}/book/${item.slug}`
    : item.type === 'learn' || item.subject
      ? `/kids/${language}/learn/${item.slug}`
      : `/kids/${language}/content/${item.slug}`;
  const [favorite, setFavorite] = useState(false);
  useEffect(() => {
    try { setFavorite(localStorage.getItem(storageKey(item)) === '1'); } catch {}
  }, [item]);
  const toggleFavorite = event => {
    event.preventDefault();
    event.stopPropagation();
    const next = !favorite;
    setFavorite(next);
    try { next ? localStorage.setItem(storageKey(item), '1') : localStorage.removeItem(storageKey(item)); } catch {}
  };
  return <article className="kids-library-card">
    <button type="button" className="kids-library-favorite" onClick={toggleFavorite} aria-label={favorite ? copy.remove : copy.favorite} aria-pressed={favorite}><Heart size={18} fill={favorite ? 'currentColor' : 'none'}/></button>
    <Link to={href} className="kids-library-card-link" aria-label={`${copy.open}: ${item.title}`}>
      <div className="kids-library-cover">
        {image ? <img src={ASSET(image)} alt={(item.title || '') + ' — ' + (item.subject || item.category || 'iFilino Kids')} loading="lazy" decoding="async" width="640" height="360"/> : <div className="kids-library-placeholder" aria-hidden="true">{(item.title || '?').slice(0,1)}</div>}
        <div className="kids-library-badges">
          {age && <span>{age}</span>}{difficulty && <span>{difficulty}</span>}
          {premium ? <span className="premium freemium-badge"><LockKeyhole size={12} aria-hidden="true"/>{item.premiumBadge || copy.premium}</span> : <span className="free freemium-badge"><CircleCheck size={12} aria-hidden="true"/>{copy.free}</span>}
        </div>
        {progress > 0 && <div className="kids-library-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}><span style={{ width: `${Math.min(100, progress)}%` }}/></div>}
      </div>
      <div className="kids-library-body">
        <div className="kids-library-meta">{duration && <span><Clock3 size={14}/>{duration} min</span>}{(item.subject || item.category) && <span>{item.subject || item.category}</span>}</div>
        <h3>{item.title}</h3>
        {(item.excerpt || item.summary) && <p>{item.excerpt || item.summary}</p>}
        <span className="kids-library-action">{copy.open}<ArrowRight size={16}/></span>
      </div>
    </Link>
  </article>;
}
