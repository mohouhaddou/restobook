import React, { useEffect, useMemo, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { DonutStat, RankBarChart, TrendChart } from '../../shared/components/stats/AdminCharts';

function last14Days(rows) {
  const byDay = new Map((rows || []).map(r => [String(r.day).slice(0, 10), Number(r.players) || 0]));
  const out = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ label: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), players: byDay.get(key) || 0 });
  }
  return out;
}

function last14DaysVisitors(rows) {
  const byDay = new Map((rows || []).map(r => [String(r.day).slice(0, 10), Number(r.visitors) || 0]));
  const out = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ label: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), visitors: byDay.get(key) || 0 });
  }
  return out;
}

const REFERRER_LABELS = { direct: 'Direct', internal: 'Interne (site)', search: 'Moteurs de recherche', social: 'Réseaux sociaux' };
function referrerLabel(domain) { return REFERRER_LABELS[domain] || domain || 'Autre'; }
const DEVICE_LABELS = { mobile: 'Mobile', desktop: 'Ordinateur', tablet: 'Tablette' };

const TABS = [
  { key: 'games', label: 'Jeux' },
  { key: 'providers', label: 'Fournisseurs' },
  { key: 'quizzes', label: 'Quiz' },
  { key: 'badges', label: 'Badges' },
  { key: 'rewards', label: 'Récompenses' },
  { key: 'daily-missions', label: 'Missions' },
  { key: 'stats', label: 'Statistiques' },
];

const FIELD_SETS = {
  games: [
    { key: 'slug', label: 'Slug', required: true }, { key: 'name', label: 'Nom', required: true },
    { key: 'game_type', label: 'Type', type: 'select', required: true, options: ['2048', 'memory', 'puzzle_image', 'quiz', 'true_false', 'geo_quiz', 'guess_place', 'memory_cards', 'reaction_test', 'color_match', 'bubble_pop', 'brick_smash', 'tower_stack', 'penalty_master', 'snake', 'gamepix'] },
    { key: 'description', label: 'Description' }, { key: 'source', label: 'Origine', type: 'select', options: ['internal', 'partner'] },
    { key: 'provider_id', label: 'ID fournisseur', type: 'number' }, { key: 'launch_url', label: 'URL lancement HTTPS' },
    { key: 'thumbnail_url', label: 'Miniature' }, { key: 'category', label: 'Catégorie' },
    { key: 'difficulty', label: 'Difficulté', type: 'select', options: ['easy', 'medium', 'hard'] }, { key: 'average_duration', label: 'Durée (min)', type: 'number' },
    { key: 'supports_mobile', label: 'Mobile', type: 'boolean' }, { key: 'supports_keyboard', label: 'Clavier', type: 'boolean' }, { key: 'supports_fullscreen', label: 'Plein écran', type: 'boolean' },
    { key: 'sort_order', label: 'Ordre', type: 'number' }, { key: 'active', label: 'Statut', type: 'boolean' },
    { key: 'is_hero', label: 'Hero (carrousel)', type: 'boolean' },
    { key: 'is_game_of_day', label: 'Jeu du jour', type: 'boolean', readOnly: true },
  ],
  providers: [
    { key: 'code', label: 'Code' }, { key: 'name', label: 'Nom' },
    { key: 'launch_mode', label: 'Lancement', type: 'select', options: ['internal', 'iframe', 'redirect', 'sdk'] },
    { key: 'license_type', label: 'Licence', type: 'select', options: ['internal', 'contract', 'revenue_share', 'free_license'] },
    { key: 'license_reference', label: 'Référence licence' }, { key: 'base_url', label: 'URL HTTPS' },
    { key: 'supports_mobile', label: 'Mobile', type: 'boolean' }, { key: 'supports_fullscreen', label: 'Plein écran', type: 'boolean' },
    { key: 'has_ads', label: 'Publicités', type: 'boolean' }, { key: 'active', label: 'Statut', type: 'boolean' },
  ],
  quizzes: [
    { key: 'slug', label: 'Slug' }, { key: 'title', label: 'Titre' },
    { key: 'category', label: 'Catégorie', type: 'select', options: ['quiz_maroc', 'culture', 'geography', 'gastronomy', 'history', 'sport'] },
    { key: 'difficulty', label: 'Difficulté', type: 'select', options: ['easy', 'medium', 'hard'] },
    { key: 'game_id', label: 'ID jeu', type: 'number' },
  ],
  badges: [
    { key: 'code', label: 'Code' }, { key: 'name', label: 'Nom' }, { key: 'icon', label: 'Icône' },
    { key: 'condition_type', label: 'Condition', type: 'select', options: ['games_played_count', 'score_threshold', 'puzzle_completed_count', 'quiz_correct_count', 'category_wins', 'time_window_sessions', 'daily_streak', 'manual'] },
    { key: 'condition_value', label: 'Valeur', type: 'number' },
    { key: 'xp_bonus', label: 'Bonus XP', type: 'number' },
    { key: 'icoins_bonus', label: 'Bonus iCoins', type: 'number' },
  ],
  rewards: [
    { key: 'name', label: 'Nom' }, { key: 'icon', label: 'Icône' },
    { key: 'cost_icoins', label: 'Coût iCoins', type: 'number' },
    { key: 'reward_type', label: 'Type', type: 'select', options: ['discount_percent', 'discount_fixed', 'free_item', 'delivery_free', 'cosmetic'] },
    { key: 'reward_value', label: 'Valeur', type: 'number' },
  ],
  'daily-missions': [
    { key: 'code', label: 'Code' }, { key: 'title', label: 'Titre' }, { key: 'icon', label: 'Icône' },
    { key: 'mission_type', label: 'Type', type: 'select', options: ['play_games_count', 'win_games_count', 'quiz_correct_count', 'specific_game', 'earn_xp', 'earn_icoins'] },
    { key: 'target_value', label: 'Objectif', type: 'number' },
    { key: 'xp_reward', label: 'Récompense XP', type: 'number' },
    { key: 'icoins_reward', label: 'Récompense iCoins', type: 'number' },
  ],
};

const th = { padding: 8, textAlign: 'left' };
const td = { padding: 8, borderTop: '1px solid #F3F4F6' };
const EMPTY_FORMS = { games: { source: 'internal', difficulty: 'medium', active: false, supports_mobile: true, supports_fullscreen: true }, providers: { launch_mode: 'iframe', license_type: 'contract', active: false, supports_mobile: true, supports_fullscreen: true } };
const emptyForm = key => ({ ...(EMPTY_FORMS[key] || {}) });

const inputStyle = { minHeight: 34, border: '1px solid #D1D5DB', borderRadius: 6, padding: '6px 8px', fontSize: 13 };
const PAGE_SIZE = 10;

function useWindowWidth() {
  const [width, setWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

function pageWindow(current, total, maxButtons) {
  if (total <= maxButtons) return Array.from({ length: total }, (_, i) => i + 1);
  const half = Math.floor(maxButtons / 2);
  let start = Math.max(1, current - half);
  let end = start + maxButtons - 1;
  if (end > total) { end = total; start = end - maxButtons + 1; }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function Pagination({ page, totalPages, onChange }) {
  const width = useWindowWidth();
  if (totalPages <= 1) return null;
  const maxButtons = width < 480 ? 3 : width < 768 ? 5 : 8;
  const pages = pageWindow(page, totalPages, maxButtons);
  const btn = (active) => ({ minWidth: 34, minHeight: 34, border: '1px solid ' + (active ? '#111827' : '#D1D5DB'), background: active ? '#111827' : '#fff', color: active ? '#fff' : '#374151', borderRadius: 6, padding: '4px 8px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' });
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '10px 4px 0' }}>
      <button style={btn(false)} disabled={page === 1} onClick={() => onChange(page - 1)}>‹</button>
      {pages[0] > 1 && <>
        <button style={btn(page === 1)} onClick={() => onChange(1)}>1</button>
        {pages[0] > 2 && <span style={{ color: '#9CA3AF', padding: '0 2px' }}>…</span>}
      </>}
      {pages.map(p => <button key={p} style={btn(p === page)} onClick={() => onChange(p)}>{p}</button>)}
      {pages[pages.length - 1] < totalPages && <>
        {pages[pages.length - 1] < totalPages - 1 && <span style={{ color: '#9CA3AF', padding: '0 2px' }}>…</span>}
        <button style={btn(page === totalPages)} onClick={() => onChange(totalPages)}>{totalPages}</button>
      </>}
      <button style={btn(false)} disabled={page === totalPages} onClick={() => onChange(page + 1)}>›</button>
    </div>
  );
}

const GAME_LIST_FIELDS = [
  { key: 'game_summary', label: 'Jeu' },
  { key: 'classification', label: 'Classification' },
  { key: 'compatibility', label: 'Compatibilité' },
  { key: 'origin', label: 'Origine' },
  { key: 'visibility', label: 'Visibilité' },
  { key: 'unique_players_count', label: 'Joueurs uniques' },
  { key: 'games_played_count', label: 'Parties jouées' },
];

const compactPill = (enabled, tone = 'default') => ({
  display: 'inline-flex', alignItems: 'center', minHeight: 24, padding: '2px 8px', borderRadius: 999,
  border: '1px solid ' + (enabled ? (tone === 'green' ? '#A7F3D0' : tone === 'amber' ? '#FDE68A' : '#BFDBFE') : '#E5E7EB'),
  background: enabled ? (tone === 'green' ? '#ECFDF5' : tone === 'amber' ? '#FFFBEB' : '#EFF6FF') : '#F9FAFB',
  color: enabled ? (tone === 'green' ? '#047857' : tone === 'amber' ? '#92400E' : '#1D4ED8') : '#9CA3AF',
  fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap',
});

function GameListCell({ item, field }) {
  if (field.key === 'game_summary') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 210 }}>
      <div style={{ width: 44, height: 44, borderRadius: 9, overflow: 'hidden', flex: '0 0 auto', background: '#F3F4F6', display: 'grid', placeItems: 'center', color: '#6B7280', fontWeight: 900 }}>
        {item.thumbnail_url ? <img src={item.thumbnail_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : item.name?.slice(0, 1)}
      </div>
      <div style={{ minWidth: 0 }}><div style={{ fontWeight: 850, color: '#111827' }}>{item.name}</div><div style={{ color: '#6B7280', fontSize: 11, overflowWrap: 'anywhere' }}>#{item.id} · /{item.slug}</div></div>
    </div>
  );
  if (field.key === 'classification') return <><div style={{ fontWeight: 750 }}>{item.game_type}</div><div style={{ color: '#6B7280', fontSize: 11 }}>{item.category || 'Sans catégorie'} · {item.difficulty} · {item.average_duration || '—'} min</div></>;
  if (field.key === 'compatibility') return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}><span style={compactPill(item.supports_mobile)}>Mobile</span><span style={compactPill(item.supports_keyboard)}>Clavier</span><span style={compactPill(item.supports_fullscreen)}>Plein écran</span></div>;
  if (field.key === 'origin') return <><div style={{ fontWeight: 750 }}>{item.source === 'partner' ? 'Partenaire' : 'Interne'}</div><div style={{ color: '#6B7280', fontSize: 11 }}>{item.provider?.name || '—'}</div></>;
  if (field.key === 'visibility') return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}><span style={compactPill(item.active, 'green')}>{item.active ? 'Actif' : 'Inactif'}</span>{item.is_hero && <span style={compactPill(true, 'amber')}>Hero</span>}{item.is_game_of_day && <span style={compactPill(true)}>Jeu du jour</span>}</div>;
  if (field.key === 'unique_players_count' || field.key === 'games_played_count') return <span style={{ display: 'block', textAlign: 'right', fontWeight: 900, fontVariantNumeric: 'tabular-nums', fontSize: 15 }}>{Number(item[field.key] || 0).toLocaleString('fr-FR')}</span>;
  return null;
}

function sortableValue(item, key) {
  if (key === 'game_summary') return item.name || '';
  if (key === 'classification') return [item.game_type, item.category, item.difficulty].filter(Boolean).join(' ');
  if (key === 'compatibility') return Number(item.supports_mobile) + Number(item.supports_keyboard) + Number(item.supports_fullscreen);
  if (key === 'origin') return item.source === 'partner' ? (item.provider?.name || 'partner') : 'internal';
  if (key === 'visibility') return Number(item.active) * 4 + Number(item.is_hero) * 2 + Number(item.is_game_of_day);
  return Number(item[key] || 0);
}

function EntityPanel({ tabKey }) {
  const { get, post, put, del } = useApi();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(() => emptyForm(tabKey));
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(tabKey !== 'games');
  const [sort, setSort] = useState({ key: 'game_summary', direction: 'asc' });
  const fields = FIELD_SETS[tabKey];
  const listFields = tabKey === 'games' ? GAME_LIST_FIELDS : fields;
  const sortedItems = useMemo(() => {
    if (tabKey !== 'games') return items;
    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => String(sortableValue(a, sort.key)).localeCompare(String(sortableValue(b, sort.key)), 'fr', { numeric: true, sensitivity: 'base' }) * direction);
  }, [items, sort, tabKey]);
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / PAGE_SIZE));
  const pagedItems = sortedItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  function toggleSort(key) {
    setSort(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
    setPage(1);
  }

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    try {
      const { items: rows } = await get(`/superadmin/play/${tabKey}`);
      setItems(rows || []);
    } catch (e) { setMessage(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); setForm(emptyForm(tabKey)); setEditingId(null); setMessage(''); setPage(1); }, [tabKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    const missing = fields.filter(field => field.required && !String(form[field.key] || '').trim());
    if (missing.length) { setMessage('Champs obligatoires : '+missing.map(field => field.label).join(', ')); return; }
    try {
      if (editingId) await put("/superadmin/play/" + tabKey + "/" + editingId, form);
      else await post("/superadmin/play/" + tabKey, form);
      setForm(emptyForm(tabKey));
      setMessage(editingId ? 'Modifications enregistrées.' : 'Créé.');
      setEditingId(null);
      if (tabKey === 'games') setShowForm(false);
      await load();
    } catch (e) { setMessage(e.message); }
  }

  function handleEdit(item) {
    const next = {};
    fields.filter(field => !field.readOnly).forEach(field => { next[field.key] = item[field.key] ?? (field.type === "boolean" ? false : ""); });
    setForm(next);
    setEditingId(item.id);
    setShowForm(true);
    setMessage("Modification de la ligne #" + item.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(emptyForm(tabKey));
    setMessage("");
    if (tabKey === 'games') setShowForm(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Supprimer cet élément ?')) return;
    try { await del(`/superadmin/play/${tabKey}/${id}`); await load(); } catch (e) { setMessage(e.message); }
  }

  async function handleToggle(item) {
    try { await put('/superadmin/play/'+tabKey+'/'+item.id, { ...item, active: !item.active }); setMessage(item.active ? 'Élément désactivé.' : 'Élément activé.'); await load(); } catch (e) { setMessage(e.message); }
  }

  async function handleToggleHero(item) {
    try { await put('/superadmin/play/'+tabKey+'/'+item.id, { ...item, is_hero: !item.is_hero }); setMessage(item.is_hero ? 'Retiré du hero.' : 'Promu en hero — apparaîtra dans le carrousel de l\'accueil.'); await load(); } catch (e) { setMessage(e.message); }
  }

  async function handleSetGameOfDay(item) {
    try {
      if (item.is_game_of_day) { await del('/superadmin/play/games/'+item.id+'/game-of-day'); setMessage('Jeu du jour retiré.'); }
      else { await post('/superadmin/play/games/'+item.id+'/game-of-day'); setMessage(item.name+' est maintenant le Jeu du jour (remplace l\'ancien, un seul actif à la fois).'); }
      await load();
    } catch (e) { setMessage(e.message); }
  }

  return (
    <div>
      {message && <div style={{ padding: '8px 12px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, color: '#9A3412', fontWeight: 700, fontSize: 13, marginBottom: 12 }}>{message}</div>}

      {tabKey === 'games' && !showForm && <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}><button type="button" onClick={() => setShowForm(true)} style={{ minHeight: 44, border: 'none', background: '#111827', color: '#fff', borderRadius: 8, padding: '8px 14px', fontWeight: 800, cursor: 'pointer' }}>Ajouter un jeu</button></div>}
      {(tabKey !== 'games' || showForm) && <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>{editingId ? ("Modifier la ligne #" + editingId) : "Nouveau"}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {fields.filter(f => !f.readOnly).map(f => (
            <label key={f.key} style={{ display: 'grid', gap: 4, fontSize: 12, color: '#4B5563', fontWeight: 700 }}>
              {f.label}{f.required ? ' *' : ''}
              {f.type === 'boolean' ? (
                <select style={inputStyle} value={String(form[f.key] ?? false)} onChange={e => setForm({ ...form, [f.key]: e.target.value === 'true' })}><option value="false">Inactif</option><option value="true">Actif</option></select>
              ) : f.type === 'select' ? (
                <select style={inputStyle} required={f.required} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}>
                  <option value="">—</option>
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input style={inputStyle} required={f.required} type={f.type || 'text'} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
              )}
            </label>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}><button onClick={handleSave} style={{ minHeight: 44, border: "none", background: "#111827", color: "#fff", borderRadius: 8, padding: "8px 14px", fontWeight: 800, cursor: "pointer" }}>{editingId ? "Enregistrer" : "Créer"}</button>{editingId && <button onClick={handleCancelEdit} style={{ minHeight: 44, border: "1px solid #D1D5DB", background: "#fff", color: "#374151", borderRadius: 8, padding: "8px 14px", fontWeight: 800, cursor: "pointer" }}>Annuler</button>}</div>
      </div>}

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ overflow: 'auto', maxHeight: '60vh' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: tabKey === 'games' ? 1120 : 640 }}>
            <thead>
              <tr style={{ background: '#F9FAFB', color: '#4B5563', fontSize: 12 }}>
                {tabKey !== 'games' && <th style={{ ...th, position: 'sticky', top: 0, background: '#F9FAFB', zIndex: 1 }}>ID</th>}
                {listFields.map(f => <th key={f.key} aria-sort={tabKey === 'games' && sort.key === f.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'} style={{ ...th, position: 'sticky', top: 0, left: f.key === 'game_summary' ? 0 : undefined, background: '#F9FAFB', zIndex: f.key === 'game_summary' ? 3 : 1 }}>{tabKey === 'games' ? <button type="button" onClick={() => toggleSort(f.key)} style={{ minHeight: 40, border: 0, background: 'transparent', color: 'inherit', padding: 0, font: 'inherit', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>{f.label} <span aria-hidden="true">{sort.key === f.key ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button> : f.label}</th>)}
                <th style={{ ...th, position: 'sticky', top: 0, background: '#F9FAFB', zIndex: 1 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={listFields.length + (tabKey === 'games' ? 1 : 2)} style={{ padding: 16, textAlign: 'center', color: '#6B7280' }}>Chargement…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={listFields.length + (tabKey === 'games' ? 1 : 2)} style={{ padding: 16, textAlign: 'center', color: '#6B7280' }}>Aucun élément.</td></tr>
              ) : pagedItems.map(item => (
                <tr key={item.id}>
                  {tabKey !== 'games' && <td style={td}>{item.id}</td>}
                  {listFields.map(f => <td key={f.key} style={{ ...td, position: f.key === 'game_summary' ? 'sticky' : undefined, left: f.key === 'game_summary' ? 0 : undefined, background: f.key === 'game_summary' ? '#fff' : undefined, zIndex: f.key === 'game_summary' ? 2 : undefined }}>{tabKey === 'games' ? <GameListCell item={item} field={f} /> : (f.type === 'boolean' ? (item[f.key] ? 'Oui' : 'Non') : String(item[f.key] ?? ''))}</td>)}
                  <td style={{ ...td, minWidth: tabKey === 'games' ? 280 : undefined }}><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <button onClick={() => handleEdit(item)} style={{ minHeight: 40, border: "1px solid #93C5FD", background: "#EFF6FF", color: "#1D4ED8", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>Modifier</button>
                    {(tabKey === 'games' || tabKey === 'providers') && <button onClick={() => handleToggle(item)} style={{ minHeight: 40, border: '1px solid silver', borderRadius: 6 }}>{item.active ? 'Désactiver' : 'Activer'}</button>}
                    {tabKey === 'games' && <button onClick={() => handleToggleHero(item)} style={{ minHeight: 40, border: '1px solid #FCD34D', background: item.is_hero ? '#FEF3C7' : '#fff', color: '#92400E', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>{item.is_hero ? 'Retirer du hero' : 'Promouvoir en hero'}</button>}
                    {tabKey === 'games' && <button onClick={() => handleSetGameOfDay(item)} style={{ minHeight: 40, border: '1px solid #93C5FD', background: item.is_game_of_day ? '#DBEAFE' : '#fff', color: '#1E3A8A', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>{item.is_game_of_day ? 'Retirer jeu du jour' : 'Jeu du jour'}</button>}
                    <button onClick={() => handleDelete(item.id)} style={{ border: '1px solid #FCA5A5', background: '#fff', color: '#DC2626', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>Supprimer</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && items.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
          <span style={{ color: '#6B7280', fontSize: 12 }}>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, items.length)} sur {items.length}
          </span>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

function KpiRow(items) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
      {items.map(([label, value]) => (
        <div key={label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 12, minWidth: 150 }}>
          <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 700 }}>{label}</div>
          <div style={{ fontSize: 22, color: '#111827', fontWeight: 800, marginTop: 4 }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ title, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 14 }}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function StatListRow({ label, value, sub }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid #F3F4F6' }}>
      <span>{label}{sub && <small style={{ marginLeft: 6, color: '#9CA3AF', fontWeight: 700 }}>{sub}</small>}</span>
      <span style={{ fontWeight: 800 }}>{value}</span>
    </div>
  );
}

function StatsPanel() {
  const { get } = useApi();
  const [stats, setStats] = useState(null);

  useEffect(() => { get('/superadmin/play/stats').then(({ stats: s }) => setStats(s)); }, [get]);

  if (!stats) return <p style={{ color: '#6B7280' }}>Chargement…</p>;
  const registered = Number(stats.playerAccounts?.registered_players || 0);
  const guests = Number(stats.playerAccounts?.guest_players || 0);

  return (
    <div>
      {KpiRow([
        ['Parties jouées', stats.games_played_count],
        ['Joueurs actifs aujourd’hui', stats.activePlayers?.dau ?? 0],
        ['Joueurs actifs (7 jours)', stats.activePlayers?.wau ?? 0],
        ['XP distribués', stats.xp_distributed],
        ['iCoins distribuées', stats.icoins_distributed],
        ['Durée moyenne (s)', Math.round(stats.avg_session_duration_seconds || 0)],
      ])}

      <div style={{ fontWeight: 900, fontSize: 13, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em', margin: '18px 0 10px' }}>Jeux</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        <StatCard title="Jeux les plus joués">
          {(stats.topGames || []).length
            ? <RankBarChart data={stats.topGames.map(g => ({ name: g.name, value: Number(g.plays) || 0 }))} />
            : <p style={{ color: '#9CA3AF', margin: 0 }}>Pas encore de données.</p>}
        </StatCard>
        <StatCard title="Jeux les plus favorisés">
          {(stats.topFavorited || []).length ? stats.topFavorited.map(g => <StatListRow key={g.slug} label={g.name} value={g.favorites}/>) : <p style={{ color: '#9CA3AF', margin: 0 }}>Pas encore de données.</p>}
        </StatCard>
        <StatCard title="Jeux les plus signalés">
          {(stats.mostReported || []).length ? stats.mostReported.map(g => <StatListRow key={g.slug} label={g.name} value={g.reports} sub={g.open_reports > 0 ? `${g.open_reports} ouvert${g.open_reports > 1 ? 's' : ''}` : null}/>) : <p style={{ color: '#9CA3AF', margin: 0 }}>Aucun signalement.</p>}
        </StatCard>
        <StatCard title="Répartition par origine">
          <DonutStat data={(stats.sourceSplit || []).map(s => ({ name: s.source === 'internal' ? 'iFilino (interne)' : 'Partenaires (GamePix…)', value: Number(s.plays_count) || 0 }))} />
        </StatCard>
      </div>

      <div style={{ fontWeight: 900, fontSize: 13, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em', margin: '18px 0 10px' }}>Joueurs</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        <StatCard title="Joueurs actifs (14 derniers jours)">
          <TrendChart data={last14Days(stats.dailyActivity)} lines={[{ key: 'players', label: 'Joueurs actifs' }]} />
        </StatCard>
        <StatCard title="Comptes vs invités">
          <DonutStat data={[
            { name: 'Comptes enregistrés', value: registered },
            { name: 'Invités', value: guests },
          ]} />
        </StatCard>
        <StatCard title="Répartition par appareil">
          {(stats.deviceSplit || []).length
            ? <DonutStat data={stats.deviceSplit.map(d => ({ name: { mobile: 'Mobile', desktop: 'Ordinateur', tablet: 'Tablette' }[d.device_type] || d.device_type, value: Number(d.sessions) || 0 }))} />
            : <p style={{ color: '#9CA3AF', margin: 0 }}>Pas encore de données.</p>}
        </StatCard>
        <StatCard title="Classement — top 10 joueurs">
          {(stats.topPlayers || []).length ? stats.topPlayers.map((p, i) => <StatListRow key={i} label={`${i + 1}. ${p.name}`} value={`${p.total_xp} XP`} sub={`Niv. ${p.current_level}`}/>) : <p style={{ color: '#9CA3AF', margin: 0 }}>Pas encore de données.</p>}
        </StatCard>
      </div>

      <div style={{ fontWeight: 900, fontSize: 13, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em', margin: '18px 0 4px' }}>Trafic réel</div>
      <p style={{ color: '#9CA3AF', fontSize: 12, margin: '0 0 10px' }}>Visiteurs uniques (déduplication par appareil+jour) sur les pages jeux — distinct des « joueurs actifs » ci-dessus qui compte uniquement les parties réellement lancées.</p>
      {KpiRow([
        ['Visiteurs uniques aujourd’hui', stats.realTraffic?.visitors_today ?? 0],
        ['Visiteurs uniques (7 jours)', stats.realTraffic?.visitors_7d ?? 0],
        ['Visiteurs uniques (30 jours)', stats.realTraffic?.visitors_30d ?? 0],
      ])}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        <StatCard title="Visiteurs uniques / jour (14 derniers jours)">
          <TrendChart data={last14DaysVisitors(stats.dailyVisitors)} lines={[{ key: 'visitors', label: 'Visiteurs uniques' }]} />
        </StatCard>
        <StatCard title="Provenance du trafic">
          <DonutStat data={(stats.topReferrers || []).map(r => ({ name: referrerLabel(r.referrer_domain), value: Number(r.visitors) || 0 }))} />
        </StatCard>
        <StatCard title="Appareil (trafic réel)">
          <DonutStat data={(stats.realDeviceSplit || []).map(d => ({ name: DEVICE_LABELS[d.device_type] || d.device_type || 'Inconnu', value: Number(d.visitors) || 0 }))} />
        </StatCard>
      </div>
    </div>
  );
}

export default function PlayAdminPage() {
  const [tab, setTab] = useState('games');

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-title">iFilino Play</div>
        <div className="page-subtitle">Gestion du catalogue, des fournisseurs, licences, jeux et récompenses.</div>
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

      {tab === 'stats' ? <StatsPanel /> : <EntityPanel key={tab} tabKey={tab} />}
    </div>
  );
}
