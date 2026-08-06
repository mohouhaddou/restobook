'use strict';

/**
 * Installe Kokoro TTS : télécharge le modèle ONNX (dtype configuré, voir KokoroConfig.js) dans
 * backend/models/kokoro/ s'il n'y est pas déjà présent — idempotent, sûr à relancer (ex. après un
 * déploiement qui aurait vidé node_modules, ou en CI). Les voix elles-mêmes (petits fichiers
 * .bin, quelques centaines de Ko chacune) sont fournies par le paquet kokoro-js et n'ont pas
 * besoin d'être téléchargées séparément.
 *
 * Usage : node src/modules/narration/KokoroInstaller.js
 *         (ou npm run kokoro:install depuis backend/, voir package.json)
 */

const config = require('./KokoroConfig');
const KokoroProvider = require('./providers/KokoroProvider');

async function install() {
  console.log(`Installation de Kokoro TTS — modèle ${config.MODEL_ID} (dtype ${config.DTYPE}, device ${config.DEVICE})`);
  console.log(`Répertoire de cache : ${config.CACHE_DIR}`);

  if (KokoroProvider.isAvailable()) {
    console.log('✅ Déjà installé — rien à télécharger.');
    return;
  }

  console.log('Téléchargement en cours (peut prendre une minute selon la connexion, ~90 Mo)...');
  const t0 = Date.now();
  await KokoroProvider.warmUp();
  console.log(`✅ Modèle installé et chargé en ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
}

if (require.main === module) {
  install().catch(err => {
    console.error('❌ Échec de l\'installation Kokoro :', err.message);
    process.exit(1);
  });
}

module.exports = { install };
