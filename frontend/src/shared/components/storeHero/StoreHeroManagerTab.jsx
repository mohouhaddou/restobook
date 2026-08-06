import React, { useEffect, useState } from 'react';
import { Reorder } from 'framer-motion';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../../contexts/AuthContext';
import { API, ASSET } from '../../../api';
import { Toast } from '../../../components/ui/Toast';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PremiumIcon, PremiumIconBadge } from '../ui/PremiumIcon';

const CTA_TYPES = [
  ['', '— Aucun —'], ['product', 'Produit'], ['category', 'Catégorie'], ['promotion', 'Promotion'],
  ['internal_url', 'URL interne'], ['external_url', 'URL externe'],
];
const ANIMATIONS = [['fade', 'Fondu'], ['slide', 'Glissement'], ['zoom', 'Zoom léger']];
const STATUS_META = {
  draft: { label: 'Brouillon', color: '#6B7280', bg: '#F3F4F6' },
  active: { label: 'Actif', color: '#16A34A', bg: '#F0FDF4' },
  paused: { label: 'En pause', color: '#D97706', bg: '#FFFBEB' },
  archived: { label: 'Archivé', color: '#9CA3AF', bg: '#F9FAFB' },
};

const DEFAULT_FORM = {
  title: '', subtitle: '', badge: '', discount_badge: '', discount_label: '',
  image_desktop: '', image_mobile: '', illustration: '',
  cta_text: '', cta_type: '', cta_url: '',
  animation: 'fade', gradient: '', text_color: '', button_color: '',
  start_date: '', end_date: '', start_time: '', end_time: '',
  status: 'draft',
};

const fieldStyle = { width: '100%', padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 13.5, boxSizing: 'border-box' };
const labelStyle = { fontSize: 12.5, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 };

function Field({ label, children }) {
  return <div><label style={labelStyle}>{label}</label>{children}</div>;
}

// Même widget d'upload que le Hero Manager marketplace (drag&drop + preview
// instantanée), pointé vers l'endpoint vendeur /store-hero/slides/upload.
function ImageDropzone({ label, hint, field, value, onUploaded, token }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState(null);
  const [error, setError] = useState('');

  async function handleFile(file) {
    if (!file) return;
    setLocalPreview(URL.createObjectURL(file));
    setUploading(true); setError('');
    try {
      const fd = new FormData();
      fd.append(field, file);
      const res = await fetch(API('/store-hero/slides/upload'), {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Échec de l\'upload');
      onUploaded(data[field]);
    } catch (e) { setError(e.message); }
    setUploading(false);
  }

  const displaySrc = localPreview || (value ? ASSET(value) : null);

  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
        style={{
          position: 'relative', borderRadius: 12, border: `2px dashed ${dragOver ? '#FF8A00' : '#E5E7EB'}`,
          background: dragOver ? '#FFF7ED' : '#FAFAFA', minHeight: 110, display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', cursor: 'pointer',
        }}
        onClick={() => document.getElementById(`store-hero-upload-${field}`).click()}
      >
        <input id={`store-hero-upload-${field}`} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden
          onChange={e => handleFile(e.target.files?.[0])} />
        {displaySrc ? (
          <img src={displaySrc} alt="" style={{ width: '100%', height: 110, objectFit: 'cover' }} />
        ) : (
          <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 12.5, padding: 12 }}>
            <><PremiumIcon name="upload" size={20} /><br />Glissez une image ou cliquez<br />{hint}</>
          </div>
        )}
        {uploading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700 }}>
            Compression WebP…
          </div>
        )}
      </div>
      {error && <div style={{ fontSize: 11.5, color: '#DC2626', marginTop: 4 }}>{error}</div>}
      {value && !uploading && (
        <button type="button" onClick={() => { onUploaded(''); setLocalPreview(null); }} style={{ marginTop: 6, fontSize: 11.5, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <><PremiumIcon name="trash" size={13} /> Retirer l'image</>
        </button>
      )}
    </div>
  );
}

function SlideForm({ initial, onCancel, onSaved, token }) {
  const { post, put } = useApi();
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(() => {
    if (!initial) return DEFAULT_FORM;
    const merged = { ...DEFAULT_FORM, ...initial };
    // Normalise les colonnes nullable en chaîne vide — sinon React avertit sur
    // un input contrôlé qui reçoit `null` comme value.
    for (const k of Object.keys(DEFAULT_FORM)) {
      if (merged[k] === null || merged[k] === undefined) merged[k] = DEFAULT_FORM[k];
    }
    return merged;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(field, value) { setForm(prev => ({ ...prev, [field]: value })); }

  async function handleSave(andPublish) {
    setSaving(true); setError('');
    try {
      const payload = { ...form, status: andPublish ? 'active' : form.status };
      for (const k of ['subtitle', 'badge', 'discount_badge', 'discount_label', 'cta_text', 'cta_type', 'cta_url', 'gradient', 'text_color', 'button_color', 'start_date', 'end_date', 'start_time', 'end_time']) {
        if (payload[k] === '') payload[k] = null;
      }
      const res = isEdit ? await put(`/store-hero/slides/${initial.id}`, payload) : await post('/store-hero/slides', payload);
      onSaved(res.slide);
    } catch (e) { setError(e.message); }
    setSaving(false);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
      <div className="if-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h6 style={{ margin: 0, fontWeight: 800 }}>Contenu</h6>
        <Field label="Titre *"><input style={fieldStyle} value={form.title} onChange={e => set('title', e.target.value)} /></Field>
        <Field label="Sous-titre"><input style={fieldStyle} value={form.subtitle} onChange={e => set('subtitle', e.target.value)} /></Field>
        <Field label="Badge"><input style={fieldStyle} value={form.badge} onChange={e => set('badge', e.target.value)} placeholder="Promo, Nouveau…" /></Field>
        <div style={{ display: 'flex', gap: 12 }}>
          <Field label="Badge remise (cercle flottant)"><input style={fieldStyle} value={form.discount_badge} onChange={e => set('discount_badge', e.target.value)} placeholder="-20%" /></Field>
          <Field label="Texte sous la remise"><input style={fieldStyle} value={form.discount_label} onChange={e => set('discount_label', e.target.value)} placeholder="Cette semaine" /></Field>
        </div>
      </div>

      <div className="if-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h6 style={{ margin: 0, fontWeight: 800 }}>Appel à l'action</h6>
        <Field label="Texte du bouton"><input style={fieldStyle} value={form.cta_text} onChange={e => set('cta_text', e.target.value)} placeholder="Découvrir" /></Field>
        <Field label="Type de lien">
          <select style={fieldStyle} value={form.cta_type} onChange={e => set('cta_type', e.target.value)}>
            {CTA_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        {form.cta_type && (
          <Field label={form.cta_type === 'external_url' ? 'URL externe' : 'Chemin / URL'}>
            <input style={fieldStyle} value={form.cta_url} onChange={e => set('cta_url', e.target.value)}
              placeholder={form.cta_type === 'external_url' ? 'https://…' : 'ex: /marketplace/search?q=...'} />
          </Field>
        )}
      </div>

      <div className="if-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h6 style={{ margin: 0, fontWeight: 800 }}>Visuels</h6>
        <ImageDropzone label="Image Desktop (16:9)" hint="1920×1080 recommandé" field="image_desktop" value={form.image_desktop} onUploaded={url => set('image_desktop', url)} token={token} />
        <ImageDropzone label="Image Mobile (portrait)" hint="828×1200 recommandé" field="image_mobile" value={form.image_mobile} onUploaded={url => set('image_mobile', url)} token={token} />
        <ImageDropzone label="Illustration produit (optionnelle)" hint="détourée, fond transparent" field="illustration" value={form.illustration} onUploaded={url => set('illustration', url)} token={token} />
      </div>

      <div className="if-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h6 style={{ margin: 0, fontWeight: 800 }}>Présentation</h6>
        <Field label="Animation">
          <select style={fieldStyle} value={form.animation} onChange={e => set('animation', e.target.value)}>
            {ANIMATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <div style={{ display: 'flex', gap: 12 }}>
          <Field label="Couleur du texte"><input type="color" value={form.text_color || '#ffffff'} onChange={e => set('text_color', e.target.value)} style={{ width: '100%', height: 38, borderRadius: 8, border: '1.5px solid #E5E7EB' }} /></Field>
          <Field label="Couleur du bouton"><input type="color" value={form.button_color || '#ffffff'} onChange={e => set('button_color', e.target.value)} style={{ width: '100%', height: 38, borderRadius: 8, border: '1.5px solid #E5E7EB' }} /></Field>
        </div>
        <Field label="Gradient CSS (optionnel — vide = couleur de votre type de commerce)">
          <input style={fieldStyle} value={form.gradient} onChange={e => set('gradient', e.target.value)} placeholder="linear-gradient(135deg, #DC2626, #7F1D1D)" />
          {form.gradient && <div style={{ marginTop: 6, height: 24, borderRadius: 6, background: form.gradient }} />}
        </Field>
      </div>

      <div className="if-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h6 style={{ margin: 0, fontWeight: 800 }}>Programmation</h6>
        <div style={{ display: 'flex', gap: 12 }}>
          <Field label="Date début"><input type="date" style={fieldStyle} value={form.start_date || ''} onChange={e => set('start_date', e.target.value)} /></Field>
          <Field label="Date fin"><input type="date" style={fieldStyle} value={form.end_date || ''} onChange={e => set('end_date', e.target.value)} /></Field>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <Field label="Heure début"><input type="time" style={fieldStyle} value={form.start_time || ''} onChange={e => set('start_time', e.target.value)} /></Field>
          <Field label="Heure fin"><input type="time" style={fieldStyle} value={form.end_time || ''} onChange={e => set('end_time', e.target.value)} /></Field>
          {(form.start_time || form.end_time) && (
            <button type="button" className="if-btn if-btn-outline if-btn-sm" style={{ marginBottom: 1 }}
              onClick={() => { set('start_time', ''); set('end_time', ''); }}>
              <><PremiumIcon name="close" size={13} /> Effacer</>
            </button>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>Laissez les heures vides pour un affichage toute la journée.</div>
        {form.start_time && form.end_time && form.start_time === form.end_time && (
          <div style={{ fontSize: 11.5, color: '#DC2626', background: '#FEF2F2', padding: '8px 10px', borderRadius: 8 }}>
            Heure début = heure fin ({form.start_time}) : le slide ne sera visible qu'à cette minute précise chaque jour.
          </div>
        )}
        <Field label="Statut">
          <select style={fieldStyle} value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="draft">Brouillon</option>
            <option value="active">Actif</option>
            <option value="paused">En pause</option>
            <option value="archived">Archivé</option>
          </select>
        </Field>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'flex-end' }}>
        {error && <div style={{ fontSize: 12.5, color: '#DC2626' }}>{error}</div>}
        <button className="if-btn if-btn-primary" disabled={saving || !form.title.trim()} onClick={() => handleSave(true)}><PremiumIcon name="rocket" size={14} /> Enregistrer et publier</button>
        <button className="if-btn if-btn-outline" disabled={saving || !form.title.trim()} onClick={() => handleSave(false)}><PremiumIcon name="save" size={14} /> Enregistrer en brouillon</button>
        <button className="if-btn if-btn-outline" disabled={saving} onClick={onCancel}>← Retour à la liste</button>
      </div>
    </div>
  );
}

function SlideCard({ slide, onEdit, onDuplicate, onDelete, onToggle, reorderMode }) {
  const st = STATUS_META[slide.status] || STATUS_META.draft;
  return (
    <div className="if-card" style={{ padding: 14, display: 'flex', gap: 14, alignItems: 'center', cursor: reorderMode ? 'grab' : 'default' }}>
      <div style={{ width: 96, height: 54, borderRadius: 8, background: '#F3F4F6', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {slide.image_desktop ? <img src={ASSET(slide.image_desktop)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <PremiumIcon name="image" size={22} style={{ opacity:.45 }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 14 }}>{slide.title}</strong>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: st.color, background: st.bg }}>{st.label}</span>
          {slide.is_active_now && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: '#16A34A', background: '#F0FDF4' }}>● actif maintenant</span>}
        </div>
        {slide.subtitle && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{slide.subtitle}</div>}
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {(slide.start_date || slide.end_date) && <span className="premium-inline-icon"><PremiumIcon name="calendar" size={13} />{slide.start_date || '…'} → {slide.end_date || '…'}</span>}
          <span className="premium-inline-icon"><PremiumIcon name="eye" size={13} />{slide.impressions} · {slide.clicks} clics · CTR {((slide.ctr || 0) * 100).toFixed(1)}%</span>
        </div>
      </div>
      {!reorderMode && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 200 }}>
          <button className="if-btn if-btn-outline if-btn-sm" onClick={() => onEdit(slide)}><PremiumIcon name="edit" size={13} /> Modifier</button>
          <button className="if-btn if-btn-outline if-btn-sm" onClick={() => onDuplicate(slide)}>⧉ Dupliquer</button>
          {['active', 'paused'].includes(slide.status) && (
            <button className="if-btn if-btn-outline if-btn-sm" onClick={() => onToggle(slide)}>
              {slide.status === 'active' ? '⏸ Désactiver' : '▶ Activer'}
            </button>
          )}
          <button className="if-btn if-btn-outline if-btn-sm" style={{ color: '#DC2626', borderColor: '#DC2626' }} onClick={() => onDelete(slide)}><PremiumIcon name="trash" size={13} /> Supprimer</button>
        </div>
      )}
    </div>
  );
}

/**
 * Onglet "Hero" réutilisable dans les 3 dashboards vendeur (restaurant, hanout,
 * pharmacie) — même moteur que le Hero Manager marketplace (SuperAdmin), mais
 * scopé au commerce du vendeur connecté (backend : /api/store-hero, toujours
 * req.user.organization_id, jamais un id d'URL). Pas de ciblage visiteur ni
 * d'A/B ni de page stats séparée : un seul commerce n'en a pas l'usage.
 */
export function StoreHeroManagerTab() {
  const { get, post, patch, del } = useApi();
  const { token } = useAuth();
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('list'); // 'list' | 'form'
  const [editing, setEditing] = useState(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [msg, setMsg] = useState(''); const [kind, setKind] = useState('success');

  function load() {
    setLoading(true);
    get('/store-hero/slides').then(d => { setSlides(d.slides || []); setLoading(false); }).catch(e => { setMsg(e.message); setKind('error'); setLoading(false); });
  }
  useEffect(() => { load(); }, []);

  async function handleDuplicate(slide) {
    try {
      await post(`/store-hero/slides/${slide.id}/duplicate`, {});
      setMsg('Slide dupliqué en brouillon.'); setKind('success');
      load();
    } catch (e) { setMsg(e.message); setKind('error'); }
  }

  async function handleToggle(slide) {
    try {
      await patch(`/store-hero/slides/${slide.id}/toggle-active`, {});
      load();
    } catch (e) { setMsg(e.message); setKind('error'); }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    try {
      await del(`/store-hero/slides/${id}`);
      setMsg('Slide supprimé.'); setKind('success');
      setSlides(prev => prev.filter(s => s.id !== id));
    } catch (e) { setMsg(e.message); setKind('error'); }
  }

  async function handleReorder(newOrder) {
    setSlides(newOrder);
    try { await post('/store-hero/slides/reorder', { order: newOrder.map(s => s.id) }); }
    catch (e) { setMsg(e.message); setKind('error'); }
  }

  if (mode === 'form') {
    return (
      <SlideForm
        initial={editing}
        token={token}
        onCancel={() => { setMode('list'); setEditing(null); }}
        onSaved={() => { setMode('list'); setEditing(null); setMsg('Slide enregistré.'); setKind('success'); load(); }}
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 14 }}>
        {slides.length > 1 && (
          <button className={`if-btn if-btn-sm ${reorderMode ? 'if-btn-primary' : 'if-btn-outline'}`} onClick={() => setReorderMode(m => !m)}>
            {reorderMode ? 'Terminer le tri' : <><PremiumIcon name="shuffle" size={13} /> Réorganiser</>}
          </button>
        )}
        <button className="if-btn if-btn-primary if-btn-sm" onClick={() => { setEditing(null); setMode('form'); }}>+ Nouveau slide</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Chargement…</div>
      ) : slides.length === 0 ? (
        <EmptyState icon="image" title="Aucun slide configuré" subtitle="Créez votre premier slide pour animer le Hero de votre page publique." />
      ) : reorderMode ? (
        <Reorder.Group axis="y" values={slides} onReorder={handleReorder} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {slides.map(slide => (
            <Reorder.Item key={slide.id} value={slide} style={{ listStyle: 'none' }}>
              <SlideCard slide={slide} reorderMode onEdit={() => {}} onDuplicate={() => {}} onDelete={() => {}} onToggle={() => {}} />
            </Reorder.Item>
          ))}
        </Reorder.Group>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {slides.map(slide => (
            <SlideCard
              key={slide.id} slide={slide}
              onEdit={s => { setEditing(s); setMode('form'); }}
              onDuplicate={handleDuplicate}
              onDelete={setPendingDelete}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      <ConfirmModal
        show={!!pendingDelete}
        title="Supprimer ce slide ?"
        message={`« ${pendingDelete?.title} » sera définitivement supprimé, avec ses statistiques.`}
        confirmLabel="Supprimer" confirmClass="btn-danger"
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />

      <Toast msg={msg} kind={kind} onClose={() => setMsg('')} />
    </div>
  );
}
