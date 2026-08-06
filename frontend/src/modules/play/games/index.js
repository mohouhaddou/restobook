import Game2048 from './Game2048';
import MemoryGame from './MemoryGame';
import PuzzleImageGame from './PuzzleImageGame';
import QuizEngine from './QuizEngine';
import GeoQuizGame from './GeoQuizGame';
import GuessThePlaceGame from './GuessThePlaceGame';

export const GAME_COMPONENTS = {
  '2048': Game2048,
  memory: MemoryGame,
  puzzle_image: PuzzleImageGame,
  quiz: QuizEngine,
  true_false: QuizEngine,
  geo_quiz: GeoQuizGame,
  guess_place: GuessThePlaceGame,
};
