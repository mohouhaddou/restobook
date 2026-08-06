import React from 'react';import { Clock3, Trophy } from './PlayIcons';
export function HUDBadge({icon:Icon,label,value,tone='default',className=''}){return <div className={`play-ui-badge ${tone} ${className}`}><Icon size={17} aria-hidden="true"/><span>{label}</span><strong>{value}</strong></div>}
export function ScoreBadge({value,label='Score'}){return <HUDBadge icon={Trophy} label={label} value={value} tone="score"/>}
export function TimerBadge({value,label='Temps'}){return <HUDBadge icon={Clock3} label={label} value={value}/>} 
export default function GameHUD({children,label='Informations de partie'}){return <div className="play-ui-hud" role="status" aria-label={label} aria-live="polite">{children}</div>}
