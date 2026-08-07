import React,{useEffect,useRef,useState}from'react';
import{PanelBottomOpen}from'lucide-react';
import useGameLibrary from'../hooks/useGameLibrary';
import{usePlayApi}from'../hooks/usePlayApi';
import{usePlayContext}from'../PlayContext';
import GamePlayerToolbar from'./GamePlayerToolbar';
import GameplayRecorderControl from'./GameplayRecorderControl';

const REPORT_REASONS=[
 ['loading','Le jeu ne démarre pas'],
 ['controls','Les commandes ne fonctionnent pas'],
 ['display','Problème d’affichage ou de son'],
 ['other','Autre problème'],
];

export default function GamePlayer({game,dir='ltr',elapsed='00:00',score=null,nextGame=null,onNext,onBack,onSession,extraActions,className='',children}){
 const rootRef=useRef(null),dialogRef=useRef(null),[dark,setDark]=useState(false),[feedback,setFeedback]=useState(''),[reportOpen,setReportOpen]=useState(false),[reason,setReason]=useState('loading'),[details,setDetails]=useState(''),[reporting,setReporting]=useState(false),[reportError,setReportError]=useState(''),[isFullscreen,setIsFullscreen]=useState(false),[barHidden,setBarHidden]=useState(false);
 const{profile}=usePlayContext(),{post,request}=usePlayApi();
 const{favorite,toggleFavorite,loading:favoriteLoading,error:favoriteError}=useGameLibrary(game?.slug||game?.id||'game');
 useEffect(()=>{let active=true,sessionId=null;const deviceType=window.innerWidth<600?'mobile':window.innerWidth<1024?'tablet':'desktop';post('/play/sessions',{gameSlug:game?.slug||game?.id,deviceType}).then(({session})=>{sessionId=session?.id;if(active)onSession?.(sessionId)}).catch(()=>{});return()=>{active=false;if(sessionId)request(`/play/sessions/${sessionId}`,{method:'PATCH',body:JSON.stringify({status:'abandoned'}),keepalive:true}).catch(()=>{})}},[game?.slug,game?.id,onSession,post,request]);
 useEffect(()=>{if(!reportOpen)return undefined;dialogRef.current?.focus();const close=event=>{if(event.key==='Escape'&&!reporting)setReportOpen(false)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[reportOpen,reporting]);
 useEffect(()=>{const onChange=()=>setIsFullscreen(Boolean(document.fullscreenElement));document.addEventListener('fullscreenchange',onChange);return()=>document.removeEventListener('fullscreenchange',onChange)},[]);
 async function fullscreen(){if(!rootRef.current)return;if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{});else await rootRef.current.requestFullscreen?.().catch(()=>{})}
 async function share(){const payload={title:game?.name||'iFilino Play',text:`Découvre ${game?.name||'ce jeu'} sur iFilino Play`,url:window.location.href};try{if(navigator.share)await navigator.share(payload);else if(navigator.clipboard){await navigator.clipboard.writeText(payload.url);setFeedback('Lien copié dans le presse-papiers.')}}catch(error){if(error?.name!=='AbortError')setFeedback('Le partage est indisponible sur cet appareil.')}}
 async function submitReport(event){event.preventDefault();setReporting(true);setReportError('');try{await post('/play/reports',{gameSlug:game?.slug||game?.id,reason,details:details.trim(),pageUrl:window.location.href});setReportOpen(false);setDetails('');setFeedback('Signalement envoyé. Merci pour votre aide.')}catch(error){setReportError(error.message||'Impossible d’envoyer le signalement. Réessayez.')}finally{setReporting(false)}}
 const actions=<>{extraActions}<GameplayRecorderControl game={game}/></>;
 return <section ref={rootRef} dir={dir} className={`play-game-shell play-universal-player${dark?' player-dark':''}${className?` ${className}`:''}`}>
  <div className="play-game-shell-stage">{children}</div>
  {barHidden
   ? <button type="button" className="play-player-show-bar" onClick={()=>setBarHidden(false)} aria-label="Afficher la barre de contrôle" title="Afficher la barre de contrôle"><PanelBottomOpen/></button>
   : <GamePlayerToolbar game={game} elapsed={elapsed} score={score} profile={profile} onNext={nextGame?onNext:null} favorite={favorite} favoriteLoading={favoriteLoading} dark={dark} isFullscreen={isFullscreen} onFavorite={toggleFavorite} onBack={onBack} onShare={share} onFullscreen={fullscreen} onDarkToggle={()=>setDark(value=>!value)} onReport={()=>{setReportError('');setReportOpen(true)}} onHideBar={()=>setBarHidden(true)} extraActions={actions}/>
  }
  {(feedback||favoriteError)&&<div className="play-player-feedback" role="status">{favoriteError||feedback}</div>}
  {reportOpen&&<div className="play-report-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!reporting)setReportOpen(false)}}>
   <form ref={dialogRef} className="play-report-dialog" role="dialog" aria-modal="true" aria-labelledby="play-report-title" tabIndex="-1" onSubmit={submitReport}>
    <span className="play-game-shell-label">Aide et qualité</span><h2 id="play-report-title">Signaler un problème</h2><p>Votre retour nous aide à améliorer {game?.name||'ce jeu'}.</p>
    <label htmlFor="play-report-reason">Quel problème rencontrez-vous ?</label>
    <select id="play-report-reason" value={reason} onChange={event=>setReason(event.target.value)}>{REPORT_REASONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
    <label htmlFor="play-report-details">Précisions <small>facultatif</small></label>
    <textarea id="play-report-details" value={details} maxLength="500" rows="4" onChange={event=>setDetails(event.target.value)} placeholder="Décrivez ce qui s’est passé…"/>
    <span className="play-report-count">{details.length}/500</span>
    {reportError&&<p className="play-report-error" role="alert">{reportError}</p>}
    <div className="play-report-actions"><button type="button" className="play-btn secondary" disabled={reporting} onClick={()=>setReportOpen(false)}>Annuler</button><button type="submit" className="play-btn" disabled={reporting}>{reporting?'Envoi…':'Envoyer'}</button></div>
   </form>
  </div>}
 </section>
}
