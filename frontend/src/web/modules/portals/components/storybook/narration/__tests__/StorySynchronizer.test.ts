import { describe, it, expect, vi } from 'vitest';
import { createStorySynchronizer } from '../StorySynchronizer';
import { INITIAL_SESSION_STATE, type NarrationSessionState } from '../NarrationSession';

function stateAt(overrides: Partial<NarrationSessionState>): NarrationSessionState {
  return { ...INITIAL_SESSION_STATE, status: 'playing', ...overrides };
}

describe('StorySynchronizer', () => {
  it('ne notifie onPageChange que lorsque la page change réellement (pas à chaque phrase de la même page)', () => {
    const onPageChange = vi.fn();
    const sync = createStorySynchronizer({ onPageChange });
    sync.handleStateChange(stateAt({ pageIndex: 0, cueId: 's0' }));
    sync.handleStateChange(stateAt({ pageIndex: 0, cueId: 's1' }));
    sync.handleStateChange(stateAt({ pageIndex: 0, cueId: 's2' }));
    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(0);

    sync.handleStateChange(stateAt({ pageIndex: 1, cueId: 's3' }));
    expect(onPageChange).toHaveBeenCalledTimes(2);
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  it('notifie onChapterChange uniquement quand le chapitre change', () => {
    const onPageChange = vi.fn();
    const onChapterChange = vi.fn();
    const sync = createStorySynchronizer({ onPageChange, onChapterChange });
    sync.handleStateChange(stateAt({ pageIndex: 0, chapter: 'Chapitre 1', cueId: 's0' }));
    sync.handleStateChange(stateAt({ pageIndex: 0, chapter: 'Chapitre 1', cueId: 's1' }));
    expect(onChapterChange).toHaveBeenCalledTimes(1);
    sync.handleStateChange(stateAt({ pageIndex: 1, chapter: 'Chapitre 2', cueId: 's2' }));
    expect(onChapterChange).toHaveBeenCalledTimes(2);
    expect(onChapterChange).toHaveBeenLastCalledWith('Chapitre 2');
  });

  it('notifie onSentenceChange à chaque phrase, y compris au sein d\'une même page', () => {
    const onSentenceChange = vi.fn();
    const sync = createStorySynchronizer({ onPageChange: vi.fn(), onSentenceChange });
    sync.handleStateChange(stateAt({ pageIndex: 0, cueId: 's0' }));
    sync.handleStateChange(stateAt({ pageIndex: 0, cueId: 's1' }));
    expect(onSentenceChange).toHaveBeenCalledTimes(2);
    expect(onSentenceChange).toHaveBeenNthCalledWith(1, 's0');
    expect(onSentenceChange).toHaveBeenNthCalledWith(2, 's1');
  });

  it('ignore les états idle/finished/error — rien à piloter dans le StoryBook', () => {
    const onPageChange = vi.fn();
    const sync = createStorySynchronizer({ onPageChange });
    sync.handleStateChange({ ...INITIAL_SESSION_STATE, status: 'idle' });
    sync.handleStateChange({ ...INITIAL_SESSION_STATE, status: 'finished' });
    sync.handleStateChange({ ...INITIAL_SESSION_STATE, status: 'error', errorMessage: 'x' });
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('reset() oublie la dernière page/chapitre connus : le prochain état redéclenche les callbacks', () => {
    const onPageChange = vi.fn();
    const sync = createStorySynchronizer({ onPageChange });
    sync.handleStateChange(stateAt({ pageIndex: 2, cueId: 's0' }));
    sync.reset();
    sync.handleStateChange(stateAt({ pageIndex: 2, cueId: 's0' }));
    expect(onPageChange).toHaveBeenCalledTimes(2);
  });

  it('un état en pause continue de piloter la page affichée (la position reste visible pendant la pause)', () => {
    const onPageChange = vi.fn();
    const sync = createStorySynchronizer({ onPageChange });
    sync.handleStateChange({ ...stateAt({ pageIndex: 3, cueId: 's0' }), status: 'paused' });
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
