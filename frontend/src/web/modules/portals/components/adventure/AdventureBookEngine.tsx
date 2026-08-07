import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Block } from '../../../../markdown/MarkdownParser';
import type { MarkdownTheme } from '../../../../markdown/MarkdownTheme';
import { useStoryLayout } from '../storybook/StoryLayoutEngine';
import { useStoryPagination, type PaginatedPage } from '../storybook/StoryPaginator';
import { StoryRenderer } from '../storybook/StoryRenderer';
import { NarrationBar } from '../storybook/NarrationBar';
import { useNarrationEngine } from '../storybook/narration/NarrationEngine';
import { useIdleVisibility } from '../storybook/useIdleVisibility';
import { listAvailableVoices, type NarrationVoice } from '../storybook/narration/VoiceManager';
import { getRememberedVoice, rememberVoice } from '../storybook/narration/NarratorRegistry';
import { detectStoryLanguage } from '../storybook/narration/LanguageDetector';
import PreviewGate from '../freemium/PreviewGate';
import '../storybook/storybook.css';
import './adventure-book-engine.css';

const START_LABEL_BY_LANGUAGE: Record<string, string> = { fr: 'Commencer', en: 'Start', ar: 'ابدأ', default: 'Commencer' };

export interface AdventureSidebarState {
  readonly pages: readonly PaginatedPage[];
  readonly currentIndex: number;
  readonly isPreview: boolean;
  readonly onNavigate: (index: number) => void;
  /** Sans NarrationBar (enableNarration=false), retour/plein-écran n'ont plus de barre où vivre —
   * le panneau latéral les héberge à la place (voir ReaderSidebar.jsx). */
  readonly backTo?: string;
  readonly backLabel?: string;
  readonly isFullscreen?: boolean;
  readonly onToggleFullscreen?: () => void;
}

export interface AdventureBookEngineProps {
  readonly blocks: readonly Block[];
  readonly theme: MarkdownTheme;
  readonly title?: string;
  readonly coverImage?: string;
  readonly backTo?: string;
  readonly backLabel?: string;
  readonly isFullscreen?: boolean;
  readonly onToggleFullscreen?: () => void;
  /** Stories garde son moteur de narration tel quel (défaut). Study/Encyclopedia le désactivent —
   * voir le plan "Unify the Educational Reader with the Storybook engine" §Scope : la narration
   * pour les leçons a de vraies lacunes non résolues (légendes d'image, tableaux jamais lues) et
   * mérite son propre passage, pas un branchement à moitié fait. */
  readonly enableNarration?: boolean;
  /** Render-prop plutôt qu'un simple ReactNode : le panneau doit rester synchronisé avec la page
   * active (pages/currentIndex/onNavigate) — voir ReaderSidebar.jsx pour l'implémentation Study/
   * Encyclopedia. Storybook (Stories) ne passe rien ici : comportement inchangé. */
  readonly sidebar?: (state: AdventureSidebarState) => React.ReactNode;
  /** Study/Encyclopedia affichent déjà une pré-page (AdventureLanding.jsx) avant d'ouvrir le
   * livre — rouvrir sur SA PROPRE couverture demanderait un second clic "Commencer" redondant.
   * Stories ne passe jamais cette prop (comportement inchangé : ouverture sur la couverture). */
  readonly skipCover?: boolean;
  readonly publication?: { readonly previewLength?: number; readonly access?: { readonly isPreview?: boolean }; readonly type?: string; };
  readonly uiLanguage?: string;
  readonly onProgressChange?: (progress: { pageIndex: number; totalPages: number; completed: boolean }) => void;
}

/**
 * Moteur de lecture partagé — extrait de BookReader.tsx (Stories) pour devenir la spécialisation
 * commune à Stories ET aux modules éducatifs (Study/Nature/Animals/Space/Science/History), voir
 * le plan "Unify the Educational Reader with the Storybook engine". Comportement Stories
 * inchangé : BookReader.tsx n'est plus qu'un appel à ce composant avec enableNarration=true et
 * sidebar=undefined.
 *
 * Assemble StoryLayoutEngine (mode single/spread), StoryPaginator (pagination par mesure réelle —
 * AUCUN changement à cet algorithme, voir vérification §Step 0 du plan : le contenu Science/Study
 * réel se paginait déjà correctement), StoryRenderer/BookRenderer (affichage), le Narration
 * Engine quand activé, et un panneau latéral optionnel synchronisé sur la page active.
 */
export function AdventureBookEngine({
  blocks, theme, title, coverImage,
  backTo, backLabel, isFullscreen, onToggleFullscreen,
  enableNarration = true, sidebar, skipCover = false,
  publication, uiLanguage, onProgressChange,
}: AdventureBookEngineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [measurerParent, setMeasurerParent] = useState<HTMLElement | null>(null);
  useEffect(() => setMeasurerParent(containerRef.current), []);
  const [fontScale, setFontScale] = useState(1);
  const language = useMemo(() => detectStoryLanguage(blocks), [blocks]);
  const layout = useStoryLayout(containerRef, language);
  const [voices, setVoices] = useState<readonly NarrationVoice[]>([]);
  const [voice, setVoice] = useState<string | null>(() => (enableNarration ? getRememberedVoice(language) : null));

  useEffect(() => {
    if (!enableNarration) return undefined;
    let cancelled = false;
    listAvailableVoices(language).then(list => {
      if (cancelled) return;
      setVoices(list);
      setVoice(current => {
        if (current && list.some(v => v.id === current)) return current;
        const remembered = getRememberedVoice(language);
        if (remembered && list.some(v => v.id === remembered)) return remembered;
        return list[0]?.id ?? null;
      });
    });
    return () => { cancelled = true; };
  }, [language, enableNarration]);
  const handleVoiceChange = useCallback((id: string) => {
    setVoice(id);
    rememberVoice(language, id);
  }, [language]);
  const [pageIndex, setPageIndex] = useState(0);

  const { pages: paginatedPages, ready } = useStoryPagination(blocks, layout, theme, fontScale, measurerParent, coverImage, title);
  const allPages = useMemo(() => skipCover ? paginatedPages.filter(page => page.kind !== "cover") : paginatedPages, [paginatedPages, skipCover]);
  const isPreview = Boolean(publication?.access?.isPreview);
  const configuredLimit = Math.floor(Number(publication?.previewLength));
  const previewPageLimit = Number.isFinite(configuredLimit) ? Math.max(0, configuredLimit) : allPages.length;
  const pages = useMemo(() => isPreview ? allPages.slice(0, Math.min(previewPageLimit, allPages.length)) : allPages, [allPages, isPreview, previewPageLimit]);
  const gate = isPreview ? React.createElement(PreviewGate, { language: uiLanguage || language, section: publication?.type || "learn" }) : null;
  const total = pages.length + (gate ? 1 : 0);
  const current = Math.min(pageIndex, Math.max(0, total - 1));
  const onCover = pages[current]?.kind === 'cover';
  const startLabel = START_LABEL_BY_LANGUAGE[language] ?? START_LABEL_BY_LANGUAGE.default;
  useEffect(() => {
    if (ready && total > 0 && current < pages.length) onProgressChange?.({ pageIndex: current, totalPages: pages.length, completed: !isPreview && current === pages.length - 1 });
  }, [current, isPreview, onProgressChange, pages.length, ready, total]);

  const handlePageChange = useCallback((next: number) => setPageIndex(next), []);
  // Narration désactivée : `useNarrationEngine` est appelé quand même (les hooks ne peuvent pas
  // être conditionnels) mais avec un tableau de pages vide, ce qui le laisse inerte (aucune cue,
  // status toujours 'idle') — moins de code qu'un second chemin d'exécution parallèle.
  const narration = useNarrationEngine({
    pages: enableNarration ? pages : EMPTY_PAGES,
    language, voice, onPageChange: handlePageChange,
  });

  const handleNavigate = useCallback((next: number) => {
    setPageIndex(next);
    narration.notifyManualPageChange(next);
  }, [narration]);
  const handleStart = useCallback(() => handleNavigate(Math.min(1, total - 1)), [handleNavigate, total]);

  const narrationActive = enableNarration && (narration.status === 'playing' || narration.status === 'paused');
  const chromeVisible = useIdleVisibility() && !onCover;

  return (
    <div
      className={`storybook-root${sidebar ? ' adventure-has-sidebar' : ''}`}
      data-storybook-ready={ready ? '1' : '0'}
      data-storybook-total={total}
      data-storybook-page-index={current}
      data-storybook-direction={layout.direction}
    >
      {sidebar && !onCover && current < pages.length && (
        <div className="adventure-sidebar-slot">
          {sidebar({ pages, currentIndex: current, isPreview, onNavigate: handleNavigate, backTo, backLabel, isFullscreen, onToggleFullscreen })}
        </div>
      )}
      <div className="adventure-book-frame">
        <div className="storybook-viewport" ref={containerRef}>
          {ready && total > 0 && (
            <StoryRenderer
              pages={pages}
              layout={layout}
              currentIndex={current}
              onNavigate={handleNavigate}
              theme={theme}
              activeSentenceText={narrationActive ? narration.activeSentenceText : undefined}
              onStart={handleStart}
              startLabel={startLabel}
              endContent={gate}
            />
          )}
        </div>
        {!onCover && enableNarration && (
          <div className={`storybook-chrome-bottom${chromeVisible ? '' : ' storybook-chrome-hidden'}`}>
            <NarrationBar
              narration={narration}
              language={language}
              voices={voices}
              voice={voice}
              onVoiceChange={handleVoiceChange}
              fontScale={fontScale}
              onFontScaleChange={setFontScale}
              backTo={backTo}
              backLabel={backLabel}
              isFullscreen={isFullscreen}
              onToggleFullscreen={onToggleFullscreen}
            />
          </div>
        )}
      </div>
    </div>
  );
}

const EMPTY_PAGES: readonly PaginatedPage[] = [];
