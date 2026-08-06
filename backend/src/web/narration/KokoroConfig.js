'use strict';

const path = require('path');

/**
 * Configuration Kokoro TTS — moteur principal (voir ProviderManager.js). Un seul modèle ONNX
 * partagé par TOUTES les voix (contrairement à Piper, un modèle par voix) : `dtype` choisit le
 * compromis qualité/vitesse/poids (voir docs/Voices.md pour le détail des options disponibles).
 *
 * CACHE_DIR pointe hors de node_modules, dans backend/models/ (même convention que
 * backend/models/piper/) : @huggingface/transformers mettrait sinon le modèle en cache DANS
 * node_modules par défaut, qui peut être supprimé/reconstruit à chaque déploiement — le modèle
 * serait alors retéléchargé (~90 Mo) à chaque `npm install` au lieu d'une seule fois.
 */
const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const DTYPE = 'q8';
const DEVICE = 'cpu';
const CACHE_DIR = path.resolve(__dirname, '../../../models/kokoro');

module.exports = { MODEL_ID, DTYPE, DEVICE, CACHE_DIR };
