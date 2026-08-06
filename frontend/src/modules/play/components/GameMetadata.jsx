import React from 'react';
import { BarChart3, Clock3, Gamepad2, Keyboard, Smartphone, Star, Users } from 'lucide-react';

const DIFFICULTY = { easy: 'Facile', medium: 'Intermédiaire', hard: 'Difficile' };
export default function GameMetadata({ game }) {
  const items = [
    [BarChart3, 'Difficulté', DIFFICULTY[game.difficulty] || 'Standard'],
    [Clock3, 'Durée moyenne', game.averageDuration || game.duration ? `${game.averageDuration || game.duration} min` : 'Variable'],
    [Users, 'Parties jouées', game.playCount ? Number(game.playCount).toLocaleString('fr-FR') : 'Nouveau'],
    [Smartphone, 'Mobile', game.compatibility?.mobile === false ? 'Non' : 'Compatible'],
    [Keyboard, 'Clavier', game.compatibility?.keyboard || game.options?.keyboard ? 'Compatible' : 'Optionnel'],
    [Star, 'Notation', game.rating ? `${Number(game.rating).toFixed(1)} / 5` : 'À découvrir'],
  ];
  return <dl className="play-details-metadata">{items.map(([Icon, label, value]) => <div key={label}><dt><Icon/>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
