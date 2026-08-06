import React, { useEffect, useRef, useState } from 'react';
import { Download, RotateCcw, Square, Video, VolumeX, Volume2, X } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useI18n } from '../../../i18n/config';
import useGameplayRecorder, { isGameplayRecordingSupported, isLikelyMobileDevice } from '../hooks/useGameplayRecorder';

function pad(value) { return String(value).padStart(2, '0'); }
function formatCountdown(seconds) { return `00:${pad(seconds)}`; }

function buildFileName(slugOrId) {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const slug = String(slugOrId || 'game').trim() || 'game';
  return `ifilino-play-${slug}-${stamp}.webm`;
}

export default function GameplayRecorderControl({ game }) {
  const { isSuperAdmin } = useAuth();
  const { t } = useI18n();
  const { status, secondsLeft, errorCode, audioWarning, videoUrl, start, stop, restart, close } = useGameplayRecorder();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const isPartner = game?.source === 'partner';
  const partnerAllowed = !isPartner || game?.config?.allowGameplayRecording === true;
  const supported = isGameplayRecordingSupported();
  const mobile = isLikelyMobileDevice();

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnOutside = (event) => { if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false); };
    const closeOnEscape = (event) => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('mousedown', closeOnOutside);
    window.addEventListener('keydown', closeOnEscape);
    return () => { window.removeEventListener('mousedown', closeOnOutside); window.removeEventListener('keydown', closeOnEscape); };
  }, [menuOpen]);

  if (!isSuperAdmin || mobile || !partnerAllowed || !supported) return null;

  function download() {
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = buildFileName(game?.slug || game?.id);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function pick(withAudio) {
    setMenuOpen(false);
    start(withAudio);
  }

  return <div className="play-record-wrap" ref={menuRef}>
    {status === 'idle' && <button type="button" className="play-record-btn" onClick={() => setMenuOpen((v) => !v)} aria-haspopup="true" aria-expanded={menuOpen} aria-label={t('play.shell.record.button')} title={t('play.shell.record.button')}><Video/></button>}
    {status === 'idle' && menuOpen && <div className="play-record-menu" role="menu">
      <span className="play-record-menu-title">{t('play.shell.record.choose')}</span>
      <button type="button" role="menuitem" onClick={() => pick(true)}><Volume2 size={16}/>{t('play.shell.record.withAudio')}</button>
      <button type="button" role="menuitem" onClick={() => pick(false)}><VolumeX size={16}/>{t('play.shell.record.withoutAudio')}</button>
      <button type="button" role="menuitem" className="cancel" onClick={() => setMenuOpen(false)}>{t('play.shell.record.cancel')}</button>
    </div>}

    {status === 'requesting' && <button type="button" className="play-record-btn" disabled aria-label={t('play.shell.record.requesting')} title={t('play.shell.record.requesting')}><Video/></button>}

    {status === 'error' && <div className="play-record-menu error" role="alert">
      <span>{t(`play.shell.record.error.${errorCode || 'failed'}`)}</span>
      <button type="button" onClick={close}>{t('play.shell.record.close')}</button>
    </div>}

    {status === 'recording' && <div className="play-record-banner" role="status" aria-live="polite">
      <span className="play-record-dot" aria-hidden="true"/>
      <span className="play-record-time">{formatCountdown(secondsLeft)}</span>
      {audioWarning && <span className="play-record-warning">{t('play.shell.record.audioUnavailable')}</span>}
      <button type="button" className="play-record-stop" onClick={stop}><Square size={14}/>{t('play.shell.record.stop')}</button>
    </div>}

    {status === 'preview' && <div className="play-record-preview-backdrop" role="dialog" aria-modal="true" aria-labelledby="play-record-preview-title">
      <div className="play-record-preview">
        <h2 id="play-record-preview-title">{t('play.shell.record.preview.title')}</h2>
        <video src={videoUrl} controls autoPlay muted={false} playsInline/>
        <div className="play-record-preview-actions">
          <button type="button" className="play-btn" onClick={download}><Download size={16}/>{t('play.shell.record.download')}</button>
          <button type="button" className="play-btn secondary" onClick={restart}><RotateCcw size={16}/>{t('play.shell.record.restart')}</button>
          <button type="button" className="play-btn secondary" onClick={close}><X size={16}/>{t('play.shell.record.close')}</button>
        </div>
      </div>
    </div>}
  </div>;
}
