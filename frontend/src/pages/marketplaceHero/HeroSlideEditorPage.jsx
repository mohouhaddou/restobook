import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import { API, ASSET } from '../../api';
import { Toast } from '../../components/ui/Toast';
import { HeroManagerLayout } from './HeroManagerLayout';
import { NEED_CATEGORIES } from '../../config/needCategories';
import { PremiumIcon } from '../../shared/components/ui/PremiumIcon';

const SLIDE_TYPES = [
  ['seasonal_campaign', 'Campagne saisonnière'], ['promotion', 'Promotion'], ['category', 'Catégorie'],
  ['business', 'Commerce'], ['brand', 'Marque'], ['product', 'Produit'], ['new_arrival', 'Nouveauté'],
  ['announcement', 'Annonce'], ['event', 'Événement'], ['custom_offer', 'Offre personnalisée'],
];
const CTA_TYPES = [
  ['', '— Aucun —'], ['category', 'Catégorie marketplace'], ['search', 'Recherche'],
  ['business', 'Commerce'], ['product', 'Produit'], ['promotion', 'Promotion'], ['product_list', 'Liste de produits'],
  ['internal_url', 'URL interne'], ['external_url', 'URL externe'],
];
const ANIMATIONS = [['fade', 'Fondu'], ['slide', 'Glissement'], ['zoom', 'Zoom léger']];
const SEGMENTS = [['all', 'Tous'], ['new', 'Nouveaux'], ['regular', 'Réguliers'], ['loyal', 'Fidèles'], ['vip', 'VIP'], ['inactive', 'Inactifs'], ['at_risk', 'À risque']];
const AUTH_TARGETS = [['all', 'Tous'], ['guest', 'Invités seulement'], ['logged_in', 'Connectés seulement']];

const DEFAULT_FORM = {
  title: '', subtitle: '', badge: '', discount_badge: '', discount_label: '', campaign_label: '',
  image_desktop: '', image_mobile: '', illustration: '', featured_category_ids: [],
  cta_text: '', cta_type: '', cta_url: '',
  slide_type: 'promotion', animation: 'fade', gradient: '', text_color: '', button_color: '',
  start_date: '', end_date: '', start_time: '', end_time: '',
  target_segment: 'all', target_language: '', target_auth: 'all',
  target_country: '', target_city: '', target_quartier: '', target_premium: false, target_family: false,
  target_purchase_category: '', target_favorite_category: '',
  campaign_group_id: '', ab_impression_threshold: 200,
  status: 'draft',
};

// Widget d'upload — drag&drop natif + input fichier, prévisualisation
// instantanée, POST immédiat vers /slides/upload (sharp → WebP). Pas de
// recadrage interactif (aucune librairie de crop dans ce codebase) : le
// fit:'cover' de sharp fait un centre-crop automatique côté serveur.
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
      const res = await fetch(API('/superadmin/hero/slides/upload'), {
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
      <label style={{ fontSize: 12.5, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>{label}</label>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
        style={{
          position: 'relative', borderRadius: 12, border: `2px dashed ${dragOver ? '#FF8A00' : '#E5E7EB'}`,
          background: dragOver ? '#FFF7ED' : '#FAFAFA', minHeight: 110, display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', cursor: 'pointer',
        }}
        onClick={() => document.getElementById(`hero-upload-${field}`).click()}
      >
        <input id={`hero-upload-${field}`} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden
          onChange={e => handleFile(e.target.files?.[0])} />
        {displaySrc ? (
          <img src={displaySrc} alt="" style={{ width: '100%', height: 110, objectFit: 'cover' }} />
        ) : (
          <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 12.5, padding: 12 }}>
            <PremiumIcon name="upload" size={20} style={{ marginBottom: 6 }} />
            <div>Glissez une image ou cliquez</div><div>{hint}</div>
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
          <PremiumIcon name="trash" size={13} /> Retirer l'image
        </button>
      )}
    </div>
  );
}

const fieldStyle = { width: '100%', padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 13.5, boxSizing: 'border-box' };
const labelStyle = { fontSize: 12.5, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 };

function Field({ label, children }) {
  return <div><label style={labelStyle}>{label}</label>{children}</div>;
}

export default function HeroSlideEditorPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { get, post, put } = useApi();
  const { token } = useAuth();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(''); const [kind, setKind] = useState('success');

  useEffect(() => {
    if (!isEdit) return;
    get(`/superadmin/hero/slides/${id}`).then(d => {
      const s = d.slide;
      setForm({
        ...DEFAULT_FORM, ...s,
        subtitle: s.subtitle || '', badge: s.badge || '', discount_badge: s.discount_badge || '', discount_label: s.discount_label || '', campaign_label: s.campaign_label || '',
        featured_category_ids: Array.isArray(s.featured_category_ids) ? s.featured_category_ids : [],
        cta_type: s.cta_type || '', cta_url: s.cta_url || '', cta_text: s.cta_text || '',
        gradient: s.gradient || '', text_color: s.text_color || '', button_color: s.button_color || '',
        start_date: s.start_date || '', end_date: s.end_date || '', start_time: s.start_time || '', end_time: s.end_time || '',
        target_language: s.target_language || '', campaign_group_id: s.campaign_group_id || '',
        target_country: s.target_country || '', target_city: s.target_city || '', target_quartier: s.target_quartier || '',
        target_purchase_category: s.target_purchase_category || '', target_favorite_category: s.target_favorite_category || '',
      });
      setLoading(false);
    }).catch(e => { setMsg(e.message); setKind('error'); setLoading(false); });
  }, [id]);

  function set(field, value) { setForm(prev => ({ ...prev, [field]: value })); }

  async function handleSave(andPublish) {
    setSaving(true);
    try {
      const payload = { ...form, status: andPublish ? 'active' : form.status };
      // Champs vides -> null plutôt que chaîne vide, pour rester cohérent avec les colonnes nullable.
      for (const k of ['subtitle', 'badge', 'discount_badge', 'discount_label', 'campaign_label', 'cta_text', 'cta_type', 'cta_url', 'gradient', 'text_color', 'button_color', 'start_date', 'end_date', 'start_time', 'end_time', 'target_language', 'campaign_group_id']) {
        if (payload[k] === '') payload[k] = null;
      }
      if (!payload.featured_category_ids?.length) payload.featured_category_ids = null;
      const res = isEdit ? await put(`/superadmin/hero/slides/${id}`, payload) : await post('/superadmin/hero/slides', payload);
      setMsg(isEdit ? 'Slide mis à jour.' : 'Slide créé.'); setKind('success');
      if (!isEdit) navigate(`/marketplace-hero/slides/${res.slide.id}/edit`);
      else setForm(prev => ({ ...prev, status: payload.status }));
    } catch (e) { setMsg(e.message); setKind('error'); }
    setSaving(false);
  }

  // Sélecteur de lien CTA — simplifié pour la Phase 1 : un select de
  // catégories réelles pour "category", sinon un champ texte pour les autres
  // types (pas de recherche live commerce/produit/promo — hors scope Phase 1,
  // la résolution finale en cta_url reste correcte quel que soit le type).
  function ctaUrlField() {
    if (form.cta_type === 'category') {
      return (
        <Field label="Catégorie ciblée">
          <select style={fieldStyle} value={form.cta_url.replace('/marketplace/search?need_category=', '')} onChange={e => set('cta_url', `/marketplace/search?need_category=${e.target.value}`)}>
            <option value="">— Choisir —</option>
            {NEED_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
      );
    }
    if (form.cta_type === 'search') {
      return (
        <Field label="Terme de recherche">
          <input style={fieldStyle} value={form.cta_url.replace('/marketplace/search?q=', '')} onChange={e => set('cta_url', `/marketplace/search?q=${encodeURIComponent(e.target.value)}`)} placeholder="ex: dattes" />
        </Field>
      );
    }
    if (!form.cta_type) return null;
    return (
      <Field label={form.cta_type === 'external_url' ? 'URL externe' : 'Chemin / URL'}>
        <input style={fieldStyle} value={form.cta_url} onChange={e => set('cta_url', e.target.value)}
          placeholder={form.cta_type === 'external_url' ? 'https://…' : 'ex: /h/hanout-brahim, /r/ma-pizzeria, /dashboard/lists'} />
      </Field>
    );
  }

  if (loading) return <HeroManagerLayout title="Hero Manager" icon="image"><div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Chargement…</div></HeroManagerLayout>;

  return (
    <HeroManagerLayout
      title={isEdit ? 'Modifier le slide' : 'Nouveau slide'} icon="image"
      actions={<button className="if-btn if-btn-outline if-btn-sm" onClick={() => navigate('/marketplace-hero/slides')}>← Retour à la liste</button>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, maxWidth: 1100 }}>

        {/* ── Contenu ── */}
        <div className="if-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h6 style={{ margin: 0, fontWeight: 800 }}>Contenu</h6>
          <Field label="Titre *"><input style={fieldStyle} value={form.title} onChange={e => set('title', e.target.value)} /></Field>
          <Field label="Sous-titre"><input style={fieldStyle} value={form.subtitle} onChange={e => set('subtitle', e.target.value)} /></Field>
          <Field label="Badge"><input style={fieldStyle} value={form.badge} onChange={e => set('badge', e.target.value)} placeholder="Ramadan, Promo, Nouveau…" /></Field>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Badge remise (cercle flottant)"><input style={fieldStyle} value={form.discount_badge} onChange={e => set('discount_badge', e.target.value)} placeholder="-25%" /></Field>
            <Field label="Texte sous la remise"><input style={fieldStyle} value={form.discount_label} onChange={e => set('discount_label', e.target.value)} placeholder="Sur une sélection BBQ" /></Field>
          </div>
          <Field label="Étiquette de campagne (interne, non affichée)"><input style={fieldStyle} value={form.campaign_label} onChange={e => set('campaign_label', e.target.value)} placeholder="ex: Ramadan 2026" /></Field>
          <Field label="Type de slide">
            <select style={fieldStyle} value={form.slide_type} onChange={e => set('slide_type', e.target.value)}>
              {SLIDE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        </div>

        {/* ── CTA ── */}
        <div className="if-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h6 style={{ margin: 0, fontWeight: 800 }}>Appel à l'action</h6>
          <Field label="Texte du bouton"><input style={fieldStyle} value={form.cta_text} onChange={e => set('cta_text', e.target.value)} placeholder="Découvrir" /></Field>
          <Field label="Type de lien">
            <select style={fieldStyle} value={form.cta_type} onChange={e => set('cta_type', e.target.value)}>
              {CTA_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          {ctaUrlField()}
        </div>

        {/* ── Visuels ── */}
        <div className="if-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h6 style={{ margin: 0, fontWeight: 800 }}>Visuels</h6>
          <ImageDropzone label="Image Desktop (16:9)" hint="1920×1080 recommandé" field="image_desktop" value={form.image_desktop} onUploaded={url => set('image_desktop', url)} token={token} />
          <ImageDropzone label="Image Mobile (portrait)" hint="828×1200 recommandé" field="image_mobile" value={form.image_mobile} onUploaded={url => set('image_mobile', url)} token={token} />
          <ImageDropzone label="Illustration produit (optionnelle)" hint="détourée, fond transparent" field="illustration" value={form.illustration} onUploaded={url => set('illustration', url)} token={token} />
        </div>

        {/* ── Catégories vedettes (carte flottante "Catégories populaires") ── */}
        <div className="if-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h6 style={{ margin: 0, fontWeight: 800 }}>Catégories vedettes</h6>
          <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>Affichées dans la carte flottante "Catégories populaires" sur le visuel (5-6 recommandé).</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {NEED_CATEGORIES.map(c => {
              const checked = form.featured_category_ids.includes(c.id);
              return (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '6px 8px', borderRadius: 8, background: checked ? '#FFF7ED' : 'transparent', cursor: 'pointer' }}>
                  <input type="checkbox" checked={checked} onChange={e => {
                    set('featured_category_ids', e.target.checked
                      ? [...form.featured_category_ids, c.id]
                      : form.featured_category_ids.filter(id => id !== c.id));
                  }} />
                  {c.label}
                </label>
              );
            })}
          </div>
        </div>

        {/* ── Présentation ── */}
        <div className="if-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h6 style={{ margin: 0, fontWeight: 800 }}>Présentation</h6>
          <Field label="Animation">
            <select style={fieldStyle} value={form.animation} onChange={e => set('animation', e.target.value)}>
              {ANIMATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Couleur du texte"><input type="color" value={form.text_color || '#ffffff'} onChange={e => set('text_color', e.target.value)} style={{ width: '100%', height: 38, borderRadius: 8, border: '1.5px solid #E5E7EB' }} /></Field>
            <Field label="Couleur du bouton"><input type="color" value={form.button_color || '#ff8a00'} onChange={e => set('button_color', e.target.value)} style={{ width: '100%', height: 38, borderRadius: 8, border: '1.5px solid #E5E7EB' }} /></Field>
          </div>
          <Field label="Gradient CSS (optionnel — remplace le dégradé iFilino par défaut)">
            <input style={fieldStyle} value={form.gradient} onChange={e => set('gradient', e.target.value)} placeholder="linear-gradient(135deg, #FF8A00, #FF5D00)" />
            {form.gradient && <div style={{ marginTop: 6, height: 24, borderRadius: 6, background: form.gradient }} />}
          </Field>
        </div>

        {/* ── Programmation ── */}
        <div className="if-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                <PremiumIcon name="close" size={14} /> Effacer
              </button>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>Laissez les heures vides pour un affichage toute la journée. Couvre aussi les campagnes saisonnières (Ramadan, Aïd, Coupe du Monde…) — programmez simplement la plage de dates concernée.</div>
          {form.start_time && form.end_time && form.start_time === form.end_time && (
            <div style={{ fontSize: 11.5, color: '#DC2626', background: '#FEF2F2', padding: '8px 10px', borderRadius: 8 }}>
              <PremiumIcon name="alert" size={14} style={{ verticalAlign: 'text-bottom', marginRight: 5 }} /> Heure début = heure fin ({form.start_time}) : le slide ne sera visible qu'à cette minute précise chaque jour. Effacez les heures pour un affichage sans restriction horaire.
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

        {/* ── Ciblage ── */}
        <div className="if-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h6 style={{ margin: 0, fontWeight: 800 }}>Ciblage</h6>
          <Field label="Segment client">
            <select style={fieldStyle} value={form.target_segment} onChange={e => set('target_segment', e.target.value)}>
              {SEGMENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Langue"><input style={fieldStyle} value={form.target_language} onChange={e => set('target_language', e.target.value)} placeholder="fr, ar, en… (vide = toutes)" /></Field>
          <Field label="Connecté / Invité">
            <select style={fieldStyle} value={form.target_auth} onChange={e => set('target_auth', e.target.value)}>
              {AUTH_TARGETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>

          <div style={{ borderTop: '1px dashed #E5E7EB', paddingTop: 12, marginTop: 4 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#9CA3AF', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><PremiumIcon name="lock" size={14} /> Bientôt disponible — champs enregistrés mais pas encore filtrés</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: .55 }}>
              {[
                ['target_country', 'Pays'], ['target_city', 'Ville'], ['target_quartier', 'Quartier'],
                ['target_purchase_category', 'Historique d\'achat (catégorie)'], ['target_favorite_category', 'Catégorie favorite'],
              ].map(([field, label]) => (
                <Field key={field} label={label}>
                  <input disabled style={fieldStyle} title="Bientôt disponible — ce ciblage n'est pas encore actif" placeholder="Bientôt disponible" />
                </Field>
              ))}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#6B7280' }} title="Bientôt disponible">
                <input type="checkbox" disabled /> Utilisateurs Premium
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#6B7280' }} title="Bientôt disponible">
                <input type="checkbox" disabled /> Mode Famille
              </label>
            </div>
          </div>
        </div>

        {/* ── A/B ── */}
        <div className="if-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h6 style={{ margin: 0, fontWeight: 800 }}>Test A/B (variantes)</h6>
          <Field label="Groupe de campagne (identique entre variantes)">
            <input style={fieldStyle} value={form.campaign_group_id} onChange={e => set('campaign_group_id', e.target.value)} placeholder="ex: promo_ramadan_2026" />
          </Field>
          <Field label="Seuil d'impressions avant recommandation">
            <input type="number" min={1} style={fieldStyle} value={form.ab_impression_threshold} onChange={e => set('ab_impression_threshold', Number(e.target.value))} />
          </Field>
          <div style={{ fontSize: 11.5, color: '#D97706', background: '#FFFBEB', padding: '8px 10px', borderRadius: 8 }}>
            <PremiumIcon name="alert" size={14} style={{ verticalAlign: 'text-bottom', marginRight: 5 }} /> N'activez qu'une seule variante à la fois pour comparer leurs performances (test séquentiel, pas un vrai partage aléatoire de trafic).
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 24, maxWidth: 1100 }}>
        <button className="if-btn if-btn-outline" disabled={saving} onClick={() => handleSave(false)}><PremiumIcon name="save" size={15} /> Enregistrer</button>
        <button className="if-btn if-btn-primary" disabled={saving || !form.title.trim()} onClick={() => handleSave(true)}><PremiumIcon name="rocket" size={15} /> Enregistrer et publier</button>
      </div>

      <Toast msg={msg} kind={kind} onClose={() => setMsg('')} />
    </HeroManagerLayout>
  );
}
