import React from 'react';
import { Download, WifiOff, X } from 'lucide-react';

export default function PlayPwaBanner({ canInstall, online, onInstall, onDismiss }) {
  if (online && !canInstall) return null;
  if (!online) return <aside className="play-pwa-banner offline" role="status" aria-live="polite"><WifiOff aria-hidden="true"/><div><strong>Mode hors ligne</strong><span>Les jeux iFilino déjà chargés restent disponibles.</span></div></aside>;
  return <aside className="play-pwa-banner" aria-label="Installer iFilino Play"><Download aria-hidden="true"/><div><strong>Gardez iFilino Play à portée de main</strong><span>Installez l’application pour lancer vos jeux plus rapidement.</span></div><button type="button" className="play-pwa-install" onClick={onInstall}>Installer</button><button type="button" className="play-pwa-close" onClick={onDismiss} aria-label="Masquer la proposition d’installation"><X aria-hidden="true"/></button></aside>;
}
