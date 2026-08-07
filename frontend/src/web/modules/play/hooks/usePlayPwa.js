import { useCallback, useEffect, useState } from 'react';

const DISMISS_KEY = 'ifilino-play-install-dismissed';

export default function usePlayPwa() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [installed, setInstalled] = useState(() => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === '1');
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(() => undefined);
    const handleInstall = event => { event.preventDefault(); setInstallPrompt(event); };
    const handleInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    const handleOnline = () => setOnline(true), handleOffline = () => setOnline(false);
    window.addEventListener('beforeinstallprompt', handleInstall); window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('beforeinstallprompt', handleInstall); window.removeEventListener('appinstalled', handleInstalled); window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);
  const install = useCallback(async () => { if (!installPrompt) return false; await installPrompt.prompt(); const choice = await installPrompt.userChoice; setInstallPrompt(null); return choice.outcome === 'accepted'; }, [installPrompt]);
  const dismiss = useCallback(() => { sessionStorage.setItem(DISMISS_KEY, '1'); setDismissed(true); }, []);
  return { canInstall: Boolean(installPrompt) && !installed && !dismissed, install, dismiss, online };
}
