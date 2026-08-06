import { describe, it, expect } from 'vitest';
import { splitIntoSentences, isDialogueText } from '../SentenceSplitter';

describe('splitIntoSentences', () => {
  it('découpe un texte simple en phrases sur . ! ?', () => {
    const result = splitIntoSentences('Il était une fois une princesse. Elle vivait dans un château ! Un jour, un dragon arriva.');
    expect(result.map(s => s.text)).toEqual([
      'Il était une fois une princesse.',
      'Elle vivait dans un château !',
      'Un jour, un dragon arriva.',
    ]);
  });

  it('ne coupe jamais après une abréviation connue (M., Dr., etc.)', () => {
    const result = splitIntoSentences("M. Dupont et Dr. Martin discutaient. Ils ont fini par etc. et sont partis.");
    expect(result.map(s => s.text)).toEqual([
      "M. Dupont et Dr. Martin discutaient.",
      'Ils ont fini par etc. et sont partis.',
    ]);
  });

  it('ne coupe jamais sur des points de suspension (normalisés en …)', () => {
    const result = splitIntoSentences('Elle hésita... puis répondit oui. Il sourit.');
    expect(result.map(s => s.text)).toEqual([
      'Elle hésita… puis répondit oui.',
      'Il sourit.',
    ]);
  });

  it('un texte vide ou blanc ne produit aucune phrase', () => {
    expect(splitIntoSentences('')).toEqual([]);
    expect(splitIntoSentences('   ')).toEqual([]);
  });

  it('un texte sans ponctuation terminale reste une phrase entière', () => {
    const result = splitIntoSentences('Un titre de chapitre sans point final');
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Un titre de chapitre sans point final');
  });

  it('détecte le dialogue introduit par un tiret cadratin', () => {
    const result = splitIntoSentences('— Bonjour, dit le renard. Le loup répondit.');
    expect(result[0].dialogue).toBe(true);
    expect(result[1].dialogue).toBe(false);
  });

  it('détecte le dialogue entre guillemets français', () => {
    const result = splitIntoSentences('Il pensa « Quelle belle journée ! » puis partit.');
    expect(result.some(s => s.dialogue)).toBe(true);
  });

  it('isDialogueText reconnaît tiret et guillemets, pas une phrase normale', () => {
    expect(isDialogueText('— Bonjour')).toBe(true);
    expect(isDialogueText('« Salut »')).toBe(true);
    expect(isDialogueText('Une phrase tout à fait normale.')).toBe(false);
  });
});
