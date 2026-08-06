import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'src');
const reportsDir = path.resolve(process.cwd(), '..', 'reports');
const jsonPath = path.join(reportsDir, 'i18n-hardcoded-audit.json');
const mdPath = path.join(reportsDir, 'i18n-hardcoded-audit.md');

const excludedPathParts = [
  `${path.sep}pages${path.sep}discover${path.sep}`,
  `${path.sep}discover${path.sep}`,
];

const extensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const stringPattern = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;

const technicalContexts = [
  /import\s+/,
  /from\s+['"`]/,
  /className\s*=/,
  /style\s*=/,
  /href\s*=/,
  /src\s*=/,
  /to\s*=/,
  /path\s*:/,
  /route/i,
  /localStorage|sessionStorage/,
  /querySelector|addEventListener|removeEventListener/,
  /API\(|fetch\(|URLSearchParams|new\s+RegExp/,
  /\bt\(/,
  /<path\s+d=|<circle|<line|<svg/,
  /var\(--/,
  /<style|@keyframes|transform:|rotate\(|opacity:/,
  /updateStatus\(|<Toast|format(Time|Date|Currency)\(/,
];

const visibleContexts = [
  />\s*$/,
  /placeholder\s*=/,
  /aria-label\s*=/,
  /title\s*=/,
  /alt\s*=/,
  /label\s*:/,
  /header\s*:/,
  /toast\.(success|error|info|warning)/,
  /set(Error|Msg|Message)\(/,
  /window\.(confirm|alert)\(/,
  /<button|<label|<h[1-6]|<p|<span|<div/,
];

const dynamicHints = [
  /\$\{/,
  /\+\s*[a-zA-Z_$]/,
  /[a-zA-Z_$]\s*\+/,
  /\.(name|title|label|description|message|error|libelle|email|phone)/,
];

const devHints = [
  /console\.(log|debug|warn|error|info)/,
  /\/\/|\/\*|\*\//,
  /describe\(|it\(|test\(|expect\(/,
  /eslint|TODO|FIXME/,
];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (excludedPathParts.some(part => full.includes(part))) continue;
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'dist-server') continue;
      out.push(...walk(full));
    } else if (extensions.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

function moduleFor(rel) {
  if (rel.includes('/pages/marketplace/') || rel.includes('/shared/components/marketplace/')) return 'marketplace';
  if (rel.includes('/pages/dashboard/') || rel.includes('/shared/components/dashboard/')) return 'customer-dashboard';
  if (rel.includes('/pages/superadmin/')) return 'superadmin';
  if (rel.includes('/pages/hanout/')) return 'hanout';
  if (rel.includes('/pages/pharmacy/')) return 'pharmacy';
  if (rel.includes('/pages/pos/')) return 'pos';
  if (rel.includes('/pages/infra/')) return 'infra';
  if (rel.includes('/pages/restaurant/') || rel.includes('/modules/resto/')) return 'restaurant';
  if (rel.includes('/LoginPage') || rel.includes('/CustomerAuthPage') || rel.includes('/auth/')) return 'auth';
  if (rel.includes('/Checkout') || rel.includes('/Order') || rel.includes('/orders')) return 'orders';
  if (rel.includes('/shared/')) return 'shared';
  return rel.split('/')[1] || 'app';
}

function priorityFor(mod) {
  if (['auth', 'marketplace', 'orders'].includes(mod)) return 'high';
  if (mod === 'customer-dashboard') return 'medium';
  if (['hanout', 'pharmacy', 'restaurant', 'pos'].includes(mod)) return 'medium';
  if (mod === 'superadmin') return 'low';
  return 'medium';
}

function isHumanText(text) {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  if (/^[\s()[\]{}.,:;|&!?+\-*/%=<>#._~\\]+$/.test(trimmed)) return false;
  if (/^#[0-9A-Fa-f]{3,8}$/.test(trimmed)) return false;
  if (/^var\(--[\w-]+\)$/.test(trimmed)) return false;
  if (/^[Mm]\d/.test(trimmed) && /\d/.test(trimmed) && /[A-Za-z]/.test(trimmed)) return false;
  if (trimmed.includes('})}') || trimmed.includes('</span>')) return false;
  if (trimmed.includes('@keyframes') || trimmed.includes('transform:')) return false;
  if (/^(GET|POST|PUT|PATCH|DELETE|true|false|null|undefined)$/i.test(trimmed)) return false;
  if (/^https?:\/\//.test(trimmed)) return false;
  if (/^[./@][\w./-]+$/.test(trimmed)) return false;
  return /[A-Za-zÀ-ÿ\u0600-\u06ff]/.test(trimmed);
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function lineAt(lines, line) {
  return lines[line - 1]?.trim() || '';
}

function classify(text, context) {
  if (devHints.some(rx => rx.test(context))) {
    return { classification: 'development_text', confidence: 0.82 };
  }
  if (technicalContexts.some(rx => rx.test(context)) || /^[a-z0-9_.:-]+$/i.test(text.trim())) {
    return { classification: 'technical_value', confidence: 0.86 };
  }
  if (dynamicHints.some(rx => rx.test(text) || rx.test(context))) {
    return { classification: 'dynamic_content', confidence: 0.72 };
  }
  if (visibleContexts.some(rx => rx.test(context))) {
    return { classification: 'visible_static', confidence: 0.78 };
  }
  return { classification: 'manual_review', confidence: 0.48 };
}

const occurrences = [];
for (const file of walk(root)) {
  const rel = path.relative(process.cwd(), file).split(path.sep).join('/');
  const source = fs.readFileSync(file, 'utf8');
  const lines = source.split('\n');
  for (const match of source.matchAll(stringPattern)) {
    const text = match[2].replace(/\\n/g, ' ').trim();
    if (!isHumanText(text)) continue;
    const line = lineNumber(source, match.index);
    const context = lineAt(lines, line);
    const module = moduleFor(rel);
    const { classification, confidence } = classify(text, context);
    occurrences.push({
      file: rel,
      line,
      text,
      excerpt: context,
      classification,
      module,
      priority: priorityFor(module),
      confidence,
      status: classification === 'visible_static' ? 'pending' : 'excluded',
    });
  }
}

const counts = occurrences.reduce((acc, item) => {
  acc[item.classification] = (acc[item.classification] || 0) + 1;
  return acc;
}, {});
const byModule = occurrences.reduce((acc, item) => {
  acc[item.module] ??= { total: 0, visible_static: 0, dynamic_content: 0, technical_value: 0, development_text: 0, manual_review: 0 };
  acc[item.module].total += 1;
  acc[item.module][item.classification] += 1;
  return acc;
}, {});

const report = {
  generatedAt: new Date().toISOString(),
  scope: {
    root: 'frontend/src',
    excluded: ['frontend/src/pages/discover/**', 'frontend/src/**/discover/**', 'backend/src/modules/discover/**'],
  },
  summary: {
    rawOccurrences: occurrences.length,
    visibleStatic: counts.visible_static || 0,
    dynamicContent: counts.dynamic_content || 0,
    technicalValues: counts.technical_value || 0,
    developmentText: counts.development_text || 0,
    manualReview: counts.manual_review || 0,
    filesWithVisibleStatic: new Set(occurrences.filter(o => o.classification === 'visible_static').map(o => o.file)).size,
  },
  modules: byModule,
  occurrences,
};

fs.mkdirSync(reportsDir, { recursive: true });
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const topModules = Object.entries(byModule)
  .sort((a, b) => b[1].visible_static - a[1].visible_static)
  .slice(0, 15);

const md = [
  '# Audit i18n des chaînes statiques',
  '',
  `Généré le : ${report.generatedAt}`,
  '',
  '## Périmètre',
  '',
  '- Inclus : `frontend/src/**/*.{js,jsx,ts,tsx}`',
  '- Exclus : `frontend/src/pages/discover/**`, `frontend/src/**/discover/**`, `backend/src/modules/discover/**`',
  '',
  '## Résumé qualifié',
  '',
  `- Occurrences brutes qualifiées : ${report.summary.rawOccurrences}`,
  `- Textes visibles probables : ${report.summary.visibleStatic}`,
  `- Contenus dynamiques : ${report.summary.dynamicContent}`,
  `- Valeurs techniques : ${report.summary.technicalValues}`,
  `- Textes de développement : ${report.summary.developmentText}`,
  `- À vérifier manuellement : ${report.summary.manualReview}`,
  `- Fichiers avec textes visibles probables : ${report.summary.filesWithVisibleStatic}`,
  '',
  '## Modules les plus concernés',
  '',
  '| Module | Total | Visible | Dynamique | Technique | Dev | À vérifier |',
  '|---|---:|---:|---:|---:|---:|---:|',
  ...topModules.map(([name, stats]) => `| ${name} | ${stats.total} | ${stats.visible_static} | ${stats.dynamic_content} | ${stats.technical_value} | ${stats.development_text} | ${stats.manual_review} |`),
  '',
  '## Notes',
  '',
  '- La classification est heuristique : `visible_static` et `manual_review` sont les files prioritaires à traiter.',
  '- Les contenus dynamiques ne doivent pas être remplacés par des clés statiques ; ils alimenteront une future phase de contenu multilingue en base.',
  '- Le rapport JSON contient chaque occurrence avec fichier, ligne, extrait, module, priorité, confiance et état de migration.',
  '',
].join('\n');

fs.writeFileSync(mdPath, md);

console.log(`i18n audit: ${report.summary.rawOccurrences} occurrences`);
console.log(`visible_static=${report.summary.visibleStatic}, dynamic_content=${report.summary.dynamicContent}, technical_value=${report.summary.technicalValues}, development_text=${report.summary.developmentText}, manual_review=${report.summary.manualReview}`);
console.log(`reports: ${path.relative(process.cwd(), jsonPath)}, ${path.relative(process.cwd(), mdPath)}`);
