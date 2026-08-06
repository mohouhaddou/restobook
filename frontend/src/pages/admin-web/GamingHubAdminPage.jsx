import React, { useEffect, useMemo, useState } from 'react';
import { useApi } from '../../hooks/useApi';

const TABS = [
  { key: 'games', label: 'Jeux' },
  { key: 'articles', label: 'Articles' },
  { key: 'similar', label: 'Jeux similaires' },
  { key: 'publishers', label: 'Éditeurs' },
  { key: 'categories', label: 'Catégories' },
  { key: 'platforms', label: 'Plateformes' },
  { key: 'tags', label: 'Tags' },
];

const ARTICLE_TYPES = ['actualite', 'guide', 'astuce', 'test', 'classement', 'comparatif', 'top', 'collection'];
const VIEW_MODES = ['2d', '3d', 'top-down', 'isometric', 'side-scroll', 'first-person'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

const inputStyle = { minHeight: 34, border: '1px solid #D1D5DB', borderRadius: 6, padding: '6px 8px', fontSize: 13 };
const textareaStyle = { ...inputStyle, minHeight: 80, fontFamily: 'inherit', resize: 'vertical' };
const th = { padding: 8, textAlign: 'left' };
const td = { padding: 8, borderTop: '1px solid #F3F4F6' };
const panelStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 14, marginBottom: 14 };
const primaryBtn = { minHeight: 40, border: 'none', background: '#111827', color: '#fff', borderRadius: 8, padding: '8px 14px', fontWeight: 800, cursor: 'pointer' };
const outlineBtn = { minHeight: 36, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 700, fontSize: 12 };
const dangerBtn = { ...outlineBtn, border: '1px solid #FCA5A5', color: '#DC2626' };
const aiBtn = { ...outlineBtn, border: '1px solid #C4B5FD', background: '#F5F3FF', color: '#6D28D9' };

function Msg({ text }) {
  if (!text) return null;
  return <div style={{ padding: '8px 12px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, color: '#9A3412', fontWeight: 700, fontSize: 13, marginBottom: 12 }}>{text}</div>;
}

function StatusBadge({ status }) {
  const published = status === 'published';
  return <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: published ? '#F0FDF4' : '#F3F4F6', color: published ? '#16A34A' : '#6B7280' }}>{published ? 'Publié' : 'Brouillon'}</span>;
}

function AdminSortHeader({ label, sortKey, sort, onSort }) {
  const active = sort.key === sortKey;
  return <th aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'} style={{ ...th, position: 'sticky', top: 0, background: '#F9FAFB', zIndex: 2 }}><button type="button" onClick={() => onSort(sortKey)} style={{ minHeight: 40, border: 0, background: 'transparent', color: 'inherit', padding: 0, font: 'inherit', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>{label} <span aria-hidden="true">{active ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>;
}

// ── CRUD générique (éditeurs/catégories/plateformes/tags) ──────────────────
const SIMPLE_FIELD_SETS = {
  publishers: [{ key: 'slug', label: 'Slug', required: true }, { key: 'name', label: 'Nom', required: true }, { key: 'logo_url', label: 'Logo URL' }, { key: 'official_url', label: 'Site officiel' }],
  categories: [{ key: 'slug', label: 'Slug', required: true }, { key: 'label_fr', label: 'Libellé FR', required: true }, { key: 'label_en', label: 'Libellé EN', required: true }, { key: 'label_ar', label: 'Libellé AR', required: true }, { key: 'icon', label: 'Icône' }, { key: 'sort_order', label: 'Ordre', type: 'number' }],
  platforms: [{ key: 'slug', label: 'Slug', required: true }, { key: 'name', label: 'Nom', required: true }],
  tags: [{ key: 'slug', label: 'Slug', required: true }, { key: 'label', label: 'Libellé', required: true }],
};

function SimpleEntityPanel({ tabKey }) {
  const { get, post, put, del } = useApi();
  const fields = SIMPLE_FIELD_SETS[tabKey];
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    try { const { items: rows } = await get(`/superadmin/gaminghub/${tabKey}`); setItems(rows || []); }
    catch (e) { setMessage(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); setForm({}); setEditingId(null); setMessage(''); }, [tabKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    const missing = fields.filter(f => f.required && !String(form[f.key] || '').trim());
    if (missing.length) { setMessage('Champs obligatoires : ' + missing.map(f => f.label).join(', ')); return; }
    try {
      if (editingId) await put(`/superadmin/gaminghub/${tabKey}/${editingId}`, form);
      else await post(`/superadmin/gaminghub/${tabKey}`, form);
      setForm({}); setEditingId(null); setMessage(editingId ? 'Modifications enregistrées.' : 'Créé.');
      await load();
    } catch (e) { setMessage(e.message); }
  }
  function handleEdit(item) {
    const next = {}; fields.forEach(f => { next[f.key] = item[f.key] ?? ''; });
    setForm(next); setEditingId(item.id); setMessage(`Modification de la ligne #${item.id}`);
  }
  async function handleDelete(id) {
    if (!window.confirm('Supprimer cet élément ?')) return;
    try { await del(`/superadmin/gaminghub/${tabKey}/${id}`); await load(); } catch (e) { setMessage(e.message); }
  }

  return (
    <div>
      <Msg text={message} />
      <div style={panelStyle}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>{editingId ? `Modifier la ligne #${editingId}` : 'Nouveau'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {fields.map(f => (
            <label key={f.key} style={{ display: 'grid', gap: 4, fontSize: 12, color: '#4B5563', fontWeight: 700 }}>
              {f.label}{f.required ? ' *' : ''}
              <input style={inputStyle} type={f.type || 'text'} value={form[f.key] ?? ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={handleSave} style={primaryBtn}>{editingId ? 'Enregistrer' : 'Créer'}</button>
          {editingId && <button onClick={() => { setEditingId(null); setForm({}); }} style={outlineBtn}>Annuler</button>}
        </div>
      </div>

      <div style={{ ...panelStyle, padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
          <thead><tr style={{ background: '#F9FAFB', color: '#4B5563', fontSize: 12 }}>
            <th style={th}>ID</th>{fields.map(f => <th key={f.key} style={th}>{f.label}</th>)}<th style={th}></th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={fields.length + 2} style={{ padding: 16, textAlign: 'center', color: '#6B7280' }}>Chargement…</td></tr>
              : items.length === 0 ? <tr><td colSpan={fields.length + 2} style={{ padding: 16, textAlign: 'center', color: '#6B7280' }}>Aucun élément.</td></tr>
              : items.map(item => (
                <tr key={item.id}>
                  <td style={td}>{item.id}</td>
                  {fields.map(f => <td key={f.key} style={td}>{String(item[f.key] ?? '')}</td>)}
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <button onClick={() => handleEdit(item)} style={{ ...outlineBtn, marginRight: 6 }}>Modifier</button>
                    <button onClick={() => handleDelete(item.id)} style={dangerBtn}>Supprimer</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Jeux (fiches éditoriales sur des jeux tiers célèbres) ──────────────────

const EMPTY_GAME_FORM = { name: '', publisher_id: '', category_id: '', genre: '', universe: '', view_mode: '', difficulty: '', cover_image_url: '', tags: '', mechanics: '', description: '', presentation: '', why_popular: '', gameplay: '', seo_title: '', seo_description: '' };

function tagsToText(arr) { return Array.isArray(arr) ? arr.join(', ') : ''; }
function textToTags(str) { return String(str || '').split(',').map(s => s.trim()).filter(Boolean); }

function GamesPanel() {
  const { get, post, put, del, patch } = useApi();
  const [items, setItems] = useState([]);
  const [publishers, setPublishers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_GAME_FORM);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [showAi, setShowAi] = useState(false);
  const [aiForm, setAiForm] = useState({ name: '', publisher_name: '', genre: '', universe: '', factual_info: '', source_label: '', source_url: '', editorial_instructions: '' });
  const [aiBusy, setAiBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [{ games }, { items: pubs }, { items: cats }] = await Promise.all([
        get('/superadmin/gaminghub/games'),
        get('/superadmin/gaminghub/publishers'),
        get('/superadmin/gaminghub/categories'),
      ]);
      setItems(games || []); setPublishers(pubs || []); setCategories(cats || []);
    } catch (e) { setMessage(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!form.name.trim()) { setMessage('Le nom est obligatoire.'); return; }
    const payload = { ...form, tags: textToTags(form.tags), mechanics: textToTags(form.mechanics) };
    try {
      if (editingId) await put(`/superadmin/gaminghub/games/${editingId}`, payload);
      else await post('/superadmin/gaminghub/games', payload);
      setForm(EMPTY_GAME_FORM); setEditingId(null); setMessage(editingId ? 'Modifications enregistrées.' : 'Fiche créée.');
      await load();
    } catch (e) { setMessage(e.message); }
  }
  function handleEdit(item) {
    setForm({
      name: item.name || '', publisher_id: item.publisher_id || '', category_id: item.category_id || '',
      genre: item.genre || '', universe: item.universe || '', view_mode: item.view_mode || '', difficulty: item.difficulty || '',
      cover_image_url: item.cover_image_url || '', tags: tagsToText(item.tags), mechanics: tagsToText(item.mechanics),
      description: item.description || '', presentation: item.presentation || '', why_popular: item.why_popular || '', gameplay: item.gameplay || '',
      seo_title: item.seo_title || '', seo_description: item.seo_description || '',
    });
    setEditingId(item.id); setMessage(`Modification de "${item.name}" — release_date/configuration/liens officiels se gèrent en base pour l'instant (pas encore dans ce formulaire).`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function handleDelete(id) {
    if (!window.confirm('Supprimer cette fiche ?')) return;
    try { await del(`/superadmin/gaminghub/games/${id}`); await load(); } catch (e) { setMessage(e.message); }
  }
  async function handlePublish(item) {
    try { await patch(`/superadmin/gaminghub/games/${item.id}/publish`, {}); await load(); } catch (e) { setMessage(e.message); }
  }
  async function handleGenerate() {
    if (!aiForm.name.trim()) { setMessage('Le nom du jeu est requis pour la génération IA.'); return; }
    setAiBusy(true);
    try {
      const sources = aiForm.source_url ? [{ label: aiForm.source_label || 'Source', url: aiForm.source_url }] : [];
      const { game } = await post('/superadmin/gaminghub/ai/generate-draft', {
        name: aiForm.name, publisher_name: aiForm.publisher_name || undefined, genre: aiForm.genre || undefined,
        universe: aiForm.universe || undefined, factual_info: aiForm.factual_info || undefined,
        editorial_instructions: aiForm.editorial_instructions || undefined, sources,
      });
      setMessage(`Brouillon généré : "${game.name}" (statut brouillon — à relire avant publication).`);
      setShowAi(false); setAiForm({ name: '', publisher_name: '', genre: '', universe: '', factual_info: '', source_label: '', source_url: '', editorial_instructions: '' });
      await load();
    } catch (e) { setMessage(e.message || 'Erreur de génération IA.'); }
    finally { setAiBusy(false); }
  }

  return (
    <div>
      <Msg text={message} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button onClick={() => setShowAi(s => !s)} style={aiBtn}>{showAi ? 'Fermer la génération IA' : '✨ Générer une fiche via IA'}</button>
      </div>

      {showAi && (
        <div style={{ ...panelStyle, borderColor: '#C4B5FD', background: '#FAF5FF' }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Générer via IA (statut brouillon, jamais auto-publié)</div>
          <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 10px' }}>L'IA ne renseigne jamais date de sortie / configuration / liens officiels — à compléter manuellement après relecture.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Nom du jeu *<input style={inputStyle} value={aiForm.name} onChange={e => setAiForm({ ...aiForm, name: e.target.value })} /></label>
            <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Éditeur<input style={inputStyle} value={aiForm.publisher_name} onChange={e => setAiForm({ ...aiForm, publisher_name: e.target.value })} /></label>
            <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Genre<input style={inputStyle} value={aiForm.genre} onChange={e => setAiForm({ ...aiForm, genre: e.target.value })} /></label>
            <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Univers<input style={inputStyle} value={aiForm.universe} onChange={e => setAiForm({ ...aiForm, universe: e.target.value })} /></label>
            <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Source — libellé<input style={inputStyle} value={aiForm.source_label} onChange={e => setAiForm({ ...aiForm, source_label: e.target.value })} /></label>
            <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Source — URL<input style={inputStyle} value={aiForm.source_url} onChange={e => setAiForm({ ...aiForm, source_url: e.target.value })} /></label>
          </div>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, marginTop: 10 }}>Informations factuelles (utilisées en priorité, jamais inventées)
            <textarea style={textareaStyle} value={aiForm.factual_info} onChange={e => setAiForm({ ...aiForm, factual_info: e.target.value })} />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, marginTop: 10 }}>Consignes éditoriales
            <textarea style={textareaStyle} value={aiForm.editorial_instructions} onChange={e => setAiForm({ ...aiForm, editorial_instructions: e.target.value })} />
          </label>
          <div style={{ marginTop: 10 }}><button onClick={handleGenerate} disabled={aiBusy} style={{ ...primaryBtn, opacity: aiBusy ? 0.6 : 1 }}>{aiBusy ? 'Génération…' : 'Générer le brouillon'}</button></div>
        </div>
      )}

      <div style={panelStyle}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>{editingId ? `Modifier "${form.name}"` : 'Nouvelle fiche (saisie manuelle)'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Nom *<input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Éditeur
            <select style={inputStyle} value={form.publisher_id} onChange={e => setForm({ ...form, publisher_id: e.target.value })}><option value="">—</option>{publishers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Catégorie
            <select style={inputStyle} value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}><option value="">—</option>{categories.map(c => <option key={c.id} value={c.id}>{c.label_fr}</option>)}</select>
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Genre<input style={inputStyle} value={form.genre} onChange={e => setForm({ ...form, genre: e.target.value })} /></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Univers<input style={inputStyle} value={form.universe} onChange={e => setForm({ ...form, universe: e.target.value })} /></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Vue<select style={inputStyle} value={form.view_mode} onChange={e => setForm({ ...form, view_mode: e.target.value })}><option value="">—</option>{VIEW_MODES.map(v => <option key={v} value={v}>{v}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Difficulté<select style={inputStyle} value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}><option value="">—</option>{DIFFICULTIES.map(v => <option key={v} value={v}>{v}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Image de couverture (URL)<input style={inputStyle} value={form.cover_image_url} onChange={e => setForm({ ...form, cover_image_url: e.target.value })} /></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Tags (séparés par virgule)<input style={inputStyle} value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} /></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Mécaniques (séparées par virgule)<input style={inputStyle} value={form.mechanics} onChange={e => setForm({ ...form, mechanics: e.target.value })} /></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>SEO — titre<input style={inputStyle} value={form.seo_title} onChange={e => setForm({ ...form, seo_title: e.target.value })} /></label>
        </div>
        <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, marginTop: 10 }}>SEO — description<textarea style={{ ...textareaStyle, minHeight: 50 }} value={form.seo_description} onChange={e => setForm({ ...form, seo_description: e.target.value })} /></label>
        <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, marginTop: 10 }}>Description<textarea style={textareaStyle} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
        <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, marginTop: 10 }}>Présentation<textarea style={textareaStyle} value={form.presentation} onChange={e => setForm({ ...form, presentation: e.target.value })} /></label>
        <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, marginTop: 10 }}>Pourquoi ce jeu est populaire<textarea style={textareaStyle} value={form.why_popular} onChange={e => setForm({ ...form, why_popular: e.target.value })} /></label>
        <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, marginTop: 10 }}>Gameplay<textarea style={textareaStyle} value={form.gameplay} onChange={e => setForm({ ...form, gameplay: e.target.value })} /></label>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={handleSave} style={primaryBtn}>{editingId ? 'Enregistrer' : 'Créer'}</button>
          {editingId && <button onClick={() => { setEditingId(null); setForm(EMPTY_GAME_FORM); }} style={outlineBtn}>Annuler</button>}
        </div>
      </div>

      <div style={{ ...panelStyle, padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead><tr style={{ background: '#F9FAFB', color: '#4B5563', fontSize: 12 }}>
            <th style={th}>ID</th><th style={th}>Nom</th><th style={th}>Genre</th><th style={th}>Statut</th><th style={th}>IA</th><th style={th}></th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center', color: '#6B7280' }}>Chargement…</td></tr>
              : items.length === 0 ? <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center', color: '#6B7280' }}>Aucune fiche.</td></tr>
              : items.map(item => (
                <tr key={item.id}>
                  <td style={td}>{item.id}</td>
                  <td style={td}>{item.name} <small style={{ color: '#9CA3AF' }}>/{item.slug}</small></td>
                  <td style={td}>{item.genre || '—'}</td>
                  <td style={td}><StatusBadge status={item.status} /></td>
                  <td style={td}>{item.generated_by_ai ? '✨' : ''}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <button onClick={() => handleEdit(item)} style={{ ...outlineBtn, marginRight: 6 }}>Modifier</button>
                    <button onClick={() => handlePublish(item)} style={{ ...outlineBtn, marginRight: 6 }}>{item.status === 'published' ? 'Dépublier' : 'Publier'}</button>
                    <button onClick={() => handleDelete(item.id)} style={dangerBtn}>Supprimer</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Articles éditoriaux ──────────────────────────────────────────────────────

const EMPTY_ARTICLE_FORM = { title: '', article_type: 'guide', excerpt: '', cover_image_url: '', body: '', tags: '', seo_title: '', seo_description: '', scheduled_at: '' };

function ArticlesPanel() {
  const { get, post, put, del, patch } = useApi();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_ARTICLE_FORM);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [showAi, setShowAi] = useState(false);
  const [aiForm, setAiForm] = useState({ topic: '', article_type: 'top', game_slugs: '', factual_info: '', source_label: '', source_url: '', editorial_instructions: '' });
  const [aiBusy, setAiBusy] = useState(false);
  const [sort, setSort] = useState({ key: 'title', direction: 'asc' });
  const sortedItems = useMemo(() => {
    const direction = sort.direction === 'asc' ? 1 : -1;
    const value = (item) => ['unique_readers_count', 'view_count'].includes(sort.key) ? Number(item[sort.key] || 0) : sort.key === 'publication' ? new Date(item.scheduled_at || item.published_at || 0).getTime() : sort.key === 'status' ? item.status : item.title || '';
    return [...items].sort((a, b) => String(value(a)).localeCompare(String(value(b)), 'fr', { numeric: true, sensitivity: 'base' }) * direction);
  }, [items, sort]);
  function toggleSort(key) { setSort(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' })); }

  async function load() {
    setLoading(true);
    try { const { articles } = await get('/superadmin/gaminghub/articles'); setItems(articles || []); }
    catch (e) { setMessage(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!form.title.trim()) { setMessage('Le titre est obligatoire.'); return; }
    const payload = { ...form, tags: textToTags(form.tags), scheduled_at: form.scheduled_at || null };
    try {
      if (editingId) await put(`/superadmin/gaminghub/articles/${editingId}`, payload);
      else await post('/superadmin/gaminghub/articles', payload);
      setForm(EMPTY_ARTICLE_FORM); setEditingId(null); setMessage(editingId ? 'Modifications enregistrées.' : 'Article créé.');
      await load();
    } catch (e) { setMessage(e.message); }
  }
  function handleEdit(item) {
    setForm({
      title: item.title || '', article_type: item.article_type || 'guide', excerpt: item.excerpt || '',
      cover_image_url: item.cover_image_url || '', body: item.body || '', tags: tagsToText(item.tags),
      seo_title: item.seo_title || '', seo_description: item.seo_description || '',
      scheduled_at: item.scheduled_at ? String(item.scheduled_at).slice(0, 16) : '',
    });
    setEditingId(item.id); setMessage(`Modification de "${item.title}"`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function handleDelete(id) {
    if (!window.confirm('Supprimer cet article ?')) return;
    try { await del(`/superadmin/gaminghub/articles/${id}`); await load(); } catch (e) { setMessage(e.message); }
  }
  async function handlePublish(item) {
    try { await patch(`/superadmin/gaminghub/articles/${item.id}/publish`, {}); await load(); } catch (e) { setMessage(e.message); }
  }
  async function handleGenerate() {
    if (!aiForm.topic.trim()) { setMessage('Le sujet est requis.'); return; }
    setAiBusy(true);
    try {
      const sources = aiForm.source_url ? [{ label: aiForm.source_label || 'Source', url: aiForm.source_url }] : [];
      const game_slugs = aiForm.game_slugs ? aiForm.game_slugs.split(',').map(s => s.trim()).filter(Boolean) : [];
      const { article } = await post('/superadmin/gaminghub/ai/generate-article-draft', {
        topic: aiForm.topic, article_type: aiForm.article_type, game_slugs,
        factual_info: aiForm.factual_info || undefined, editorial_instructions: aiForm.editorial_instructions || undefined, sources,
      });
      setMessage(`Brouillon généré : "${article.title}" (statut brouillon — à relire avant publication).`);
      setShowAi(false); setAiForm({ topic: '', article_type: 'top', game_slugs: '', factual_info: '', source_label: '', source_url: '', editorial_instructions: '' });
      await load();
    } catch (e) { setMessage(e.message || 'Erreur de génération IA.'); }
    finally { setAiBusy(false); }
  }

  return (
    <div>
      <Msg text={message} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button onClick={() => setShowAi(s => !s)} style={aiBtn}>{showAi ? 'Fermer la génération IA' : '✨ Générer un article via IA'}</button>
      </div>

      {showAi && (
        <div style={{ ...panelStyle, borderColor: '#C4B5FD', background: '#FAF5FF' }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Générer via IA (statut brouillon, jamais auto-publié)</div>
          <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 10px' }}>Ne cite que des jeux publiés existants sur le Gaming Hub — jamais un jeu inventé. Laissez "Jeux" vide pour laisser l'IA choisir parmi tous les jeux publiés.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Sujet *<input style={inputStyle} value={aiForm.topic} onChange={e => setAiForm({ ...aiForm, topic: e.target.value })} /></label>
            <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Type<select style={inputStyle} value={aiForm.article_type} onChange={e => setAiForm({ ...aiForm, article_type: e.target.value })}>{ARTICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
            <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Jeux (slugs, séparés par virgule)<input style={inputStyle} value={aiForm.game_slugs} onChange={e => setAiForm({ ...aiForm, game_slugs: e.target.value })} placeholder="dofus, minecraft" /></label>
            <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Source — libellé<input style={inputStyle} value={aiForm.source_label} onChange={e => setAiForm({ ...aiForm, source_label: e.target.value })} /></label>
            <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Source — URL<input style={inputStyle} value={aiForm.source_url} onChange={e => setAiForm({ ...aiForm, source_url: e.target.value })} /></label>
          </div>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, marginTop: 10 }}>Informations factuelles<textarea style={textareaStyle} value={aiForm.factual_info} onChange={e => setAiForm({ ...aiForm, factual_info: e.target.value })} /></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, marginTop: 10 }}>Consignes éditoriales<textarea style={textareaStyle} value={aiForm.editorial_instructions} onChange={e => setAiForm({ ...aiForm, editorial_instructions: e.target.value })} /></label>
          <div style={{ marginTop: 10 }}><button onClick={handleGenerate} disabled={aiBusy} style={{ ...primaryBtn, opacity: aiBusy ? 0.6 : 1 }}>{aiBusy ? 'Génération…' : 'Générer le brouillon'}</button></div>
        </div>
      )}

      <div style={panelStyle}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>{editingId ? `Modifier "${form.title}"` : 'Nouvel article (saisie manuelle)'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Titre *<input style={inputStyle} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Type<select style={inputStyle} value={form.article_type} onChange={e => setForm({ ...form, article_type: e.target.value })}>{ARTICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Image de couverture (URL)<input style={inputStyle} value={form.cover_image_url} onChange={e => setForm({ ...form, cover_image_url: e.target.value })} /></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Tags (séparés par virgule)<input style={inputStyle} value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} /></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>SEO — titre<input style={inputStyle} value={form.seo_title} onChange={e => setForm({ ...form, seo_title: e.target.value })} /></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Planifier la publication<input style={inputStyle} type="datetime-local" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} /></label>
        </div>
        <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, marginTop: 10 }}>Extrait<textarea style={{ ...textareaStyle, minHeight: 50 }} value={form.excerpt} onChange={e => setForm({ ...form, excerpt: e.target.value })} /></label>
        <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, marginTop: 10 }}>Corps (Markdown)<textarea style={{ ...textareaStyle, minHeight: 180 }} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} /></label>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={handleSave} style={primaryBtn}>{editingId ? 'Enregistrer' : 'Créer'}</button>
          {editingId && <button onClick={() => { setEditingId(null); setForm(EMPTY_ARTICLE_FORM); }} style={outlineBtn}>Annuler</button>}
        </div>
      </div>

      <div style={{ ...panelStyle, padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 920 }}>
          <thead><tr style={{ background: '#F9FAFB', color: '#4B5563', fontSize: 12 }}>
            <AdminSortHeader label="Article" sortKey="title" sort={sort} onSort={toggleSort} /><AdminSortHeader label="Statut" sortKey="status" sort={sort} onSort={toggleSort} /><AdminSortHeader label="Lecteurs uniques" sortKey="unique_readers_count" sort={sort} onSort={toggleSort} /><AdminSortHeader label="Lectures brutes" sortKey="view_count" sort={sort} onSort={toggleSort} /><AdminSortHeader label="Publication" sortKey="publication" sort={sort} onSort={toggleSort} /><th style={{ ...th, position: 'sticky', top: 0, background: '#F9FAFB', zIndex: 2 }}>Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center', color: '#6B7280' }}>Chargement…</td></tr>
              : items.length === 0 ? <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center', color: '#6B7280' }}>Aucun article.</td></tr>
              : sortedItems.map(item => (
                <tr key={item.id}>
                  <td style={{ ...td, minWidth: 260 }}><div style={{ fontWeight: 850, color: '#111827' }}>{item.title}</div><div style={{ marginTop: 4, color: '#6B7280', fontSize: 11 }}>#{item.id} · {item.article_type}</div></td>
                  <td style={td}><StatusBadge status={item.status} /></td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {Number(item.unique_readers_count || 0).toLocaleString('fr-FR')}
                  </td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {Number(item.view_count || 0).toLocaleString('fr-FR')}
                  </td>
                  <td style={td}>{item.scheduled_at ? new Date(item.scheduled_at).toLocaleString('fr-FR') : item.published_at ? new Date(item.published_at).toLocaleDateString('fr-FR') : '—'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <button onClick={() => handleEdit(item)} style={{ ...outlineBtn, marginRight: 6 }}>Modifier</button>
                    <button onClick={() => handlePublish(item)} style={{ ...outlineBtn, marginRight: 6 }}>{item.status === 'published' ? 'Dépublier' : 'Publier'}</button>
                    <button onClick={() => handleDelete(item.id)} style={dangerBtn}>Supprimer</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Jeux similaires (validation des suggestions du moteur de similarité) ────

function SimilarPanel() {
  const { get, post, patch, del } = useApi();
  const [games, setGames] = useState([]);
  const [gameId, setGameId] = useState('');
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [manualPlayId, setManualPlayId] = useState('');

  useEffect(() => { get('/superadmin/gaminghub/games').then(({ games: rows }) => setGames(rows || [])).catch(e => setMessage(e.message)); }, [get]);

  async function loadLinks(id) {
    if (!id) { setLinks([]); return; }
    setLoading(true);
    try { const { links: rows } = await get(`/superadmin/gaminghub/games/${id}/similar`); setLinks(rows || []); }
    catch (e) { setMessage(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadLinks(gameId); }, [gameId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSuggest() {
    try { await post(`/superadmin/gaminghub/games/${gameId}/similar/suggest`, {}); setMessage('Suggestions recalculées via le moteur de similarité (à valider ci-dessous).'); await loadLinks(gameId); }
    catch (e) { setMessage(e.message); }
  }
  async function handleApprove(link) {
    try { await patch(`/superadmin/gaminghub/similar/${link.id}/approve`, { approved: !link.approved }); await loadLinks(gameId); }
    catch (e) { setMessage(e.message); }
  }
  async function handleDelete(id) {
    if (!window.confirm('Retirer ce lien ?')) return;
    try { await del(`/superadmin/gaminghub/similar/${id}`); await loadLinks(gameId); } catch (e) { setMessage(e.message); }
  }
  async function handleManualAdd() {
    if (!manualPlayId) return;
    try { await post(`/superadmin/gaminghub/games/${gameId}/similar`, { play_game_id: Number(manualPlayId), approved: true }); setManualPlayId(''); await loadLinks(gameId); }
    catch (e) { setMessage(e.message); }
  }

  return (
    <div>
      <Msg text={message} />
      <div style={panelStyle}>
        <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, maxWidth: 320 }}>Fiche jeu
          <select style={inputStyle} value={gameId} onChange={e => setGameId(e.target.value)}>
            <option value="">— choisir une fiche —</option>
            {games.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        {gameId && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={handleSuggest} style={aiBtn}>Calculer des suggestions (moteur de similarité)</button>
            <input style={{ ...inputStyle, width: 160 }} placeholder="ID jeu Play" value={manualPlayId} onChange={e => setManualPlayId(e.target.value)} />
            <button onClick={handleManualAdd} style={outlineBtn}>Rattacher manuellement</button>
          </div>
        )}
      </div>

      {gameId && (
        <div style={{ ...panelStyle, padding: 0, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead><tr style={{ background: '#F9FAFB', color: '#4B5563', fontSize: 12 }}>
              <th style={th}>Jeu Play</th><th style={th}>Score</th><th style={th}>Raisons</th><th style={th}>Source</th><th style={th}>Approuvé</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center', color: '#6B7280' }}>Chargement…</td></tr>
                : links.length === 0 ? <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center', color: '#6B7280' }}>Aucune suggestion — cliquez "Calculer des suggestions".</td></tr>
                : links.map(link => (
                  <tr key={link.id}>
                    <td style={td}>{link.playGame?.name || `#${link.play_game_id}`}</td>
                    <td style={td}>{Number(link.match_score).toFixed(2)}</td>
                    <td style={td}>{(link.match_reasons || []).join(', ')}</td>
                    <td style={td}>{link.source}</td>
                    <td style={td}>{link.approved ? '✅' : '—'}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <button onClick={() => handleApprove(link)} style={{ ...outlineBtn, marginRight: 6 }}>{link.approved ? 'Retirer' : 'Approuver'}</button>
                      <button onClick={() => handleDelete(link.id)} style={dangerBtn}>Supprimer</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function GamingHubAdminPage() {
  const [tab, setTab] = useState('games');

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-title">Gaming Hub</div>
        <div className="page-subtitle">Portail éditorial SEO sur des jeux tiers célèbres — fiches, articles et rattachement aux jeux iFilino Play.</div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            minHeight: 38, padding: '8px 14px', borderRadius: 8,
            border: `1.5px solid ${tab === t.key ? '#111827' : '#E5E7EB'}`,
            background: tab === t.key ? '#111827' : '#fff',
            color: tab === t.key ? '#fff' : '#374151',
            cursor: 'pointer', fontWeight: 800, fontSize: 13,
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'games' && <GamesPanel />}
      {tab === 'articles' && <ArticlesPanel />}
      {tab === 'similar' && <SimilarPanel />}
      {tab === 'publishers' && <SimpleEntityPanel key="publishers" tabKey="publishers" />}
      {tab === 'categories' && <SimpleEntityPanel key="categories" tabKey="categories" />}
      {tab === 'platforms' && <SimpleEntityPanel key="platforms" tabKey="platforms" />}
      {tab === 'tags' && <SimpleEntityPanel key="tags" tabKey="tags" />}
    </div>
  );
}
