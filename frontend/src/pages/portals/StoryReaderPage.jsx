import React, { useMemo, useRef } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { BookReader } from '../../modules/portals/components/storybook/BookReader';
import { useFullscreen } from '../../modules/portals/components/storybook/useFullscreen';
import { parseMarkdownBlocks } from '../../shared/markdown/MarkdownParser';
import { ThemeResolver } from '../../shared/markdown/ThemeResolver';
import { usePortalItem } from '../../modules/portals/hooks/usePortalItem';
import { useKidsRouteLanguage } from '../kids/useKidsRouteLanguage';
import PremiumPreviewNotice from '../../modules/portals/components/freemium/PremiumPreviewNotice';
import { useStoryProgress } from '../../modules/portals/hooks/useStoryEngagement';
import '../../modules/portals/portals.css';

/**
 * Lecture StoryBook plein écran — dernière étape du parcours Kids (Bibliothèque → page de
 * présentation du livre → ici). Reprend exactement ce que PortalDetailPage faisait auparavant pour
 * une histoire (même hook de fetch, même BookReader/ThemeResolver/useFullscreen), simplement
 * atteint depuis sa propre route dédiée `/kids/story/:slug` plutôt qu'un branchement conditionnel
 * dans la page de détail générique.
 */
export default function StoryReaderPage() {
  const { slug } = useParams();
  const { language, t } = useKidsRouteLanguage();
  const state = usePortalItem('kids', slug, language);
  const item = state.item;
  const { saveProgress } = useStoryProgress('kids', slug);
  const storyModeRef = useRef(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(storyModeRef);

  // parseMarkdownBlocks(item.blocks) recrée un nouveau tableau à chaque appel — sans ce useMemo,
  // n'importe quel re-rendu de cette page (ex. le fullscreen qui change d'état) fournirait à
  // BookReader une référence `blocks` différente à chaque fois. Le Narration Engine, lui,
  // interprète tout changement de référence de pages comme "la pagination a changé" (cas légitime :
  // redimensionnement d'écran) et tente de "reprendre" la lecture — d'où un bug déjà rencontré où
  // la narration redémarrait la phrase en cours sans raison apparente.
  const blocks = useMemo(() => parseMarkdownBlocks(item?.blocks), [item]);

  if (state.loading) {
    return (
      <div className="portal portal-kids portal-story-mode">
        <div className="portal-detail-skeleton" aria-busy="true"><span/><span/><span/><span/></div>
      </div>
    );
  }

  // Contenu introuvable, ou pas vraiment une histoire (lien mal formé) : repli sur la page de
  // détail générique plutôt qu'un écran de lecture vide.
  if (state.error || !item || item.type !== 'stories') {
    return <Navigate to={`/kids/${language}/content/${slug}`} replace />;
  }

  return (
    <div ref={storyModeRef} className="portal portal-kids portal-story-mode">
      <main className="story-reader-viewport">
        <div className="story-reader-body">
          <PremiumPreviewNotice item={item} language={language}/>
          <BookReader
            blocks={blocks}
            theme={ThemeResolver.resolve('kids')}
            title={item.title}
            coverImage={item.image_url}
            backTo={`/kids/${language}/book/${slug}`}
            backLabel={t('portals.back')}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            publication={item}
            uiLanguage={language}
            onProgressChange={saveProgress}
          />
        </div>
      </main>
    </div>
  );
}
