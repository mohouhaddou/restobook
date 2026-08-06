import{useEffect,useMemo,useState}from'react';
import{usePlayApi}from'./usePlayApi';
const FAVORITES_KEY='ifilino-play-favorites';
const readLocalFavorites=()=>{try{const value=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return[]}};
const unique=values=>[...new Set(values.filter(Boolean))];
const EMPTY_SUMMARY={totalPlays:0,totalTimeSeconds:0,completed:0,abandoned:0};
export default function usePersonalGameLibrary(catalogGames){
 const{get,isGuest}=usePlayApi(),[favoriteSlugs,setFavoriteSlugs]=useState([]),[activity,setActivity]=useState([]),[summary,setSummary]=useState(EMPTY_SUMMARY);
 useEffect(()=>{let active=true;const favoritesRequest=isGuest?Promise.resolve(readLocalFavorites()):get('/play/favorites').then(data=>(data.favorites||[]).map(item=>item.slug));Promise.all([favoritesRequest,get('/play/history?limit=50')]).then(([favorites,history])=>{if(!active)return;setFavoriteSlugs(unique(favorites));setActivity(history.history||[]);setSummary({...EMPTY_SUMMARY,...history.summary})}).catch(()=>{if(active&&isGuest)setFavoriteSlugs(readLocalFavorites())});return()=>{active=false}},[get,isGuest]);
 const bySlug=useMemo(()=>new Map(catalogGames.map(game=>[game.slug,game])),[catalogGames]);
 const resolve=slugs=>slugs.map(slug=>bySlug.get(slug)).filter(Boolean);
 const recentSlugs=unique(activity.map(item=>item.game?.slug));
 const continueSlugs=unique(activity.filter(item=>item.status==='abandoned'||item.status==='started').map(item=>item.game?.slug));
 const favorites=resolve(favoriteSlugs),recent=resolve(recentSlugs).slice(0,8),continuePlaying=resolve(continueSlugs).slice(0,4);
 return{favorites,recent,continuePlaying,summary,activity,hasLibrary:favorites.length>0||recent.length>0};
}
