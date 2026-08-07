import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import type { BookItem } from './types';
import { fadeUp, staggerContainer } from './bookMotion';
import { useKidsRouteLanguage } from '../../../../pages/kids/useKidsRouteLanguage';

export interface BookLearningGoalsProps {
  readonly item: BookItem;
}

/** Valeurs éducatives (cartes) + "Ce que l'enfant va apprendre" (liste illustrée) — les deux
 * sections cohabitent dans ce composant, chacune masquée indépendamment si sa donnée est absente. */
export function BookLearningGoals({ item }: BookLearningGoalsProps) {
  const { t } = useKidsRouteLanguage();
  const values = item.metadata?.values || [];
  const goals = item.metadata?.learningGoals || [];
  if (!values.length && !goals.length) return null;

  return (
    <section className="book-section book-learning">
      {!!values.length && (
        <>
          <h2>{t('kids.book.educationalValues')}</h2>
          <motion.div className="book-values-grid" initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={staggerContainer}>
            {values.map(value => (
              <motion.div key={value.label} className="book-value-card" variants={fadeUp}>
                {value.icon && <span className="book-value-icon" aria-hidden="true">{value.icon}</span>}
                <span>{value.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </>
      )}

      {!!goals.length && (
        <>
          <h2>{t('kids.book.learningGoals')}</h2>
          <ul className="book-learning-list">
            {goals.map(goal => (
              <li key={goal.label}>
                {goal.icon ? <span aria-hidden="true">{goal.icon}</span> : <CheckCircle2 size={18} aria-hidden="true" />}
                <span>{goal.label}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
