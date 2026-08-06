import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import { API, ASSET } from '../../api';
import { Toast } from '../../components/ui/Toast';
import { AdsManagerLayout } from './AdsManagerLayout';
import { PremiumIcon } from '../../shared/components/ui/PremiumIcon';

const SOURCE_TYPES = [['internal', 'Interne iFilino'], ['partner', 'Partenaire / annonceur'], ['adsense', 'Google AdSense']];
const STATUSES = [['draft', 'Brouillon'], ['scheduled', 'Planifiée'], ['active', 'Active'], ['paused', 'Suspendue'], ['expired', 'Terminée'], ['archived', 'Archivée']];
const AD_FORMATS = [['auto', 'Auto'], ['rectangle', 'Rectangle'], ['horizontal', 'Horizontal'], ['vertical', 'Vertical'], ['fluid', 'Fluid']];
const PLATFORMS = ['global', 'homepage', 'marketplace', 'discover', 'play', 'user_dashboard'];
const ROUTE_TYPES = [['all', 'Toutes les pages'], ['exact', 'Route exacte'], ['prefix', 'Préfixe de route'], ['pattern', 'Motif (ex: /discover/*, /product/:slug)']];
const LANGUAGES = [['all', 'Toutes'], ['fr', 'Français'], ['ar', 'Arabe'], ['en', 'Anglais']];
const DEVICES = [['all', 'Tous'], ['desktop', 'Desktop'], ['tablet', 'Tablette'], ['mobile', 'Mobile']];
const AUDIENCES = [['all', 'Tous les visiteurs'], ['guest', 'Non connectés'], ['logged_in', 'Connectés']];
const FALLBACK_TYPES = [['none', 'Aucune publicité'], ['internal_default', 'Campagne interne par défaut'], ['adsense', 'Bloc AdSense']];
const CONSENT_LEVELS = [['none', 'Aucun'], ['analytics', 'Analytics'], ['advertising', 'Publicité (tiers)']];

const DEFAULT_FORM = {
  name: '', advertiser_name: '', source_type: 'internal', description: '', status: 'draft',
  title: '', desktop_image_url: '', mobile_image_url: '', alt_text: '', destination_url: '', button_text: '',
  open_in_new_tab: true, sponsored: true, background_color: '', advertiser_logo_url: '',
  publisher_id: '', ad_slot_id: '', ad_format: 'auto', responsive: true, full_width_responsive: true,
  start_at: '', end_at: '', timezone: 'Africa/Casablanca', priority: 0, rotation_weight: 1,
  max_impressions: '', max_clicks: '', frequency_cap: '', session_cap: '',
  fallback_type: 'none', requires_consent: 'none',
  placement_ids: [], targeting_rules: [],
};

const fieldStyle = { width: '100%', padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 13.5, boxSizing: 'border-box' };
const labelStyle = { fontSize: 12.5, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 };
function Field({ label, children }) { return <div><label style={labelStyle}>{label}</label>{children}</div>; }

function ImageDropzone({ label, hint, field, value, onUploaded, token }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState(null);
  const [error, setError] = useState('');
  const uploadFieldMap = { desktop_image_url: 'desktop_image', mobile_image_url: 'mobile_image', advertiser_logo_url: 'advertiser_logo' };

  async function handleFile(file) {
    if (!file) return;
    setLocalPreview(URL.createObjectURL(file));
    setUploading(true); setError('');
    try {
      const fd = new FormData();
      fd.append(uploadFieldMap[field], file);
      const res = await fetch(API('/superadmin/ads/upload'), { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Échec de l'upload");
      onUploaded(data[field]);
    } catch (e) { setError(e.message); }
    setUploading(false);
  }

  const displaySrc = localPreview || (value ? ASSET(value) : null);
  const inputId = `ads-upload-${field}`;

  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
        onClick={() => document.getElementById(inputId).click()}
        style={{ position: 'relative', borderRadius: 12, border: `2px dashed ${dragOver ? '#FF8A00' : '#E5E7EB'}`, background: dragOver ? '#FFF7ED' : '#FAFAFA', minHeight: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer' }}
      >
        <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={e => handleFile(e.target.files?.[0])} />
        {displaySrc ? <img src={displaySrc} alt="" style={{ width: '100%', height: 100, objectFit: 'cover' }} /> : (
          <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 12.5, padding: 10 }}>
            <PremiumIcon name="upload" size={18} style={{ marginBottom: 6 }} /><div>Glissez ou cliquez</div><div>{hint}</div>
          </div>
        )}
        {uploading && <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>Compression WebP…</div>}
      </div>
      {error && <div style={{ fontSize: 11.5, color: '#DC2626', marginTop: 4 }}>{error}</div>}
      {value && !uploading && <button type="button" onClick={() => { onUploaded(''); setLocalPreview(null); }} style={{ marginTop: 6, fontSize: 11.5, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><PremiumIcon name="trash" size={13} /> Retirer</button>}
    </div>
  );
}

function TargetingRuleRow({ rule, onChange, onRemove }) {
  return (
    <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, position: 'relative' }}>
      <button type="button" onClick={onRemove} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer' }}><PremiumIcon name="close" size={14} /></button>
      <Field label="Plateforme">
        <select style={fieldStyle} value={rule.platform || ''} onChange={e => onChange({ ...rule, platform: e.target.value || null })}>
          <option value="">Toutes (déjà limité par emplacements)</option>
          {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </Field>
      <Field label="Ciblage de route">
        <select style={fieldStyle} value={rule.route_type} onChange={e => onChange({ ...rule, route_type: e.target.value })}>
          {ROUTE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      {rule.route_type !== 'all' && (
        <Field label="Motif de route">
          <input style={fieldStyle} value={rule.route_pattern || ''} onChange={e => onChange({ ...rule, route_pattern: e.target.value })} placeholder="/discover/*" />
        </Field>
      )}
      <Field label="Langue">
        <select style={fieldStyle} value={rule.language || 'all'} onChange={e => onChange({ ...rule, language: e.target.value })}>
          {LANGUAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field label="Appareil">
        <select style={fieldStyle} value={rule.device || 'all'} onChange={e => onChange({ ...rule, device: e.target.value })}>
          {DEVICES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field label="Audience">
        <select style={fieldStyle} value={rule.audience_type || 'all'} onChange={e => onChange({ ...rule, audience_type: e.target.value })}>
          {AUDIENCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field label="Pays (optionnel, code ISO2)">
        <input style={fieldStyle} value={rule.country || ''} onChange={e => onChange({ ...rule, country: e.target.value.toUpperCase().slice(0, 2) })} placeholder="MA" />
      </Field>
      <Field label="Ville (optionnel)">
        <input style={fieldStyle} value={rule.city || ''} onChange={e => onChange({ ...rule, city: e.target.value })} placeholder="Casablanca" />
      </Field>
    </div>
  );
}

// Aperçu visuel simplifié — pas un éditeur de page : les emplacements sont
// regroupés par leur champ "position" (top/sidebar/bottom/inline...) dans une
// silhouette de page, cliquables pour (dés)assigner la campagne.
function bucketOf(position) {
  const p = (position || '').toLowerCase();
  if (p.includes('top')) return 'top';
  if (p.includes('sidebar')) return 'sidebar';
  if (p.includes('bottom')) return 'bottom';
  return 'content';
}

function PreviewZone({ label, placements, selectedIds, onToggle, style }) {
  return (
    <div style={{ border: '1.5px dashed #D1D5DB', borderRadius: 8, padding: 8, background: '#FAFAFA', ...style }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', marginBottom: 6, textTransform: 'uppercase' }}>{label}</div>
      {placements.length === 0 ? (
        <div style={{ fontSize: 11, color: '#D1D5DB' }}>Aucun emplacement ici</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {placements.map(p => {
            const active = selectedIds.includes(p.id);
            return (
              <button key={p.id} type="button" onClick={() => onToggle(p.id)}
                style={{ textAlign: 'left', fontSize: 11, padding: '5px 8px', borderRadius: 6, border: `1.5px solid ${active ? '#FF8A00' : '#E5E7EB'}`, background: active ? '#FFF7ED' : '#fff', color: active ? '#B45309' : '#6B7280', cursor: 'pointer', fontWeight: active ? 700 : 500 }}>
                {active && <PremiumIcon name="check" size={11} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />}{p.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PagePreview({ placements, selectedIds, onToggle, deviceView }) {
  const byBucket = { top: [], sidebar: [], bottom: [], content: [] };
  placements.forEach(p => byBucket[bucketOf(p.position)].push(p));
  const isMobile = deviceView === 'mobile';
  const width = deviceView === 'desktop' ? 640 : deviceView === 'tablet' ? 460 : 300;

  return (
    <div style={{ width, maxWidth: '100%', border: '1px solid #E5E7EB', borderRadius: 14, padding: 10, background: '#fff', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <PreviewZone label="Haut de page" placements={byBucket.top} selectedIds={selectedIds} onToggle={onToggle} />
      <div style={{ display: 'flex', gap: 8 }}>
        <PreviewZone label="Contenu" placements={byBucket.content} selectedIds={selectedIds} onToggle={onToggle} style={{ flex: 1, minHeight: 100 }} />
        {!isMobile && <PreviewZone label="Barre latérale" placements={byBucket.sidebar} selectedIds={selectedIds} onToggle={onToggle} style={{ width: 130 }} />}
      </div>
      {isMobile && byBucket.sidebar.length > 0 && (
        <div style={{ fontSize: 10, color: '#9CA3AF', fontStyle: 'italic' }}>Barre latérale masquée/repositionnée sur mobile (configuration du slot).</div>
      )}
      <PreviewZone label="Bas de page" placements={byBucket.bottom} selectedIds={selectedIds} onToggle={onToggle} />
    </div>
  );
}

export default function AdCampaignEditorPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { get, post, put } = useApi();
  const { token } = useAuth();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [placements, setPlacements] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(''); const [kind, setKind] = useState('success');
  const [deviceView, setDeviceView] = useState('desktop');

  useEffect(() => {
    get('/superadmin/ad-placements').then(d => setPlacements(d.placements || [])).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isEdit) return;
    get(`/superadmin/ads/${id}`).then(d => {
      const c = d.campaign;
      setForm({
        ...DEFAULT_FORM, ...c,
        start_at: c.start_at ? c.start_at.slice(0, 16) : '',
        end_at: c.end_at ? c.end_at.slice(0, 16) : '',
        placement_ids: (c.placements || []).map(p => p.id),
        targeting_rules: (c.targetingRules || []).map(r => ({ ...r })),
      });
      setLoading(false);
    }).catch(e => { setMsg(e.message); setKind('error'); setLoading(false); });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function set(field, value) { setForm(prev => ({ ...prev, [field]: value })); }
  function togglePlacement(pid) {
    set('placement_ids', form.placement_ids.includes(pid) ? form.placement_ids.filter(x => x !== pid) : [...form.placement_ids, pid]);
  }
  function addTargetingRule() {
    set('targeting_rules', [...form.targeting_rules, { platform: null, route_type: 'all', route_pattern: '', language: 'all', device: 'all', audience_type: 'all', country: '', city: '' }]);
  }
  function updateTargetingRule(i, next) {
    const rules = [...form.targeting_rules]; rules[i] = next; set('targeting_rules', rules);
  }
  function removeTargetingRule(i) {
    set('targeting_rules', form.targeting_rules.filter((_, idx) => idx !== i));
  }

  async function handleSave(andPublish) {
    setSaving(true);
    try {
      const payload = { ...form, status: andPublish ? 'active' : form.status };
      for (const k of ['max_impressions', 'max_clicks', 'frequency_cap', 'session_cap']) {
        payload[k] = payload[k] === '' ? null : Number(payload[k]);
      }
      payload.start_at = payload.start_at ? new Date(payload.start_at).toISOString() : null;
      payload.end_at = payload.end_at ? new Date(payload.end_at).toISOString() : null;
      const res = isEdit ? await put(`/superadmin/ads/${id}`, payload) : await post('/superadmin/ads', payload);
      setMsg(isEdit ? 'Campagne mise à jour.' : 'Campagne créée.'); setKind('success');
      if (!isEdit) navigate(`/superadmin/ads/${res.campaign.id}/edit`);
    } catch (e) { setMsg(e.message); setKind('error'); }
    setSaving(false);
  }

  const isAdsense = form.source_type === 'adsense';

  if (loading) return <AdsManagerLayout title="Publicités" icon="radio"><div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Chargement…</div></AdsManagerLayout>;

  return (
    <AdsManagerLayout
      title={isEdit ? 'Modifier la publicité' : 'Nouvelle publicité'} icon="radio"
      actions={<button className="if-btn if-btn-outline if-btn-sm" onClick={() => navigate('/superadmin/ads')}>← Retour à la liste</button>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, maxWidth: 1200 }}>

        {/* ── Informations générales ── */}
        <div className="if-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h6 style={{ margin: 0, fontWeight: 800 }}>Informations générales</h6>
          <Field label="Nom de la campagne *"><input style={fieldStyle} value={form.name} onChange={e => set('name', e.target.value)} /></Field>
          <Field label="Nom de l'annonceur"><input style={fieldStyle} value={form.advertiser_name || ''} onChange={e => set('advertiser_name', e.target.value)} /></Field>
          <Field label="Type de source *">
            <select style={fieldStyle} value={form.source_type} onChange={e => set('source_type', e.target.value)}>
              {SOURCE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Description interne (jamais affichée)"><textarea style={{ ...fieldStyle, minHeight: 60 }} value={form.description || ''} onChange={e => set('description', e.target.value)} /></Field>
          <Field label="Statut">
            <select style={fieldStyle} value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        </div>

        {!isAdsense ? (
          <div className="if-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h6 style={{ margin: 0, fontWeight: 800 }}>Contenu créatif</h6>
            <Field label="Titre"><input style={fieldStyle} value={form.title || ''} onChange={e => set('title', e.target.value)} /></Field>
            <Field label="Texte alternatif (accessibilité)"><input style={fieldStyle} value={form.alt_text || ''} onChange={e => set('alt_text', e.target.value)} /></Field>
            <ImageDropzone label="Image desktop" hint="ex: 1200×400" field="desktop_image_url" value={form.desktop_image_url} onUploaded={url => set('desktop_image_url', url)} token={token} />
            <ImageDropzone label="Image mobile (optionnelle)" hint="ex: 600×400" field="mobile_image_url" value={form.mobile_image_url} onUploaded={url => set('mobile_image_url', url)} token={token} />
            <ImageDropzone label="Logo annonceur (optionnel)" hint="carré" field="advertiser_logo_url" value={form.advertiser_logo_url} onUploaded={url => set('advertiser_logo_url', url)} token={token} />
            <Field label="URL de destination"><input style={fieldStyle} value={form.destination_url || ''} onChange={e => set('destination_url', e.target.value)} placeholder="https://…" /></Field>
            <Field label="Texte du bouton"><input style={fieldStyle} value={form.button_text || ''} onChange={e => set('button_text', e.target.value)} placeholder="En savoir plus" /></Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}><input type="checkbox" checked={form.open_in_new_tab} onChange={e => set('open_in_new_tab', e.target.checked)} /> Ouvrir dans un nouvel onglet</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}><input type="checkbox" checked={form.sponsored} onChange={e => set('sponsored', e.target.checked)} /> Afficher la mention « Sponsorisé »</label>
            <Field label="Couleur d'arrière-plan (optionnelle)"><input type="color" value={form.background_color || '#ffffff'} onChange={e => set('background_color', e.target.value)} style={{ width: '100%', height: 38, borderRadius: 8, border: '1.5px solid #E5E7EB' }} /></Field>
          </div>
        ) : (
          <div className="if-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h6 style={{ margin: 0, fontWeight: 800 }}>Bloc Google AdSense</h6>
            <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>Seuls ces paramètres sont enregistrés — aucun script personnalisé n'est jamais accepté.</div>
            <Field label="Publisher ID"><input style={fieldStyle} value={form.publisher_id || ''} onChange={e => set('publisher_id', e.target.value)} placeholder="pub-XXXXXXXXXXXXXXXX" /></Field>
            <Field label="Ad Slot ID"><input style={fieldStyle} value={form.ad_slot_id || ''} onChange={e => set('ad_slot_id', e.target.value)} /></Field>
            <Field label="Format">
              <select style={fieldStyle} value={form.ad_format || 'auto'} onChange={e => set('ad_format', e.target.value)}>
                {AD_FORMATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}><input type="checkbox" checked={form.responsive} onChange={e => set('responsive', e.target.checked)} /> Responsive</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}><input type="checkbox" checked={form.full_width_responsive} onChange={e => set('full_width_responsive', e.target.checked)} /> Full-width responsive</label>
          </div>
        )}

        {/* ── Emplacements ── */}
        <div className="if-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h6 style={{ margin: 0, fontWeight: 800 }}>Emplacements</h6>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
            {placements.map(p => {
              const checked = form.placement_ids.includes(p.id);
              return (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '6px 8px', borderRadius: 8, background: checked ? '#FFF7ED' : 'transparent', cursor: 'pointer' }}>
                  <input type="checkbox" checked={checked} onChange={() => togglePlacement(p.id)} /> {p.name} <span style={{ color: '#9CA3AF' }}>({p.platform})</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* ── Planification & diffusion ── */}
        <div className="if-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h6 style={{ margin: 0, fontWeight: 800 }}>Planification & diffusion</h6>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Début"><input type="datetime-local" style={fieldStyle} value={form.start_at || ''} onChange={e => set('start_at', e.target.value)} /></Field>
            <Field label="Fin"><input type="datetime-local" style={fieldStyle} value={form.end_at || ''} onChange={e => set('end_at', e.target.value)} /></Field>
          </div>
          <Field label="Fuseau horaire"><input style={fieldStyle} value={form.timezone} onChange={e => set('timezone', e.target.value)} placeholder="Africa/Casablanca" /></Field>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Priorité"><input type="number" style={fieldStyle} value={form.priority} onChange={e => set('priority', Number(e.target.value))} /></Field>
            <Field label="Poids de rotation"><input type="number" min={1} style={fieldStyle} value={form.rotation_weight} onChange={e => set('rotation_weight', Number(e.target.value))} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Impressions max"><input type="number" style={fieldStyle} value={form.max_impressions ?? ''} onChange={e => set('max_impressions', e.target.value)} /></Field>
            <Field label="Clics max"><input type="number" style={fieldStyle} value={form.max_clicks ?? ''} onChange={e => set('max_clicks', e.target.value)} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Fréquence max / utilisateur"><input type="number" style={fieldStyle} value={form.frequency_cap ?? ''} onChange={e => set('frequency_cap', e.target.value)} /></Field>
            <Field label="Limite / session"><input type="number" style={fieldStyle} value={form.session_cap ?? ''} onChange={e => set('session_cap', e.target.value)} /></Field>
          </div>
          <Field label="Fallback si aucune éligible">
            <select style={fieldStyle} value={form.fallback_type} onChange={e => set('fallback_type', e.target.value)}>
              {FALLBACK_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Consentement requis">
            <select style={fieldStyle} value={form.requires_consent} onChange={e => set('requires_consent', e.target.value)}>
              {CONSENT_LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        </div>

        {/* ── Ciblage ── */}
        <div className="if-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10, gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h6 style={{ margin: 0, fontWeight: 800 }}>Règles de ciblage</h6>
            <button type="button" className="if-btn if-btn-outline if-btn-sm" onClick={addTargetingRule}><PremiumIcon name="plus" size={13} /> Ajouter une règle</button>
          </div>
          <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>Aucune règle = diffusée sur toutes les pages des emplacements sélectionnés. Plusieurs règles = diffusée si au moins une règle correspond.</div>
          {form.targeting_rules.length === 0 ? (
            <div style={{ fontSize: 12.5, color: '#9CA3AF', fontStyle: 'italic' }}>Aucune règle de ciblage — diffusion sans restriction.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {form.targeting_rules.map((r, i) => (
                <TargetingRuleRow key={i} rule={r} onChange={next => updateTargetingRule(i, next)} onRemove={() => removeTargetingRule(i)} />
              ))}
            </div>
          )}
        </div>

        {/* ── Aperçu visuel ── */}
        <div className="if-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10, gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <h6 style={{ margin: 0, fontWeight: 800 }}>Aperçu de position</h6>
            <div style={{ display: 'flex', gap: 6 }}>
              {['desktop', 'tablet', 'mobile'].map(d => (
                <button key={d} type="button" onClick={() => setDeviceView(d)}
                  className={`if-btn if-btn-sm ${deviceView === d ? 'if-btn-primary' : 'if-btn-outline'}`}>{d}</button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>Cliquez sur une zone pour (dés)assigner cet emplacement à la campagne. Ceci n'est pas un éditeur de page — juste une aide visuelle.</div>
          <PagePreview placements={placements} selectedIds={form.placement_ids} onToggle={togglePlacement} deviceView={deviceView} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 24, maxWidth: 1200 }}>
        <button className="if-btn if-btn-outline" disabled={saving} onClick={() => handleSave(false)}><PremiumIcon name="save" size={15} /> Enregistrer</button>
        <button className="if-btn if-btn-primary" disabled={saving || !form.name.trim()} onClick={() => handleSave(true)}><PremiumIcon name="rocket" size={15} /> Enregistrer et activer</button>
      </div>

      <Toast msg={msg} kind={kind} onClose={() => setMsg('')} />
    </AdsManagerLayout>
  );
}
