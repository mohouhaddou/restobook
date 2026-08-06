import React, { useEffect, useState } from 'react';
import { getGameMeta } from '../config/gameCatalogMeta';

export default function GameCardArtwork({ game }) {
  const meta = getGameMeta(game.game_type), Icon = meta.icon;
  const image = game.thumbnail || game.cover || game.heroImage;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image]);
  return <span className="play-game-artwork" style={{ '--game-color': meta.color }} aria-hidden="true">{image && !failed ? <img src={image} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)}/> : <span className="play-game-artwork-fallback"><i/><i/><Icon size={54} strokeWidth={1.6}/><span>iF</span></span>}</span>;
}
