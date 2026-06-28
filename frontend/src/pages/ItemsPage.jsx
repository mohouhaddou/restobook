import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { ASSET, API } from '../api';
import { Toast } from '../components/ui/Toast';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/ConfirmModal';

const TYPES = ['plat', 'entrée', 'dessert', 'boisson'];
const BLANK = { libelle: '', description: '', type: 'plat', image_url: '', prix: '', category_id: '', sort_order: '0', is_available: true };

const FALLBACKS = {
  plat:    'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=400&q=70',
  entrée:  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=70',
  dessert: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=400&q=70',
  boisson: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=400&q=70',
};

const TYPE_COLORS = {
  plat:    { bg: '#FFF7ED', color: '#FF8A00' },
  entrée:  { bg: '#F0FDF4', color: '#16A34A' },
  dessert: { bg: '#F5F3FF', color: '#9333EA' },
  boisson: { bg: '#EFF6FF', color: '#2563EB' },
};

export default function ItemsPage() {
  const { get, del, token } = useApi();
  const [items, setItems]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm]     = useState(BLANK);
  const [file, setFile]     = useState(null);
  const [editing, setEditing]   = useState(null);
  const [editFile, setEditFile] = useState(null);
  const [msg, setMsg]   = useState('');
  const [kind, setKind] = useState('success');
  const [q, setQ]             = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showForm, setShowForm]     = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const d = await get('/restaurant-saas/menu');
      setItems(d.items || []);
      setCategories(d.categories || []);
    } catch {
      try { const d = await get('/menu/items'); setItems(d.items || []); } catch {}
    }
  }
  function notify(text, k = 'success') { setMsg(text); setKind(k); }

  async function create(e) {
    e.preventDefault();
    const fd = new FormData();
    fd.append('libelle', form.libelle);
    if (form.description) fd.append('description', form.description);
    fd.append('type', form.type);
    if (form.prix) fd.append('prix', form.prix);
    if (form.category_id) fd.append('category_id', form.category_id);
    fd.append('sort_order', form.sort_order || '0');
    fd.append('is_available', String(form.is_available));
    if (file) fd.append('image', file);
    else if (form.image_url) fd.append('image_url', form.image_url);
    try {
      const r = await fetch(API('/menu/items'), {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      notify('Plat ajouté avec succès');
      setForm(BLANK); setFile(null); setShowForm(false);
      load();
    } catch (err) { notify(err.message, 'error'); }
  }

  async function update(e) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData();
    fd.append('libelle', editing.libelle);
    if (editing.description !== undefined) fd.append('description', editing.description || '');
    fd.append('type', editing.type);
    if (editing.prix !== undefined && editing.prix !== null) fd.append('prix', editing.prix || '');
    fd.append('category_id', editing.category_id || '');
    fd.append('sort_order', editing.sort_order || '0');
    fd.append('is_available', String(editing.is_available !== false));
    if (editFile) fd.append('image', editFile);
    try {
      const r = await fetch(API(`/menu/items/${editing.id}`), {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: fd
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      notify('Plat mis à jour'); setEditing(null); setEditFile(null); load();
    } catch (err) { notify(err.message, 'error'); }
  }

  async function remove(it) {
    try {
      await del(`/menu/items/${it.id}`);
      setPendingDelete(null);
      notify('Plat supprimé');
      load();
    }
    catch (err) { notify(err.message, 'error'); }
  }

  const filtered = items.filter(it => {
    if (typeFilter !== 'all' && it.type !== typeFilter) return false;
    return !q || `${it.libelle} ${it.description || ''}`.toLowerCase().includes(q.toLowerCase());
  });

  const counts = TYPES.reduce((acc, t) => {
    acc[t] = items.filter(it => it.type === t).length;
    return acc;
  }, {});

  return (
    <>
      <Toast msg={msg} kind={kind} onClose={() => setMsg('')} />

      {/* Stats rapides */}
      <div className="row g-2">
        {TYPES.map(t => {
          const cfg = TYPE_COLORS[t];
          return (
            <div key={t} className="col-6 col-md-3">
              <div className="card p-3 text-center border-0"
                style={{ background: cfg.bg, cursor: 'pointer', transition: 'transform .15s' }}
                onClick={() => setTypeFilter(typeFilter === t ? 'all' : t)}>
                <div style={{ fontSize: 24, fontWeight: 700, color: cfg.color }}>{counts[t]}</div>
                <div style={{ fontSize: 12, color: cfg.color, fontWeight: 600, textTransform: 'capitalize' }}>{t}{counts[t] > 1 ? 's' : ''}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Barre de recherche + bouton ajouter */}
      <div className="card p-3">
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <div className="cat-tabs flex-grow-1" style={{ flexWrap: 'wrap' }}>
            <button className={`cat-tab${typeFilter === 'all' ? ' active' : ''}`} onClick={() => setTypeFilter('all')}>
              Tous ({items.length})
            </button>
            {TYPES.map(t => (
              <button key={t} className={`cat-tab${typeFilter === t ? ' active' : ''}`}
                onClick={() => setTypeFilter(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)} ({counts[t]})
              </button>
            ))}
          </div>
          <input className="form-control form-control-sm" style={{ maxWidth: 200 }}
            placeholder="Rechercher…" value={q} onChange={e => setQ(e.target.value)} />
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
            {showForm ? '✕ Fermer' : '＋ Ajouter un plat'}
          </button>
        </div>

        {/* Formulaire ajout */}
        {showForm && (
          <form onSubmit={create} className="row g-2 mt-3 p-3 rounded-3"
            style={{ background: 'var(--rb-surface)' }}>
            <div className="col-12 col-sm-5">
              <label className="form-label small">Libellé *</label>
              <input className="form-control form-control-sm" value={form.libelle} required
                onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))} />
            </div>
            <div className="col-6 col-sm-2">
              <label className="form-label small">Type</label>
              <select className="form-select form-select-sm" value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-6 col-sm-2">
              <label className="form-label small">Catégorie</label>
              <select className="form-select form-select-sm" value={form.category_id}
                onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">Aucune</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-6 col-sm-2">
              <label className="form-label small">Prix (MAD)</label>
              <input type="number" min="0" step="0.5" className="form-control form-control-sm"
                value={form.prix} placeholder="ex: 45"
                onChange={e => setForm(f => ({ ...f, prix: e.target.value }))} />
            </div>
            <div className="col-12 col-sm-3">
              <label className="form-label small">Image</label>
              <input type="file" accept="image/*" className="form-control form-control-sm"
                onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>
            <div className="col-12">
              <label className="form-label small">Description</label>
              <input className="form-control form-control-sm" value={form.description}
                placeholder="Ingrédients, allergènes, etc."
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="col-6 col-sm-3">
              <label className="form-label small">Ordre</label>
              <input type="number" min="0" className="form-control form-control-sm" value={form.sort_order}
                onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} />
            </div>
            <div className="col-6 col-sm-3 d-flex align-items-end">
              <label className="form-check small mb-2">
                <input className="form-check-input me-2" type="checkbox" checked={form.is_available}
                  onChange={e => setForm(f => ({ ...f, is_available: e.target.checked }))} />
                Disponible
              </label>
            </div>
            <div className="col-12 d-flex gap-2">
              <button type="submit" className="btn btn-primary btn-sm">＋ Ajouter</button>
              <button type="button" className="btn btn-outline-secondary btn-sm"
                onClick={() => { setShowForm(false); setForm(BLANK); setFile(null); }}>
                Annuler
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Grille plats */}
      <div className="card p-3">
        {filtered.length === 0 ? (
          <EmptyState icon="🍽️" title="Aucun plat" subtitle="Ajoutez des plats via le bouton ci-dessus." />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: 14,
          }}>
            {filtered.map(it => {
              const t   = it.type === 'entree' ? 'entrée' : it.type;
              const cfg = TYPE_COLORS[t] || {};
              const img = it.image_url ? ASSET(it.image_url) : FALLBACKS[t];
              const categoryName = it.category?.name || categories.find(c => String(c.id) === String(it.category_id))?.name;

              return (
                <div key={it.id} style={{
                  background: 'var(--rb-card)', borderRadius: 14,
                  border: '1px solid var(--rb-border)',
                  overflow: 'hidden', boxShadow: 'var(--rb-shadow)',
                  transition: 'transform .15s, box-shadow .15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--rb-shadow-md)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'var(--rb-shadow)'; }}
                >
                  <div style={{ position: 'relative' }}>
                    <img
                      src={img} alt={it.libelle}
                      style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }}
                      onError={e => { e.target.src = FALLBACKS[t]; }}
                    />
                    <div style={{
                      position: 'absolute', top: 8, left: 8,
                      background: cfg.bg, color: cfg.color,
                      fontSize: 10, fontWeight: 700, textTransform: 'capitalize',
                      padding: '3px 8px', borderRadius: 20,
                    }}>
                      {t}
                    </div>
                    {it.prix && (
                      <div style={{
                        position: 'absolute', top: 8, right: 8,
                        background: 'rgba(0,0,0,.7)', color: '#fff',
                        fontSize: 11, fontWeight: 700,
                        padding: '3px 8px', borderRadius: 20,
                      }}>
                        {Number(it.prix).toFixed(0)} MAD
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '10px 12px 12px' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{it.libelle}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
                      {categoryName && <span style={{ fontSize: 10, color: 'var(--rb-muted)' }}>{categoryName}</span>}
                      {it.is_available === false && <span style={{ fontSize: 10, color: '#B91C1C', fontWeight: 700 }}>Indisponible</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--rb-muted)', lineHeight: 1.4, minHeight: 16 }}>
                      {it.description || <span style={{ fontStyle: 'italic' }}>Pas de description</span>}
                    </div>
                    <div className="d-flex gap-2 mt-2">
                      <button className="btn btn-sm flex-grow-1"
                        style={{ fontSize: 11, background: 'var(--rb-surface)', border: '1px solid var(--rb-border)' }}
                        onClick={() => { setEditing({ ...it, prix: it.prix || '', category_id: it.category_id || '', sort_order: it.sort_order || '0', is_available: it.is_available !== false }); setEditFile(null); }}>
                        ✏️ Éditer
                      </button>
                      <button className="btn btn-sm"
                        style={{ fontSize: 11, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
                        onClick={() => setPendingDelete(it)}>
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal édition */}
      <ConfirmModal
        show={!!pendingDelete}
        title="Supprimer ce plat"
        message={pendingDelete ? `Le plat "${pendingDelete.libelle}" sera retiré du catalogue.` : ''}
        confirmLabel="Supprimer"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove(pendingDelete)}
      />

      {editing && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1060,
          background: 'rgba(0,0,0,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }} onClick={() => setEditing(null)}>
          <div style={{
            background: 'var(--rb-card)', borderRadius: 16, padding: 24,
            width: '100%', maxWidth: 480, boxShadow: 'var(--rb-shadow-lg)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h5 style={{ margin: 0 }}>Modifier — {editing.libelle}</h5>
              <button onClick={() => setEditing(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--rb-muted)' }}>✕</button>
            </div>
            <form onSubmit={update} className="row g-3">
              <div className="col-12">
                <label className="form-label small">Libellé</label>
                <input className="form-control" value={editing.libelle}
                  onChange={e => setEditing(v => ({ ...v, libelle: e.target.value }))} />
              </div>
              <div className="col-6">
                <label className="form-label small">Type</label>
                <select className="form-select" value={editing.type}
                  onChange={e => setEditing(v => ({ ...v, type: e.target.value }))}>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-6">
                <label className="form-label small">Catégorie</label>
                <select className="form-select" value={editing.category_id || ''}
                  onChange={e => setEditing(v => ({ ...v, category_id: e.target.value }))}>
                  <option value="">Aucune</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-6">
                <label className="form-label small">Prix (MAD)</label>
                <input type="number" min="0" step="0.5" className="form-control"
                  value={editing.prix || ''}
                  onChange={e => setEditing(v => ({ ...v, prix: e.target.value }))} />
              </div>
              <div className="col-12">
                <label className="form-label small">Description</label>
                <input className="form-control" value={editing.description || ''}
                  onChange={e => setEditing(v => ({ ...v, description: e.target.value }))} />
              </div>
              <div className="col-6">
                <label className="form-label small">Ordre</label>
                <input type="number" min="0" className="form-control" value={editing.sort_order || '0'}
                  onChange={e => setEditing(v => ({ ...v, sort_order: e.target.value }))} />
              </div>
              <div className="col-6 d-flex align-items-end">
                <label className="form-check mb-2">
                  <input className="form-check-input me-2" type="checkbox" checked={editing.is_available !== false}
                    onChange={e => setEditing(v => ({ ...v, is_available: e.target.checked }))} />
                  Disponible
                </label>
              </div>
              <div className="col-12">
                <label className="form-label small">Remplacer l'image</label>
                <input type="file" accept="image/*" className="form-control"
                  onChange={e => setEditFile(e.target.files?.[0] || null)} />
                {editing.image_url && !editFile && (
                  <div style={{ marginTop: 6 }}>
                    <img src={ASSET(editing.image_url)} alt="" style={{ height: 60, borderRadius: 6, objectFit: 'cover' }} />
                  </div>
                )}
              </div>
              <div className="col-12 d-flex gap-2 justify-content-end">
                <button type="button" className="btn btn-outline-secondary"
                  onClick={() => setEditing(null)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
