import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  BookOpen, Calendar, ChevronLeft, Gamepad2, Layers, Newspaper, Play, Sparkles, Tag, Wrench,
} from 'lucide-react';
import { API } from '../../../api';
import { useI18n } from '../../../i18n/config';
import GamingRail from '../../modules/gaminghub/components/GamingRail';
import ArticleCard from '../../modules/gaminghub/components/ArticleCard';
import SimilarGamesGrid from '../../modules/gaminghub/components/SimilarGamesGrid';
import ShareButtons from '../../../shared/components/social/ShareButtons';
import '../../modules/gaminghub/gaminghub.css';

function useGameProfile(slug) {
  const [state, setState] = useState({ loading: true, game: null, similarGames: [], relatedArticles: [] });

  useEffect(() => {
    let cancelled = false;
    setState(s => ({ ...s, loading: true }));

    Promise.all([
      fetch(API(`/gaminghub/games/${slug}`)).then(r => (r.ok ? r.json() : Promise.reject(r.status))),
      fetch(API(`/gaminghub/games/${slug}/similar?limit=15`)).then(r => (r.ok ? r.json() : { games: [] })).catch(() => ({ games: [] })),
      fetch(API('/gaminghub/articles?limit=40')).then(r => (r.ok ? r.json() : { articles: [] })).catch(() => ({ articles: [] })),
    ])
      .then(([gameRes, similarRes, articlesRes]) => {
        if (cancelled) return;
        setState({
          loading: false,
          game: gameRes.game,
          similarGames: similarRes.games || [],
          // related_game_ids n'est pas exposé sur les cartes de liste (voir
          // articleService.CARD_ATTRIBUTES côté backend) : on ne peut donc pas
          // filtrer les articles par jeu sans un appel détail par article (non
          // scalable). On affiche à la place les actualités/guides Gaming Hub
          // les plus récents (libellés honnêtes, pas "articles sur ce jeu").
          relatedArticles: (articlesRes.articles || []).slice(0, 8),
        });
      })
      .catch(() => { if (!cancelled) setState({ loading: false, game: null, similarGames: [], relatedArticles: [] }); });

    return () => { cancelled = true; };
  }, [slug]);

  return state;
}

export default function GameProfilePage() {
  const { slug } = useParams();
  const { t } = useI18n();
  const { loading, game, similarGames, relatedArticles } = useGameProfile(slug);

  if (loading) {
    return (
      <div className="play-page">
        <main className="play-container play-route-skeleton" aria-busy="true">
          <span className="play-skeleton-hero" />
          <span className="play-skeleton-line wide" /><span className="play-skeleton-line" />
        </main>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="play-page">
        <main className="play-container">
          <div className="gh-empty-state">
            <Gamepad2 size={40} />
            <strong>{t('gaminghub.notFound')}</strong>
          </div>
        </main>
      </div>
    );
  }

  const news = relatedArticles.filter(a => a.article_type === 'actualite').slice(0, 4);
  const guides = relatedArticles.filter(a => a.article_type === 'guide').slice(0, 4);

  return (
    <div className="play-page">
      <main className="play-container">
        <nav className="play-details-breadcrumb" aria-label="Fil d'Ariane">
          <a href="/gaming"><ChevronLeft size={16} /> {t('gaminghub.breadcrumb.gaming')}</a>
          <span>/</span>
          <span>{game.name}</span>
        </nav>

        {/* ── Hero fiche jeu ── */}
        <section style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', marginBottom: 24, minHeight: 280, display: 'flex', alignItems: 'flex-end', background: 'linear-gradient(135deg,#0f1b2d,#162b45 58%,#2a1240)' }}>
          {game.cover_image_url && (
            <img src={game.cover_image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: .55 }} />
          )}
          <div style={{ position: 'relative', zIndex: 2, padding: 'clamp(20px,4vw,40px)', color: '#fff', width: '100%', background: 'linear-gradient(transparent, rgba(7,14,24,.85) 60%)' }}>
            {game.category?.label && <span className="play-catalog-kicker"><Sparkles size={14} /> {game.category.label}</span>}
            <h1 style={{ margin: '8px 0 6px', fontSize: 'clamp(26px,4vw,44px)' }}>{game.name}</h1>
            <p style={{ margin: 0, color: '#d7e1ed', fontSize: 14 }}>
              {game.genre}{game.publisher?.name ? ` · ${game.publisher.name}` : ''}{game.universe ? ` · ${game.universe}` : ''}
            </p>
          </div>
        </section>

        {/* ── Infos générales ── */}
        <div className="gh-info-grid">
          {game.category?.label && (
            <div className="play-stat-tile"><span className="label">{t('gaminghub.info.category')}</span><span className="value" style={{ fontSize: 15 }}>{game.category.label}</span></div>
          )}
          {game.difficulty && (
            <div className="play-stat-tile"><span className="label">{t('gaminghub.info.difficulty')}</span><span className="value" style={{ fontSize: 15 }}>{game.difficulty}</span></div>
          )}
          {game.view_mode && (
            <div className="play-stat-tile"><span className="label">{t('gaminghub.info.viewMode')}</span><span className="value" style={{ fontSize: 15 }}>{game.view_mode}</span></div>
          )}
          {game.release_date && (
            <div className="play-stat-tile"><span className="label">{t('gaminghub.info.releaseDate')}</span><span className="value" style={{ fontSize: 15 }}><Calendar size={14} style={{ verticalAlign: -2 }} /> {new Date(game.release_date).toLocaleDateString()}</span></div>
          )}
        </div>

        {game.description && (
          <section className="gh-section"><h2>{t('gaminghub.section.description')}</h2><p>{game.description}</p></section>
        )}
        {game.why_popular && (
          <section className="gh-section"><h2><Sparkles size={18} />{t('gaminghub.section.whyPopular')}</h2><p>{game.why_popular}</p></section>
        )}
        {game.gameplay && (
          <section className="gh-section"><h2><Gamepad2 size={18} />{t('gaminghub.section.gameplay')}</h2><p>{game.gameplay}</p></section>
        )}

        {game.gallery?.length > 0 && (
          <section className="gh-section">
            <h2>{t('gaminghub.section.gallery')}</h2>
            <div className="gh-gallery-thumbs">
              {game.gallery.map((url, i) => (
                <div key={i} className="gh-gallery-thumb"><img src={url} alt="" loading="lazy" /></div>
              ))}
            </div>
          </section>
        )}

        {game.tags?.length > 0 && (
          <section className="gh-section">
            <h2><Tag size={18} />{t('gaminghub.section.tags')}</h2>
            <div className="gh-tag-list">{game.tags.map(tag => <span key={tag} className="gh-tag">{tag}</span>)}</div>
          </section>
        )}

        {game.videos?.length > 0 && (
          <section className="gh-section">
            <h2>{t('gaminghub.section.videos')}</h2>
            <div className="gh-video-grid">
              {game.videos.map(v => (
                <div key={v.id} className="gh-video-embed">
                  <iframe src={`https://www.youtube.com/embed/${v.youtube_id}`} title={v.title || game.name} allowFullScreen />
                </div>
              ))}
            </div>
          </section>
        )}

        {game.updates?.length > 0 && (
          <section className="gh-section">
            <h2><Wrench size={18} />{t('gaminghub.section.updates')}</h2>
            <div className="gh-update-list">
              {game.updates.map(u => (
                <article key={u.id} className="gh-update-item">
                  <span className="version">{u.version || 'MAJ'}</span>
                  <div><h3>{u.title}</h3>{u.body && <p>{u.body}</p>}{u.released_at && <time>{new Date(u.released_at).toLocaleDateString()}</time>}</div>
                </article>
              ))}
            </div>
          </section>
        )}

        {game.faqs?.length > 0 && (
          <section className="gh-section">
            <h2>{t('gaminghub.section.faq')}</h2>
            <div className="gh-faq-list">
              {game.faqs.map(f => (
                <details key={f.id} className="gh-faq-item"><summary>{f.question}</summary><p>{f.answer}</p></details>
              ))}
            </div>
          </section>
        )}

        {news.length > 0 && (
          <GamingRail id="game-news" icon={Newspaper} title={t('gaminghub.section.gamingNews')} items={news} renderItem={a => <ArticleCard key={a.slug} article={a} />} pageSize={4} />
        )}
        {guides.length > 0 && (
          <GamingRail id="game-guides" icon={BookOpen} title={t('gaminghub.section.gamingGuides')} items={guides} renderItem={a => <ArticleCard key={a.slug} article={a} />} pageSize={4} />
        )}

        {similarGames.length > 0 && (
          <>
            <SimilarGamesGrid gameName={game.name} games={similarGames} />
            <div style={{ textAlign: 'center', margin: '20px 0 8px' }}>
              <a href="#gh-similar-rail" className="play-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                <Play size={16} fill="currentColor" /> {t('gaminghub.cta.playSimilar')}
              </a>
            </div>
          </>
        )}

        <section className="gh-section">
          <h2>{t('gaminghub.section.share')}</h2>
          <ShareButtons title={game.name} />
        </section>

        <p style={{ marginTop: 32, fontSize: 12, color: 'var(--il-muted)' }}>
          {t('gaminghub.disclaimer', { name: game.name })}
        </p>
      </main>
    </div>
  );
}
