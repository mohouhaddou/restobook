import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Heart, History as HistoryIcon, ShoppingBag, Sparkles, Flame, Trophy, Clock3, Target, Headphones, Palette, TrendingUp, Library, Star, UserRound, Languages, LogOut } from 'lucide-react';
import { useCustomerAuth } from '../../modules/marketplace/CustomerAuthContext';
import { useKidsProfile } from '../../modules/kids-profile';
import { useGamification } from '../../modules/gamification';
import { API } from '../../api';
import { useI18n } from '../../i18n/config';
import { PortalBrand } from '../../modules/portals/components/PortalBrand';
import { getKidsCardComponent } from '../../modules/portals/components/cards';
import { useKidsRouteLanguage } from '../kids/useKidsRouteLanguage';
import '../../modules/portals/portals.css';

async function authGet(path, token) {
  const res = await fetch(API(path), { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function ContentShelf({ title, icon: Icon, items, language, empty }) {
  if (!items.length && !empty) return null;
  return (
    <section className="kids-dashboard-section">
      <div className="kids-dashboard-section-heading"><Icon size={21} aria-hidden="true"/><h2>{title}</h2></div>
      {items.length ? <div className="kids-dashboard-rail">{items.map(item => {
        const Card = getKidsCardComponent(item.type);
        const percent = item.progress?.totalPages ? Math.min(100, Math.round(((item.progress.pageIndex + 1) / item.progress.totalPages) * 100)) : null;
        return <div className="kids-dashboard-rail-item" key={item.id}><Card portal="kids" item={item} language={language}/>{percent !== null && <div className="kids-dashboard-card-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percent}><span style={{ width: percent + "%" }}/><strong>{percent}%</strong></div>}</div>;
      })}</div> : <p className="kids-dashboard-empty">{empty}</p>}
    </section>
  );
}

/**
 * Espace "Mon compte" iFilino Kids — minimal par choix (voir le plan) : pas de
 * profils enfants, pas de gamification, juste de quoi retrouver sa lecture en
 * cours et son historique. Même identité que /kids/login (CustomerAuthContext),
 * même moteur backend que les favoris de lecture déjà existants
 * (useStoryEngagement.ts), mais consommé directement ici plutôt que via un hook
 * par élément (on affiche une liste, pas un item isolé).
 */
export default function KidsProfilePage() {
  const { user, token, logoutCustomer } = useCustomerAuth();
  const { language, t } = useKidsRouteLanguage();
  const { options: languageOptions, setLanguage } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const kidsProfile = useKidsProfile();
  const gamification = useGamification();
  const history = [...kidsProfile.readingHistory];
  const favorites = [...kidsProfile.favoriteStories];
  const completedLessons = [...kidsProfile.completedLessons];
  const completedActivities = [...kidsProfile.completedActivities];
  const { points, badges, achievements, rewards } = gamification;
  const loading = kidsProfile.loading || gamification.loading;
  const error = kidsProfile.error?.message || '';
  const [overview, setOverview] = useState({});
  const [signingOut, setSigningOut] = useState(false);

  async function handleLanguageChange(event) {
    const nextLanguage = event.target.value;
    await setLanguage(nextLanguage);
    const pathParts = location.pathname.split('/');
    pathParts[2] = nextLanguage;
    const nextPath = pathParts.join('/');
    navigate(nextPath + location.search + location.hash, { replace: true });
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    await logoutCustomer();
    navigate('/kids/' + language + '/login', { replace: true });
  }

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    authGet("/portals/kids/overview?lang=" + language, token)
      .then(overviewData => { if (active) setOverview(overviewData.sections || {}); })
      .catch(() => { if (active) setOverview({}); });
    return () => { active = false; };
  }, [token, language]);

  const continueItems = useMemo(() => history.filter(item => !item.progress?.completed), [history]);
  const completedCount = useMemo(() => history.filter(item => item.progress?.completed).length, [history]);
  const stories = overview.stories || [];
  const knownIds = useMemo(() => new Set(history.map(item => item.id)), [history]);
  const recommendations = useMemo(() => stories.filter(item => !knownIds.has(item.id)).slice(0, 8), [stories, knownIds]);
  const readingPages = useMemo(() => history.reduce((sum, item) => sum + Number(item.progress?.pageIndex || 0), 0), [history]);
  const readingPercent = history.length ? Math.round((completedCount / history.length) * 100) : 0;
  const activeDays = useMemo(() => new Set(history.map(item => String(item.progress?.updatedAt || '').slice(0, 10)).filter(Boolean)).size, [history]);
  const today = new Date().toISOString().slice(0, 10);
  const challengeDone = history.some(item => String(item.progress?.updatedAt || '').slice(0, 10) === today);
  const recentlyAdded = useMemo(() => [...stories].sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0)).slice(0, 8), [stories]);
  const trending = useMemo(() => [...stories].sort((a, b) => Number(b.view_count || 0) - Number(a.view_count || 0)).slice(0, 8), [stories]);

  if (!token) {
    return (
      <div className="portal portal-kids kids-profile-page">
        <div className="kids-profile-guest">
          <PortalBrand portal="kids"/>
          <h1>{t('kids.profile.guestTitle')}</h1>
          <p>{t('kids.profile.guestSubtitle')}</p>
          <Link to={`/kids/${language}/login`} className="kids-auth-btn">{t('kids.profile.guestCta')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="portal portal-kids kids-profile-page">
      <header className="portal-header">
        <div className="portal-shell portal-header-row">
          <PortalBrand portal="kids"/>
          <nav className="kids-profile-nav" aria-label={t('kids.dashboard.accountNavigation')}>
            <Link to={`/kids/${language}/purchases`} className="kids-profile-back"><ShoppingBag size={15} aria-hidden="true"/> {t('kids.purchases.title')}</Link>
            <Link to={`/kids/${language}`} className="kids-profile-back">{t('portals.back')}</Link>
          </nav>
          <div className="kids-profile-account-actions">
            <label className="kids-profile-language">
              <Languages size={18} aria-hidden="true"/>
              <span>{t('kids.dashboard.changeLanguage')}</span>
              <select value={language} onChange={handleLanguageChange} aria-label={t('kids.dashboard.changeLanguage')}>
                {languageOptions.map(option => <option key={option.code} value={option.code}>{option.nativeName}</option>)}
              </select>
            </label>
            <button type="button" className="kids-profile-signout" onClick={handleSignOut} disabled={signingOut}>
              <LogOut size={18} aria-hidden="true"/>
              <span>{signingOut ? t('kids.dashboard.signingOut') : t('kids.dashboard.signOut')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="portal-shell kids-profile-content">
        <section className="kids-dashboard-welcome">
          <div className="kids-dashboard-avatar" aria-hidden="true"><UserRound size={32}/></div>
          <div className="kids-dashboard-welcome-copy">
            <span className="kids-dashboard-eyebrow"><Sparkles size={16} aria-hidden="true"/> {t("kids.dashboard.adventure")}</span>
            <h1>{t("kids.profile.greeting", { name: user?.nom || t("kids.dashboard.reader") })}</h1>
            <p>{t("kids.dashboard.welcomeSubtitle")}</p>
          </div>
          <div className="kids-dashboard-language"><span>{t("kids.dashboard.language")}</span><strong>{t("kids.book.lang." + language)}</strong></div>
        </section>

        {loading ? (
          <div className="portal-detail-skeleton" aria-busy="true"><span/><span/><span/><span/></div>
        ) : error ? (
          <div className="portal-empty" role="alert"><strong>{t('portals.error.title')}</strong><p>{t('portals.error.description')}</p></div>
        ) : (
          <>
            <section className="kids-dashboard-stats" aria-label={t("kids.dashboard.stats")}>
              {[
                [BookOpen, completedCount, "kids.dashboard.storiesCompleted"],
                [Clock3, readingPages, "kids.dashboard.pagesRead"],
                [Flame, activeDays, "kids.dashboard.activeDays"],
                [Heart, favorites.length, "kids.profile.favorites"],
                [Star, points, language === "fr" ? "Points" : language === "ar" ? "النقاط" : "Points"],
                [Trophy, badges.length, language === "fr" ? "Badges" : language === "ar" ? "الشارات" : "Badges"],
                [Target, completedLessons.length, language === "fr" ? "Leçons terminées" : language === "ar" ? "دروس مكتملة" : "Completed lessons"],
                [Sparkles, completedActivities.length, language === "fr" ? "Activités terminées" : language === "ar" ? "أنشطة مكتملة" : "Completed activities"],
                [Star, achievements.filter(item => item.unlocked).length, language === "fr" ? "Succès" : language === "ar" ? "الإنجازات" : "Achievements"],
                [Trophy, rewards.filter(item => item.unlocked).length, language === "fr" ? "Récompenses" : language === "ar" ? "المكافآت" : "Rewards"],
              ].map(([Icon, value, key]) => <article className="kids-dashboard-stat" key={key}><Icon size={21} aria-hidden="true"/><strong>{value}</strong><span>{String(key).startsWith("kids.") ? t(key) : key}</span></article>)}
            </section>

            <section className="kids-dashboard-focus-grid">
              <article className="kids-dashboard-challenge">
                <div><span className="kids-dashboard-eyebrow"><Star size={16} aria-hidden="true"/> {t("kids.dashboard.dailyChallenge")}</span><h2>{t("kids.dashboard.readToday")}</h2><p>{t("kids.dashboard.challengeReward")}</p></div>
                <div className="kids-dashboard-challenge-state" aria-label={challengeDone ? t("kids.dashboard.completed") : t("kids.dashboard.notCompleted")}><Trophy size={28}/><strong>{challengeDone ? t("kids.dashboard.completed") : "0/1"}</strong></div>
              </article>
              <article className="kids-dashboard-goal">
                <div className="kids-dashboard-section-heading"><Target size={21} aria-hidden="true"/><h2>{t("kids.dashboard.readingGoal")}</h2></div>
                <div className="kids-dashboard-goal-ring" style={{ "--goal": readingPercent }}><strong>{readingPercent}%</strong></div>
                <p>{t("kids.dashboard.goalSummary", { completed: completedCount, total: history.length })}</p>
              </article>
            </section>

            <ContentShelf title={t("kids.profile.continueReading")} icon={BookOpen} items={continueItems} language={language} empty={t("kids.dashboard.continueEmpty")}/>
            <ContentShelf title={t("kids.dashboard.recommended")} icon={Sparkles} items={recommendations} language={language} empty={t("kids.dashboard.recommendedEmpty")}/>
            <ContentShelf title={t("kids.dashboard.recentlyAdded")} icon={Clock3} items={recentlyAdded} language={language}/>
            <ContentShelf title={t("kids.dashboard.trending")} icon={TrendingUp} items={trending} language={language}/>
            <ContentShelf title={t("kids.profile.favorites")} icon={Heart} items={favorites} language={language} empty={t("kids.profile.favoritesEmpty")}/>
            <ContentShelf title={t("kids.profile.history")} icon={HistoryIcon} items={history.slice(0, 8)} language={language} empty={t("kids.profile.historyEmpty")}/>

            <section className="kids-dashboard-library">
              <div className="kids-dashboard-section-heading"><Library size={21} aria-hidden="true"/><h2>{t("kids.dashboard.familyLibrary")}</h2></div>
              <div className="kids-dashboard-library-links">
                <Link to={"/kids/" + language + "/purchases"}><ShoppingBag size={20}/><span>{t("kids.purchases.title")}</span></Link>
                <Link to={"/kids/" + language + "/stories"}><BookOpen size={20}/><span>{t("kids.nav.stories")}</span></Link>
                <Link to={"/kids/" + language + "/drawing"}><Palette size={20}/><span>{t("kids.dashboard.coloring")}</span></Link>
                <Link to={"/kids/" + language + "/stories"}><Headphones size={20}/><span>{t("kids.dashboard.audiobooks")}</span></Link>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
