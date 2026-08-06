'use strict';

const crypto = require('crypto');
const { GeneratedFile } = require('../../../models');
const { getGenerator } = require('./generators/GeneratorRegistry');
const { getStorageProvider } = require('./storage');

/**
 * Orchestration de la génération d'un fichier — jamais de queue externe (aucune infra de ce type
 * n'existe dans ce projet, voir le plan), mais jamais non plus de génération synchrone dans une
 * requête HTTP (le précédent aiImageService.js cause déjà des 502 nginx avec ce pattern). La
 * génération réelle tourne en arrière-plan (`runGeneration`, jamais `await` par l'appelant) ; le
 * frontend poll GET /digital-products/:id/status jusqu'à `ready`/`failed`.
 */

function isStale(generatedFile, story) {
  if (!generatedFile.generated_at) return true;
  return new Date(generatedFile.generated_at) < new Date(story.updated_at);
}

// File d'attente process-wide, toutes générations confondues — jamais deux générations en
// parallèle sur cette machine. Garde-fou délibérément large (pas seulement pour PdfGenerator, qui
// pilote un Chromium headless réel) : ce serveur (1.9 Go RAM, déjà vu OOM sur un simple build)
// n'a aucune marge pour deux jobs lourds simultanés, quel que soit leur type.
let generationQueue = Promise.resolve();
function enqueue(task) {
  const result = generationQueue.then(task, task);
  generationQueue = result.catch(() => {}); // une erreur ne bloque jamais la file pour la suite
  return result;
}

async function runGeneration(generatedFileId, digitalProduct, story) {
  try {
    const generator = getGenerator(digitalProduct.type);
    const { buffer, mimeType, extension } = await generator.generate({ digitalProduct, story });
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    const file = await GeneratedFile.findByPk(generatedFileId);
    if (!file) return; // ligne supprimée entre-temps (produit supprimé) — rien à mettre à jour

    const relativePath = `digital-product-${digitalProduct.id}/v${file.version}/file.${extension}`;
    await getStorageProvider().save(buffer, relativePath);

    await file.update({
      status: 'ready',
      checksum,
      storage_path: relativePath,
      mime_type: mimeType,
      size: buffer.length,
      generated_at: new Date(),
      error_message: null,
    });
  } catch (err) {
    await GeneratedFile.update(
      { status: 'failed', error_message: String(err.message || err).slice(0, 500) },
      { where: { id: generatedFileId } }
    ).catch(() => {}); // ne jamais faire planter le process pour une écriture d'échec
  }
}

/**
 * Renvoie le GeneratedFile courant (cache, jamais régénéré s'il est valide), ou en crée un
 * nouveau et lance sa génération en arrière-plan.
 * @returns {Promise<object>} la ligne GeneratedFile (status 'ready' ou 'generating')
 */
async function ensureGeneratedFile(digitalProduct, story) {
  const latest = await GeneratedFile.findOne({
    where: { digital_product_id: digitalProduct.id },
    order: [['version', 'DESC']],
  });

  if (latest && latest.status === 'ready' && !isStale(latest, story)) {
    return latest; // cache valide — jamais régénéré (section "Cache" du cahier des charges)
  }
  if (latest && latest.status === 'generating') {
    return latest; // génération déjà en cours — ne pas en démarrer une seconde en parallèle
  }
  if (latest && latest.status === 'ready' && isStale(latest, story)) {
    await latest.update({ status: 'obsolete' }); // Story modifiée depuis — périmé (section "Cache")
  }

  const nextVersion = latest ? latest.version + 1 : 1;
  const file = await GeneratedFile.create({
    digital_product_id: digitalProduct.id,
    version: nextVersion,
    status: 'generating',
  });

  // Fire-and-forget, jamais await ici — mais toujours mis en file (enqueue), jamais lancé en
  // parallèle d'une autre génération en cours.
  enqueue(() => runGeneration(file.id, digitalProduct, story)).catch(() => {});

  return file;
}

async function getStatus(generatedFileId) {
  return GeneratedFile.findByPk(generatedFileId);
}

module.exports = { ensureGeneratedFile, getStatus };
