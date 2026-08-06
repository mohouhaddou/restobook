'use strict';

/**
 * Sauvegardes réelles — mysqldump + tar, suivant le gabarit de
 * backups/BACKUP_REPORT.md (sauvegarde manuelle unique déjà réalisée avant
 * une migration). Seuls Créer/Lister/Télécharger sont implémentés dans cette
 * phase — la RESTAURATION est explicitement hors périmètre (écraserait la BD
 * de production) et n'a aucune fonction ici.
 *
 * Sécurité :
 *  - le mot de passe MySQL passe par la variable d'env MYSQL_PWD, jamais en
 *    argument de ligne de commande (invisible dans `ps aux`/logs).
 *  - `.env` n'est JAMAIS inclus dans l'archive (contient JWT_SECRET, DB_PASS).
 *  - le nom de fichier demandé au téléchargement est toujours réduit à son
 *    basename et revalidé contre le contenu réel du dossier de sauvegardes,
 *    pour empêcher toute traversée de chemin.
 */
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BACKUP_DIR  = path.join(__dirname, '../../../../../backups');
const UPLOADS_DIR = path.join(__dirname, '../../../../uploads');

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 120000, maxBuffer: 50 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr?.toString().slice(0, 500) || err.message));
      resolve(stdout);
    });
  });
}

function timestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// Suivi en mémoire du dernier résultat — alimente l'alerte "Sauvegarde
// échouée" (voir alertEngineService.js) tant qu'aucune sauvegarde planifiée
// automatique n'existe (Phase 1 = déclenchement manuel uniquement).
let lastBackupFailed = false;
function wasLastBackupFailed() { return lastBackupFailed; }

async function createBackup() {
  try {
    const result = await doCreateBackup();
    lastBackupFailed = false;
    return result;
  } catch (e) {
    lastBackupFailed = true;
    throw e;
  }
}

async function doCreateBackup() {
  const start = Date.now();
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = timestamp();
  const dumpFile = path.join(BACKUP_DIR, `db_${stamp}.sql`);
  const tarFile  = path.join(BACKUP_DIR, `infra_backup_${stamp}.tar.gz`);

  const dumpOut = await run(
    'mysqldump',
    ['-h', process.env.DB_HOST || '127.0.0.1', '-u', process.env.DB_USER, process.env.DB_NAME, '--single-transaction', '--quick'],
    { env: { ...process.env, MYSQL_PWD: process.env.DB_PASS }, maxBuffer: 100 * 1024 * 1024 }
  );
  fs.writeFileSync(dumpFile, dumpOut);

  const tarArgs = ['-czf', tarFile, '-C', BACKUP_DIR, path.basename(dumpFile)];
  if (fs.existsSync(UPLOADS_DIR)) {
    tarArgs.push('-C', path.dirname(UPLOADS_DIR), path.basename(UPLOADS_DIR));
  }
  await run('tar', tarArgs);
  fs.unlinkSync(dumpFile);

  const buf = fs.readFileSync(tarFile);
  const checksum = crypto.createHash('sha256').update(buf).digest('hex');
  fs.writeFileSync(`${tarFile}.sha256`, `${checksum}  ${path.basename(tarFile)}\n`);

  const stat = fs.statSync(tarFile);
  return { ok: true, filename: path.basename(tarFile), size_bytes: stat.size, duration_ms: Date.now() - start, checksum };
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.tar.gz'))
    .map(f => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      const shaFile = path.join(BACKUP_DIR, `${f}.sha256`);
      const checksum = fs.existsSync(shaFile) ? fs.readFileSync(shaFile, 'utf8').split(' ')[0] : null;
      return { filename: f, size_bytes: stat.size, created_at: stat.mtime, checksum };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function getBackupPath(filename) {
  const safe = path.basename(String(filename || ''));
  const full = path.join(BACKUP_DIR, safe);
  if (!full.startsWith(BACKUP_DIR) || !fs.existsSync(full)) return null;
  return full;
}

module.exports = { createBackup, listBackups, getBackupPath, wasLastBackupFailed };
