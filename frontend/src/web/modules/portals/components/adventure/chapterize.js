// Découpe un flux de blocs Markdown déjà parsés en "chapitres" à chaque titre de
// profondeur 2 — extrait de StudyLessonPage.jsx (makeChapters) pour être réutilisé tel quel par
// EncyclopediaReader (Nature/Animals/Space/Science/History/Geography). Logique pure, aucune
// dépendance à un module en particulier ; la traduction des titres de section (ex. Study's
// FR_TITLES) reste la responsabilité de l'appelant, pas de cette fonction.
export function chapterize(blocks, { skipTitles = ['Cover'] } = {}) {
  const chapters = [];
  let current = null;
  for (const block of blocks || []) {
    if (block.type === 'heading' && block.depth === 2) {
      if (skipTitles.includes(block.text)) { current = null; continue; }
      current = { id: block.anchor || `chapter-${chapters.length + 1}`, title: block.text, blocks: [] };
      chapters.push(current);
      continue;
    }
    if (current) current.blocks.push(block);
  }
  return chapters.filter(chapter => chapter.blocks.length);
}
