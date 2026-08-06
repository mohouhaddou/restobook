import React, { useEffect, useState } from 'react';
import { ArrowLeft, Download, ExternalLink } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../../shared/hooks/useApi';
import { API, ASSET } from "../../shared/services/api";
import { DigitalProductsPanel } from "./DigitalProductsPanel";

const LANGUAGES = [
  ['en', 'English', 'ltr'],
  ['fr', 'Français', 'ltr'],
  ['ar', 'العربية', 'rtl'],
];
const DIFFICULTIES = ['', 'beginner', 'intermediate', 'advanced'];

const blankLesson = () => ({
  slug: '', subject: '', grade: '', difficulty: '', estimated_duration_minutes: '',
  cover_image_url: '', category: 'lesson', tags: [], keywords: [], premium: false,
  status: 'draft', featured: false, sort_order: 0, prerequisites: [], next_lessons: [], related_lessons: [],
});
const blankTranslations = () => Object.fromEntries(LANGUAGES.map(([code]) => [code, {
  language: code, title: '', slug: '', summary: '', body: '', objectives: [], skills: [], competencies: [],
  seo_title: '', seo_description: '',
}]));

const listToText = value => (Array.isArray(value) ? value.join(', ') : '');
const textToList = value => value.split(',').map(v => v.trim()).filter(Boolean);

export default function StudyLessonEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const api = useApi();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(blankLesson);
  const [translations, setTranslations] = useState(blankTranslations);
  const [resources, setResources] = useState([]);
  const [lang, setLang] = useState('en');
  const [tab, setTab] = useState('content'); // 'content' | 'resources'
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isNew) { setLesson(blankLesson()); setTranslations(blankTranslations()); setResources([]); return; }
    api.get(`/superadmin/study/lessons/${id}`)
      .then(({ item }) => {
        setLesson({ ...blankLesson(), ...item });
        const byLang = blankTranslations();
        for (const t of item.translations || []) byLang[t.language] = { ...byLang[t.language], ...t };
        setTranslations(byLang);
        setResources(item.resources || []);
      })
      .catch(error => setMessage(error.message));
  }, [id, isNew]); // eslint-disable-line react-hooks/exhaustive-deps

  const setLessonField = (field, value) => setLesson(current => ({ ...current, [field]: value }));
  const setTranslationField = (field, value) => setTranslations(current => ({ ...current, [lang]: { ...current[lang], [field]: value } }));

  async function save(publish) {
    if (!lesson.slug.trim() || !translations.en.title.trim()) {
      setMessage('Le slug et le titre anglais sont obligatoires.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        lesson: { ...lesson, status: publish ? 'published' : lesson.status },
        translations: Object.values(translations).filter(t => t.title.trim()),
      };
      const { item } = isNew
        ? await api.post('/superadmin/study/lessons', payload)
        : await api.put(`/superadmin/study/lessons/${id}`, payload);
      setLesson({ ...blankLesson(), ...item });
      const byLang = blankTranslations();
      for (const t of item.translations || []) byLang[t.language] = { ...byLang[t.language], ...t };
      setTranslations(byLang);
      setMessage(publish ? 'Leçon enregistrée et publiée.' : 'Leçon enregistrée.');
      if (isNew) navigate(`/admin/study/lessons/${item.id}/edit`, { replace: true });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  const livePath = lesson.status === 'published' && translations[lang]?.slug
    ? `/kids/${lang}/learn/${translations[lang].slug}` : '';
  const currentTranslation = translations[lang] || blankTranslations()[lang];

  async function downloadResource(resource) {
    try {
      const response = await fetch(API(`/superadmin/study/lessons/${id}/resources/${resource.id}/download`), {
        headers: { Authorization: `Bearer ${api.token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${resource.type}.${resource.format === 'markdown' ? 'md' : 'json'}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return <div className="app-content">
    <div className="page-header">
      <div>
        <Link to="/admin/study" className="btn btn-outline-primary btn-xs" style={{ marginBottom: 10 }}><ArrowLeft size={15}/> Retour aux leçons</Link>
        <h1 className="page-title">{isNew ? 'Nouvelle leçon' : 'Modifier la leçon'} Study</h1>
        <p className="page-subtitle">Statut : {lesson.status === 'published' ? 'Publié' : 'Brouillon'}</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-outline-primary" onClick={() => save(false)} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        <button type="button" className="btn btn-primary" onClick={() => save(true)} disabled={saving || lesson.status === 'published'}>{lesson.status === 'published' ? 'Publié' : 'Publier'}</button>
        <button type="button" className="btn btn-outline-primary" disabled={!livePath} onClick={() => window.open(livePath, '_blank', 'noopener,noreferrer')}><ExternalLink size={16}/> Voir live</button>
      </div>
    </div>
    {message && <div className="alert alert-info" role="status">{message}</div>}

    <div className="if-card" style={{ padding: 6, display: 'inline-flex', gap: 5, width: 'fit-content', marginBottom: 14 }}>
      {[['content', 'Contenu'], ['resources', `Ressources (${resources.length})`]].map(([key, label]) => (
        <button key={key} type="button" className={`btn ${tab === key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(key)}>{label}</button>
      ))}
    </div>

    {tab === 'resources' ? (
      <div className="if-card" style={{ padding: 18 }}>
        {!resources.length && <p style={{ color: '#6b7280' }}>Aucune ressource optionnelle importée (quiz, flashcards, glossaire, notes enseignant...).</p>}
        {!!resources.length && <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Type', 'Format', 'Taille', 'Mise à jour', ''].map(l => <th key={l} style={{ textAlign: 'left', padding: 8, color: '#6b7280' }}>{l}</th>)}</tr></thead>
          <tbody>{resources.map(r => <tr key={r.id} style={{ borderTop: '1px solid #e5e7eb' }}>
            <td style={{ padding: 8 }}>{r.type}</td>
            <td style={{ padding: 8 }}>{r.format}</td>
            <td style={{ padding: 8 }}>{r.size ? `${Math.ceil(r.size / 1024)} Ko` : '—'}</td>
            <td style={{ padding: 8 }}>{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—'}</td>
            <td style={{ padding: 8 }}>
              <button type="button" className="btn btn-secondary btn-xs" onClick={() => downloadResource(r)}><Download size={14}/></button>
            </td>
          </tr>)}</tbody>
        </table>}
      </div>
    ) : (
      <div className="portal-admin-editor-grid">
        <div className="card portal-admin-editor-main">
          <div className="portal-admin-language-tabs">
            {LANGUAGES.map(([key, label]) => <button key={key} type="button" className={`btn btn-xs ${lang === key ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setLang(key)}>{label} {translations[key]?.title ? '•' : ''}</button>)}
          </div>
          <div dir={LANGUAGES.find(item => item[0] === lang)?.[2]} className="portal-admin-fields">
            <label className="form-label">Titre<input className="form-control" value={currentTranslation.title} onChange={e => setTranslationField('title', e.target.value)}/></label>
            <label className="form-label">Slug localisé<input className="form-control" value={currentTranslation.slug} onChange={e => setTranslationField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder={lang === 'en' ? lesson.slug : `${lesson.slug}-${lang}`}/></label>
            <label className="form-label">Résumé<textarea className="form-control" rows={2} value={currentTranslation.summary} onChange={e => setTranslationField('summary', e.target.value)}/></label>
            <label className="form-label">Contenu Markdown (article.md)<textarea className="form-control" rows={16} style={{ fontFamily: 'monospace', fontSize: 13 }} value={currentTranslation.body} onChange={e => setTranslationField('body', e.target.value)}/></label>
            <label className="form-label">Objectifs d'apprentissage (séparés par virgule)<input className="form-control" value={listToText(currentTranslation.objectives)} onChange={e => setTranslationField('objectives', textToList(e.target.value))}/></label>
            <label className="form-label">Compétences (séparées par virgule)<input className="form-control" value={listToText(currentTranslation.skills)} onChange={e => setTranslationField('skills', textToList(e.target.value))}/></label>
          </div>
        </div>

        <aside className="portal-admin-editor-sidebar">
          <div className="card portal-admin-panel">
            <label className="form-label">Slug de base (EN)<input className="form-control" value={lesson.slug} onChange={e => setLessonField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}/></label>
            <label className="form-label">Matière<input className="form-control" value={lesson.subject || ''} onChange={e => setLessonField('subject', e.target.value)}/></label>
            <label className="form-label">Niveau / grade<input className="form-control" value={lesson.grade || ''} onChange={e => setLessonField('grade', e.target.value)}/></label>
            <label className="form-label">Difficulté<select className="form-select" value={lesson.difficulty || ''} onChange={e => setLessonField('difficulty', e.target.value || null)}>{DIFFICULTIES.map(d => <option key={d} value={d}>{d || '—'}</option>)}</select></label>
            <label className="form-label">Durée estimée (minutes)<input className="form-control" type="number" value={lesson.estimated_duration_minutes || ''} onChange={e => setLessonField('estimated_duration_minutes', e.target.value ? Number(e.target.value) : null)}/></label>
            <label className="form-label">Tags (séparés par virgule)<input className="form-control" value={listToText(lesson.tags)} onChange={e => setLessonField('tags', textToList(e.target.value))}/></label>
            <label className="form-label">Mots-clés (séparés par virgule)<input className="form-control" value={listToText(lesson.keywords)} onChange={e => setLessonField('keywords', textToList(e.target.value))}/></label>
            <label className="form-label">Ordre d'affichage<input className="form-control" type="number" value={lesson.sort_order || 0} onChange={e => setLessonField('sort_order', Number(e.target.value))}/></label>
            <label className="portal-admin-check"><input type="checkbox" checked={Boolean(lesson.featured)} onChange={e => setLessonField('featured', e.target.checked)}/> Mettre à la une</label>
            <label className="portal-admin-check"><input type="checkbox" checked={Boolean(lesson.premium)} onChange={e => setLessonField('premium', e.target.checked)}/> Contenu premium</label>
          </div>
          <div className="card portal-admin-panel">
            <label className="form-label">Prérequis (slugs, séparés par virgule)<input className="form-control" value={listToText(lesson.prerequisites)} onChange={e => setLessonField('prerequisites', textToList(e.target.value))}/></label>
            <label className="form-label">Leçons suivantes (slugs)<input className="form-control" value={listToText(lesson.next_lessons)} onChange={e => setLessonField('next_lessons', textToList(e.target.value))}/></label>
            <label className="form-label">Leçons liées (slugs)<input className="form-control" value={listToText(lesson.related_lessons)} onChange={e => setLessonField('related_lessons', textToList(e.target.value))}/></label>
          </div>
          <div className="card portal-admin-panel">
            <label className="form-label">Image de couverture</label>
            {lesson.cover_image_url && <img src={ASSET(lesson.cover_image_url)} alt="" className="portal-admin-cover"/>}
            <label className="form-label">URL de l'image<input className="form-control" value={lesson.cover_image_url || ''} onChange={e => setLessonField('cover_image_url', e.target.value)}/></label>
          </div>
          <div className="card portal-admin-panel">
            <label className="form-label">SEO title ({lang.toUpperCase()})<input className="form-control" value={currentTranslation.seo_title} onChange={e => setTranslationField('seo_title', e.target.value)}/></label>
            <label className="form-label">SEO description ({lang.toUpperCase()})<textarea className="form-control" rows={3} value={currentTranslation.seo_description} onChange={e => setTranslationField('seo_description', e.target.value)}/></label>
          </div>
          {!isNew && <DigitalProductsPanel studyLessonId={lesson.id}/>}
        </aside>
      </div>
    )}
  </div>;
}
