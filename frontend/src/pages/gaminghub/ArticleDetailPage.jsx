import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, Gamepad2 } from 'lucide-react';
import { API } from '../../api';
import { useI18n } from '../../i18n/config';
import ShareButtons from '../../shared/components/social/ShareButtons';
import { ARTICLE_TYPE_COLORS } from '../../modules/gaminghub/articleTypeColors';
import '../../modules/gaminghub/gaminghub.css';

// Article éditorial Gaming Hub — le corps est rendu en HTML côté backend
// (marked), voir gaminghub/articleService.getArticleBySlug. Réutilise le
// thème/chrome iFilino Play (.play-page, wrapped in PlayChrome).
export default function ArticleDetailPage() {
  const { slug } = useParams();
  const { t, formatDate } = useI18n();
  const [state, setState] = useState({ loading: true, article: null, relatedGames: [] });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, article: null, relatedGames: [] });
    fetch(API(`/gaminghub/articles/${slug}`))
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(data => { if (!cancelled) setState({ loading: false, article: data.article, relatedGames: data.relatedGames || [] }); })
      .catch(() => { if (!cancelled) setState({ loading: false, article: null, relatedGames: [] }); });
    return () => { cancelled = true; };
  }, [slug]);

  if (state.loading) {
    return (
      <div className="play-page">
        <main className="play-container play-route-skeleton" aria-busy="true">
          <span className="play-skeleton-hero" /><span className="play-skeleton-line wide" /><span className="play-skeleton-line" />
        </main>
      </div>
    );
  }

  if (!state.article) {
    return (
      <div className="play-page">
        <main className="play-container">
          <div className="gh-empty-state"><Gamepad2 size={40} /><strong>{t('gaminghub.articleNotFound')}</strong></div>
        </main>
      </div>
    );
  }

  const { article, relatedGames } = state;
  const color = ARTICLE_TYPE_COLORS[article.article_type] || '#22C3FF';

  return (
    <div className="play-page">
      <main className="play-container" style={{ maxWidth: 820 }}>
        <nav className="play-details-breadcrumb" aria-label="Fil d'Ariane">
          <a href="/gaming/articles"><ChevronLeft size={16} /> {t('gaminghub.breadcrumb.gaming')}</a>
          <span>/</span>
          <span>{article.title}</span>
        </nav>

        {article.cover_image_url && (
          <img src={article.cover_image_url} alt={article.title} style={{ width: '100%', height: 320, objectFit: 'cover', borderRadius: 20, marginBottom: 20 }} />
        )}

        <span className="gh-badge-type" style={{ background: color }}>{t(`gaminghub.type.${article.article_type}`)}</span>
        <h1 style={{ margin: '10px 0 8px', fontSize: 'clamp(24px,3.6vw,36px)', color: 'var(--il-text)' }}>{article.title}</h1>
        {article.published_at && <p style={{ margin: '0 0 20px', color: 'var(--il-muted)', fontSize: 13 }}>{formatDate(article.published_at)}</p>}

        {/* eslint-disable-next-line react/no-danger -- Markdown déjà rendu et échappé côté backend (marked), voir articleService.getArticleBySlug */}
        <div className="gh-article-body" dangerouslySetInnerHTML={{ __html: article.body_html }} />

        {relatedGames.length > 0 && (
          <section className="gh-section">
            <h2>{t('gaminghub.section.gamesInThisArticle')}</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {relatedGames.map(g => (
                <a key={g.slug} href={`/gaming/${g.slug}`} className="play-widget-card" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', padding: '10px 16px' }}>
                  {g.cover_image_url && <img src={g.cover_image_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />}
                  <strong style={{ color: 'var(--il-text)', fontSize: 13 }}>{g.name}</strong>
                </a>
              ))}
            </div>
          </section>
        )}

        {Array.isArray(article.faq) && article.faq.length > 0 && (
          <section className="gh-section">
            <h2>{t('gaminghub.section.faq')}</h2>
            <div className="gh-faq-list">
              {article.faq.map((f, i) => <details key={i} className="gh-faq-item"><summary>{f.question}</summary><p>{f.answer}</p></details>)}
            </div>
          </section>
        )}

        <section className="gh-section">
          <h2>{t('gaminghub.section.share')}</h2>
          <ShareButtons title={article.title} />
        </section>
      </main>
    </div>
  );
}
