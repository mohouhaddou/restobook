import React, { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, ImagePlus } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../../shared/hooks/useApi';
import { API, ASSET } from '../../shared/services/api';
import { DigitalProductsPanel } from './DigitalProductsPanel';
import StoryMediaPanel from './StoryMediaPanel';
import './portal-article-editor.css';

const TYPES = {
  sports: ['news', 'articles', 'competitions', 'clubs', 'players', 'matches', 'live', 'videos', 'standings', 'statistics', 'community'],
  kids: ['learn', 'games', 'stories', 'quizzes', 'drawing', 'music', 'videos', 'animals', 'science', 'space', 'nature', 'history', 'crafts'],
};
const LANGUAGES = [
  ['en', 'English', 'ltr'],
  ['fr', 'Français', 'ltr'],
  ['ar', 'العربية', 'rtl'],
];
const blank = portal => ({
  portal, content_type: TYPES[portal]?.[0] || '', slug: '',
  title_fr: '', title_ar: '', title_en: '', excerpt_fr: '', excerpt_ar: '', excerpt_en: '',
  slug_fr: '', slug_ar: '', slug_en: '', body_fr: '', body_ar: '', body_en: '',
  metadata_fr: null, metadata_ar: null, metadata_en: null,
  seo_title_fr: '', seo_title_ar: '', seo_title_en: '',
  seo_description_fr: '', seo_description_ar: '', seo_description_en: '',
  seo_keywords_fr: [], seo_keywords_ar: [], seo_keywords_en: [], image_url: '', category: '', status: 'draft',
  featured: false, isPremium: false, previewLength: 1200, premiumBadge: 'Premium', sort_order: 0, seo_title: '', seo_description: '',
});

export default function PortalArticleEditorPage() {
  const { portal, id } = useParams();
  const isNew = !id;
  const api = useApi();
  const navigate = useNavigate();
  const [form, setForm] = useState(() => blank(portal));
  const [lang, setLang] = useState('en');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState('');
  const [message, setMessage] = useState('');
  const set = (field, value) => setForm(current => ({ ...current, [field]: value }));
  const field = name => `${name}_${lang}`;

  useEffect(() => {
    if (!TYPES[portal]) return navigate('/admin/portals', { replace: true });
    if (isNew) return setForm(blank(portal));
    api.get(`/superadmin/portals/${portal}/contents/${id}`)
      .then(({ item }) => setForm({ ...blank(portal), ...item }))
      .catch(error => setMessage(error.message));
  }, [id, isNew, portal]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(publish = false) {
    if (!form.title_en.trim() || !form.slug.trim()) return setMessage('The English title and base slug are required.');
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        ...form,
        status: publish ? 'published' : form.status,
        published_at: publish && !form.published_at ? new Date().toISOString() : form.published_at,
      };
      const { item } = isNew
        ? await api.post(`/superadmin/portals/${portal}/contents`, payload)
        : await api.put(`/superadmin/portals/${portal}/contents/${id}`, payload);
      setForm({ ...blank(portal), ...item });
      setMessage(publish ? 'Article enregistré et publié.' : 'Article enregistré.');
      if (isNew) navigate(`/admin/portals/${portal}/articles/${item.id}/edit`, { replace: true });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function showPreview() {
    try {
      const { html } = await api.post('/superadmin/discover/preview', { title: form[field('title')] || '', body: form[field('body')] || '' });
      setPreview(html);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function uploadImage(file) {
    if (!file) return;
    setUploading(true);
    try {
      const data = new FormData();
      data.append('cover', file);
      const response = await fetch(API('/superadmin/discover/articles/upload'), {
        method: 'POST', headers: { Authorization: `Bearer ${api.token}` }, body: data,
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Échec de l’upload');
      set('image_url', result.cover_image_url);
      setMessage('Image ajoutée.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setUploading(false);
    }
  }

  const liveSlug = form[field('slug')] || (lang === 'en' ? form.slug : '');
  const liveType = form.content_type === 'stories' ? 'book' : 'content';
  const livePath = liveSlug ? `/${portal}/${lang}/${liveType}/${liveSlug}` : '';
  return <div className="app-content portal-article-editor-page">
    <div className="page-header">
      <div>
        <Link to={`/admin/portals?portal=${portal}`} className="btn btn-outline-primary btn-xs" style={{ marginBottom: 10 }}><ArrowLeft size={15}/> Retour aux contenus</Link>
        <h1 className="page-title">{isNew ? 'Nouvel article' : 'Modifier l’article'} iFilino {portal === 'sports' ? 'Sports' : 'Kids'}</h1>
        <p className="page-subtitle">Statut : {form.status === 'published' ? 'Publié' : 'Brouillon'}</p>
      </div>
      <div className="portal-admin-editor-actions">
        <button type="button" className="btn btn-outline-primary" onClick={() => save()} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        <button type="button" className="btn btn-primary" onClick={() => save(true)} disabled={saving || form.status === 'published'}>{form.status === 'published' ? 'Publié' : 'Publier'}</button>
        <button type="button" className="btn btn-outline-primary" disabled={form.status !== 'published' || !livePath} onClick={() => window.open(livePath, '_blank', 'noopener,noreferrer')}><ExternalLink size={16}/> Voir live</button>
      </div>
    </div>
    {message && <div className="alert alert-info" role="status">{message}</div>}

    <div className="portal-admin-editor-grid">
      <div className="card portal-admin-editor-main">
        <div className="portal-admin-language-tabs">
          {LANGUAGES.map(([key, label]) => <button key={key} type="button" className={`btn btn-xs ${lang === key ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => { setLang(key); setPreview(''); }}>{label} {(form[`title_${key}`] || form[`body_${key}`]) ? '•' : ''}</button>)}
        </div>
        <div dir={LANGUAGES.find(item => item[0] === lang)?.[2]} className="portal-admin-fields">
          <label className="form-label">Titre<input className="form-control" value={form[field('title')] || ''} onChange={event => set(field('title'), event.target.value)}/></label>
          <label className="form-label">Localized slug<input className="form-control" pattern="[a-z0-9-]+" value={form[field('slug')] || (lang === 'en' ? form.slug : '')} onChange={event => { const value = event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'); set(field('slug'), value); if (lang === 'en') set('slug', value); }} placeholder="localized-story-title"/></label>
          <label className="form-label">Résumé<textarea className="form-control" rows={3} value={form[field('excerpt')] || ''} onChange={event => set(field('excerpt'), event.target.value)}/></label>
          <label className="form-label">Contenu Markdown<textarea className="form-control" rows={18} style={{ fontFamily: 'monospace', fontSize: 13 }} value={form[field('body')] || ''} onChange={event => { set(field('body'), event.target.value); setPreview(''); }}/></label>
          <button type="button" className="btn btn-outline-primary btn-xs" style={{ justifySelf: 'start' }} onClick={showPreview}>Aperçu</button>
          {preview && <div className="card portal-admin-preview" dangerouslySetInnerHTML={{ __html: preview }}/>}
        </div>
      </div>

      <aside className="portal-admin-editor-sidebar">
        <div className="card portal-admin-panel portal-admin-content-settings">
          <label className="form-label">Type de contenu<select className="form-select" value={form.content_type} onChange={event => set('content_type', event.target.value)}>{TYPES[portal].map(type => <option key={type}>{type}</option>)}</select></label>
          <label className="form-label">Catégorie<input className="form-control" value={form.category || ''} onChange={event => set('category', event.target.value)}/></label>
          <label className="form-label">Ordre d’affichage<input className="form-control" type="number" value={form.sort_order || 0} onChange={event => set('sort_order', Number(event.target.value))}/></label>
          <label className="portal-admin-check"><input type="checkbox" checked={Boolean(form.featured)} onChange={event => set('featured', event.target.checked)}/> Mettre à la une</label>
          <label className="portal-admin-check"><input type="checkbox" checked={Boolean(form.isPremium)} onChange={event => set('isPremium', event.target.checked)}/> Publication Premium</label>
          {form.isPremium && <>
            <label className="form-label">Longueur de l’aperçu (caractères)<input className="form-control" type="number" min="0" max="50000" value={form.previewLength ?? 1200} onChange={event => set('previewLength', Math.max(0, Number(event.target.value) || 0))}/></label>
            <label className="form-label">Badge Premium<input className="form-control" maxLength={80} value={form.premiumBadge || 'Premium'} onChange={event => set('premiumBadge', event.target.value)}/></label>
          </>}
        </div>
        <div className="card portal-admin-panel portal-admin-cover-panel">
          <label className="form-label">Image de couverture</label>
          {form.image_url && <img src={ASSET(form.image_url)} alt="" className="portal-admin-cover"/>}
          <input type="file" accept="image/*" disabled={uploading} onChange={event => { uploadImage(event.target.files?.[0]); event.target.value = ''; }}/>
          <small className="portal-admin-help"><ImagePlus size={15}/>{uploading ? 'Upload en cours…' : 'JPG, PNG ou WebP'}</small>
          <label className="form-label">Ou URL de l’image<input className="form-control" value={form.image_url || ''} onChange={event => set('image_url', event.target.value)}/></label>
        </div>
        <div className="card portal-admin-panel portal-admin-editor-seo">
          <label className="form-label">SEO title ({lang.toUpperCase()})<input className="form-control" value={form[field('seo_title')] || ''} onChange={event => set(field('seo_title'), event.target.value)}/></label>
          <label className="form-label">SEO description ({lang.toUpperCase()})<textarea className="form-control" rows={4} value={form[field('seo_description')] || ''} onChange={event => set(field('seo_description'), event.target.value)}/></label>
          <label className="form-label">SEO keywords ({lang.toUpperCase()})<input className="form-control" value={Array.isArray(form[field('seo_keywords')]) ? form[field('seo_keywords')].join(', ') : (form[field('seo_keywords')] || '')} onChange={event => set(field('seo_keywords'), event.target.value)} placeholder="keyword, keyword"/></label>
          <label className="form-label">Localized metadata JSON ({lang.toUpperCase()})<textarea className="form-control" rows={6} value={typeof form[field('metadata')] === 'string' ? form[field('metadata')] : JSON.stringify(form[field('metadata')] || {}, null, 2)} onChange={event => set(field('metadata'), event.target.value)}/></label>
        </div>
        {!isNew && <DigitalProductsPanel portalContentId={form.id}/>}
      </aside>
      {!isNew && form.content_type === 'stories' && <StoryMediaPanel story={form}/>}
    </div>
  </div>;
}
