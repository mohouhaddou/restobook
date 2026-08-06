import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BookOpen } from 'lucide-react';
import { API } from '../../../api';
import { recommendArticleForGame } from '../services/discoverPlayBridge';

export default function RelatedDiscoverContent({ game, language = 'fr' }) {
  const [articles, setArticles] = useState([]);
  useEffect(() => { let active = true; fetch(API(`/discover/recent?limit=20&lang=${language}`)).then(response => response.ok ? response.json() : Promise.reject()).then(data => { if (active) setArticles(data.articles || []); }).catch(() => undefined); return () => { active = false; }; }, [language]);
  const article = useMemo(() => recommendArticleForGame(game, articles), [game, articles]);
  if (!article) return null;
  const href = `/discover/${article.language || language}/article/${article.slug}`;
  return <aside className="play-discover-card" aria-labelledby="play-discover-title"><span className="play-discover-icon"><BookOpen aria-hidden="true"/></span><div><span>iFilino Discover</span><h2 id="play-discover-title">Pour aller plus loin</h2><strong>{article.title}</strong><p>{article.summary || article.excerpt || 'Découvrez un article sélectionné selon le thème de ce jeu.'}</p></div><a href={href}>Lire l’article<ArrowUpRight aria-hidden="true"/></a></aside>;
}
