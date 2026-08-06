import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Gamepad2 } from 'lucide-react';
import { API } from '../../../api';
import { recommendGameForArticle } from '../../../modules/play/services/discoverPlayBridge';
const COPY = { fr:{kicker:'À vous de jouer',title:'Prolongez la découverte',action:'Découvrir le jeu',fallback:'Un défi rapide inspiré de votre lecture.'}, ar:{kicker:'حان وقت اللعب',title:'واصل الاكتشاف',action:'اكتشف اللعبة',fallback:'تحدٍ سريع مستوحى من قراءتك.'}, en:{kicker:'Your turn to play',title:'Keep exploring',action:'Discover the game',fallback:'A quick challenge inspired by your reading.'} };
export default function DiscoverGameRecommendation({ article, language='fr' }) {
 const[games,setGames]=useState([]);
 useEffect(()=>{let active=true;fetch(API('/play/games')).then(response=>response.ok?response.json():Promise.reject()).then(data=>{if(active)setGames(data.games||[])}).catch(()=>undefined);return()=>{active=false}},[]);
 const game=useMemo(()=>recommendGameForArticle(article,games),[article,games]);
 if(!game)return null;
 const copy=COPY[language]||COPY.fr;
 return <aside className="ifm-final-cta" aria-labelledby="discover-game-title"><div><p className="ifm-kicker"><Gamepad2 size={18} aria-hidden="true"/> iFilino Play · {copy.kicker}</p><h2 id="discover-game-title">{copy.title} avec {game.name}</h2><p>{game.description||copy.fallback}</p></div><a className="btn btn-primary" href={`/play/${game.slug}`}>{copy.action}<ArrowRight size={18} aria-hidden="true"/></a></aside>;
}
