'use strict';

/**
 * Tests — Narration Engine backend (backend/src/modules/narration/).
 * Usage : node tests/narration_engine.test.js
 * Nécessite Kokoro installé (backend/models/kokoro/, voir `npm run kokoro:install`) et Piper
 * installé (backend/vendor/piper + backend/models/piper) — sinon les tests de synthèse réelle
 * échouent volontairement (pas de mock : on vérifie les vrais moteurs).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const cache = require('../src/modules/narration/cache');
const KokoroProvider = require('../src/modules/narration/providers/KokoroProvider');
const PiperProvider = require('../src/modules/narration/providers/PiperProvider');
const SherpaOnnxProvider = require('../src/modules/narration/providers/SherpaOnnxProvider');
const CoquiXttsProvider = require('../src/modules/narration/providers/CoquiXttsProvider');
const providerManager = require('../src/modules/narration/ProviderManager');
const service = require('../src/modules/narration/service');
const { readWavDurationMs } = require('../src/modules/narration/wav');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

function cleanup(...paths) {
  for (const p of paths) fs.rmSync(p, { force: true });
}

async function run() {
  // cache.js — clé stable, discriminante, et versionnée.
  {
    const k1 = cache.keyFor('Bonjour le monde', 'fr_FR-siwis-medium', 'fr');
    const k2 = cache.keyFor('Bonjour le monde', 'fr_FR-siwis-medium', 'fr');
    const k3 = cache.keyFor('Bonjour le monde !', 'fr_FR-siwis-medium', 'fr');
    const k4 = cache.keyFor('Bonjour le monde', 'autre-voix', 'fr');
    assert(k1 === k2, 'même texte/voix/langue => même clé de cache');
    assert(k1 !== k3, 'un texte différent (même un seul caractère) => clé différente');
    assert(k1 !== k4, 'une voix différente => clé différente');
    assert(cache.has(`inexistant-${k1}`) === false, 'has() renvoie false pour une clé absente du disque');
    // La clé inclut une version (v2) : un ancien fichier généré par Piper avant l'arrivée de
    // Kokoro (clé calculée sans ce préfixe) ne peut donc jamais être resservi par erreur.
    const crypto = require('crypto');
    const legacyV1Key = crypto.createHash('sha256').update('fr::fr_FR-siwis-medium::Bonjour le monde').digest('hex');
    assert(k1 !== legacyV1Key, 'la clé v2 diffère de ce qu\'aurait produit l\'ancien format (v1) — invalide tout cache pré-Kokoro');
  }

  // ProviderManager — nouvel ordre de priorité : Kokoro (principal) → Sherpa-ONNX → Piper → Coqui.
  {
    assert(providerManager.PROVIDERS.map(p => p.id).join(',') === 'kokoro,sherpa-onnx,piper,coqui-xtts',
      "l'ordre de priorité déclaré est bien Kokoro → Sherpa-ONNX → Piper → Coqui XTTS");
    assert(SherpaOnnxProvider.isAvailable() === false, 'Sherpa-ONNX non installé dans cet environnement (provider prêt mais inactif)');
    assert(CoquiXttsProvider.isAvailable() === false, 'Coqui XTTS non installé dans cet environnement (provider prêt mais inactif)');
    try {
      await SherpaOnnxProvider.synthesize('test', { outputPath: '/tmp/should-not-exist.wav' });
      assert(false, 'SherpaOnnxProvider.synthesize doit rejeter tant que non installé');
    } catch (e) {
      assert(/non install/i.test(e.message), 'SherpaOnnxProvider rejette avec un message explicite "non installé"');
    }
  }

  // KokoroProvider — moteur principal, réellement installé, synthèse anglaise réelle.
  {
    assert(KokoroProvider.isAvailable() === true, 'Kokoro est installé et détecté disponible (modèle ONNX en cache local)');
    assert(KokoroProvider.supportsLanguage('en') === true, 'Kokoro déclare supporter l\'anglais');
    assert(KokoroProvider.supportsLanguage('fr') === false, 'Kokoro déclare NE PAS supporter le français (aucune voix fr dans kokoro-js à ce jour)');
    assert(KokoroProvider.supportsLanguage('ar') === false, 'Kokoro déclare NE PAS supporter l\'arabe (aucune voix ar dans kokoro-js à ce jour)');

    const enVoices = await KokoroProvider.listVoices('en');
    assert(enVoices.length > 10, `Kokoro expose un vrai catalogue de voix anglaises (${enVoices.length} voix, jamais codées en dur)`);
    assert(enVoices.every(v => v.id && v.label && (v.gender === 'male' || v.gender === 'female')), 'chaque voix listée a un id, un label et un genre exploitables');
    const frVoices = await KokoroProvider.listVoices('fr');
    assert(frVoices.length === 0, 'Kokoro ne liste aucune voix française (cohérent avec supportsLanguage)');

    const outputPath = path.join(os.tmpdir(), `kokoro-test-${Date.now()}.wav`);
    try {
      await KokoroProvider.synthesize('This is a short test of the Kokoro narrator.', { lang: 'en', outputPath });
      assert(fs.existsSync(outputPath), 'KokoroProvider.synthesize produit bien un fichier');
      const buf = fs.readFileSync(outputPath);
      assert(buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE', 'le fichier produit est un WAV RIFF valide');
    } finally {
      cleanup(outputPath);
    }

    // Une voix inconnue (ex. ancien identifiant Piper mémorisé avant cette migration) ne doit
    // jamais faire échouer la synthèse — Kokoro retombe sur sa meilleure voix anglaise.
    const fallbackOutput = path.join(os.tmpdir(), `kokoro-fallback-voice-${Date.now()}.wav`);
    try {
      await KokoroProvider.synthesize('Fallback voice test.', { voice: 'en_US-amy-medium', lang: 'en', outputPath: fallbackOutput });
      assert(fs.existsSync(fallbackOutput), 'un identifiant de voix invalide (d\'un autre provider) ne fait pas échouer Kokoro : repli sur sa meilleure voix');
    } finally {
      cleanup(fallbackOutput);
    }
  }

  // PiperProvider — synthèse réelle, toujours le SEUL provider réel pour français/arabe.
  {
    assert(PiperProvider.isAvailable() === true, 'Piper est installé et détecté disponible (binaire + modèle vocal fr)');
    assert(PiperProvider.supportsLanguage('fr') && PiperProvider.supportsLanguage('en') && PiperProvider.supportsLanguage('ar'),
      'Piper couvre fr/en/ar (voix installées lors du chantier précédent)');

    const outputPath = path.join(os.tmpdir(), `piper-test-${Date.now()}.wav`);
    try {
      await PiperProvider.synthesize('Ceci est un court test de synthèse vocale.', { lang: 'fr', outputPath });
      assert(fs.existsSync(outputPath), 'PiperProvider.synthesize produit bien un fichier');
      const buf = fs.readFileSync(outputPath);
      assert(buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE', 'le fichier produit est un WAV RIFF valide');
      const durationMs = readWavDurationMs(outputPath);
      assert(durationMs > 0, `wav.js lit une durée réelle positive (${durationMs}ms)`);
    } finally {
      cleanup(outputPath);
    }
  }

  // PiperProvider — voix par défaut PAR LANGUE (bug corrigé : le défaut était toujours français,
  // quelle que soit la langue demandée, quand aucune voix explicite n'était fournie).
  {
    const outputPath = path.join(os.tmpdir(), `piper-default-en-${Date.now()}.wav`);
    try {
      // Aucune `voice` fournie, lang='en' : ne doit PAS utiliser la voix française par défaut.
      await PiperProvider.synthesize('Default voice for English.', { lang: 'en', outputPath });
      assert(fs.existsSync(outputPath), 'Piper synthétise avec la voix par défaut anglaise quand lang="en" et aucune voix fournie');
    } finally {
      cleanup(outputPath);
    }
  }

  // PiperProvider — voix supplémentaires installées (homme/femme FR, homme AR, homme/femme EN-US).
  {
    const extraVoices = ['fr_FR-tom-medium', 'ar_JO-kareem-medium', 'en_US-ryan-medium', 'en_US-amy-medium'];
    for (const voice of extraVoices) {
      const outputPath = path.join(os.tmpdir(), `piper-voice-test-${voice}-${Date.now()}.wav`);
      try {
        await PiperProvider.synthesize('Test.', { voice, outputPath });
        const buf = fs.readFileSync(outputPath);
        assert(buf.toString('ascii', 0, 4) === 'RIFF', `la voix ${voice} est installée et synthétise un WAV valide`);
      } finally {
        cleanup(outputPath);
      }
    }
  }

  // ProviderManager — sélection PAR LANGUE : c'est le cœur du fallback automatique.
  {
    assert(providerManager.activeProvider({ lang: 'en' })?.id === 'kokoro', "langue 'en' → Kokoro (moteur principal, la couvre réellement)");
    assert(providerManager.activeProvider({ lang: 'fr' })?.id === 'piper', "langue 'fr' → Piper (Kokoro ne la couvre pas : bascule automatique, pas une panne)");
    assert(providerManager.activeProvider({ lang: 'ar' })?.id === 'piper', "langue 'ar' → Piper (idem)");
    assert(providerManager.activeProvider()?.id === 'kokoro', 'sans langue précisée → le premier provider disponible tout court (Kokoro)');
  }

  // ProviderManager — /voices reflète EXACTEMENT le provider qui sera utilisé pour synthétiser.
  {
    const enVoices = await providerManager.listVoices('en');
    assert(enVoices.length > 10 && enVoices.every(v => v.providerId === 'kokoro'), 'les voix listées pour "en" viennent de Kokoro, cohérent avec activeProvider({lang:"en"})');
    const frVoices = await providerManager.listVoices('fr');
    assert(frVoices.length === 2 && frVoices.every(v => v.providerId === 'piper'), 'les voix listées pour "fr" viennent de Piper (Siwis + Tom)');
    const arVoices = await providerManager.listVoices('ar');
    assert(arVoices.length === 1 && arVoices[0].providerId === 'piper', 'les voix listées pour "ar" viennent de Piper (Kareem uniquement)');
  }

  // ProviderManager — bascule Kokoro → Piper si Kokoro devient indisponible, MÊME pour l'anglais.
  {
    const originalKokoroAvailable = KokoroProvider.isAvailable;
    KokoroProvider.isAvailable = () => false;
    try {
      assert(providerManager.activeProvider({ lang: 'en' })?.id === 'piper', 'Kokoro down → l\'anglais bascule sur Piper (filet de sécurité), pas de panne totale');
    } finally {
      KokoroProvider.isAvailable = originalKokoroAvailable;
    }
    assert(providerManager.activeProvider({ lang: 'en' })?.id === 'kokoro', 'Kokoro redevient le provider actif pour l\'anglais une fois isAvailable() restauré');
  }

  // ProviderManager — bascule si TOUS les providers deviennent indisponibles (aucune langue ne répond).
  {
    const originalKokoro = KokoroProvider.isAvailable;
    const originalPiper = PiperProvider.isAvailable;
    KokoroProvider.isAvailable = () => false;
    PiperProvider.isAvailable = () => false;
    try {
      assert(providerManager.activeProvider() === null, 'aucun provider disponible => activeProvider() renvoie null');
      let threw = false;
      try {
        await providerManager.synthesize('texte', { lang: 'fr', outputPath: '/tmp/unused.wav' });
      } catch (e) {
        threw = true;
        assert(e.code === 'NO_PROVIDER_AVAILABLE', 'synthesize() lève une erreur au code NO_PROVIDER_AVAILABLE quand aucun provider ne répond');
      }
      assert(threw, "synthesize() rejette (ne renvoie jamais silencieusement) quand aucun provider n'est disponible");
    } finally {
      KokoroProvider.isAvailable = originalKokoro;
      PiperProvider.isAvailable = originalPiper;
    }
    assert(providerManager.activeProvider()?.id === 'kokoro', 'Kokoro redevient le provider actif une fois isAvailable() restauré partout');
  }

  // service.synthesizeText — bout en bout pour CHAQUE langue, cache miss puis cache hit.
  {
    const enText = `Kokoro cache test ${Date.now()} for English narration.`;
    const r1 = await service.synthesizeText({ text: enText, lang: 'en' });
    assert(r1.cached === false, '[en] premier appel : cache miss, synthèse réelle déclenchée');
    assert(r1.providerId === 'kokoro', '[en] le provider utilisé est bien Kokoro');
    assert(r1.durationMs > 0, '[en] durée audio réelle > 0 renvoyée');
    assert(/^\/uploads\/narration-cache\/.+\.wav$/.test(r1.audioUrl), "[en] l'URL audio pointe vers /uploads/narration-cache/");

    const r2 = await service.synthesizeText({ text: enText, lang: 'en' });
    assert(r2.cached === true, '[en] second appel : servi depuis le cache, pas de resynthèse Kokoro');
    assert(r2.audioUrl === r1.audioUrl, '[en] même fichier audio renvoyé');

    const frText = `Texte de test narration ${Date.now()} pour vérifier le cache français.`;
    const r3 = await service.synthesizeText({ text: frText, lang: 'fr' });
    assert(r3.cached === false, '[fr] premier appel : cache miss');
    assert(r3.providerId === 'piper', '[fr] le provider utilisé est bien Piper (fallback automatique)');

    const r4 = await service.synthesizeText({ text: frText, lang: 'fr' });
    assert(r4.cached === true, '[fr] second appel : servi depuis le cache');

    // Nettoyage — ne pas laisser de résidus de test dans le cache de production.
    for (const r of [r1, r3]) {
      const cachedPath = path.join(__dirname, '..', r.audioUrl.replace('/uploads/', 'uploads/'));
      cleanup(cachedPath);
    }
  }

  console.log(`\n${pass} succès, ${fail} échec(s)\n`);
  if (fail > 0) process.exit(1);
}

run();
