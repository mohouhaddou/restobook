import React, { useEffect, useMemo, useRef, useState } from 'react';
import { API, ASSET } from '../../../../api';

const emptyStats = { avg_rating: 0, total_reviews: 0, rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
const token = () => (typeof window === 'undefined' ? null : localStorage.getItem('rb_customer_token'));

function authHeaders(extra = {}) {
  const t = token();
  return t ? { ...extra, Authorization: `Bearer ${t}` } : extra;
}

function initials(name = '') {
  return String(name || 'Utilisateur Ifilino')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'IF';
}

function Stars({ value, interactive = false, onChange, size = 'md' }) {
  const numeric = Number(value || 0);
  const rounded = Math.round(numeric);
  const className = `if-review-stars if-review-stars--${size}`;

  return (
    <span className={className} aria-label={`${numeric.toFixed(1)} sur 5`}>
      {[1, 2, 3, 4, 5].map(star => {
        const active = star <= rounded;
        if (!interactive) return <span key={star} aria-hidden="true" className={active ? 'is-active' : ''}>★</span>;
        return (
          <button key={star} type="button" onClick={() => onChange(star)} aria-label={`${star} etoile${star > 1 ? 's' : ''}`} className={active ? 'is-active' : ''}>
            ★
          </button>
        );
      })}
    </span>
  );
}

function RatingHistogram({ stats }) {
  const dist = stats.rating_distribution || emptyStats.rating_distribution;
  const total = Math.max(0, Number(stats.total_reviews || 0));

  return (
    <div className="if-review-histogram" aria-label="Repartition des notes">
      {[5, 4, 3, 2, 1].map(rating => {
        const count = Number(dist[rating] || 0);
        const percent = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={rating} className="if-review-histogram__row">
            <span className="if-review-histogram__label">{rating}</span>
            <span className="if-review-histogram__track">
              <span className="if-review-histogram__fill" style={{ width: `${percent}%` }} />
            </span>
            <span className="if-review-histogram__count">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

function ReviewForm({ businessId, onCreated }) {
  const fileRef = useRef(null);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const previews = useMemo(() => files.map(file => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach(p => URL.revokeObjectURL(p.url)), [previews]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!token()) return setError('Connectez-vous pour publier un avis.');
    if (rating < 1 || rating > 5) return setError('Choisissez une note entre 1 et 5.');
    if (!comment.trim()) return setError('Le commentaire est obligatoire.');

    setSubmitting(true);
    try {
      const response = await fetch(API('/reviews'), {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ business_id: businessId, rating, title, comment }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Publication impossible');

      if (files.length > 0) {
        const form = new FormData();
        files.forEach(file => form.append('photos', file));
        await fetch(API(`/reviews/${data.review.id}/photos`), { method: 'POST', headers: authHeaders(), body: form });
      }

      setRating(0);
      setTitle('');
      setComment('');
      setFiles([]);
      if (fileRef.current) fileRef.current.value = '';
      onCreated?.();
    } catch (err) {
      setError(err.message || 'Erreur lors de la publication.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="if-review-form">
      <div className="if-review-form__header">
        <div>
          <h3>Votre avis</h3>
          <p>Partagez une experience utile pour les prochains clients.</p>
        </div>
        <Stars value={rating} interactive onChange={setRating} size="lg" />
      </div>
      <label className="if-review-field">
        <span>Titre</span>
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={191} placeholder="Ex. Tres bonne adresse" />
      </label>
      <label className="if-review-field">
        <span>Commentaire</span>
        <textarea value={comment} onChange={e => setComment(e.target.value)} required minLength={3} rows={4} placeholder="Qualite, accueil, livraison, prix..." />
      </label>
      <div className="if-review-upload">
        <input ref={fileRef} id={`review-photos-${businessId}`} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={e => setFiles(Array.from(e.target.files || []).slice(0, 8))} />
        <label htmlFor={`review-photos-${businessId}`}>Ajouter des photos</label>
        <span>{files.length ? `${files.length} photo${files.length > 1 ? 's' : ''}` : 'JPG, PNG, WebP ou GIF'}</span>
      </div>
      {previews.length > 0 && (
        <div className="if-review-previews">
          {previews.map(({ file, url }) => <img key={`${file.name}-${file.size}`} src={url} alt="Apercu" />)}
        </div>
      )}
      {error && <p role="alert" className="if-review-error">{error}</p>}
      <button type="submit" disabled={submitting} className="if-review-submit">
        {submitting ? 'Publication...' : 'Publier mon avis'}
      </button>
    </form>
  );
}

function ReviewCard({ review, onChanged }) {
  async function vote() {
    if (!token()) return;
    const response = await fetch(API(`/reviews/${review.id}/vote`), {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ type: 'helpful' }),
    });
    if (response.ok) onChanged?.();
  }

  async function report() {
    if (!token()) return;
    const reason = window.prompt('Pourquoi signalez-vous cet avis ?');
    if (!reason) return;
    const response = await fetch(API(`/reviews/${review.id}/report`), {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ reason }),
    });
    if (response.ok) onChanged?.();
  }

  const userName = review.user?.name || 'Utilisateur Ifilino';

  return (
    <article className="if-review-card">
      <div className="if-review-card__top">
        {review.user?.avatar_url ? (
          <img src={ASSET(review.user.avatar_url)} alt="" className="if-review-avatar" />
        ) : (
          <span aria-hidden="true" className="if-review-avatar if-review-avatar--fallback">{initials(userName)}</span>
        )}
        <div className="if-review-card__meta">
          <div className="if-review-card__name">{userName}</div>
          <div className="if-review-card__line">
            <Stars value={review.rating} size="sm" />
            <time dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString('fr-FR')}</time>
            {review.verified && <span className="if-review-badge">Verifie</span>}
          </div>
        </div>
      </div>
      {review.title && <h3 className="if-review-card__title">{review.title}</h3>}
      <p className="if-review-card__comment">{review.comment}</p>
      {review.photos?.length > 0 && (
        <div className="if-review-photos">
          {review.photos.map(photo => <img key={photo.id} src={ASSET(photo.image_url)} alt="Photo de l'avis" loading="lazy" />)}
        </div>
      )}
      {review.business_reply && (
        <div className="if-review-reply">
          <strong>Reponse du professionnel</strong>
          <p>{review.business_reply.reply}</p>
        </div>
      )}
      <div className="if-review-actions">
        <button type="button" onClick={vote} className={review.my_vote === 'helpful' ? 'is-active' : ''}>Avis utile <span>{review.helpful_count || 0}</span></button>
        <button type="button" onClick={report}>Signaler</button>
      </div>
    </article>
  );
}

function ReviewsSkeleton() {
  return (
    <div className="if-review-skeleton" aria-label="Chargement des avis">
      <span />
      <span />
      <span />
    </div>
  );
}

export default function BusinessReviewsSection({ businessId }) {
  const [stats, setStats] = useState(emptyStats);
  const [reviews, setReviews] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load(nextPage = page) {
    if (!businessId) return;
    setLoading(true);
    try {
      const [statsRes, reviewsRes] = await Promise.all([
        fetch(API(`/business/${businessId}/reviews/stats`)),
        fetch(API(`/business/${businessId}/reviews?page=${nextPage}&limit=8`)),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (reviewsRes.ok) {
        const data = await reviewsRes.json();
        setReviews(data.reviews || []);
        setPagination(data.pagination || null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(1); }, [businessId]);

  const avg = Number(stats.avg_rating || 0);
  const total = Number(stats.total_reviews || 0);

  return (
    <section className="if-reviews" aria-labelledby="business-reviews-title">
      <style>{`
        .if-reviews{--review-ink:var(--il-text,#0F172A);--review-muted:var(--il-muted,#64748B);--review-border:var(--il-border,#E2E8F0);--review-soft:#FFF7ED;--review-brand:var(--il-primary,#FF8A00);--review-brand-dark:var(--il-primary-dark,#E67200);margin-top:40px;font-family:var(--il-font,inherit)}
        .if-review-shell{border:1px solid rgba(226,232,240,.9);border-radius:8px;background:linear-gradient(180deg,#FFFFFF 0%,#FFFDF9 100%);box-shadow:0 18px 48px rgba(15,23,42,.08);overflow:hidden}
        .if-review-hero{display:grid;grid-template-columns:minmax(220px,.8fr) minmax(260px,1.2fr) auto;gap:24px;align-items:center;padding:24px;border-bottom:1px solid var(--review-border);background:radial-gradient(circle at 12% 8%,rgba(255,138,0,.14),transparent 32%),linear-gradient(135deg,#FFFFFF 0%,#FFF7ED 58%,#FFFFFF 100%)}
        .if-review-title h2{margin:0;color:var(--review-ink);font-size:clamp(24px,3vw,34px);line-height:1.05;letter-spacing:0}.if-review-title p{margin:8px 0 0;color:var(--review-muted);line-height:1.55;max-width:42rem}
        .if-review-score{display:grid;gap:6px}.if-review-score strong{color:var(--review-ink);font-size:clamp(42px,7vw,66px);line-height:.95;letter-spacing:0}.if-review-score span{color:var(--review-muted);font-size:14px;font-weight:700}
        .if-review-cta,.if-review-submit{min-height:46px;border:0;border-radius:8px;background:linear-gradient(135deg,var(--review-ink),#223047);color:#FFFFFF;padding:0 18px;font-weight:800;cursor:pointer;box-shadow:0 12px 28px rgba(15,23,42,.22);transition:transform 160ms ease,box-shadow 160ms ease,opacity 160ms ease}.if-review-cta:hover,.if-review-submit:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 16px 32px rgba(15,23,42,.26)}.if-review-cta:active,.if-review-submit:active:not(:disabled){transform:translateY(0) scale(.98)}.if-review-submit:disabled{cursor:not-allowed;opacity:.62}
        .if-review-histogram{display:grid;gap:9px;min-width:250px}.if-review-histogram__row{display:grid;grid-template-columns:24px minmax(96px,1fr) 34px;gap:10px;align-items:center;color:var(--review-muted);font-size:13px;font-weight:700}.if-review-histogram__label::after{content:"★";margin-left:3px;color:var(--review-brand)}.if-review-histogram__track{height:10px;border-radius:999px;background:rgba(226,232,240,.92);overflow:hidden}.if-review-histogram__fill{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--review-brand),#FF3B30);min-width:0;transition:width 300ms ease}.if-review-histogram__count{text-align:right;font-variant-numeric:tabular-nums}
        .if-review-stars{display:inline-flex;align-items:center;gap:3px;color:#CBD5E1;line-height:1}.if-review-stars--sm{font-size:14px}.if-review-stars--md{font-size:18px}.if-review-stars--lg{font-size:26px}.if-review-stars .is-active{color:var(--review-brand);text-shadow:0 4px 12px rgba(255,138,0,.25)}.if-review-stars button{width:38px;height:38px;display:inline-grid;place-items:center;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;line-height:1;cursor:pointer;transition:background 150ms ease,transform 150ms ease}.if-review-stars button:hover{background:var(--review-soft);transform:translateY(-1px)}
        .if-review-form{display:grid;gap:14px;margin:18px 24px 0;padding:18px;border:1px solid rgba(255,138,0,.22);border-radius:8px;background:#FFFFFF;box-shadow:0 14px 36px rgba(15,23,42,.07)}.if-review-form__header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap}.if-review-form h3{margin:0;color:var(--review-ink);font-size:18px}.if-review-form p{margin:4px 0 0;color:var(--review-muted);line-height:1.5}
        .if-review-field{display:grid;gap:7px;color:var(--review-ink);font-weight:800;font-size:13px}.if-review-field input,.if-review-field textarea{width:100%;border:1px solid var(--review-border);border-radius:8px;background:#FFFFFF;color:var(--review-ink);font:inherit;font-weight:500;outline:none;transition:border-color 150ms ease,box-shadow 150ms ease}.if-review-field input{min-height:46px;padding:0 13px}.if-review-field textarea{padding:12px 13px;resize:vertical;line-height:1.55}.if-review-field input:focus,.if-review-field textarea:focus{border-color:var(--review-brand);box-shadow:0 0 0 4px rgba(255,138,0,.13)}
        .if-review-upload{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.if-review-upload input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}.if-review-upload label,.if-review-actions button,.if-review-pagination button{min-height:42px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--review-border);border-radius:8px;background:#FFFFFF;color:var(--review-ink);padding:0 13px;font-weight:800;cursor:pointer;transition:border-color 150ms ease,background 150ms ease,transform 150ms ease}.if-review-upload label:hover,.if-review-actions button:hover,.if-review-pagination button:hover:not(:disabled){border-color:rgba(255,138,0,.55);background:var(--review-soft)}.if-review-upload span{color:var(--review-muted);font-size:13px}
        .if-review-previews,.if-review-photos{display:flex;gap:10px;overflow-x:auto;padding-bottom:2px}.if-review-previews img{width:76px;height:76px;object-fit:cover;border-radius:8px;border:1px solid var(--review-border)}.if-review-error{margin:0;padding:10px 12px;border-radius:8px;background:var(--il-danger-light,rgba(239,68,68,.12));color:#991B1B;font-weight:700}
        .if-review-list{display:grid;gap:14px;padding:20px 24px 24px}.if-review-card{display:grid;gap:12px;padding:18px;border:1px solid rgba(226,232,240,.95);border-radius:8px;background:#FFFFFF;box-shadow:0 10px 28px rgba(15,23,42,.06)}.if-review-card__top{display:flex;gap:12px;align-items:center;min-width:0}.if-review-avatar{width:48px;height:48px;border-radius:50%;object-fit:cover;flex:0 0 auto}.if-review-avatar--fallback{display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#111827,#334155);color:#FFFFFF;font-weight:900;letter-spacing:0}.if-review-card__meta{min-width:0}.if-review-card__name{color:var(--review-ink);font-weight:900}.if-review-card__line{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-top:5px;color:var(--review-muted);font-size:13px}
        .if-review-badge{border-radius:999px;background:var(--il-success-light,rgba(34,197,94,.12));color:#166534;padding:4px 8px;font-size:12px;font-weight:900}.if-review-card__title{margin:0;color:var(--review-ink);font-size:18px;line-height:1.25;letter-spacing:0}.if-review-card__comment{margin:0;color:#334155;line-height:1.7}.if-review-photos img{width:128px;height:94px;border-radius:8px;object-fit:cover;flex:0 0 auto;border:1px solid var(--review-border)}
        .if-review-reply{border-left:3px solid var(--review-brand);border-radius:8px;background:#FFF7ED;padding:12px 14px}.if-review-reply strong{color:var(--review-ink)}.if-review-reply p{margin:6px 0 0;color:#334155;line-height:1.55}.if-review-actions{display:flex;gap:10px;flex-wrap:wrap}.if-review-actions button span{margin-left:6px;color:var(--review-brand-dark);font-variant-numeric:tabular-nums}.if-review-actions button.is-active{border-color:rgba(255,138,0,.55);background:var(--review-soft)}
        .if-review-empty{display:grid;gap:8px;justify-items:center;padding:34px 18px;border:1px dashed var(--review-border);border-radius:8px;color:var(--review-muted);text-align:center;background:#FFFFFF}.if-review-empty strong{color:var(--review-ink);font-size:17px}.if-review-skeleton{display:grid;gap:12px}.if-review-skeleton span{height:92px;border-radius:8px;background:linear-gradient(90deg,#F1F5F9,#FFFFFF,#F1F5F9);background-size:220% 100%;animation:if-review-shimmer 1200ms infinite linear}.if-review-pagination{display:flex;gap:8px;justify-content:flex-end;padding:0 24px 24px}.if-review-pagination button:disabled{opacity:.45;cursor:not-allowed}
        @keyframes if-review-shimmer{to{background-position:-220% 0}}@media(max-width:900px){.if-review-hero{grid-template-columns:1fr;align-items:stretch}.if-review-cta{width:100%}}@media(max-width:560px){.if-review-hero,.if-review-list{padding:18px}.if-review-form{margin:14px 18px 0;padding:16px}.if-review-score strong{font-size:48px}.if-review-histogram{min-width:0}.if-review-card{padding:15px}.if-review-pagination{padding:0 18px 20px}}@media(prefers-reduced-motion:reduce){.if-review-cta,.if-review-submit,.if-review-histogram__fill,.if-review-stars button,.if-review-actions button,.if-review-pagination button{transition:none}.if-review-skeleton span{animation:none}}
      `}</style>
      <div className="if-review-shell">
        <div className="if-review-hero">
          <div className="if-review-score">
            <strong>{avg.toFixed(1)}</strong>
            <Stars value={avg} size="md" />
            <span>{total} avis client{total > 1 ? 's' : ''}</span>
          </div>
          <div className="if-review-title">
            <h2 id="business-reviews-title">Avis clients</h2>
            <p>Des retours publics pour comparer l'accueil, la qualite et l'experience avant de commander ou reserver.</p>
          </div>
          <button type="button" onClick={() => setShowForm(v => !v)} className="if-review-cta">{showForm ? 'Fermer' : 'Ecrire un avis'}</button>
          <RatingHistogram stats={stats} />
        </div>
        {showForm && <ReviewForm businessId={businessId} onCreated={() => { setShowForm(false); load(1); }} />}
        <div className="if-review-list">
          {loading && <ReviewsSkeleton />}
          {!loading && reviews.length === 0 && (
            <div className="if-review-empty">
              <strong>Aucun avis pour le moment</strong>
              <span>Soyez le premier a partager une experience utile.</span>
            </div>
          )}
          {!loading && reviews.map(review => <ReviewCard key={review.id} review={review} onChanged={() => load(page)} />)}
        </div>
        {pagination?.pages > 1 && (
          <div className="if-review-pagination">
            <button type="button" disabled={page <= 1} onClick={() => { const next = page - 1; setPage(next); load(next); }}>Precedent</button>
            <button type="button" disabled={page >= pagination.pages} onClick={() => { const next = page + 1; setPage(next); load(next); }}>Suivant</button>
          </div>
        )}
      </div>
    </section>
  );
}
