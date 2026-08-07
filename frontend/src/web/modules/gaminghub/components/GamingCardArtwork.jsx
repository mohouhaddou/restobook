import React, { useEffect, useState } from 'react';
import { Gamepad2 } from 'lucide-react';

// Miroir de GameCardArtwork.jsx (Play) mais sans mapping game_type — les
// fiches Gaming Hub n'ont qu'une cover_image_url, pas de catalogue de types
// internes. Réutilise les mêmes classes CSS (.play-game-artwork*).
export default function GamingCardArtwork({ image, color = '#22C3FF' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image]);
  return (
    <span className="play-game-artwork" style={{ '--game-color': color }} aria-hidden="true">
      {image && !failed ? (
        <img src={image} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <span className="play-game-artwork-fallback"><i /><i /><Gamepad2 size={54} strokeWidth={1.6} /><span>iF</span></span>
      )}
    </span>
  );
}
