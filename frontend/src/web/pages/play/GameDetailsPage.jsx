import React,{useEffect,useMemo,useState}from'react';
import{useNavigate,useParams}from'react-router-dom';
import'../../modules/play/play.css';
import{usePlayApi}from'../../modules/play/hooks/usePlayApi';
import{useI18n}from'../../../i18n/config';
import{getRegistryGame,listRegistryGames,localizeRegistryGame}from'../../modules/play/registry/gamesRegistry';
import{rankGameRecommendations}from'../../modules/play/services/recommendationService';
import GameDetails from'../../modules/play/components/GameDetails';
import PlayGameSeo from'../../modules/play/components/PlayGameSeo';
import RelatedDiscoverContent from'../../modules/play/components/RelatedDiscoverContent';
import PlaySidebar from'../../modules/play/components/PlaySidebar';

export default function GameDetailsPage(){
 const{slug}=useParams(),navigate=useNavigate(),{get}=usePlayApi(),{t}=useI18n();
 const[game,setGame]=useState(null),[games,setGames]=useState([]),[history,setHistory]=useState([]),[favoriteSlugs,setFavoriteSlugs]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let active=true;setLoading(true);Promise.all([get('/play/games'),get('/play/history?limit=50'),get('/play/favorites')]).then(([catalog,activity,favorites])=>{const locals=listRegistryGames().map(item=>localizeRegistryGame(item,t)),unique=new Map();[...(catalog.games||[]),...locals].forEach(item=>unique.set(item.slug,item));const all=[...unique.values()],selected=getRegistryGame(slug)?localizeRegistryGame(getRegistryGame(slug),t):all.find(item=>item.slug===slug);if(!selected)throw new Error('Jeu introuvable');if(active){setGame(selected);setGames(all);setHistory(activity.history||[]);setFavoriteSlugs((favorites.favorites||[]).map(item=>item.slug))}}).catch(reason=>{if(active)setError(reason.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[slug,get,t]);
 const similar=useMemo(()=>rankGameRecommendations({currentGame:game,games,history,favoriteSlugs,limit:4}),[game,games,history,favoriteSlugs]);
 if(loading)return <div className="play-page"><div className="play-shell"><PlaySidebar/><div className="play-container"><div className="play-game-loading" role="status"><span className="play-loader"/><strong>Préparation de la fiche…</strong></div></div></div></div>;
 if(error||!game)return <div className="play-page"><div className="play-shell"><PlaySidebar/><div className="play-container"><div className="play-catalog-empty"><strong>{error||'Jeu introuvable'}</strong><button type="button" onClick={()=>navigate('/play')}>Retour au catalogue</button></div></div></div></div>;
 const canonicalUrl=window.location.origin+'/play/'+game.slug,schema={'@context':'https://schema.org','@graph':[{'@type':'VideoGame',name:game.name,description:game.description,url:canonicalUrl,gamePlatform:['Web Browser','Mobile Web'],applicationCategory:'Game',genre:game.category||game.categories},{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'iFilino Play',item:window.location.origin+'/play'},{'@type':'ListItem',position:2,name:game.name,item:canonicalUrl}]}]};
 return <div className="play-page"><PlayGameSeo game={game}/><div className="play-shell"><PlaySidebar/><div className="play-container"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,'\\u003c')}}/><GameDetails game={game} similarGames={similar} onPlay={()=>navigate(`/play/${slug}/play`)} onBack={()=>navigate('/play')}/><RelatedDiscoverContent game={game}/></div></div></div>
}
