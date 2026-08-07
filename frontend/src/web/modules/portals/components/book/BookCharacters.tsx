import React from 'react';
import { motion } from 'framer-motion';
import { UserRound } from 'lucide-react';
import type { BookItem } from './types';
import { fadeUp, staggerContainer } from './bookMotion';
import { useKidsRouteLanguage } from '../../../../pages/kids/useKidsRouteLanguage';

export interface BookCharactersProps {
  readonly item: BookItem;
}

export function BookCharacters({ item }: BookCharactersProps) {
  const { t } = useKidsRouteLanguage();
  const characters = item.metadata?.characters || [];
  if (!characters.length) return null;

  return (
    <section className="book-section book-characters">
      <h2>{t('kids.book.characters')}</h2>
      <motion.div className="book-characters-grid" initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={staggerContainer}>
        {characters.map(character => (
          <motion.article key={character.name} className="book-character-card" variants={fadeUp}>
            <div className="book-character-media">
              {character.image
                ? <img src={character.image} alt={character.name || 'Story character'} loading="lazy" decoding="async" width="320" height="320" />
                : <span className="book-character-placeholder" aria-hidden="true"><UserRound size={28} /></span>}
            </div>
            <h3>{character.name}</h3>
            {character.description && <p>{character.description}</p>}
            {!!character.traits?.length && (
              <ul className="book-character-tags">
                {character.traits.map(trait => <li key={trait}>{trait}</li>)}
              </ul>
            )}
            {!!character.colors?.length && (
              <div className="book-character-colors" aria-label={t('kids.book.colors')}>
                {character.colors.map(color => <span key={color} style={{ '--character-color': color } as React.CSSProperties} title={color} />)}
              </div>
            )}
            {!!character.accessories?.length && (
              <p className="book-character-accessories">{character.accessories.join(' · ')}</p>
            )}
          </motion.article>
        ))}
      </motion.div>
    </section>
  );
}
