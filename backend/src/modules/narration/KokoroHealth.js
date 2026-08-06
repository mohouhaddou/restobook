'use strict';

/**
 * Vérifie que Kokoro est réellement opérationnel : modèle présent, chargement en mémoire réussi,
 * synthèse réelle d'un texte court produisant un WAV valide non vide.
 * Usage : node src/modules/narration/KokoroHealth.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const KokoroProvider = require('./providers/KokoroProvider');

async function checkHealth() {
  const report = { modelPresent: false, modelLoads: false, synthesizes: false, errors: [] };

  report.modelPresent = KokoroProvider.isAvailable();
  if (!report.modelPresent) {
    report.errors.push('Modèle non installé — lancer `node src/modules/narration/KokoroInstaller.js`.');
    return report;
  }

  try {
    await KokoroProvider.warmUp();
    report.modelLoads = true;
  } catch (e) {
    report.errors.push(`Échec de chargement du modèle : ${e.message}`);
    return report;
  }

  const outputPath = path.join(os.tmpdir(), `kokoro-health-${Date.now()}.wav`);
  try {
    await KokoroProvider.synthesize('This is a Kokoro health check.', { voice: 'af_heart', lang: 'en', outputPath });
    report.synthesizes = fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0;
  } catch (e) {
    report.errors.push(`Échec de synthèse : ${e.message}`);
  } finally {
    fs.rmSync(outputPath, { force: true });
  }

  return report;
}

if (require.main === module) {
  checkHealth().then(report => {
    console.log(JSON.stringify(report, null, 2));
    const healthy = report.modelPresent && report.modelLoads && report.synthesizes;
    console.log(healthy ? '✅ Kokoro est opérationnel.' : '❌ Kokoro a un problème — voir errors ci-dessus.');
    process.exit(healthy ? 0 : 1);
  });
}

module.exports = { checkHealth };
