import { describe, it, expect } from 'vitest';
import { reduceSession, INITIAL_SESSION_STATE } from '../NarrationSession';

describe('reduceSession', () => {
  it('PLAY_REQUESTED passe en playing et efface une éventuelle erreur précédente', () => {
    const errored = { ...INITIAL_SESSION_STATE, status: 'error' as const, errorMessage: 'oups' };
    const next = reduceSession(errored, { type: 'PLAY_REQUESTED' });
    expect(next.status).toBe('playing');
    expect(next.errorMessage).toBeNull();
  });

  it('CUE_STARTED met à jour la position (cue/page/chapitre/provider) et passe en playing', () => {
    const next = reduceSession(INITIAL_SESSION_STATE, {
      type: 'CUE_STARTED', cueId: 's3', pageIndex: 2, chapter: 'Chapitre 2', providerId: 'piper', usingFallback: false,
    });
    expect(next).toEqual({ ...INITIAL_SESSION_STATE, status: 'playing', cueId: 's3', pageIndex: 2, chapter: 'Chapitre 2', providerId: 'piper', usingFallback: false });
  });

  it('PAUSED / FINISHED changent uniquement le statut', () => {
    const playing = { ...INITIAL_SESSION_STATE, status: 'playing' as const, cueId: 's1' };
    expect(reduceSession(playing, { type: 'PAUSED' }).status).toBe('paused');
    expect(reduceSession(playing, { type: 'FINISHED' }).status).toBe('finished');
    expect(reduceSession(playing, { type: 'PAUSED' }).cueId).toBe('s1'); // la position est conservée en pause
  });

  it('ERROR fixe le message et le statut error', () => {
    const next = reduceSession(INITIAL_SESSION_STATE, { type: 'ERROR', message: 'panne réseau' });
    expect(next.status).toBe('error');
    expect(next.errorMessage).toBe('panne réseau');
  });

  it('RESET revient exactement à l\'état initial, quel que soit l\'état de départ', () => {
    const playing = { ...INITIAL_SESSION_STATE, status: 'playing' as const, cueId: 's9', pageIndex: 5 };
    expect(reduceSession(playing, { type: 'RESET' })).toEqual(INITIAL_SESSION_STATE);
  });

  it('CURSOR_MOVED met à jour la position sans jamais changer le statut (reste en pause)', () => {
    const paused = { ...INITIAL_SESSION_STATE, status: 'paused' as const, cueId: 's1', pageIndex: 0 };
    const next = reduceSession(paused, { type: 'CURSOR_MOVED', cueId: 's4', pageIndex: 2, chapter: 'Chapitre 2' });
    expect(next.status).toBe('paused'); // navigation manuelle en pause : ne relance jamais la lecture
    expect(next.cueId).toBe('s4');
    expect(next.pageIndex).toBe(2);
    expect(next.chapter).toBe('Chapitre 2');
  });
});
