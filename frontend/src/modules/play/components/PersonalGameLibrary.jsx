import React from'react';
import{Clock3,Play,RotateCcw,Trophy}from'../ui';
import GameRail from'./GameRail';
const duration=value=>{const minutes=Math.round((value||0)/60);return minutes<60?`${minutes} min`:`${Math.floor(minutes/60)} h ${minutes%60} min`};
export default function PersonalGameLibrary({favorites,recent,continuePlaying,summary}){
 if(!favorites.length&&!recent.length)return null;
 const stats=[{icon:Play,label:'Parties',value:summary?.totalPlays||0},{icon:Clock3,label:'Temps joué',value:duration(summary?.totalTimeSeconds)},{icon:Trophy,label:'Terminées',value:summary?.completed||0},{icon:RotateCcw,label:'À reprendre',value:summary?.abandoned||0}];
 return <section className="play-personal-library" aria-labelledby="play-library-title"><header className="play-library-header"><div><span>Votre espace</span><h2 id="play-library-title">Ma bibliothèque</h2></div>{summary?.totalPlays>0&&<div className="play-library-stats" aria-label="Résumé de votre activité">{stats.map(({icon:Icon,label,value})=><div key={label}><Icon aria-hidden="true"/><span>{label}</span><strong>{value}</strong></div>)}</div>}</header>{continuePlaying.length>0&&<GameRail sectionKey="continue" title="Continuer à jouer" games={continuePlaying}/>} {favorites.length>0&&<GameRail sectionKey="favorites" title="Mes jeux favoris" games={favorites}/>} {recent.length>0&&<GameRail sectionKey="recent" title="Récemment joués" games={recent}/>}</section>;
}
