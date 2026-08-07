import React from 'react';
import QuizEngine from './QuizEngine';

// Même moteur que Quiz Maroc / Vrai-Faux — seule la catégorie des quiz
// proposés change (filtrée en amont via GET /play/quizzes?category=geography).
export default function GeoQuizGame(props) {
  return <QuizEngine {...props} />;
}
