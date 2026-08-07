import React from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause, RotateCcw, Mic, Minus, Plus, BookOpenCheck, ArrowLeft, Maximize, Minimize, User } from 'lucide-react';
import type { NarrationEngineApi } from './narration/NarrationEngine';
import type { NarrationVoice } from './narration/VoiceManager';
import { translate } from '../../../../../i18n/config';

export type NarrationLanguage = 'fr' | 'ar' | 'en';
export const NARRATION_RATES = [0.75, 1, 1.25, 1.5] as const;
export type NarrationRate = (typeof NARRATION_RATES)[number];

export interface NarrationBarProps {
  readonly narration: NarrationEngineApi;
  readonly language: NarrationLanguage;
  /** Voix disponibles pour la langue du texte affiché — déjà filtrées par BookReader.tsx via
   * VoiceManager.listAvailableVoices(language) (jamais codées en dur ici) ; pas de sélecteur de
   * langue dans cette barre, la langue elle-même est détectée depuis le contenu. Vide tant que
   * le fetch n'a pas répondu. */
  readonly voices: readonly NarrationVoice[];
  readonly voice: string | null;
  readonly onVoiceChange: (voiceId: string) => void;
  readonly fontScale: number;
  readonly onFontScaleChange: (scale: number) => void;
  /** Retour au portail — remplace l'ancienne barre du haut, supprimée en page Stories (voir
   * PortalDetailPage.jsx) : tout le chrome de lecture vit désormais dans cette seule barre. */
  readonly backTo?: string;
  readonly backLabel?: string;
  readonly isFullscreen?: boolean;
  readonly onToggleFullscreen?: () => void;
}

/**
 * Barre de narration — pilote le Narration Engine (voir narration/NarrationEngine.ts), jamais
 * l'inverse. Un seul bouton principal lit TOUTE l'histoire en continu (titre → paragraphes →
 * dialogues → chapitre suivant → fin), sans jamais s'arrêter à un changement de page. Le menu
 * "Reprendre depuis..." permet de relancer la lecture à un chapitre précis sans perdre sa place
 * dans le livre. speechSynthesis n'est JAMAIS piloté directement ici — uniquement via le moteur.
 * Regroupe aussi retour et plein écran : la page Stories n'a plus qu'une seule barre de chrome.
 */
export function NarrationBar({
  narration, language, voices, voice, onVoiceChange, fontScale, onFontScaleChange,
  backTo, backLabel = translate(language, 'portals.back'), isFullscreen = false, onToggleFullscreen,
}: NarrationBarProps) {
  const t = (key: string) => translate(language, key);
  const isPlaying = narration.status === 'playing';
  const isPaused = narration.status === 'paused';
  const hasSession = isPlaying || isPaused;

  const handleMainButton = () => {
    if (isPlaying) narration.pause();
    else if (isPaused) narration.resume();
    else narration.playAll();
  };

  return (
    <div className="storybook-narration" role="toolbar" aria-label={t('kids.reader.audioNarration')}>
      {backTo && (
        <Link className="storybook-narration-btn" to={backTo} aria-label={backLabel} title={backLabel}>
          <ArrowLeft size={18} />
        </Link>
      )}

      <button
        type="button"
        className="storybook-narration-btn storybook-narration-play storybook-narration-main"
        onClick={handleMainButton}
        aria-label={isPlaying ? t('kids.reader.pause') : hasSession ? t('kids.reader.resume') : t('kids.reader.readAll')}
      >
        {isPlaying ? <Pause size={22} /> : <Play size={22} />}
        <span>{isPlaying ? t('kids.reader.pause') : isPaused ? t('kids.reader.resume') : t('kids.reader.readAll')}</span>
      </button>

      {hasSession && (
        <button type="button" className="storybook-narration-btn" onClick={() => narration.stop()} aria-label={t('kids.reader.stop')}>
          <RotateCcw size={18} />
        </button>
      )}

      {narration.chapters.length > 0 && (
        <label className="storybook-narration-field storybook-narration-resume">
          <BookOpenCheck size={16} />
          <select
            value={narration.activeChapter ?? ''}
            onChange={e => { if (e.target.value) narration.resumeFromChapter(e.target.value); }}
            aria-label={t('kids.reader.resumeChapter')}
          >
            <option value="" disabled>{t('kids.reader.resumeFrom')}</option>
            {narration.chapters.map(chapter => <option key={chapter} value={chapter}>{chapter}</option>)}
          </select>
        </label>
      )}

      {voices.length > 0 && (
        <label className="storybook-narration-field storybook-narration-voice">
          <User size={16} />
          <select value={voice ?? ''} onChange={e => onVoiceChange(e.target.value)} aria-label={t('kids.reader.narratorVoice')}>
            {voices.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </label>
      )}

      <label className="storybook-narration-field">
        <select
          value={narration.rate}
          onChange={e => narration.setRate(Number(e.target.value))}
          aria-label={t('kids.reader.readingSpeed')}
        >
          {NARRATION_RATES.map(r => <option key={r} value={r}>{r}×</option>)}
        </select>
      </label>

      <div className="storybook-narration-field storybook-narration-font" role="group" aria-label={t('kids.reader.textSize')}>
        <button type="button" onClick={() => onFontScaleChange(Math.max(0.85, fontScale - 0.1))} aria-label={t('kids.reader.decreaseText')}><Minus size={14} /></button>
        <span aria-hidden="true">A</span>
        <button type="button" onClick={() => onFontScaleChange(Math.min(1.4, fontScale + 0.1))} aria-label={t('kids.reader.increaseText')}><Plus size={14} /></button>
      </div>

      <span className="storybook-narration-provider" title={narration.usingFallback ? t('kids.reader.browserVoiceHelp') : narration.providerLabel ?? undefined}>
        <Mic size={14} />
        {narration.usingFallback ? t('kids.reader.browserVoice') : narration.providerLabel ?? (narration.providerAvailable ? '' : t('kids.reader.voiceUnavailable'))}
      </span>

      {onToggleFullscreen && (
        <button
          type="button"
          className="storybook-narration-btn"
          onClick={onToggleFullscreen}
          aria-label={isFullscreen ? t('kids.reader.exitFullscreen') : t('kids.reader.fullscreen')}
          title={isFullscreen ? t('kids.reader.exitFullscreen') : t('kids.reader.fullscreen')}
        >
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
      )}
    </div>
  );
}
