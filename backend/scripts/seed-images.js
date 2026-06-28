/**
 * Seed logo + cover images for restaurants that have none.
 * Downloads from Unsplash, saves to uploads/orgs/{id}/, updates DB.
 */
const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const { Sequelize } = require('sequelize');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  { host: process.env.DB_HOST || '127.0.0.1', dialect: 'mysql', logging: false }
);

// Curated Unsplash images per restaurant type/name
// Set ONLY_IDS env var to restrict to specific org ids, e.g. ONLY_IDS=7,8
const ONLY_IDS = process.env.ONLY_IDS ? process.env.ONLY_IDS.split(',').map(Number) : null;

const SEEDS = [
  {
    id: 5,
    name: 'Pizza Express Casa',
    logo: {
      url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&h=400&q=80',
      file: 'logo_seed.jpg',
    },
    cover: {
      url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1200&h=500&q=80',
      file: 'cover_seed.jpg',
    },
  },
  {
    id: 6,
    name: 'Restaurant Bennani Test',
    logo: {
      url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&h=400&q=80',
      file: 'logo_seed.jpg',
    },
    cover: {
      url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&h=500&q=80',
      file: 'cover_seed.jpg',
    },
  },
  {
    id: 7,
    name: 'Restaurant Bennani Test (2)',
    logo: {
      url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&h=400&q=80',
      file: 'logo_seed.jpg',
    },
    cover: {
      url: 'https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?auto=format&fit=crop&w=1200&h=500&q=80',
      file: 'cover_seed.jpg',
    },
  },
  {
    id: 8,
    name: 'Restaurant Bennani',
    logo: {
      url: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=400&h=400&q=80',
      file: 'logo_seed.jpg',
    },
    cover: {
      url: 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=1200&h=500&q=80',
      file: 'cover_seed.jpg',
    },
  },
];

const UPLOADS_BASE = path.join(__dirname, '../uploads/orgs');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const protocol = url.startsWith('https') ? https : http;

    function get(u) {
      protocol.get(u, res => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          fs.unlinkSync(dest);
          return get(res.headers.location);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          return reject(new Error(`HTTP ${res.statusCode} for ${u}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', err => { fs.unlinkSync(dest); reject(err); });
      }).on('error', err => { fs.unlinkSync(dest); reject(err); });
    }

    get(url);
  });
}

async function run() {
  await sequelize.authenticate();
  console.log('DB connected.\n');

  const toProcess = ONLY_IDS ? SEEDS.filter(s => ONLY_IDS.includes(s.id)) : SEEDS;
  for (const seed of toProcess) {
    const dir = path.join(UPLOADS_BASE, String(seed.id));
    fs.mkdirSync(dir, { recursive: true });

    console.log(`── ${seed.name} (org #${seed.id})`);

    // Logo
    const logoPath = path.join(dir, seed.logo.file);
    const logoDbUrl = `/uploads/orgs/${seed.id}/${seed.logo.file}`;
    process.stdout.write(`   logo  → downloading... `);
    await download(seed.logo.url, logoPath);
    console.log(`saved (${(fs.statSync(logoPath).size / 1024).toFixed(1)} KB)`);

    // Cover
    const coverPath = path.join(dir, seed.cover.file);
    const coverDbUrl = `/uploads/orgs/${seed.id}/${seed.cover.file}`;
    process.stdout.write(`   cover → downloading... `);
    await download(seed.cover.url, coverPath);
    console.log(`saved (${(fs.statSync(coverPath).size / 1024).toFixed(1)} KB)`);

    // Update DB
    await sequelize.query(
      `UPDATE organizations SET logo_url = COALESCE(logo_url, ?), cover_url = COALESCE(cover_url, ?) WHERE id = ?`,
      { replacements: [logoDbUrl, coverDbUrl, seed.id] }
    );
    console.log(`   DB updated.\n`);
  }

  console.log('Done.');
  await sequelize.close();
}

run().catch(err => { console.error(err); process.exit(1); });
