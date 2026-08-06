import { useCallback, useRef, useState } from 'react';

// Web Speech API native — aucune dépendance externe, aucun service tiers.
// Dégradation identique à BarcodeCameraScanner.jsx : `supported` piloté par le
// caller pour désactiver/masquer le bouton, jamais de blocage silencieux.
export function useVoiceInput({ lang = 'fr-FR' } = {}) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  const SpeechRecognitionCtor = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;
  const supported = !!SpeechRecognitionCtor;

  const start = useCallback((onResult) => {
    if (!supported) return;
    setError(null);
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript || '';
      onResult(transcript);
    };
    recognition.onerror = () => setError("Je n'ai pas compris — réessayez ou tapez votre article.");
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [supported, lang]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, error, start, stop };
}
