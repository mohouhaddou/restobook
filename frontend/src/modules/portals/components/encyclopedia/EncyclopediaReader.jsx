import React, { useCallback, useEffect, useState } from 'react';
import { Atom, BookOpen, Clock3, Compass, FlaskConical, Gauge, GraduationCap, Leaf, Map, PawPrint, Rocket } from 'lucide-react';
import { AdventureBookEngine } from '../adventure/AdventureBookEngine';
import { ReaderSidebar } from '../adventure/ReaderSidebar';
import { CompletionCelebration } from '../adventure/CompletionCelebration';
import { subjectThemeStyle } from '../adventure/SubjectTheme';
import { ThemeResolver } from '../../../../shared/markdown/ThemeResolver';
import './encyclopedia-reader-shell.css';

const MODULES = {
  animals: { icon: PawPrint, label: 'Animals' }, nature: { icon: Leaf, label: 'Nature' },
  space: { icon: Rocket, label: 'Space' }, science: { icon: Atom, label: 'Science' },
  history: { icon: BookOpen, label: 'History' }, geography: { icon: Map, label: 'Geography' },
  experiments: { icon: FlaskConical, label: 'Experiments' }, crafts: { icon: Compass, label: 'Crafts' },
};
const getValue = (item, ...keys) => keys.map(key => item?.[key] ?? item?.metadata?.[key]).find(value => value !== undefined && value !== null && value !== '');

/** Pont entre le render-prop d'AdventureBookEngine et la sidebar — voir StudyLessonPage.jsx pour
 * le même principe : un composant à part pour pouvoir détecter la dernière page via useEffect,
 * avec une référence stable (onReachEnd vient de useCallback côté parent) pour ne pas réarmer
 * l'effet à chaque rendu — voir le correctif "modale de fin qui se rouvrait après fermeture". */
function EncyclopediaSidebar({ state, item, quickFacts, onReachEnd }) {
  useEffect(() => {
    if (!state.isPreview && state.pages.length > 1 && state.currentIndex === state.pages.length - 1) onReachEnd();
  }, [state.currentIndex, state.pages.length, onReachEnd]);

  return (
    <ReaderSidebar
      pages={state.pages} currentIndex={state.currentIndex} onNavigate={state.onNavigate}
      backTo={state.backTo} backLabel={state.backLabel} isFullscreen={state.isFullscreen} onToggleFullscreen={state.onToggleFullscreen}
      title={item.title} quickFacts={quickFacts}
    />
  );
}

export function EncyclopediaReader({ item, blocks, backTo, backLabel, isFullscreen, onToggleFullscreen }) {
  const moduleId = String(item.type || item.category || 'learn').toLowerCase();
  const module = MODULES[moduleId] || { icon: GraduationCap, label: moduleId || 'Learn' };
  const readingTime = getValue(item, 'reading_time', 'readingTime');
  const age = getValue(item, 'age_range', 'ageRange');
  const difficulty = getValue(item, 'difficulty');
  const quickFacts = [
    [Clock3, 'Reading time', readingTime ? `${readingTime} min` : null], [GraduationCap, 'Age', age],
    [Gauge, 'Difficulty', difficulty], [Compass, 'Category', module.label],
  ].filter(([, , fact]) => fact);

  const [celebrating, setCelebrating] = useState(false);
  useEffect(() => { setCelebrating(false); }, [item?.slug]);

  const handleReachEnd = useCallback(() => setCelebrating(true), []);

  return (
    <div className={`encyclopedia-reader-shell encyclopedia--${moduleId}`} style={subjectThemeStyle(moduleId)}>
      <AdventureBookEngine
        blocks={blocks}
        theme={ThemeResolver.resolve('kids')}
        title={item.title}
        coverImage={item.image_url}
        backTo={backTo}
        backLabel={backLabel}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
        enableNarration
        skipCover
        publication={item}
        uiLanguage={item.language}
        sidebar={bookState => (
          <EncyclopediaSidebar state={bookState} item={item} quickFacts={quickFacts} onReachEnd={handleReachEnd}/>
        )}
      />
      <CompletionCelebration
        open={celebrating} onClose={() => setCelebrating(false)} slug={item.slug} title={item.title}
        objectives={null} nextLessons={null} buildNextHref={null}
      />
    </div>
  );
}
