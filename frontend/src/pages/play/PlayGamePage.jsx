import React,{useEffect,useState}from'react';
import{useNavigate,useParams,Link}from'react-router-dom';
import{motion,AnimatePresence}from'framer-motion';
import'../../modules/play/play.css';
import{usePlayApi}from'../../modules/play/hooks/usePlayApi';
import{usePlayContext}from'../../modules/play/PlayContext';
import{useCustomerAuth}from'../../modules/marketplace/CustomerAuthContext';
import{useI18n}from'../../i18n/config';
import{GAME_COMPONENTS}from'../../modules/play/games';
import{getRegistryGame,listRegistryGames,localizeRegistryGame}from'../../modules/play/registry/gamesRegistry';
import{rankGameRecommendations}from'../../modules/play/services/recommendationService';
import GameShell from'../../modules/play/components/GameShell';
import GamePlayer from'../../modules/play/components/GamePlayer';
import PartnerGameFrame from'../../modules/play/components/PartnerGameFrame';
import{GameIntroScreen}from'../../modules/play/ui';
import{playModalVariants}from'../../modules/play/games/playMotion';
import ShareButtons from'../../shared/components/social/ShareButtons';
const QUIZ_TYPES=new Set(['quiz','true_false','geo_quiz','guess_place']);

export default function PlayGamePage(){
 const{slug}=useParams(),navigate=useNavigate(),{get,post}=usePlayApi(),{refreshProfile}=usePlayContext(),{user}=useCustomerAuth(),{t,language}=useI18n();
 const[game,setGame]=useState(null),[nextGame,setNextGame]=useState(null),[sessionId,setSessionId]=useState(null),[quiz,setQuiz]=useState(null),[questions,setQuestions]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[result,setResult]=useState(null),[roundKey,setRoundKey]=useState(0),[introduced,setIntroduced]=useState(false),[legacyMuted,setLegacyMuted]=useState(true);
 useEffect(()=>{let cancelled=false;setLoading(true);setError('');setResult(null);setIntroduced(false);setNextGame(null);(async()=>{try{
  const local=getRegistryGame(slug);
  if(local){const[activity,favorites]=await Promise.all([get('/play/history?limit=50'),get('/play/favorites')]),registry=listRegistryGames().map(item=>localizeRegistryGame(item,t)),current=localizeRegistryGame(local,t),[recommended]=rankGameRecommendations({currentGame:current,games:registry,history:activity.history||[],favoriteSlugs:(favorites.favorites||[]).map(item=>item.slug),limit:1});if(cancelled)return;setGame(current);setNextGame(recommended||null);return}
  const[{game:g},{games=[]},activity,favorites]=await Promise.all([get(`/play/games/${slug}`),get('/play/games'),get('/play/history?limit=50'),get('/play/favorites')]);
  if(cancelled)return;const[recommended]=rankGameRecommendations({currentGame:g,games,history:activity.history||[],favoriteSlugs:(favorites.favorites||[]).map(item=>item.slug),limit:1});setGame(g);setNextGame(recommended||null);
  if(QUIZ_TYPES.has(g.game_type)){const{quizzes}=await get(`/play/quizzes?gameId=${g.id}`),q=quizzes?.[0];if(!q){setError("Aucun contenu disponible pour ce jeu pour l'instant.");return}const{questions:qs}=await get(`/play/quizzes/${q.id}/questions?locale=${language}`);if(cancelled)return;setQuiz(q);setQuestions(qs)}
 }catch(e){setError(e.message)}finally{if(!cancelled)setLoading(false)}})();return()=>{cancelled=true}},[slug,get,roundKey,t,language]);
 async function handleLocalFinish(payload,activeSessionId){const response=await post('/play/scores',{gameSlug:slug,sessionId:activeSessionId,score:payload.score,durationSeconds:payload.durationSeconds,difficulty:payload.difficulty,stats:payload.stats,won:payload.won});refreshProfile();return response.result}
 async function handleFinish(payload){try{const{result:r}=await post('/play/scores',{gameSlug:slug,sessionId,...payload});setResult(r);refreshProfile()}catch(e){setError(e.message)}}
 const playAgain=()=>{setResult(null);setIntroduced(false);setRoundKey(key=>key+1)},playNext=()=>{if(nextGame?.slug)navigate(`/play/${nextGame.slug}/play`)};
 if(loading)return <div className="play-page"><div className="play-container"><div className="play-game-loading" role="status"><span className="play-loader"/><strong>Chargement du jeu…</strong></div></div></div>;
 if(error&&!game)return <div className="play-page"><div className="play-container"><p>{error}</p><Link to="/play" className="play-btn secondary">Retour à iFilino Play</Link></div></div>;
 if(game?.isLocal){const LocalGame=game.component;return <div className="play-page"><div className="play-container play-game-container"><GameShell game={game} user={user} nextGame={nextGame} onNext={playNext} onComplete={handleLocalFinish} onExit={()=>navigate('/play')}><LocalGame key={roundKey}/></GameShell></div></div>}
 if(game?.source==='partner'){const url=game.launchConfig?.url||game.launch_url,descriptor={url,sandbox:'allow-scripts allow-same-origin allow-pointer-lock allow-orientation-lock allow-presentation allow-popups',permissions:'fullscreen; gamepad; autoplay',referrerPolicy:'strict-origin-when-cross-origin'},stage=game.launchMethod==='redirect'?<div className="play-partner-redirect" role="region" aria-labelledby="partner-redirect-title"><span>Jeu hébergé par {game.providerName||game.providerId}</span><h2 id="partner-redirect-title">Ce jeu s’ouvre chez le fournisseur</h2><p>Famobi ne permet pas l’affichage de cette URL dans une iframe. Votre session iFilino Play reste ouverte dans cet onglet.</p><a className="play-btn" href={url} target="_blank" rel="noopener noreferrer">Ouvrir {game.name}</a></div>:<PartnerGameFrame game={game} descriptor={descriptor} onError={reason=>setError(reason.message)}/>;return <div className="play-page"><div className="play-container-immersive"><GamePlayer game={game} nextGame={nextGame} onNext={playNext} onSession={setSessionId} onBack={()=>navigate('/play')}>{stage}</GamePlayer></div></div>}
 const GameComponent=game?GAME_COMPONENTS[game.game_type]:null;
 return <div className="play-page"><div className="play-container play-game-container">{error&&<p className="play-player-error" role="alert">{error}</p>}<GamePlayer game={game} nextGame={nextGame} onNext={playNext} onSession={setSessionId} onBack={()=>navigate('/play')} className="play-legacy-player"><div className="play-legacy-stage">{!introduced?<GameIntroScreen game={game} muted={legacyMuted} onMutedChange={setLegacyMuted} onStart={()=>setIntroduced(true)} onBack={()=>navigate('/play')} t={t}/>:GameComponent?<GameComponent key={roundKey} game={game} quiz={quiz} questions={questions} onFinish={handleFinish}/>:<p>Jeu indisponible.</p>}</div></GamePlayer></div><AnimatePresence>{result&&<motion.div className="play-modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><motion.div className="play-modal" variants={playModalVariants} initial="hidden" animate="visible"><h2>Bravo !</h2>{result.score!=null&&<p>Score : <strong>{result.score}{result.maxScore?` / ${result.maxScore}`:''}</strong></p>}<p>+{result.xpEarned} XP · +{result.icoinsEarned} iCoins</p>{game&&<div style={{margin:'12px 0'}}><ShareButtons compact title={game.name} text={result.score!=null?`J'ai fait ${result.score}${result.maxScore?`/${result.maxScore}`:''} points sur ${game.name} sur iFilino Play !`:`Je viens de jouer à ${game.name} sur iFilino Play !`} url={`${window.location.origin}/play/${game.slug}`}/></div>}<div className="play-result-modal-actions"><button className="play-btn secondary" onClick={()=>navigate('/play')}>Accueil</button>{nextGame&&<button className="play-btn secondary" onClick={playNext}>Jeu suivant : {nextGame.name}</button>}<button className="play-btn" onClick={playAgain}>Rejouer</button></div></motion.div></motion.div>}</AnimatePresence></div>
}
