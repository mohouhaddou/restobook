import React,{Suspense,useEffect,useRef,useState}from'react';
import{Link}from'react-router-dom';
import{GameIntroScreen,GameResultCard,Pause,Play,Volume2,VolumeX}from'../ui';
import{createGameResult,GAME_RESULT_STATUS}from'../contracts/gameResult';
import{useI18n}from'../../../i18n/config';
import GamePlayer from'./GamePlayer';
const EMBEDDED_INTROS=new Set(['memory-cards','reaction-test','color-match']);
const formatTime=seconds=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
function LoadingGame(){return <div className="play-game-loading" role="status"><span className="play-loader"/><strong>Chargement du jeu…</strong></div>}
export default function GameShell({game,user=null,children,onComplete,onExit,nextGame=null,onNext}){
 const{language,dir,t}=useI18n(),embeddedIntro=EMBEDDED_INTROS.has(game.id||game.slug),[started,setStarted]=useState(embeddedIntro),[paused,setPaused]=useState(false),[muted,setMuted]=useState(true),[elapsed,setElapsed]=useState(0),[confirmExit,setConfirmExit]=useState(false),[result,setResult]=useState(null),[sessionId,setSessionId]=useState(null),startedAt=useRef(Date.now());
 useEffect(()=>{if(!started||paused||result)return;const id=setInterval(()=>setElapsed(Math.floor((Date.now()-startedAt.current)/1000)),1000);return()=>clearInterval(id)},[started,paused,result]);
 function startGame(){startedAt.current=Date.now();setElapsed(0);setStarted(true)}
 async function finish(payload){const next=createGameResult({gameId:game.id,difficulty:game.difficulty,duration:elapsed,...payload});setResult(next);try{const saved=await onComplete?.(next,sessionId);if(saved)setResult({...next,server:saved})}catch{setResult({...next,saveFailed:true})}}
 function exit(){setConfirmExit(false);onExit?.(createGameResult({gameId:game.id,duration:elapsed,difficulty:game.difficulty,status:GAME_RESULT_STATUS.ABANDONED,won:false}))}
 const gameProps={user,locale:language,direction:dir,settings:{muted},paused,onScoreChange:()=>{},onPause:()=>setPaused(true),onResume:()=>setPaused(false),onComplete:finish,onExit:()=>setConfirmExit(true)};
 const controls=<><button type="button" disabled={!started||!!result} onClick={()=>setPaused(v=>!v)} aria-label={paused?t('play.shell.resume'):t('play.shell.pause')}>{paused?<Play/>:<Pause/>}</button><button type="button" onClick={()=>setMuted(v=>!v)} aria-label={muted?t('play.shell.soundOn'):t('play.shell.soundOff')}>{muted?<VolumeX/>:<Volume2/>}</button></>;
 return <GamePlayer game={game} dir={dir} elapsed={formatTime(elapsed)} score={result?.score} nextGame={nextGame} onNext={onNext} onSession={setSessionId} onBack={()=>setConfirmExit(true)} extraActions={controls}>
  {paused&&!result&&<div className="play-game-overlay"><Pause size={34}/><h2>{t('play.shell.paused')}</h2><button className="play-btn" onClick={()=>setPaused(false)}>{t('play.shell.resume')}</button></div>}
  {result?<GameResultCard title={t('play.shell.completed')} score={result.score} duration={`${t('play.shell.duration')}: ${formatTime(result.durationSeconds)}`} reward={result.server?`+${result.server.xpEarned} XP · +${result.server.icoinsEarned} iCoins`:null} warning={result.saveFailed?'Score non synchronisé':null} onReplay={()=>window.location.reload()} backAction={{replayLabel:t('play.shell.replay'),element:<Link className="play-ui-button secondary" to="/play">{t('play.shell.back')}</Link>}} shareTitle={game.name} shareText={`J'ai fait ${result.score} points sur ${game.name} sur iFilino Play !`} shareUrl={typeof window!=='undefined'?`${window.location.origin}/play/${game.slug}`:undefined}/>:!started?<GameIntroScreen game={game} muted={muted} onMutedChange={setMuted} onStart={startGame} onBack={()=>setConfirmExit(true)} t={t}/>:<Suspense fallback={<LoadingGame/>}>{typeof children==='function'?children(gameProps):React.cloneElement(children,gameProps)}</Suspense>}
  {confirmExit&&<div className="play-confirm-backdrop" role="dialog" aria-modal="true" aria-labelledby="play-exit-title"><div className="play-confirm"><h2 id="play-exit-title">{t('play.shell.exitTitle')}</h2><p>{t('play.shell.exitText')}</p><div><button className="play-btn secondary" onClick={()=>setConfirmExit(false)}>{t('play.shell.stay')}</button><button className="play-btn" onClick={exit}>{t('play.shell.leave')}</button></div></div></div>}
 </GamePlayer>
}