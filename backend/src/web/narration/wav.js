'use strict';

const fs = require('fs');

/** Parcourt les chunks RIFF d'un buffer WAV et renvoie { channels, sampleRate, bitsPerSample,
 * dataOffset, dataSize } — utilisé à la fois par readWavDurationMs (narration) et concatWav
 * (AudiobookGenerator, voir digitalProducts/generators/AudiobookGenerator.js), pour ne jamais
 * dupliquer la lecture du format RIFF/WAVE. */
function parseWavHeader(buf) {
  if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null;

  let offset = 12;
  let sampleRate = 0;
  let channels = 1;
  let bitsPerSample = 16;
  let dataOffset = 0;
  let dataSize = 0;

  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString('ascii', offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (chunkId === 'fmt ') {
      channels = buf.readUInt16LE(body + 2);
      sampleRate = buf.readUInt32LE(body + 4);
      bitsPerSample = buf.readUInt16LE(body + 14);
    } else if (chunkId === 'data') {
      dataOffset = body;
      dataSize = chunkSize;
    }
    offset = body + chunkSize + (chunkSize % 2);
  }

  if (!sampleRate || !dataSize) return null;
  return { channels, sampleRate, bitsPerSample, dataOffset, dataSize };
}

/** Lit la durée réelle (ms) d'un fichier WAV — pas de dépendance, sert à synchroniser le
 * surlignage phrase par phrase côté client sans alignement approximatif. */
function readWavDurationMs(filePath) {
  const info = parseWavHeader(fs.readFileSync(filePath));
  if (!info) return 0;
  const bytesPerSample = Math.max(1, info.bitsPerSample / 8);
  const totalSamples = info.dataSize / (bytesPerSample * Math.max(1, info.channels));
  return Math.round((totalSamples / info.sampleRate) * 1000);
}

function buildWavHeader({ channels, sampleRate, bitsPerSample, dataSize }) {
  const blockAlign = channels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * blockAlign, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40);
  return header;
}

/**
 * Concatène plusieurs WAV (même format garanti : tous produits par le même provider/voix, voir
 * AudiobookGenerator) en un seul fichier — ne garde que le payload `data` de chacun, reconstruit
 * un en-tête propre à 44 octets pour l'ensemble. Le format (fréquence/canaux/bits) du PREMIER
 * buffer fait foi.
 * @param {Buffer[]} buffers
 * @returns {Buffer}
 */
function concatWav(buffers) {
  const infos = buffers.map(buf => parseWavHeader(buf)).filter(Boolean);
  if (!infos.length) throw new Error('Aucun WAV valide à concaténer');

  const { channels, sampleRate, bitsPerSample } = infos[0];
  const dataChunks = buffers.map((buf, i) => buf.subarray(infos[i].dataOffset, infos[i].dataOffset + infos[i].dataSize));
  const dataSize = dataChunks.reduce((sum, chunk) => sum + chunk.length, 0);

  return Buffer.concat([buildWavHeader({ channels, sampleRate, bitsPerSample, dataSize }), ...dataChunks]);
}

module.exports = { readWavDurationMs, concatWav };
