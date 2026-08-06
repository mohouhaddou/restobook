'use strict';

/**
 * Tests — moteur Markdown partagé (backend/src/shared/markdown/markdownEngine.js).
 * Usage : node tests/markdown_engine.test.js
 */
const { parseMarkdown, computeReadingTime } = require('../src/shared/markdown/markdownEngine');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

function run() {
  // TOC / heading id — comportement historique de Discover (renderBodyWithToc), préservé.
  {
    const md = '# Titre\n\n## Première section\n\n### Sous-section\n\nTexte.';
    const { html, toc } = parseMarkdown(md, { title: 'Titre' });
    assert(toc.length === 2, 'toc ne retient que les H2/H3');
    assert(toc[0].anchor === 'premiere-section', 'anchor slugifié sans accents');
    assert(html.includes('id="premiere-section"'), 'body_html injecte l\'id sur le H2');
  }

  // Callout — nouveauté : > [!TIP] ... est distingué d'une citation simple.
  {
    const md = '> [!TIP] Astuce\n> Contenu utile\n\n> Une citation normale';
    const { blocks } = parseMarkdown(md);
    const callout = blocks.find(b => b.type === 'callout');
    const quote = blocks.find(b => b.type === 'quote');
    assert(callout && callout.kind === 'tip' && callout.title === 'Astuce', 'un blockquote [!TIP] devient un bloc callout typé');
    assert(quote && quote.html.includes('Une citation normale'), 'un blockquote sans marqueur reste un bloc quote');
  }

  // Image seule sur sa ligne — CommonMark en fait un token inline dans un paragraphe.
  {
    const { blocks } = parseMarkdown('![Un chat](chat.webp)\n\nTexte après.');
    assert(blocks[0].type === 'image' && blocks[0].src === 'chat.webp' && blocks[0].alt === 'Un chat', 'une image seule devient un bloc image, pas un paragraphe');
    assert(blocks[1].type === 'paragraph', 'le texte suivant reste un paragraphe');
  }

  // Table.
  {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |';
    const { blocks } = parseMarkdown(md);
    const table = blocks.find(b => b.type === 'table');
    assert(table && table.header.length === 2 && table.rows.length === 2, 'un tableau Markdown devient un bloc table structuré');
    assert(table.rows[1][1] === '4', 'les cellules du tableau sont accessibles individuellement');
  }

  // Liste.
  {
    const { blocks } = parseMarkdown('- un\n- deux **trois**');
    const list = blocks.find(b => b.type === 'list');
    assert(list && list.ordered === false && list.items.length === 2, 'une liste devient un bloc list avec ses items');
    assert(list.items[1].includes('<strong>trois</strong>'), 'le formatage inline est conservé dans chaque item');
  }

  // Code.
  {
    const { blocks } = parseMarkdown('```js\nconsole.log(1)\n```');
    const code = blocks.find(b => b.type === 'code');
    assert(code && code.lang === 'js' && code.text === 'console.log(1)', 'un bloc de code conserve son langage et son contenu brut');
  }

  // Markdown vide.
  {
    const result = parseMarkdown('');
    assert(result.html === '' && result.toc.length === 0 && result.blocks.length === 0, 'un markdown vide renvoie des structures vides sans erreur');
  }

  // Frontmatter YAML (contenu Sports réel) — ne doit jamais fuiter dans le rendu.
  {
    const md = '---\ntitle: "Achraf Hakimi"\nslug: "achraf-hakimi"\ntags:\n  - PSG\n---\n\n# Titre réel\n\nTexte réel.';
    const { blocks, html } = parseMarkdown(md, { title: 'Achraf Hakimi' });
    assert(!html.includes('slug:') && !html.includes('title:'), 'le frontmatter YAML est retiré du body_html');
    assert(blocks[0].type === 'heading' && blocks[0].text === 'Titre réel', 'le premier bloc est le vrai contenu, pas le frontmatter');
    assert(!blocks.some(b => JSON.stringify(b).includes('slug:')), 'aucun bloc ne contient de résidu de frontmatter');
  }

  // Cohérence multi-module : Discover/Sports/Kids partagent EXACTEMENT la même fonction —
  // un même Markdown produit les mêmes blocs quel que soit le module appelant.
  {
    const md = '## Section\n\nTexte **important**.\n\n![](x.webp)';
    const forDiscover = parseMarkdown(md, { title: 'X' });
    const forKids = parseMarkdown(md, { title: 'X' });
    assert(JSON.stringify(forDiscover.blocks) === JSON.stringify(forKids.blocks), 'un même Markdown produit des blocs identiques quel que soit le module appelant (aucune logique dupliquée)');
  }

  // computeReadingTime — export toujours disponible (consommé par discover/adminRoutes.js).
  {
    const longText = 'mot '.repeat(400);
    assert(computeReadingTime('') === 1, 'un texte vide donne un temps de lecture minimal de 1 minute');
    assert(computeReadingTime(longText) === 2, '400 mots ≈ 2 minutes de lecture à 200 mots/minute');
  }

  console.log(`\n${pass} succès, ${fail} échec(s)\n`);
  if (fail > 0) process.exit(1);
}

run();
