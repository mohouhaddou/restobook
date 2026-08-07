/**
 * Mémorise le narrateur choisi par l'utilisateur, par langue — survit à un rechargement de page
 * (localStorage). N'existait pas avant le remplacement de Piper par Kokoro comme moteur
 * principal ; créé à cette occasion car le catalogue de voix change et il devient utile de ne
 * pas redemander un choix à chaque histoire. Ne fait que stocker/lire un identifiant : c'est à
 * l'appelant (BookReader.tsx) de vérifier que la voix mémorisée existe encore dans le registre
 * courant (voir VoiceManager.ts) et de retomber sur la meilleure voix compatible sinon.
 */
const STORAGE_KEY = 'ifilino:narrator-registry';

function readAll(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Stockage indisponible (navigation privée, quota plein...) — la mémorisation du narrateur
    // est un confort, pas une exigence fonctionnelle : on échoue silencieusement.
  }
}

export function getRememberedVoice(language: string): string | null {
  return readAll()[language] ?? null;
}

export function rememberVoice(language: string, voiceId: string): void {
  const all = readAll();
  all[language] = voiceId;
  writeAll(all);
}

export function forgetVoice(language: string): void {
  const all = readAll();
  delete all[language];
  writeAll(all);
}
