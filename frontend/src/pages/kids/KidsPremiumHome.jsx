import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, Atom, BookOpen, Brain, Brush, ChevronLeft, ChevronRight, Clock3, Gamepad2, GraduationCap,
  Headphones, Heart, Leaf, Music2, Palette, PawPrint, Play, Rocket, Search,
  ShieldCheck, Sparkles, Star, Trophy, Video,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { API } from '../../shared/services/api';
import { PortalBrand } from '../../modules/portals/components/PortalBrand';
import { PortalFooter } from '../../modules/portals/components/PortalFooter';
import { PortalHeroCarousel } from '../../shared/components/portalHero/PortalHeroCarousel';
import ContentRail from '../../modules/kids-taxonomy/ContentRail';
import KidsLibraryCard from '../../modules/kids-taxonomy/KidsLibraryCard';
import SeoHead, { kidsAlternates } from '../../shared/seo/SeoHead';
import './kids-premium-home.css';

const COPY = {
  fr: { welcome:'Bienvenue dans ton monde de découvertes', morning:'Bonjour', afternoon:'Bon après-midi', evening:'Bonsoir', ready:'Prêt pour l’aventure du jour ?', message:'Lis, joue et apprends quelque chose de merveilleux chaque jour.', search:'Que veux-tu explorer ?', quick:'Accès rapide', today:'L’aventure du jour', continue:'Reprendre mon aventure', progress:'Mes progrès', paths:'Parcours pour grandir', subjects:'Découvrir par univers', worlds:'Explore les mondes', friends:'Rencontre nos amis', parents:'Espace parents', parentsText:'Suivez les progrès et partagez de beaux moments d’apprentissage.', dashboard:'Tableau de bord parent', tips:'Conseils éducatifs', reports:'Rapports de lecture', seeAll:'Tout voir', stories:'Histoires lues', lessons:'Leçons terminées', badges:'Badges gagnés', streak:'Jours actifs', start:'Explorer' },
  en: { welcome:'Welcome to your world of discovery', morning:'Good morning', afternoon:'Good afternoon', evening:'Good evening', ready:'Ready for today’s adventure?', message:'Read, play and learn something wonderful every day.', search:'What would you like to explore?', quick:'Quick access', today:'Today’s Adventure', continue:'Continue your adventure', progress:'My progress', paths:'Learning journeys', subjects:'Discover by subject', worlds:'Explore Worlds', friends:'Meet Our Friends', parents:'For parents', parentsText:'Follow progress and share meaningful learning moments together.', dashboard:'Parent dashboard', tips:'Educational tips', reports:'Reading reports', seeAll:'See all', stories:'Stories read', lessons:'Lessons completed', badges:'Badges earned', streak:'Active days', start:'Explore' },
  ar: { welcome:'مرحباً بك في عالم الاكتشاف', morning:'صباح الخير', afternoon:'مساء الخير', evening:'مساء الخير', ready:'هل أنت مستعد لمغامرة اليوم؟', message:'اقرأ والعب وتعلم شيئاً رائعاً كل يوم.', search:'ماذا تريد أن تستكشف؟', quick:'وصول سريع', today:'مغامرة اليوم', continue:'تابع مغامرتك', progress:'تقدمي', paths:'مسارات التعلم', subjects:'اكتشف حسب الموضوع', worlds:'استكشف العوالم', friends:'تعرف على أصدقائنا', parents:'للآباء', parentsText:'تابعوا التقدم وشاركوا لحظات تعلم ممتعة.', dashboard:'لوحة الآباء', tips:'نصائح تعليمية', reports:'تقارير القراءة', seeAll:'عرض الكل', stories:'قصص مقروءة', lessons:'دروس مكتملة', badges:'شارات مكتسبة', streak:'أيام نشطة', start:'استكشف' },
};

const QUICK = [
  ['study', GraduationCap], ['stories', BookOpen], ['games', Gamepad2], ['coloring', Palette],
  ['audiobooks', Headphones], ['videos', Video], ['quizzes', Brain], ['crafts', Brush],
];
const SUGGESTIONS = ['Stories','Animals','Space','Math','Science','Princess Nada','Draco','Zinoo','Nature'];
const WORLD_DATA = [
  ['princesses','Princesses',Sparkles,'rose'],['dragons','Dragons',Rocket,'orange'],['dinosaurs','Dinosaurs',PawPrint,'green'],
  ['ocean','Ocean',Atom,'blue'],['robots','Robots',Brain,'violet'],['magic','Magic',Star,'pink'],
  ['nature','Nature',Leaf,'emerald'],['adventure','Adventure',Rocket,'amber'],['friendship','Friendship',Heart,'red'],['space','Space',Rocket,'indigo'],
];
const CHARACTERS = [
  { name:'Princess Nada', mark:'N', color:'rose', description:'Curious, brave and always ready for a new story.' },
  { name:'Piko', mark:'P', color:'cyan', description:'A playful friend who loves puzzles and discovery.' },
  { name:'Draco', mark:'D', color:'orange', description:'A kind little dragon with a big imagination.' },
  { name:'Zinoo', mark:'Z', color:'violet', description:'An explorer who asks brilliant questions.' },
];
const PATHS = [
  ['mathematics','Learn Mathematics','12 lessons','2 h',Brain],['science','Become a Scientist','10 lessons','1 h 40',Atom],
  ['space','Explore Space','8 lessons','1 h 20',Rocket],['english','Learn English','14 lessons','2 h 30',BookOpen],
  ['nature','Discover Nature','9 lessons','1 h 30',Leaf],['reading','Read Every Day','21 stories','3 weeks',BookOpen],
  ['coding','Coding for Kids','12 lessons','2 h',Gamepad2],
];

function greeting(copy) { const hour = new Date().getHours(); return hour < 12 ? copy.morning : hour < 18 ? copy.afternoon : copy.evening; }
function flatten(sections) { return Object.values(sections || {}).flat(); }
function hrefFor(item, language) { return item.type === "learn" || item.subject ? `/kids/${language}/learn/${item.slug}` : item.type === "stories" ? `/kids/${language}/book/${item.slug}` : `/kids/${language}/content/${item.slug}`; }

export default function KidsPremiumHome({ language, t, user, token, data }) {
  const copy = COPY[language] || COPY.en;
  const seoCopy = {
    en: { title: 'iFilino Kids — Free Stories, Educational Games & Lessons', description: 'Explore illustrated children’s stories, educational games, quizzes, audiobooks and interactive lessons for curious young minds on iFilino Kids.' },
    fr: { title: 'iFilino Kids — Histoires, jeux éducatifs et leçons', description: 'Découvrez des histoires illustrées, jeux éducatifs, quiz, livres audio et leçons interactives pour les enfants sur iFilino Kids.' },
    ar: { title: 'iFilino Kids — قصص وألعاب تعليمية ودروس للأطفال', description: 'اكتشف قصصاً مصورة وألعاباً تعليمية واختبارات وكتباً صوتية ودروساً تفاعلية للأطفال على iFilino Kids.' },
  }[language] || {};
  const [query, setQuery] = useState('');
  const [study, setStudy] = useState([]);
  const [history, setHistory] = useState([]);
  const worldTrackRef = useRef(null);
  const portalItems = useMemo(() => flatten(data.sections), [data.sections]);
  useEffect(() => {
    fetch(API(`/study/lessons?lang=${language}&limit=50`)).then(r=>r.ok?r.json():{}).then(d=>setStudy((d.items||[]).map(item=>({...item,type:'learn'})))).catch(()=>setStudy([]));
  }, [language]);
  useEffect(() => {
    if (!token) { setHistory([]); return; }
    Promise.all([
      fetch(API(`/study/history?lang=${language}`),{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.ok?r.json():{}),
      fetch(API(`/portals/kids/history?lang=${language}&limit=20`),{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.ok?r.json():{}),
    ]).then(([a,b])=>setHistory([...(a.history||[]).map(item=>({...item,type:'learn'})),...(b.history||[])])).catch(()=>setHistory([]));
  }, [token, language]);
  const allItems = useMemo(() => [...portalItems, ...study], [portalItems, study]);
  const suggestions = useMemo(() => {
    const q=query.trim().toLowerCase(); if(!q) return [];
    return allItems.filter(item=>`${item.title} ${item.subject||''} ${item.category||''} ${JSON.stringify(item.metadata||{})} ${(item.tags||[]).join(' ')}`.toLowerCase().includes(q)).slice(0,6);
  }, [allItems,query]);
  const daily = allItems.length ? allItems[Math.floor(Date.now()/86400000)%allItems.length] : null;
  const rails = useMemo(() => {
    const byType = key => key==='study' ? study : (data.sections?.[key]||[]);
    return [['stories',BookOpen],['study',GraduationCap],['science',Atom],['space',Rocket],['animals',PawPrint],['nature',Leaf],['games',Gamepad2],['drawing',Palette],['music',Music2]].map(([key,Icon])=>({key,Icon,items:byType(key)})).filter(x=>x.items.length);
  },[data.sections,study]);
  const recent = [...allItems].sort((a,b)=>new Date(b.published_at||b.publishedAt||0)-new Date(a.published_at||a.publishedAt||0)).slice(0,12);
  const popular = [...allItems].sort((a,b)=>Number(b.view_count||b.viewCount||0)-Number(a.view_count||a.viewCount||0)).slice(0,12);
  const scrollWorlds = direction => {
    const track = worldTrackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * (language === 'ar' ? -640 : 640), behavior: 'smooth' });
  };

  return <div className="portal portal-kids kids-premium-home" dir={language==='ar'?'rtl':'ltr'}>
    <SeoHead title={seoCopy.title} description={seoCopy.description} canonicalPath={"/kids/" + language} language={language} alternates={kidsAlternates()}/>
    <header className="portal-header"><div className="portal-shell portal-header-row"><PortalBrand portal="kids"/><nav className="kids-home-nav" aria-label={t('kids.nav.label')}><Link to={`/kids/${language}/study`}>{t('kids.nav.learn')}</Link><Link to={`/kids/${language}/stories`}>{t('kids.nav.stories')}</Link><Link to={`/kids/${language}/games`}>{t('kids.nav.games')}</Link></nav><Link className="portal-header-auth" to={user?`/kids/${language}/profile`:`/kids/${language}/login`}>{user?(user.nom||user.name||t('kids.auth.myAccount')):t('kids.auth.tabs.login')}</Link></div></header>
    <main id="kids-main-content">
      <section className="kids-home-hero"><PortalHeroCarousel portal="kids"/><div className="portal-shell kids-home-hero-grid"><div><span className="kids-home-kicker"><ShieldCheck size={17}/>{copy.welcome}</span><h1>{user?`${greeting(copy)} ${user.nom||user.name||''}!`:copy.ready}</h1><p>{user?copy.ready:copy.message}</p><div className="kids-home-search-wrap"><label className="kids-home-search"><Search/><span className="sr-only">{copy.search}</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={copy.search} autoComplete="off" aria-autocomplete="list" aria-expanded={suggestions.length>0}/></label>{suggestions.length>0&&<div className="kids-home-autocomplete" role="listbox">{suggestions.map(item=><Link role="option" key={`${item.type}-${item.id}`} to={hrefFor(item, language)}><Search size={15}/><span>{item.title}</span><small>{item.subject||item.category||item.type}</small></Link>)}</div>}<div className="kids-home-suggestions">{SUGGESTIONS.map(value=><button type="button" key={value} onClick={()=>setQuery(value)}>{value}</button>)}</div></div>{user&&<Link className="kids-home-primary" to={`/kids/${language}/study/continue-learning`}><Play size={18}/>{copy.continue}</Link>}</div><div className="kids-home-illustration" aria-hidden="true"><div className="kids-home-planet"><Rocket/><BookOpen/><Atom/><span>iF</span></div></div></div></section>
      <div className="portal-shell kids-home-content">
        <section className="kids-quick-actions" aria-labelledby="quick-title"><h2 id="quick-title">{copy.quick}</h2><div>{QUICK.map(([key,Icon])=><Link key={key} to={`/kids/${language}/${key}`}><Icon/><span>{t(`kids.nav.${key==='study'?'learn':key}`)}</span></Link>)}</div></section>
        {history.length>0&&<><ContentRail id="home-continue" title={copy.continue} items={history.slice(0,12)} language={language}/><section className="kids-progress-widget" aria-labelledby="progress-title"><div><span><Trophy/></span><div><h2 id="progress-title">{copy.progress}</h2><p>{copy.ready}</p></div></div><dl><div><dt>{copy.stories}</dt><dd>{history.filter(x=>x.type==='stories').length}</dd></div><div><dt>{copy.lessons}</dt><dd>{history.filter(x=>x.type==='learn'&&x.progress?.completed).length}</dd></div><div><dt>{copy.badges}</dt><dd>{Math.min(8,history.length)}</dd></div><div><dt>{copy.streak}</dt><dd>{Math.min(7,history.length)}</dd></div></dl></section></>}
        {daily&&<section className="kids-daily"><div><span><Sparkles/>{copy.today}</span><h2>{daily.title}</h2><p>{daily.excerpt||daily.summary||copy.message}</p><Link to={hrefFor(daily, language)}>{copy.start}<ArrowRight/></Link></div><KidsLibraryCard item={daily} language={language}/></section>}
        <section className="kids-home-section"><div className="kids-home-section-head"><h2>{copy.paths}</h2></div><div className="kids-path-track">{PATHS.map(([slug,title,count,duration,Icon],index)=><Link to={`/kids/${language}/study/${slug}`} className={`kids-path path-${index%5}`} key={slug}><Icon/><h3>{title}</h3><p>{count} · {duration}</p><div role="progressbar" aria-valuenow={user?(index+1)*6:0} aria-valuemin="0" aria-valuemax="100"><span style={{width:`${user?(index+1)*6:0}%`}}/></div></Link>)}</div></section>
        <section className="kids-home-section"><div className="kids-home-section-head"><h2>{copy.subjects}</h2></div><div className="kids-subject-list">{rails.map(({key,Icon,items},index)=><section key={key}><header><h3><Icon/>{t(`kids.nav.${key==='study'?'learn':key}`)}</h3><Link to={`/kids/${language}/${key}`}>{copy.seeAll}<ArrowRight/></Link></header><ContentRail id={`home-subject-${index}`} title="" items={items.slice(0,12)} language={language}/></section>)}</div></section>
        <section className="kids-home-section"><div className="kids-home-section-head"><h2>{copy.worlds}</h2><div className="kids-rail-controls"><button type="button" onClick={()=>scrollWorlds(-1)} aria-label={language==='fr'?'Univers précédents':language==='ar'?'العوالم السابقة':'Previous worlds'}><ChevronLeft/></button><button type="button" onClick={()=>scrollWorlds(1)} aria-label={language==='fr'?'Univers suivants':language==='ar'?'العوالم التالية':'Next worlds'}><ChevronRight/></button></div></div><div ref={worldTrackRef} className="kids-world-track">{WORLD_DATA.map(([slug,title,Icon,color])=><Link key={slug} className={`kids-world world-${color}`} to={`/kids/${language}/stories/${slug}`}><Icon/><strong>{title}</strong><ArrowRight/></Link>)}</div></section>
        {recent.length>0&&<><ContentRail id="home-recent" title={language==='fr'?'Nouveautés':language==='ar'?'أضيف حديثاً':'New This Week'} items={recent} language={language}/><ContentRail id="home-popular" title={language==='fr'?'Les plus populaires':language==='ar'?'الأكثر شعبية':'Most Popular'} items={popular} language={language}/></>}
        <section className="kids-home-section"><div className="kids-home-section-head"><h2>{copy.friends}</h2></div><div className="kids-characters">{CHARACTERS.map(character=><article key={character.name} className={`character-${character.color}`}><div aria-hidden="true">{character.mark}</div><h3>{character.name}</h3><p>{character.description}</p><Link to={`/kids/${language}/stories/search?q=${encodeURIComponent(character.name)}`}>{copy.seeAll}<ArrowRight/></Link></article>)}</div></section>
        <aside className="kids-parents"><div><span><ShieldCheck/>{copy.parents}</span><h2>{copy.parentsText}</h2></div><nav><Link to={`/kids/${language}/profile`}>{copy.dashboard}</Link><Link to={`/kids/${language}/parents`}>{copy.tips}</Link><Link to={`/kids/${language}/profile`}>{copy.reports}</Link></nav></aside>
      </div>
    </main><PortalFooter portal="kids" language={language}/>
  </div>;
}
