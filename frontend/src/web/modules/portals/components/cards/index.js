import { PortalCard } from '../PortalCard';
import { StoryCard } from './StoryCard';
import { LearningCard } from './LearningCard';
import { ScienceCard } from './ScienceCard';
import { AnimalCard } from './AnimalCard';
import { HistoryCard } from './HistoryCard';
import { QuizCard } from './QuizCard';
import { GameCard } from './GameCard';
import { ActivityCard } from './ActivityCard';
import { PuzzleCard } from './PuzzleCard';

export { StoryCard, LearningCard, ScienceCard, AnimalCard, HistoryCard, QuizCard, GameCard, ActivityCard, PuzzleCard };

// content_type (backend/src/modules/portals/config.js) -> composant carte.
// Ajouter un type de contenu Kids = une entrée ici, jamais un if/else dans PortalPage.
const KIDS_CARD_BY_CONTENT_TYPE = {
  stories: StoryCard,
  learn: LearningCard,
  science: ScienceCard,
  space: ScienceCard,
  nature: ScienceCard,
  animals: AnimalCard,
  history: HistoryCard,
  quizzes: QuizCard,
  games: GameCard,
  puzzles: PuzzleCard,
  drawing: ActivityCard,
  music: ActivityCard,
  crafts: ActivityCard,
  videos: ActivityCard,
};

/** Résout la carte Kids à utiliser pour un content_type donné ; PortalCard générique en repli. */
export function getKidsCardComponent(contentType) {
  return KIDS_CARD_BY_CONTENT_TYPE[contentType] || PortalCard;
}
