import React from 'react';
import { Clock3, Flame, Layers, Newspaper, Rocket, TrendingUp, Wrench } from 'lucide-react';
import { useI18n } from '../../../i18n/config';
import { useGamingHubHome } from '../../modules/gaminghub/hooks/useGamingHubHome';
import GamingHubHero from '../../modules/gaminghub/components/GamingHubHero';
import GamingRail from '../../modules/gaminghub/components/GamingRail';
import GamingCard from '../../modules/gaminghub/components/GamingCard';
import ArticleCard from '../../modules/gaminghub/components/ArticleCard';
import SimilarGamesGrid from '../../modules/gaminghub/components/SimilarGamesGrid';
import '../../modules/gaminghub/gaminghub.css';

export default function GamingHubHomePage() {
  const { t } = useI18n();
  const {
    loading, heroGames, gameCount, popular, upcoming, news, guides,
    collections, trending, updates, similar,
  } = useGamingHubHome();

  if (loading) {
    return (
      <div className="play-page">
        <main className="play-container play-route-skeleton" aria-busy="true">
          <span className="play-skeleton-hero" />
          <span className="play-skeleton-line wide" />
          <div className="play-skeleton-grid">{Array.from({ length: 6 }, (_, i) => <span key={i} />)}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="play-page">
      <GamingHubHero gameCount={gameCount} heroGames={heroGames} />

      <div className="play-container">
        <GamingRail
          id="popular" icon={Flame} title={t('gaminghub.home.popular')}
          items={popular} renderItem={g => <GamingCard key={g.slug} game={g} />}
          seeAllHref="/gaming/jeux" seeAllLabel={t('gaminghub.home.seeAll')}
        />

        <GamingRail
          id="news" icon={Newspaper} title={t('gaminghub.home.news')}
          items={news} renderItem={a => <ArticleCard key={a.slug} article={a} />}
          seeAllHref="/gaming/actualites" seeAllLabel={t('gaminghub.home.seeAll')}
        />

        <GamingRail
          id="guides" icon={Layers} title={t('gaminghub.home.guides')}
          items={guides} renderItem={a => <ArticleCard key={a.slug} article={a} />}
          seeAllHref="/gaming/guides" seeAllLabel={t('gaminghub.home.seeAll')}
        />

        {updates.length > 0 && (
          <section className="gh-section" aria-labelledby="gh-updates-title">
            <h2 id="gh-updates-title"><Wrench size={20} />{t('gaminghub.home.updates')}</h2>
            <div className="gh-update-list">
              {updates.map((u, i) => (
                <article key={i} className="gh-update-item">
                  <span className="version">{u.version || 'MAJ'}</span>
                  <div>
                    <a href={`/gaming/${u.gameSlug}`} className="game-link">{u.gameName}</a>
                    <h3>{u.title}</h3>
                    {u.body && <p>{u.body}</p>}
                    <time>{new Date(u.released_at).toLocaleDateString()}</time>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {upcoming.length > 0 && (
          <GamingRail
            id="upcoming" icon={Rocket} title={t('gaminghub.home.upcoming')}
            items={upcoming} renderItem={g => <GamingCard key={g.slug} game={g} />}
            seeAllHref="/gaming/jeux" seeAllLabel={t('gaminghub.home.seeAll')}
          />
        )}

        <GamingRail
          id="trending" icon={TrendingUp} title={t('gaminghub.home.trending')}
          items={trending} renderItem={a => <ArticleCard key={a.slug} article={a} />}
          seeAllHref="/gaming/articles" seeAllLabel={t('gaminghub.home.seeAll')}
        />

        <GamingRail
          id="collections" icon={Clock3} title={t('gaminghub.home.collections')}
          items={collections} renderItem={a => <ArticleCard key={a.slug} article={a} />}
          seeAllHref="/gaming/articles?type=collection" seeAllLabel={t('gaminghub.home.seeAll')}
        />

        {similar.anchorGame && similar.games.length > 0 && (
          <SimilarGamesGrid gameName={similar.anchorGame.name} games={similar.games} />
        )}
      </div>
    </div>
  );
}
