'use strict';

const fs = require('fs');
const path = require('path');
const { StorageProvider } = require('./StorageProvider');

// Racine délibérément hors de backend/uploads/ (jamais servi par le express.static de
// backend/index.js) : un produit numérique est payant, son fichier ne doit jamais être
// atteignable par une URL publique devinable — seule la route authentifiée de téléchargement
// (voir routes.js) y donne accès, via getStream().
const ROOT_DIR = path.join(__dirname, '../../../../storage', 'digital-products');

function resolve(relativePath) {
  const abs = path.join(ROOT_DIR, relativePath);
  // Un relativePath ne provient jamais d'une entrée utilisateur libre (toujours construit côté
  // serveur à partir d'un id numérique, voir generationService.js) — cette vérification est un
  // filet de sécurité, pas la défense principale.
  if (!abs.startsWith(ROOT_DIR)) throw new Error('Invalid storage path');
  return abs;
}

class LocalStorageProvider extends StorageProvider {
  async save(buffer, relativePath) {
    const abs = resolve(relativePath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buffer);
  }

  async read(relativePath) {
    return fs.promises.readFile(resolve(relativePath));
  }

  async exists(relativePath) {
    return fs.existsSync(resolve(relativePath));
  }

  async delete(relativePath) {
    const abs = resolve(relativePath);
    if (fs.existsSync(abs)) await fs.promises.unlink(abs);
  }

  getStream(relativePath) {
    return fs.createReadStream(resolve(relativePath));
  }
}

module.exports = { LocalStorageProvider };
