// Parseur pur — transforme une phrase française dictée (ou tapée) en une
// liste d'articles { quantity_value, quantity_unit, name }, permettant de
// dicter toute une liste en une fois ("1kg dattes, deux litres d'eau, un
// paquet de thé…") et de l'insérer intelligemment article par article.
// Heuristique volontairement simple (pas de NLP réel) : nombre en tête
// (chiffré ou en toutes lettres, collé ou non à son unité) + mot-unité + reste
// = nom de l'article.

const NUMBER_WORDS = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, dix_sept: 17, 'dix-sept': 17,
  'dix-huit': 18, 'dix-neuf': 19, vingt: 20, trente: 30, quarante: 40, cinquante: 50, une_demi: 0.5, demi: 0.5,
};

// Unités reconnues comme mot séparé après le nombre (ex: "2 litres", "un paquet").
const UNIT_WORDS = {
  kilo: 'kg', kilos: 'kg', kg: 'kg', kgs: 'kg',
  gramme: 'g', grammes: 'g', g: 'g',
  litre: 'L', litres: 'L', l: 'L',
  centilitre: 'cl', centilitres: 'cl', cl: 'cl',
  millilitre: 'ml', millilitres: 'ml', ml: 'ml',
  paquet: 'paquet', paquets: 'paquet', packet: 'paquet', packets: 'paquet',
  sachet: 'sachet', sachets: 'sachet',
  boite: 'pièce', boîte: 'pièce', boites: 'pièce', boîtes: 'pièce',
  bouteille: 'pièce', bouteilles: 'pièce',
  pot: 'pièce', pots: 'pièce',
  tube: 'pièce', tubes: 'pièce',
  sac: 'pièce', sacs: 'pièce',
  botte: 'botte', bottes: 'botte',
  tranche: 'tranche', tranches: 'tranche',
  barquette: 'pièce', barquettes: 'pièce',
  douzaine: 'douzaine', douzaines: 'douzaine',
  piece: 'pièce', pièce: 'pièce', pieces: 'pièce', pièces: 'pièce',
};

// Unités pouvant être collées directement au chiffre sans espace (ex: "1kg", "2L", "500g").
const GLUED_UNIT_MAP = { kg: 'kg', kgs: 'kg', g: 'g', gr: 'g', l: 'L', cl: 'cl', ml: 'ml' };

const ARTICLES = ['du ', 'de la ', "de l'", "d'", 'des ', 'de ', 'le ', 'la ', 'les ', "l'"];

function stripLeadingArticle(text) {
  const lower = text.toLowerCase();
  for (const a of ARTICLES) {
    if (lower.startsWith(a)) return text.slice(a.length).trim();
  }
  return text;
}

function parseSegment(rawSegment) {
  let s = rawSegment.trim();
  if (!s) return null;

  let quantity_value = 1;
  let quantity_unit = null;

  // Cas nombre + unité collés sans espace : "1kg", "2L", "500g", "1,5kg".
  const glued = s.match(/^(\d+(?:[.,]\d+)?)\s*(kg|kgs|gr|g|cl|ml|l)\b/i);
  if (glued) {
    quantity_value = Number(glued[1].replace(',', '.'));
    quantity_unit = GLUED_UNIT_MAP[glued[2].toLowerCase()] || glued[2].toLowerCase();
    s = s.slice(glued[0].length).trim();
  } else {
    const words = s.split(/\s+/).filter(Boolean);
    let idx = 0;
    const first = (words[0] || '').toLowerCase().replace(/[.,]/g, '');
    if (/^\d+([.,]\d+)?$/.test(words[0] || '')) { quantity_value = Number(words[0].replace(',', '.')); idx = 1; }
    else if (NUMBER_WORDS[first] != null) { quantity_value = NUMBER_WORDS[first]; idx = 1; }

    if (words[idx]) {
      const unitWord = words[idx].toLowerCase().replace(/[.,]/g, '');
      if (UNIT_WORDS[unitWord]) { quantity_unit = UNIT_WORDS[unitWord]; idx += 1; }
    }
    s = words.slice(idx).join(' ');
  }

  s = stripLeadingArticle(s.trim());
  // Une deuxième passe : "deux boites de conserve" → après avoir consommé
  // "boites" comme unité, il reste "de conserve" → l'article doit être
  // re-strippé (le premier strip a déjà eu lieu ci-dessus, mais on couvre
  // aussi le cas où l'unité elle-même était précédée d'un article résiduel).
  s = stripLeadingArticle(s.trim());
  if (!s) return null;

  return { quantity_value, quantity_unit, name: s };
}

export function parseVoiceList(transcript) {
  if (!transcript) return [];
  const cleaned = transcript.toLowerCase().replace(/[.!?]/g, '');
  const segments = cleaned.split(/\s+et\s+|,|\s*virgule\s*/).map(s => s.trim()).filter(Boolean);
  return segments.map(parseSegment).filter(Boolean);
}
