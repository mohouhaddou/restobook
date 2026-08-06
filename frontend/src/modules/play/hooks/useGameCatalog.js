import{useDeferredValue,useEffect,useMemo,useState}from'react';
import GameCatalog from'../catalog/gameCatalog';
import{GAME_LAUNCH_METHODS,GAME_SOURCES,normalizeCatalogGame}from'../catalog/gameSchema';
import InternalGameProvider from'../providers/InternalGameProvider';
import{getGameMeta,getGameSection,humanizeCategory}from'../config/gameCatalogMeta';
const CURATED_ORDER=['populaires','quiz','puzzle','voyage','culture'];
const CATEGORY_LABELS={all:'Tous les jeux',populaires:'Populaires',quiz:'Quiz',puzzle:'Puzzle',voyage:'Voyage',culture:'Culture'};
const STORAGE_KEY='ifilino-play-catalog-filters';
const DEFAULT_FILTERS={difficulty:'all',duration:'all',device:'all',source:'all'};
const readFilters=()=>{try{return{...DEFAULT_FILTERS,...JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'{}')}}catch{return DEFAULT_FILTERS}};
function createApiProvider(apiGames){const games=apiGames.map(game=>normalizeCatalogGame({...game,source:game.source||GAME_SOURCES.INTERNAL,launchMethod:game.launchMethod||GAME_LAUNCH_METHODS.REACT,category:game.category||getGameMeta(game.game_type).section,thumbnail:game.thumbnail||game.thumbnail_url,averageDuration:game.averageDuration??game.average_duration,compatibility:game.compatibility||{mobile:Boolean(game.supports_mobile??true),keyboard:Boolean(game.supports_keyboard??true),fullscreen:Boolean(game.supports_fullscreen??true)},launchConfig:game.launchConfig||{legacyType:game.game_type}},game.providerId||'ifilino-api'));return{id:'ifilino-api',getCatalog:async()=>games,getGame:async slug=>games.find(game=>game.slug===slug)||null}}
const toCardGame=game=>({...game.original,...game,game_type:game.original?.game_type||game.original?.gameType});
export default function useGameCatalog(apiGames,translate){
 const[catalogGames,setCatalogGames]=useState([]),[query,setQuery]=useState(''),[category,setCategory]=useState('all'),[filters,setFilters]=useState(readFilters);
 const deferredQuery=useDeferredValue(query.trim().toLocaleLowerCase());
 useEffect(()=>{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(filters))},[filters]);
 useEffect(()=>{let active=true;const catalog=new GameCatalog([createApiProvider(apiGames),new InternalGameProvider({translate})]);catalog.list().then(games=>{if(active)setCatalogGames(games.map(toCardGame))});return()=>{active=false}},[apiGames,translate]);
 const games=useMemo(()=>catalogGames.filter(game=>{const section=getGameSection(game),content=`${game.name} ${game.description||''} ${section}`.toLocaleLowerCase(),minutes=Number(game.averageDuration??game.duration??0),difficulty=game.difficulty||'medium',compatibility=game.compatibility||{},source=game.source||GAME_SOURCES.INTERNAL;return(category==='all'||section===category)&&(!deferredQuery||content.includes(deferredQuery))&&(filters.difficulty==='all'||difficulty===filters.difficulty)&&(filters.duration==='all'||(filters.duration==='short'?minutes<=5:filters.duration==='medium'?minutes>5&&minutes<=10:minutes>10))&&(filters.device==='all'||(filters.device==='mobile'?compatibility.mobile:compatibility.keyboard))&&(filters.source==='all'||source===filters.source)}),[catalogGames,category,deferredQuery,filters]);
 const categories=useMemo(()=>{const counts=new Map();catalogGames.forEach(game=>{const id=getGameSection(game);counts.set(id,(counts.get(id)||0)+1)});const dynamicIds=[...counts.keys()].filter(id=>!CURATED_ORDER.includes(id)).sort((a,b)=>(counts.get(b)-counts.get(a))||a.localeCompare(b));const orderedIds=['all',...CURATED_ORDER,...dynamicIds];return orderedIds.map(id=>({id,label:CATEGORY_LABELS[id]||humanizeCategory(id),count:id==='all'?catalogGames.length:(counts.get(id)||0)})).filter(item=>item.id==='all'||item.count>0)},[catalogGames]);
 const setFilter=(key,value)=>setFilters(current=>({...current,[key]:value})),resetFilters=()=>{setQuery('');setCategory('all');setFilters(DEFAULT_FILTERS)},activeFilterCount=Object.values(filters).filter(value=>value!=='all').length;
 return{games,allGames:catalogGames,total:catalogGames.length,query,setQuery,category,setCategory,categories,filters,setFilter,resetFilters,activeFilterCount};
}
