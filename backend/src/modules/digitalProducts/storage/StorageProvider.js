'use strict';

/**
 * Contrat commun à tout backend de stockage des fichiers générés (PDF/audiobook/...). Aujourd'hui
 * seul LocalStorageProvider existe ; demain S3Provider/R2Provider/BackblazeProvider/AzureBlob
 * implémentent exactement cette même interface — aucun appelant (generationService, routes de
 * téléchargement) ne doit jamais changer.
 *
 * `relativePath` est toujours un chemin logique choisi par l'appelant (ex.
 * `digital-product-42/v1/livre.pdf`), jamais un chemin absolu ni une URL — c'est au provider de
 * décider où/comment le stocker réellement.
 */
class StorageProvider {
  /** @returns {Promise<void>} */
  async save(_buffer, _relativePath) { throw new Error('StorageProvider.save() not implemented'); }

  /** @returns {Promise<Buffer>} */
  async read(_relativePath) { throw new Error('StorageProvider.read() not implemented'); }

  /** @returns {Promise<boolean>} */
  async exists(_relativePath) { throw new Error('StorageProvider.exists() not implemented'); }

  /** @returns {Promise<void>} */
  async delete(_relativePath) { throw new Error('StorageProvider.delete() not implemented'); }

  /** @returns {NodeJS.ReadableStream} */
  getStream(_relativePath) { throw new Error('StorageProvider.getStream() not implemented'); }
}

module.exports = { StorageProvider };
