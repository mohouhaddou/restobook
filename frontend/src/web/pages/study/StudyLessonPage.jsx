import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLessonItem } from '../../../modules/study/hooks/useLessonItem';
import { useLessonFavorite, useLessonProgress } from '../../../modules/study/hooks/useLessonEngagement';
import { useKidsRouteLanguage } from '../kids/useKidsRouteLanguage';
import { kidsPath } from '../kids/i18n';
import { AdventureBookEngine } from '../../modules/portals/components/adventure/AdventureBookEngine';
import { ReaderSidebar } from '../../modules/portals/components/adventure/ReaderSidebar';
import { AdventureLanding } from "../../modules/portals/components/adventure/AdventureLanding";
import { PortalBrand } from "../../modules/portals/components/PortalBrand";
import { PortalFooter } from "../../modules/portals/components/PortalFooter";
import { BookHero } from "../../modules/portals/components/book/BookHero";
import { BookMetadata } from "../../modules/portals/components/book/BookMetadata";
import { BookRecommendations } from "../../modules/portals/components/book/BookRecommendations";
import { DigitalProductsSection } from "../../modules/portals/digitalProducts/DigitalProductsSection";
import { CompletionCelebration } from '../../modules/portals/components/adventure/CompletionCelebration';
import PremiumPreviewNotice from '../../modules/portals/components/freemium/PremiumPreviewNotice';
import { subjectThemeStyle } from '../../modules/portals/components/adventure/SubjectTheme';
import { useFullscreen } from '../../modules/portals/components/storybook/useFullscreen';
import { parseMarkdownBlocks } from '../../markdown/MarkdownParser';
import { ThemeResolver } from '../../markdown/ThemeResolver';
import { LessonResources } from './LessonResources';
import '../../modules/portals/portals.css';
import "./study.css";
import "../../modules/portals/components/book/book.css";

const COPY = {
  fr: { back: 'Toutes les leçons', contents: 'Sommaire', progress: 'Progression', objectives: 'Ce que tu vas apprendre', close: 'Fermer', start: 'Commencer la leçon', celebrateHeading: 'Bravo, tu as réussi !', celebrateSubheading: 'Leçon terminée', learned: 'Ce que tu as appris', explored: 'leçons explorées', unlocked: 'Nouveau badge explorateur débloqué !', nextAdventure: 'Prochaine aventure' },
  en: { back: 'All lessons', contents: 'Contents', progress: 'Progress', objectives: 'What you will learn', close: 'Close', start: 'Start the lesson', celebrateHeading: 'You did it!', celebrateSubheading: 'Lesson complete', learned: 'What you learned', explored: 'lessons explored', unlocked: 'New explorer badge unlocked!', nextAdventure: 'Next adventure' },
  ar: { back: 'كل الدروس', contents: 'الفهرس', progress: 'التقدم', objectives: 'ماذا ستتعلم', close: 'إغلاق', start: 'ابدأ الدرس', celebrateHeading: 'أحسنت، لقد نجحت!', celebrateSubheading: 'اكتمل الدرس', learned: 'ما تعلمته', explored: 'دروس تم استكشافها', unlocked: 'تم فتح شارة مستكشف جديدة!', nextAdventure: 'المغامرة التالية' },
};

/** Pont entre le render-prop d'AdventureBookEngine (état de page synchronisé) et la sidebar +
 * les ressources — un composant à part entière (pas une fonction nue) pour pouvoir utiliser
 * useEffect : détecte la dernière page du livre pour déclencher la célébration. */
function StudySidebar({ state, item, resources, slug, language, copy, onReachEnd }) {
  useEffect(() => {
    if (!state.isPreview && state.pages.length > 1 && state.currentIndex === state.pages.length - 1) onReachEnd();
  }, [state.currentIndex, state.pages.length, onReachEnd]);

  return (
    <>
      <ReaderSidebar
        pages={state.pages} currentIndex={state.currentIndex} onNavigate={state.onNavigate}
        backTo={state.backTo} backLabel={state.backLabel} isFullscreen={state.isFullscreen} onToggleFullscreen={state.onToggleFullscreen}
        title={item.title} objectives={item.objectives} copy={copy}
      />
      {resources.length > 0 && (
        <div className="reader-sidebar-resources">
          <LessonResources resources={resources} slug={slug} language={language}/>
        </div>
      )}
    </>
  );
}

export default function StudyLessonPage() {
  const { slug } = useParams();
  const { language } = useKidsRouteLanguage();
  const copy = COPY[language] || COPY.en;
  const state = useLessonItem(slug, language);
  const item = state.item;
  const { favorite, toggleFavorite } = useLessonFavorite(slug);
  const { saveProgress } = useLessonProgress(slug);
  const [started, setStarted] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const readerModeRef = useRef(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(readerModeRef);

  // Même précaution que StoryReaderPage.jsx : parseMarkdownBlocks(item.blocks) recrée un nouveau
  // tableau à chaque appel, et AdventureBookEngine (via StoryPaginator) réagit à tout changement
  // de référence de `blocks` comme si le contenu avait changé. Sans ce useMemo, n'importe quel
  // re-rendu (ex. bascule plein écran) redéclencherait toute la pagination.
  const blocks = useMemo(() => parseMarkdownBlocks(item?.blocks), [item]);

  useEffect(() => { setStarted(false); setCelebrating(false); }, [slug, language]);

  // useCallback — indispensable ici : passée à StudySidebar comme dépendance de son useEffect
  // (détection "dernière page atteinte"). Sans référence stable, CHAQUE rendu de StudyLessonPage
  // (ex. fermer la modale change `celebrating`, qui redéclenche un rendu) fournissait une nouvelle
  // fonction, réarmant l'effet alors que la page n'avait pas changé — la modale se refermait puis
  // se rouvrait aussitôt, ce qui donnait l'impression que le bouton fermer ne marchait pas.
  const handleReachEnd = useCallback(() => {
    saveProgress({ lastPosition: 1, completionPercent: 100, completed: true });
    setCelebrating(true);
  }, [saveProgress]);

  if (state.loading) {
    return (
      <div className="portal portal-kids portal-story-mode">
        <div className="portal-detail-skeleton" aria-busy="true"><span/><span/><span/><span/></div>
      </div>
    );
  }
  if (state.missingLanguage || state.error || !item) {
    return (
      <div className="portal portal-kids portal-story-mode">
        <div className="portal-empty" role="alert">
          <strong>{state.missingLanguage ? 'Not yet available in this language' : 'Unable to load this lesson'}</strong>
          {state.missingLanguage && <p>{Object.entries(state.languageUrls).map(([lng, url]) => <a key={lng} href={url}>{lng.toUpperCase()}</a>)}</p>}
        </div>
      </div>
    );
  }

  const resources = item.resources || [];
  const backTo = kidsPath(language, 'learn');

  if (!started) {
    const landingItem = {
      id: item.id, portal: "kids", type: "learn", slug: item.slug, title: item.title,
      excerpt: item.summary, image_url: item.coverImageUrl, published_at: item.publishedAt,
      available_languages: item.available_languages,
      isPremium: item.isPremium, premium: item.premium, previewLength: item.previewLength,
      premiumBadge: item.premiumBadge, access: item.access,
      metadata: { readingMinutes: item.estimatedDurationMinutes, learningGoals: (item.objectives || []).map(label => ({ label })) },
    };
    const recommendations = item.navigation?.relatedLessons || item.navigation?.nextLessons || [];
    return (
      <div className="portal portal-kids book-landing" style={subjectThemeStyle(item.subject)}>
        <header className="portal-header"><div className="portal-shell portal-header-row"><PortalBrand portal="kids"/></div></header>
        <main className="portal-shell book-landing-main">
          <nav className="book-breadcrumb"><a href={backTo}>{copy.back}</a><span>/</span><span>{item.subject || "Learn"}</span><span>/</span><span aria-current="page">{item.title}</span></nav>
          <PremiumPreviewNotice item={item} language={language}/>
          <BookHero item={landingItem} language={language} contentLabel={language === "fr" ? "Leçon interactive" : language === "ar" ? "درس تفاعلي" : "Interactive lesson"} badges={[item.subject, item.grade, item.difficulty].filter(Boolean)} favorite={favorite} onToggleFavorite={toggleFavorite} primaryLabel={copy.start} onPrimaryAction={() => setStarted(true)}/>
          <BookMetadata item={landingItem} language={language}/>
          <DigitalProductsSection studyLessonId={item.id}/>
          <BookRecommendations books={recommendations.map(candidate => ({ ...candidate, image_url: candidate.coverImageUrl }))} language={language} title={language === "fr" ? "Leçons similaires" : language === "ar" ? "دروس مشابهة" : "Similar lessons"} hrefFor={candidate => kidsPath(language, `learn/${candidate.slug}`)}/>
        </main>
        <PortalFooter portal="kids" language={language}/>
      </div>
    );
  }

  return (
    <div ref={readerModeRef} className="portal portal-kids portal-story-mode" style={subjectThemeStyle(item.subject)}>
      <main className="story-reader-viewport">
        <div className="story-reader-body">
          <AdventureBookEngine
            blocks={blocks}
            theme={ThemeResolver.resolve('kids')}
            title={item.title}
            coverImage={item.coverImageUrl}
            backTo={backTo}
            backLabel={copy.back}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            enableNarration
            skipCover
            publication={item}
            uiLanguage={language}
            sidebar={bookState => (
              <StudySidebar
                state={bookState} item={item} resources={resources} slug={slug} language={language}
                copy={copy} onReachEnd={handleReachEnd}
              />
            )}
          />
        </div>
      </main>
      <CompletionCelebration
        open={celebrating} onClose={() => setCelebrating(false)} slug={slug} title={item.title}
        objectives={item.objectives} nextLessons={item.navigation?.nextLessons}
        buildNextHref={nextSlug => kidsPath(language, `learn/${nextSlug}`)}
        copy={{ heading: copy.celebrateHeading, subheading: copy.celebrateSubheading, learned: copy.learned, explored: copy.explored, unlocked: copy.unlocked, next: copy.nextAdventure, close: copy.close }}
      />
    </div>
  );
}
