import React, { createContext, useContext, useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { BookOpen, Compass, Library, Moon, Search, Sun, UserRound } from 'lucide-react';
import { API } from '../../shared/services/api';
import { COMICS } from './data/catalog';
import './comics.css';

const ComicsThemeContext = createContext(null);
export const useComicsTheme = () => useContext(ComicsThemeContext);

export default function ComicsChrome({ children, reader = false }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('ifilino-comics-theme') || 'light');
  const location = useLocation();
  const [comics, setComics] = useState([]);
  useEffect(() => { let active = true; fetch(API('/comics/public/series')).then(r => r.ok ? r.json() : Promise.reject()).then(({ items }) => { if (!active) return; const remote = items.map(item => ({ id:item.id, slug:item.slug, title:item.title, subtitle:item.subtitle || '', synopsis:item.synopsis || '', cover:item.cover_url, banner:item.banner_url || item.cover_url, genre:item.genres?.[0] || 'Comics', author:item.publisher_name || 'iFilino Comics', rating:Number(item.avg_rating||0), reviewCount:Number(item.review_count||0), readers:Number(item.view_count || 0).toLocaleString(), status:'Published', accent:'#e5484d', chapter:item.episodes?.[0]?.number || 1, episodes:item.episodes || [], pages:item.episodes?.[0]?.pages?.map(page => page.image_url) || [] })); setComics(remote); }).catch(() => {}); return () => { active = false; }; }, []);
  useEffect(() => { localStorage.setItem('ifilino-comics-theme', theme); }, [theme]);
  useEffect(() => { document.querySelector('.cm-main')?.focus({ preventScroll:true }); }, [location.pathname]);
  return <ComicsThemeContext.Provider value={{ theme, comics, toggle:() => setTheme(v => v === 'dark' ? 'light' : 'dark') }}>
    <div className={`cm-shell cm-${theme}${reader ? ' cm-reader-shell' : ''}`}>
      <a className="cm-skip" href="#comics-main">Skip to content</a>
      {!reader && <header className="cm-header">
        <Link className="cm-brand" to="/comics" aria-label="iFilino Comics home"><img src="/brand/iFilino_Comics_Logo.png" alt="iFilino Comics"/></Link>
        <nav className="cm-nav" aria-label="Comics navigation">
          <NavLink end to="/comics"><Compass/> <span>Discover</span></NavLink>
          <NavLink to="/comics/search"><Search/> <span>Search</span></NavLink>
          <NavLink to="/comics/library"><Library/> <span>Library</span></NavLink>
        </nav>
        <div className="cm-head-actions">
          <button className="cm-icon-button" onClick={() => setTheme(v => v === 'dark' ? 'light' : 'dark')} aria-label={`Use ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? <Sun/> : <Moon/>}</button>
          <Link className="cm-profile" to="/comics/account" aria-label="Comics account"><UserRound/></Link>
        </div>
      </header>}
      <main id="comics-main" className="cm-main" tabIndex="-1">{children}</main>
      {!reader && <nav className="cm-bottom-nav" aria-label="Comics mobile navigation">
        <NavLink end to="/comics"><Compass/><span>Discover</span></NavLink><NavLink to="/comics/search"><Search/><span>Search</span></NavLink><NavLink to="/comics/library"><BookOpen/><span>Library</span></NavLink>
      </nav>}
    </div>
  </ComicsThemeContext.Provider>;
}
