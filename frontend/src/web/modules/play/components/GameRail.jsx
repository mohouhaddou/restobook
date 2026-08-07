import React, { useEffect, useState } from 'react';
import { BrainCircuit, Clock3, Flame, Globe2, Heart, MapPinned, PlayCircle, Puzzle, Search, Sparkles, ThumbsUp, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import GameCard from './GameCard';
import { playCardGridContainer } from '../games/playMotion';

const ICONS = { populaires: Flame, quiz: BrainCircuit, puzzle: Puzzle, voyage: MapPinned, culture: Globe2, favorites: Heart, recent: Clock3, continue: PlayCircle, trending: TrendingUp, new: Sparkles, recommended: ThumbsUp, results: Search };
export default function GameRail({ sectionKey, title, games, viewMode = "grid", action }) {
 const Icon = ICONS[sectionKey] || Flame;
 const PAGE_SIZE = 8;
 const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
 useEffect(() => setVisibleCount(PAGE_SIZE), [games, viewMode]);
 const visibleGames = games.slice(0, visibleCount);
 const hasMore = visibleCount < games.length;
 return <motion.section className={"play-game-rail play-section view-" + viewMode} initial="hidden" animate="visible" variants={playCardGridContainer} aria-labelledby={"play-rail-" + sectionKey}>
  <header><h2 id={"play-rail-" + sectionKey}><Icon size={20}/>{title}</h2><div className="play-rail-header-end"><span>{visibleGames.length} sur {games.length}</span>{action}</div></header>
  <div className={"play-game-rail-track " + viewMode}>{visibleGames.map(game => <GameCard key={game.slug} game={game}/>)}</div>
  {hasMore && <button type="button" className="play-show-more" onClick={() => setVisibleCount(count => count + PAGE_SIZE)}>Afficher plus <small>({games.length - visibleCount} restants)</small></button>}
 </motion.section>;
}