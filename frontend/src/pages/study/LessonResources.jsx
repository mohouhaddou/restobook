import React, { useMemo, useRef, useState } from 'react';
import { Award, BookCheck, BookOpen, Brain, Check, ChevronDown, CircleHelp, Download, FileText, GraduationCap, Layers3, LoaderCircle, Map, RotateCcw, Sparkles, Users, X } from 'lucide-react';
import { API } from '../../shared/services/api';
import { useCustomerAuth } from '../../modules/marketplace/CustomerAuthContext';

const RESOURCE_UI = {
  quiz: { label: 'Quiz interactif', description: 'Teste tes connaissances et découvre ton score.', icon: CircleHelp, action: 'Jouer' },
  exercises: { label: 'Exercices pratiques', description: 'Réponds aux questions à ton rythme.', icon: BookCheck, action: 'S’entraîner' },
  flashcards: { label: 'Cartes mémoire', description: 'Retourne les cartes pour mémoriser les mots-clés.', icon: Brain, action: 'Réviser' },
  glossary: { label: 'Glossaire illustré', description: 'Retrouve les mots importants de la leçon.', icon: BookOpen, action: 'Explorer' },
  answers: { label: 'Corrigé expliqué', description: 'Vérifie tes réponses après les exercices.', icon: Check, action: 'Voir le corrigé' },
  certificate: { label: 'Mon certificat', description: 'Personnalise et imprime ton diplôme de réussite.', icon: Award, action: 'Créer' },
  learning_path: { label: 'Mon parcours', description: 'Vois d’où tu viens et quelle leçon poursuivre.', icon: Map, action: 'Voir le parcours' },
  parent_guide: { label: 'Coin des parents', description: 'Des activités simples à refaire à la maison.', icon: Users, action: 'Lire' },
  teacher_notes: { label: 'Espace enseignant', description: 'Déroulé, matériel et pistes de différenciation.', icon: GraduationCap, action: 'Préparer le cours' },
  sources: { label: 'Sources pédagogiques', description: 'Références utilisées pour construire la leçon.', icon: FileText, action: 'Consulter' },
};

function InlineText({ text }) {
  const parts = String(text).split(/(\[[^\]]+\]\(https?:\/\/[^)]+\))/g);
  return parts.map((part, index) => { const match = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/); return match ? <a key={index} href={match[2]} target="_blank" rel="noopener noreferrer">{match[1]}</a> : <React.Fragment key={index}>{part.replace(/\*\*/g, '')}</React.Fragment>; });
}

function MarkdownView({ text }) {
  return <div className="resource-markdown">{String(text).split('\n').map((line, index) => {
    if (line.startsWith('### ')) return <h4 key={index}><InlineText text={line.slice(4)}/></h4>;
    if (line.startsWith('## ')) return <h3 key={index}><InlineText text={line.slice(3)}/></h3>;
    if (line.startsWith('# ')) return <h2 key={index}><InlineText text={line.slice(2)}/></h2>;
    if (/^\d+\. /.test(line)) return <div className="resource-step" key={index}><span>{line.match(/^\d+/)[0]}</span><p><InlineText text={line.replace(/^\d+\. /, '')}/></p></div>;
    if (line.startsWith('- ')) return <div className="resource-bullet" key={index}><Check size={15}/><p><InlineText text={line.slice(2)}/></p></div>;
    return line.trim() ? <p key={index}><InlineText text={line}/></p> : <br key={index}/>;
  })}</div>;
}

function Quiz({ data }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const questions = data.questions || [];
  const result = useMemo(() => questions.reduce((score, q) => {
    const value = answers[q.id];
    if (q.type === 'multiple_choice' && Number(value) === q.answer) return score + 1;
    if (q.type === 'true_false' && value === String(q.answer)) return score + 1;
    if (q.type === 'fill_blank' && q.accepted_answers?.some(a => String(a).toLowerCase() === String(value || '').trim().toLowerCase())) return score + 1;
    return score;
  }, 0), [answers, questions]);
  const choose = (id, value) => { setAnswers(current => ({ ...current, [id]: value })); setSubmitted(false); };
  return <div className="resource-quiz"><div className="resource-quiz-head"><Brain/><div><h3>{data.title || 'Mini quiz'}</h3><p>{questions.length} questions · objectif {data.passing_score || questions.length}/{questions.length}</p></div></div>{questions.map((q, index) => <fieldset key={q.id} className="resource-question"><legend><span>{index + 1}</span>{q.question}</legend>{q.type === 'multiple_choice' && <div className="resource-options">{q.options.map((option, optionIndex) => <label key={option}><input type="radio" name={q.id} checked={String(answers[q.id]) === String(optionIndex)} onChange={() => choose(q.id, optionIndex)}/><span>{option}</span></label>)}</div>}{q.type === 'true_false' && <div className="resource-options"><label><input type="radio" name={q.id} checked={answers[q.id] === 'true'} onChange={() => choose(q.id, 'true')}/><span>Vrai</span></label><label><input type="radio" name={q.id} checked={answers[q.id] === 'false'} onChange={() => choose(q.id, 'false')}/><span>Faux</span></label></div>}{['fill_blank','short_answer'].includes(q.type) && <input className="resource-answer-input" value={answers[q.id] || ''} onChange={event => choose(q.id, event.target.value)} placeholder="Écris ta réponse…"/>}{submitted && q.explanation && <p className="resource-explanation"><Sparkles size={15}/>{q.explanation}</p>}</fieldset>)}<button type="button" className="resource-submit" onClick={() => setSubmitted(true)} disabled={Object.keys(answers).length < questions.length}>{submitted ? 'Recalculer mon score' : 'Voir mon score'}</button>{submitted && <div className={`resource-score ${result >= (data.passing_score || questions.length) ? 'success' : ''}`} role="status"><strong>{result}/{questions.length}</strong><span>{result >= (data.passing_score || questions.length) ? 'Bravo, mission réussie !' : 'Presque ! Relis les explications et réessaie.'}</span></div>}</div>;
}

function Flashcards({ data }) {
  const [index, setIndex] = useState(0); const [flipped, setFlipped] = useState(false); const cards = data.cards || []; const card = cards[index];
  if (!card) return null;
  return <div className="resource-flashcards"><p>Carte {index + 1} sur {cards.length}</p><button type="button" className={`resource-flashcard${flipped ? ' flipped' : ''}`} onClick={() => setFlipped(value => !value)} aria-pressed={flipped}><span>{flipped ? card.back : card.front}</span><small><RotateCcw size={15}/>{flipped ? 'Voir le mot' : 'Voir la définition'}</small></button><div><button type="button" disabled={index === 0} onClick={() => { setIndex(i => i - 1); setFlipped(false); }}>Précédente</button><button type="button" disabled={index === cards.length - 1} onClick={() => { setIndex(i => i + 1); setFlipped(false); }}>Suivante</button></div></div>;
}

function Glossary({ data }) {
  const [open, setOpen] = useState(0); return <div className="resource-glossary">{(data.terms || []).map((item, index) => <button type="button" key={item.term} onClick={() => setOpen(open === index ? -1 : index)} aria-expanded={open === index}><span><strong>{item.term}</strong><ChevronDown className={open === index ? 'rotated' : ''}/></span>{open === index && <p>{item.definition}</p>}</button>)}</div>;
}

function Exercises({ data }) {
  const [answers, setAnswers] = useState({}); return <div className="resource-exercises">{(data.exercises || []).map((exercise, index) => <div className="resource-exercise" key={exercise.id}><span>{index + 1}</span><div><h4>{exercise.prompt}</h4>{exercise.options ? <div className="resource-options">{exercise.options.map(option => <label key={option}><input type="radio" name={exercise.id} checked={answers[exercise.id] === option} onChange={() => setAnswers(current => ({ ...current, [exercise.id]: option }))}/><span>{option}</span></label>)}</div> : exercise.type === 'true_false' ? <div className="resource-options">{['Vrai','Faux'].map(option => <label key={option}><input type="radio" name={exercise.id} onChange={() => setAnswers(current => ({ ...current, [exercise.id]: option }))}/><span>{option}</span></label>)}</div> : <textarea value={answers[exercise.id] || ''} onChange={event => setAnswers(current => ({ ...current, [exercise.id]: event.target.value }))} placeholder={exercise.type === 'drawing' ? 'Fais ton dessin sur une feuille, puis décris-le ici…' : 'Ta réponse…'}/>}</div></div>)}</div>;
}

function Answers({ data }) { return <div className="resource-answers">{Object.entries(data).map(([key, value], index) => <div key={key}><span>{index + 1}</span><div><strong>Réponse</strong><p>{typeof value === 'string' ? value : JSON.stringify(value).replace(/[{}\[\]"]/g, '').replace(/,/g, ' · ')}</p></div></div>)}</div>; }

function Certificate({ data }) {
  const [name, setName] = useState(''); return <div className="resource-certificate-wrap"><label>Prénom de l’enfant<input value={name} onChange={event => setName(event.target.value)} placeholder="Ex. Lina"/></label><div className="resource-certificate"><Award/><small>{data.issuer || 'iFilino Kids'} présente ce</small><h3>{data.template || 'Certificat de réussite'}</h3><strong>{name || 'Ton prénom'}</strong><p>{data.achievement || 'a terminé cette leçon avec succès'}</p><span>{data.lesson}</span></div><button type="button" className="resource-submit" onClick={() => window.print()} disabled={!name.trim()}><Download size={17}/>Imprimer mon certificat</button></div>;
}

function LearningPath({ data }) { return <div className="resource-path">{(data.prerequisites || []).map(item => <div key={item.slug}><span><Check/></span><small>Déjà acquis</small><strong>{item.title}</strong></div>)}{data.current && <div className="current"><span><Layers3/></span><small>Tu es ici</small><strong>{data.current.title}</strong></div>}{(data.next || []).map((item, index) => <div key={item.slug}><span>{index + 1}</span><small>Prochaine étape</small><strong>{item.title}</strong></div>)}</div>; }

function ResourceContent({ resource, data }) {
  if (resource.format === 'markdown') return <MarkdownView text={data}/>;
  if (resource.type === 'quiz') return <Quiz data={data}/>;
  if (resource.type === 'flashcards') return <Flashcards data={data}/>;
  if (resource.type === 'glossary') return <Glossary data={data}/>;
  if (resource.type === 'exercises') return <Exercises data={data}/>;
  if (resource.type === 'answers') return <Answers data={data}/>;
  if (resource.type === 'certificate') return <Certificate data={data}/>;
  if (resource.type === 'learning_path') return <LearningPath data={data}/>;
  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}

export function LessonResources({ resources, slug, language }) {
  const { token } = useCustomerAuth(); const [active, setActive] = useState(null); const [data, setData] = useState(null); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const panelRef = useRef(null);
  const open = async resource => { setActive(resource); setData(null); setError(''); setLoading(true); try { const response = await fetch(API(`/study/lessons/${slug}/resources/${resource.id}/download?lang=${language}`), { headers: token ? { Authorization: `Bearer ${token}` } : {} }); if (!response.ok) throw new Error('Cette activité est momentanément indisponible.'); setData(resource.format === 'json' ? await response.json() : await response.text()); setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } catch (err) { setError(err.message); } finally { setLoading(false); } };
  return <section className="study-resources"><div className="study-resource-heading"><div><span><Sparkles size={15}/>Pour aller plus loin</span><h2>Activités et outils</h2><p>Choisis une activité : tout se fait directement ici, sans télécharger de fichier technique.</p></div></div><div className="study-resource-grid">{resources.map(resource => { const ui = RESOURCE_UI[resource.type] || { label: resource.type, description: 'Ressource complémentaire', icon: BookOpen, action: 'Ouvrir' }; const Icon = ui.icon; return <button type="button" key={resource.id} onClick={() => open(resource)} className={active?.id === resource.id ? 'active' : ''}><span className="resource-icon"><Icon/></span><span className="resource-card-copy"><strong>{ui.label}</strong><small>{ui.description}</small><em>{ui.action}</em></span></button>; })}</div>{active && <div className="study-resource-panel" ref={panelRef}><header><div><span>{React.createElement((RESOURCE_UI[active.type] || {}).icon || BookOpen)}</span><div><small>Activité</small><h2>{(RESOURCE_UI[active.type] || {}).label || active.type}</h2></div></div><button type="button" onClick={() => { setActive(null); setData(null); }} aria-label="Fermer"><X/></button></header>{loading && <div className="resource-loading"><LoaderCircle/><span>Préparation de l’activité…</span></div>}{error && <div className="resource-error" role="alert">{error}</div>}{data !== null && <ResourceContent resource={active} data={data}/>}</div>}</section>;
}
