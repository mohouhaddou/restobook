import { useCallback, useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 900;

// Mobile et desktop sont deux comportements distincts, pas un seul état
// partagé : sur mobile la sidebar est un tiroir (fermé par défaut, jamais
// persisté — chaque page repart fermée), sur desktop elle est toujours
// visible (pas de bouton pour la masquer). Avant ce découplage, fermer le
// tiroir sur mobile écrivait la même clé localStorage que le desktop, donc
// la sidebar restait masquée en revenant sur desktop, sans moyen de la
// rouvrir (le bouton est caché ≥901px).
export default function usePlaySidebar() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const toggle = useCallback(() => { if (isMobile) setMobileOpen(value => !value); }, [isMobile]);

  const collapsed = isMobile ? !mobileOpen : false;

  return { collapsed, toggle };
}
