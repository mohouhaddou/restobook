import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';

const distDir = resolve(process.argv[2] || new URL('../dist', import.meta.url).pathname);
const entry = resolve(process.argv[3] || join(distDir, 'index.html'));
const queue = [entry];
const visited = new Set();
const missing = [];

function referencedFiles(source, file) {
  const refs = new Set();
  const patterns = [
    /(?:src|href)=["']([^"'?#]+)["']/g,
    /(?:import|from)\s*(?:\(\s*)?["']([^"'?#]+)["']/g,
    /url\(\s*["']?([^"'?#)]+)["']?\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const ref = match[1];
      if (ref.startsWith('data:') || ref.startsWith('http:') || ref.startsWith('https:')) continue;
      if (!/\.(?:js|mjs|css|json|html|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|avif)$/i.test(ref)) continue;
      if (ref.startsWith('/')) refs.add(join(distDir, ref.slice(1)));
      else if (ref.startsWith('.')) refs.add(resolve(dirname(file), ref));
    }
  }
  return refs;
}

while (queue.length) {
  const file = queue.pop();
  if (visited.has(file)) continue;
  visited.add(file);

  try {
    if (!(await stat(file)).isFile()) throw new Error('not a file');
  } catch {
    missing.push(relative(distDir, file));
    continue;
  }

  if (file !== entry && !['.html', '.js', '.mjs', '.css'].includes(extname(file))) continue;
  const source = await readFile(file, 'utf8');
  queue.push(...referencedFiles(source, file));
}

const portalChunks = (await readdir(join(distDir, 'assets')))
  .filter((name) => /^PortalPage-.*\.js$/.test(name));

if (portalChunks.length < 1) {
  console.error('PortalPage chunk was not generated.');
  process.exitCode = 1;
}

if (missing.length) {
  console.error('Build contains missing asset references:');
  for (const file of missing.sort()) console.error(`  - ${file}`);
  process.exitCode = 1;
}

if (!process.exitCode) {
  const referencedPortal = [...visited]
    .map((file) => relative(distDir, file))
    .find((file) => /^assets\/PortalPage-.*\.js$/.test(file));
  console.log(`Verified ${visited.size} referenced files; PortalPage chunk: ${referencedPortal || portalChunks[0]}`);
}
