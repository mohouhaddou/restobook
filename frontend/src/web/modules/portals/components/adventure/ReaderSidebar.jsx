import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, List, Maximize, Minimize, Menu, X } from 'lucide-react';
import './reader-sidebar.css';

function chapterTitle(page) {
  const heading = page.blocks.find(block => block.type === 'heading');
  return heading?.text || page.title || '';
}

/**
 * Panneau latéral du lecteur — "centre de navigation" partagé Study/Encyclopedia, voir le plan
 * "Unify the Educational Reader with the Storybook engine" §Step 2. Reçoit `pages`/`currentIndex`/
 * `onNavigate` directement du render-prop `sidebar` d'AdventureBookEngine.tsx : toujours
 * synchronisé avec la page réellement affichée, jamais un état dupliqué.
 *
 * Les chapitres viennent de `pages` elles-mêmes (page.isChapterStart, déjà calculé par
 * StoryPaginator — même règle "tout titre commence un chapitre" que la narration), pas d'un
 * second découpage indépendant : impossible de désynchroniser sidebar et livre.
 */
export function ReaderSidebar({
  pages, currentIndex, onNavigate,
  backTo, backLabel, isFullscreen, onToggleFullscreen,
  title, quickFacts, objectives, copy,
}) {
  const [open, setOpen] = useState(false);
  const t = copy || { contents: 'Contents', progress: 'Progress', objectives: 'What you will learn', close: 'Close' };

  const chapters = useMemo(() => pages
    .map((page, index) => ({ index, page }))
    .filter(({ page }) => page.kind !== 'cover' && page.isChapterStart)
    .map(({ index, page }) => ({ index, title: chapterTitle(page) })),
  [pages]);

  const currentChapterPos = Math.max(0, chapters.filter(c => c.index <= currentIndex).length - 1);
  const percent = pages.length > 1 ? Math.round((currentIndex / (pages.length - 1)) * 100) : 100;

  const navigate = index => { onNavigate(index); setOpen(false); };

  return (
    <>
      <button type="button" className="reader-sidebar-toggle" onClick={() => setOpen(true)} aria-label={t.contents}>
        <Menu size={18}/><span>{t.contents}</span>
      </button>

      {open && <button className="reader-sidebar-backdrop" aria-label={t.close} onClick={() => setOpen(false)}/>}

      <aside className={`reader-sidebar${open ? ' is-open' : ''}`} aria-label={t.contents}>
        <div className="reader-sidebar-head">
          {backTo
            ? <Link to={backTo} className="reader-sidebar-back"><ArrowLeft size={16}/>{backLabel}</Link>
            : <span/>}
          <div className="reader-sidebar-head-actions">
            {onToggleFullscreen && (
              <button type="button" onClick={onToggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                {isFullscreen ? <Minimize size={16}/> : <Maximize size={16}/>}
              </button>
            )}
            <button type="button" className="reader-sidebar-close" onClick={() => setOpen(false)} aria-label={t.close}><X size={18}/></button>
          </div>
        </div>

        {title && <h2 className="reader-sidebar-title">{title}</h2>}

        <div className="reader-sidebar-progress">
          <div className="reader-sidebar-progress-label"><span>{t.progress}</span><strong>{percent}%</strong></div>
          <div className="reader-sidebar-progress-bar" role="progressbar" aria-label={t.progress} aria-valuemin="0" aria-valuemax="100" aria-valuenow={percent}>
            <span style={{ width: `${percent}%` }}/>
          </div>
        </div>

        {objectives?.length > 0 && (
          <div className="reader-sidebar-block">
            <strong>{t.objectives}</strong>
            <ul>{objectives.map(o => <li key={o}>{o}</li>)}</ul>
          </div>
        )}

        {quickFacts?.length > 0 && (
          <div className="reader-sidebar-block reader-sidebar-facts">
            {quickFacts.map(([Icon, label, value]) => (
              <div key={label} className="reader-sidebar-fact"><Icon size={16}/><span><small>{label}</small><strong>{value}</strong></span></div>
            ))}
          </div>
        )}

        <nav className="reader-sidebar-chapters" aria-label={t.contents}>
          <div className="reader-sidebar-chapters-head"><List size={16}/><span>{t.contents}</span></div>
          <ol>
            {chapters.map((chapter, position) => (
              <li key={chapter.index}>
                <button
                  type="button"
                  className={position === currentChapterPos ? 'active' : position < currentChapterPos ? 'done' : ''}
                  onClick={() => navigate(chapter.index)}
                >
                  <span>{position < currentChapterPos ? <Check size={13}/> : position + 1}</span>
                  <small>{chapter.title}</small>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </aside>
    </>
  );
}
