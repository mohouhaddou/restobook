import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Bookmark, BookOpen, Check, ChevronDown, ChevronRight, Clock3, Expand, Eye, Filter, Heart, ListFilter, Maximize2, MessageCircle, MoreHorizontal, Play, Search, Share2, Sparkles, Star, Users, X, ZoomIn, ZoomOut } from 'lucide-react';
import { GENRES, getComic } from './data/catalog';
import { useComicsTheme } from './ComicsChrome';
import { ComicsLibraryButtons, ComicsReviews, ComicsViewTracker } from './ComicsEngagement';

const MotionLink = motion.create(Link);
const fade = { initial:{ opacity:0, y:14 }, whileInView:{ opacity:1, y:0 }, viewport:{ once:true, margin:'-40px' }, transition:{ duration:.28 } };

function ComicCard({ comic, rank, wide=false }) {
  return <MotionLink {...fade} className={`cm-card${wide ? ' cm-card-wide' : ''}`} to={`/comics/series/${comic.slug}`} aria-label={`${comic.title}, ${comic.genre}, rated ${comic.rating}`}>
    <div className="cm-cover-wrap"><img src={comic.cover} alt={`Cover of ${comic.title}`} loading="lazy" width="420" height="600"/><span className="cm-card-gradient"/>{rank && <b className="cm-rank">{String(rank).padStart(2,'0')}</b>}<button className="cm-card-save" aria-label={`Save ${comic.title}`} onClick={e=>e.preventDefault()}><Bookmark/></button></div>
    <div className="cm-card-copy"><h3>{comic.title}</h3><p>{comic.genre} · {comic.status}</p><span><Star fill="currentColor"/> {comic.rating} <i>·</i> {comic.readers} readers</span></div>
  </MotionLink>;
}

function Section({ eyebrow, title, action='See all', children }) {
  return <section className="cm-section"><div className="cm-section-head"><div>{eyebrow && <span>{eyebrow}</span>}<h2>{title}</h2></div><button>{action}<ChevronRight/></button></div>{children}</section>;
}

export function ComicsHomePage() {
  const { comics } = useComicsTheme();
  const [hero, setHero] = useState(0); const featured = comics.slice(0,3);
  useEffect(() => { if (!featured.length) return undefined; const id=setInterval(()=>setHero(v=>(v+1)%featured.length),7000); return()=>clearInterval(id); },[featured.length]);
  const active=featured[hero];
  if (!active) return <div className="cm-loading">Loading comics…</div>;
  return <div className="cm-home">
    <section className="cm-hero" style={{'--hero':`url(${active.banner})`,'--accent':active.accent}}>
      <AnimatePresence mode="wait"><motion.div key={active.slug} className="cm-hero-copy" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} transition={{duration:.35}}>
        <span className="cm-kicker"><Sparkles/> IFILINO ORIGINAL</span><h1>{active.title}</h1><p className="cm-hero-sub">{active.subtitle}</p><p>When the impossible becomes ordinary, one reluctant hero must redraw the edge of the known world.</p>
        <div className="cm-meta"><span><Star fill="currentColor"/> {active.rating}</span><span>{active.genre}</span><span>{active.status}</span><span>13+</span></div>
        <div className="cm-hero-actions"><Link className="cm-primary" to={`/comics/read/${active.slug}/1`}><Play fill="currentColor"/> Start reading</Link><Link className="cm-secondary" to={`/comics/series/${active.slug}`}><BookOpen/> View series</Link></div>
      </motion.div></AnimatePresence>
      <div className="cm-hero-dots" aria-label="Featured comics">{featured.map((comic,index)=><button key={comic.slug} className={index===hero?'active':''} onClick={()=>setHero(index)} aria-label={`Show ${comic.title}`} aria-current={index===hero}/>)}</div>
    </section>
    <div className="cm-content">
      <Section eyebrow="YOUR STORIES" title="Continue reading"><div className="cm-continue">{comics.filter(c=>c.progress).slice(0,3).map(comic=><Link key={comic.slug} to={`/comics/read/${comic.slug}/${comic.chapter}`} className="cm-progress-card"><img src={comic.cover} alt=""/><div><span>{comic.genre}</span><h3>{comic.title}</h3><p>Chapter {comic.chapter} · {comic.progress}% read</p><div className="cm-progress"><i style={{width:`${comic.progress}%`}}/></div></div><button aria-label={`Continue ${comic.title}`}><ArrowRight/></button></Link>)}</div></Section>
      <Section eyebrow="WHAT EVERYONE'S READING" title="Trending today"><div className="cm-grid">{comics.slice(0,5).map((comic,i)=><ComicCard key={comic.slug} comic={comic} rank={i+1}/>)}</div></Section>
      <section className="cm-editorial"><div><span>EDITOR'S COLLECTION</span><h2>Worlds built to get lost in</h2><p>Five remarkable series where every panel rewards a closer look.</p><button>Explore the collection <ArrowRight/></button></div></section>
      <Section eyebrow="JUST IN" title="Fresh chapters"><div className="cm-grid cm-grid-compact">{[...comics].reverse().slice(0,5).map(comic=><ComicCard key={comic.slug} comic={comic}/>)}</div></Section>
      <Section title="Explore by genre" action="All genres"><div className="cm-genres">{GENRES.map((genre,i)=><Link to={`/comics/search?genre=${genre}`} key={genre}><span>{String(i+1).padStart(2,'0')}</span>{genre}<ArrowRight/></Link>)}</div></Section>
    </div>
  </div>;
}

export function ComicsSearchPage() {
  const { comics } = useComicsTheme();
  const [params,setParams]=useSearchParams(); const [query,setQuery]=useState(params.get('q')||''); const [genre,setGenre]=useState(params.get('genre')||'All');
  const results=useMemo(()=>comics.filter(c=>(genre==='All'||c.genre===genre)&&(`${c.title} ${c.author} ${c.genre}`.toLowerCase().includes(query.toLowerCase()))),[query,genre,comics]);
  useEffect(()=>{const id=setTimeout(()=>{const next={};if(query)next.q=query;if(genre!=='All')next.genre=genre;setParams(next,{replace:true});},250);return()=>clearTimeout(id)},[query,genre,setParams]);
  return <div className="cm-content cm-search-page"><header><span>DISCOVER YOUR NEXT WORLD</span><h1>Search comics</h1><div className="cm-search-box"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} autoFocus placeholder="Title, creator, publisher…" aria-label="Search comics"/>{query&&<button onClick={()=>setQuery('')} aria-label="Clear search"><X/></button>}</div></header>
    <div className="cm-filter-row"><button className="active"><ListFilter/> All filters</button>{['All',...GENRES].map(item=><button key={item} onClick={()=>setGenre(item)} className={genre===item?'selected':''}>{item}</button>)}<button><Filter/> More <ChevronDown/></button></div>
    <div className="cm-results-head"><p><strong>{results.length}</strong> {results.length===1?'series':'series'} found</p><button>Trending <ChevronDown/></button></div>
    {results.length?<div className="cm-grid cm-search-grid">{results.map(comic=><ComicCard key={comic.slug} comic={comic}/>)}</div>:<div className="cm-empty"><Search/><h2>No stories found</h2><p>Try a different title or remove a filter.</p><button onClick={()=>{setQuery('');setGenre('All')}}>Clear filters</button></div>}
  </div>;
}

export function ComicDetailPage() {
  const { comics } = useComicsTheme();
  const {slug}=useParams(); const comic=comics.find(item=>item.slug===slug)||getComic(slug); const [saved,setSaved]=useState(false); const chapters=comic.episodes?.length?comic.episodes:[24,23,22,21,20,19].map((number,index)=>({number,title:['Where the sky ends','Signal through the dark','A map with no north','The quiet machine','Before we wake','A borrowed horizon'][index],pages:Array(18).fill(null)}));
  return <div className="cm-detail"><ComicsViewTracker comic={comic}/><div className="cm-detail-hero" style={{'--banner':`url(${comic.banner})`}}><div className="cm-detail-inner"><img className="cm-detail-cover" src={comic.cover} alt={`Cover of ${comic.title}`}/><div className="cm-detail-copy"><span className="cm-kicker">IFILINO ORIGINAL</span><h1>{comic.title}</h1><p className="cm-detail-sub">{comic.subtitle}</p><div className="cm-meta"><span><Star fill="currentColor"/>{comic.rating}</span><span><Eye/>{comic.readers}</span><span>{comic.status}</span><span>13+</span></div><p>Across a fractured world, old legends return in unexpected forms. A richly drawn journey about memory, courage, and the stories we inherit.</p><div className="cm-hero-actions"><Link className="cm-primary" to={`/comics/read/${comic.slug}/1`}><Play fill="currentColor"/> Read first chapter</Link><button className="cm-secondary" onClick={()=>setSaved(v=>!v)}>{saved?<Check/>:<Bookmark/>}{saved?'In your library':'Add to library'}</button><button className="cm-icon-button"><Share2/></button><button className="cm-icon-button"><MoreHorizontal/></button></div></div></div></div>
    <div className="cm-content cm-detail-content"><div className="cm-detail-main"><nav className="cm-tabs"><button className="active">Chapters</button><button>About</button><button>Characters</button><button>Reviews</button></nav><div className="cm-chapter-head"><div><h2>{chapters.length} {chapters.length===1?'chapter':'chapters'}</h2><p>{chapters.length?'Available to read':'No published chapters yet'}</p></div><button>Newest first <ChevronDown/></button></div><div className="cm-chapters">{[...chapters].reverse().map((episode,index)=><Link key={episode.number} to={'/comics/read/'+comic.slug+'/'+episode.number}><div className="cm-chapter-thumb" style={{backgroundImage:'url('+(episode.cover_image||(episode.pages&&episode.pages[0]&&(episode.pages[0].thumbnail_url||episode.pages[0].image_url))||comic.cover||comic.banner)+')'}}/><div><span>{index===0?'NEW · ':''}CHAPTER {episode.number}</span><h3>{episode.title||'Chapter '+episode.number}</h3><p>{episode.pages?.length||0} pages</p></div><ChevronRight/></Link>)}</div></div><aside className="cm-detail-aside"><h3>Series information</h3><dl><div><dt>Creator</dt><dd>{comic.author}</dd></div><div><dt>Genres</dt><dd>{comic.genre}, Adventure</dd></div><div><dt>Languages</dt><dd>English, Français, العربية</dd></div><div><dt>Publisher</dt><dd>iFilino Originals</dd></div></dl><hr/><div className="cm-stat-grid"><span><strong>{comic.rating||"—"}</strong>Rating</span><span><strong>{comic.reviewCount||0}</strong>Reviews</span><span><strong>{comic.readers}</strong>Views</span><span><strong>{chapters.length}</strong>Chapters</span></div></aside></div><ComicsReviews comic={comic}/>
  </div>;
}

export function ComicsLibraryPage(){const {comics}=useComicsTheme();return <div className="cm-content cm-library"><header><span>YOUR SPACE</span><h1>My library</h1><p>Everything you love, right where you left it.</p></header><nav className="cm-tabs"><button className="active">Reading</button><button>Saved</button><button>Completed</button><button>History</button></nav><div className="cm-library-list">{comics.filter(c=>c.progress).map(c=><Link to={`/comics/read/${c.slug}/${c.chapter}`} key={c.slug}><img src={c.cover} alt=""/><div><span>{c.genre}</span><h2>{c.title}</h2><p>Chapter {c.chapter} · Continue where you stopped</p><div className="cm-progress"><i style={{width:`${c.progress}%`}}/></div></div><strong>{c.progress}%</strong><ArrowRight/></Link>)}</div></div>}

export function ComicReaderPage(){const {comics}=useComicsTheme();const {slug,chapter}=useParams();const comic=comics.find(item=>item.slug===slug)||getComic(slug);const navigate=useNavigate();const [zoom,setZoom]=useState(1);const [controls,setControls]=useState(true);const episodeOrder=comic.episodes||[];const episodeIndex=episodeOrder.findIndex(episode=>String(episode.number)===String(chapter));const selectedEpisode=episodeOrder[episodeIndex];const previousEpisode=episodeIndex>0?episodeOrder[episodeIndex-1]:null;const nextEpisode=episodeIndex>=0&&episodeIndex<episodeOrder.length-1?episodeOrder[episodeIndex+1]:null;const pages=selectedEpisode?.pages?.map(page=>page.image_url)||comic.pages||Array.from({length:7},(_,i)=>`${comic.banner}&sat=${80+i*2}`);useEffect(()=>{const fn=e=>{if(e.key==='Escape')navigate(`/comics/series/${slug}`);if(e.key==='ArrowRight')window.scrollBy({top:window.innerHeight*.8,behavior:'smooth'});if(e.key==='+')setZoom(z=>Math.min(1.5,z+.1));if(e.key==='-')setZoom(z=>Math.max(.7,z-.1))};addEventListener('keydown',fn);return()=>removeEventListener('keydown',fn)},[navigate,slug]);return <div className={`cm-reader${controls?'':' controls-hidden'}`} onDoubleClick={()=>setControls(v=>!v)}><header><Link to={`/comics/series/${slug}`} aria-label="Exit reader"><ArrowLeft/></Link><div><strong>{comic.title}</strong><span>Chapter {chapter} · {selectedEpisode?.title||'Reading'}</span></div><div className="cm-reader-progress">Page 1 of {pages.length}</div><button onClick={()=>setZoom(z=>Math.max(.7,z-.1))} aria-label="Zoom out"><ZoomOut/></button><button onClick={()=>setZoom(z=>Math.min(1.5,z+.1))} aria-label="Zoom in"><ZoomIn/></button><button onClick={()=>document.documentElement.requestFullscreen?.()} aria-label="Fullscreen"><Maximize2/></button></header><div className="cm-reader-pages" style={{'--zoom':zoom}}>{pages.map((page,i)=><figure key={i}><img src={page} alt={`Page ${i+1} of chapter ${chapter}`} loading={i>1?'lazy':'eager'}/><figcaption>PAGE {i+1}</figcaption></figure>)}</div><footer><button disabled={!previousEpisode} onClick={()=>previousEpisode&&navigate('/comics/read/'+slug+'/'+previousEpisode.number)}><ArrowLeft/> Previous</button><span>Chapter {chapter}</span><div className="cm-reader-line"><i style={{width:'14%'}}/></div><button disabled={!nextEpisode} onClick={()=>nextEpisode&&navigate('/comics/read/'+slug+'/'+nextEpisode.number)}>Next <ArrowRight/></button></footer></div>}
