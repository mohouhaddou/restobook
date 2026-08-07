import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Heart, Play } from 'lucide-react';
import { ASSET } from '../../../../../shared/services/api';
import './adventure-landing.css';

/**
 * Pré-page avant lecture — même principe que BookLandingPage.jsx pour Stories (Bibliothèque →
 * présentation → lecture), généralisée pour Study/Encyclopedia qui n'avaient jusqu'ici aucune
 * étape intermédiaire (clic direct dans le livre plein écran). Volontairement plus simple que
 * BookHero.tsx/BookCharacters.tsx/etc. (typés contre le contrat Story-spécifique BookItem) :
 * reconstruite ici avec les seules données déjà disponibles pour une leçon/un article
 * (résumé, chips matière/niveau/durée, objectifs ou infos rapides), pas une duplication du
 * contrat Book.
 */
export function AdventureLanding({
  coverImage, title, summary, chips, objectives, quickFacts,
  backTo, backLabel, startLabel, onStart,
  favorite, onToggleFavorite,
}) {
  return (
    <div className="adventure-landing">
      <div className="adventure-landing-hero">
        {coverImage && <img src={ASSET(coverImage)} alt="" className="adventure-landing-cover"/>}
        <div className="adventure-landing-scrim"/>
        <div className="adventure-landing-content">
          <Link to={backTo} className="adventure-landing-back"><ArrowLeft size={16}/>{backLabel}</Link>
          <div className="adventure-landing-chips">
            {chips.filter(Boolean).map(chip => <span key={chip}>{chip}</span>)}
          </div>
          <h1>{title}</h1>
          {summary && <p>{summary}</p>}
          <div className="adventure-landing-actions">
            <button type="button" className="adventure-landing-start" onClick={onStart}>
              <Play size={18} fill="currentColor"/>{startLabel}
            </button>
            {onToggleFavorite && (
              <button type="button" className="adventure-landing-favorite" onClick={onToggleFavorite} aria-pressed={favorite} aria-label="Favorite">
                <Heart size={20} fill={favorite ? 'currentColor' : 'none'}/>
              </button>
            )}
          </div>
        </div>
      </div>

      {(objectives?.length > 0 || quickFacts?.length > 0) && (
        <div className="adventure-landing-body">
          {objectives?.length > 0 && (
            <div className="adventure-landing-block">
              <strong>What you'll learn</strong>
              <ul>{objectives.map(o => <li key={o}>{o}</li>)}</ul>
            </div>
          )}
          {quickFacts?.length > 0 && (
            <div className="adventure-landing-facts">
              {quickFacts.map(([Icon, label, value]) => (
                <div key={label}><Icon size={18}/><span><small>{label}</small><strong>{value}</strong></span></div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

