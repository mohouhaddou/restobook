/**
 * Bip sonore court (Web Audio API, aucun fichier audio nécessaire) — joué à
 * chaque détection de code-barres, scanner physique ou caméra, pour confirmer
 * la lecture comme le ferait une douchette classique.
 */
let audioCtx;

export function playBeep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});

    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 1000;
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.15);
  } catch { /* audio indisponible — ne doit jamais bloquer le scan */ }
}
