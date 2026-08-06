import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Toast } from '../components/ui/Toast';
import { useLeafletMap } from '../shared/hooks/useLeafletMap';

const ZONE_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4'];
function colorForZoneId(id) { return ZONE_COLORS[id % ZONE_COLORS.length]; }

const RULE_TYPES = [
  { value: 'fixed',          label: 'Prix fixe' },
  { value: 'per_distance',   label: 'Prix par distance' },
  { value: 'dynamic_surge',  label: 'Prix dynamique (heures de pointe)' },
  { value: 'free_threshold', label: 'Livraison gratuite dès un montant' },
  { value: 'off_peak',       label: 'Heures creuses' },
];

const cardStyle = { background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 14 };
const inputStyle = { width: '100%', padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' };
const labelStyle = { fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4 };
// Un enfant de grille CSS a `min-width: auto` par défaut : le contenu d'un
// <select>/<input> peut forcer la piste au-delà de minmax(...,1fr) et faire
// déborder la page sur mobile — voir VehicleDocumentsPanel.jsx pour le détail.
const gridItemStyle = { minWidth: 0 };

export default function DeliveryZonesPricingPage() {
  const { get, post, patch, del } = useApi();
  const [tab, setTab] = useState('zones');
  const [zones, setZones] = useState([]);
  const [rules, setRules] = useState([]);
  const [msg, setMsg] = useState('');
  const [msgKind, setMsgKind] = useState('success');
  const [saving, setSaving] = useState(false);

  const [zoneForm, setZoneForm] = useState({ name: '', center_lat: null, center_lng: null, radius_km: 5, base_fee: '', per_km_fee: '', priority: 0 });
  const [ruleForm, setRuleForm] = useState({ name: '', type: 'fixed', base_amount: '', per_km_amount: '', zone_id: '', min_order_for_free: '', priority: 0 });
  const [gpsLoading, setGpsLoading] = useState(false);

  const {
    containerRef: zoneMapRef, setMarker: setZoneMarker, removeMarker: removeZoneMarker,
    setCircle: setZoneCircle, removeCircle: removeZoneCircle, setOnMapClick, panTo: panZoneMap,
  } = useLeafletMap({ zoom: 12 });

  function toast(m, kind = 'success') { setMsg(m); setMsgKind(kind); }

  async function loadZones() { try { const d = await get('/delivery/zones'); setZones(d.zones || []); } catch {} }
  async function loadRules() { try { const d = await get('/delivery/pricing-rules'); setRules(d.rules || []); } catch {} }
  useEffect(() => { loadZones(); loadRules(); }, []);

  // Placer/déplacer le centre en cliquant sur la carte.
  useEffect(() => {
    setOnMapClick((lat, lng) => setZoneForm(f => ({ ...f, center_lat: lat, center_lng: lng })));
  }, [setOnMapClick]);

  // Cercle "brouillon" (zone en cours de création) — orange, marqueur déplaçable.
  useEffect(() => {
    if (zoneForm.center_lat == null || zoneForm.center_lng == null) return;
    setZoneCircle('draft', { lat: zoneForm.center_lat, lng: zoneForm.center_lng, radiusKm: Number(zoneForm.radius_km) || 0.1, color: '#FF8A00', fillOpacity: 0.18 });
    setZoneMarker('draft', {
      lat: zoneForm.center_lat, lng: zoneForm.center_lng, html: '📍', draggable: true,
      onDragEnd: (lat, lng) => setZoneForm(f => ({ ...f, center_lat: lat, center_lng: lng })),
    });
  }, [zoneForm.center_lat, zoneForm.center_lng, zoneForm.radius_km, setZoneCircle, setZoneMarker]);

  // Zones déjà existantes affichées en superposition (contexte visuel pendant
  // la création d'une nouvelle zone — couleurs neutres, non éditables ici).
  useEffect(() => {
    zones.forEach(z => {
      setZoneCircle(`zone-${z.id}`, {
        lat: Number(z.center_lat), lng: Number(z.center_lng), radiusKm: Number(z.radius_km),
        color: colorForZoneId(z.id), fillOpacity: 0.08, dashArray: z.is_active ? undefined : '4 4',
        popupHtml: `<strong>${z.name}</strong><br/>${z.radius_km} km`,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones]);

  function detectZoneGps() {
    if (!navigator.geolocation) { toast('Géolocalisation non supportée', 'error'); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setZoneForm(f => ({ ...f, center_lat: pos.coords.latitude, center_lng: pos.coords.longitude }));
        panZoneMap(pos.coords.latitude, pos.coords.longitude, 14);
        setGpsLoading(false);
      },
      () => { toast('Position indisponible', 'error'); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function createZone(e) {
    e.preventDefault();
    if (zoneForm.center_lat == null || zoneForm.center_lng == null) { toast('Cliquez sur la carte pour placer le centre de la zone', 'error'); return; }
    setSaving(true);
    try {
      await post('/delivery/zones', {
        name: zoneForm.name, center_lat: zoneForm.center_lat, center_lng: zoneForm.center_lng,
        radius_km: Number(zoneForm.radius_km),
        base_fee: zoneForm.base_fee !== '' ? Number(zoneForm.base_fee) : undefined,
        per_km_fee: zoneForm.per_km_fee !== '' ? Number(zoneForm.per_km_fee) : undefined,
        priority: Number(zoneForm.priority) || 0,
      });
      toast('Zone créée');
      removeZoneCircle('draft');
      removeZoneMarker('draft');
      setZoneForm({ name: '', center_lat: null, center_lng: null, radius_km: 5, base_fee: '', per_km_fee: '', priority: 0 });
      loadZones();
    } catch (err) { toast(err.message || 'Erreur', 'error'); }
    setSaving(false);
  }

  async function toggleZone(zone) {
    try { await patch(`/delivery/zones/${zone.id}`, { is_active: !zone.is_active }); loadZones(); } catch (err) { toast(err.message, 'error'); }
  }
  async function deleteZone(id) {
    try { await del(`/delivery/zones/${id}`); toast('Zone supprimée'); loadZones(); } catch (err) { toast(err.message, 'error'); }
  }

  async function createRule(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await post('/delivery/pricing-rules', {
        name: ruleForm.name, type: ruleForm.type, base_amount: Number(ruleForm.base_amount) || 0,
        per_km_amount: ruleForm.per_km_amount !== '' ? Number(ruleForm.per_km_amount) : undefined,
        zone_id: ruleForm.zone_id !== '' ? Number(ruleForm.zone_id) : undefined,
        min_order_for_free: ruleForm.min_order_for_free !== '' ? Number(ruleForm.min_order_for_free) : undefined,
        priority: Number(ruleForm.priority) || 0,
      });
      toast('Règle créée');
      setRuleForm({ name: '', type: 'fixed', base_amount: '', per_km_amount: '', zone_id: '', min_order_for_free: '', priority: 0 });
      loadRules();
    } catch (err) { toast(err.message || 'Erreur', 'error'); }
    setSaving(false);
  }

  async function toggleRule(rule) {
    try { await patch(`/delivery/pricing-rules/${rule.id}`, { is_active: !rule.is_active }); loadRules(); } catch (err) { toast(err.message, 'error'); }
  }
  async function deleteRule(id) {
    try { await del(`/delivery/pricing-rules/${id}`); toast('Règle supprimée'); loadRules(); } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <Toast message={msg} onClose={() => setMsg('')} kind={msgKind} />
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-title">🗺️ Zones & Tarification livraison</div>
        <div className="page-subtitle">Sans règle configurée, le tarif plat actuel du commerce reste appliqué — rien ne change tant que vous ne créez rien ici.</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['zones', '🗺️ Zones'], ['pricing', '💰 Tarification']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '8px 16px', borderRadius: 8, border: '1.5px solid', cursor: 'pointer', fontWeight: 700, fontSize: 13,
            borderColor: tab === k ? 'var(--rb-orange,#FF8A00)' : '#E5E7EB',
            background: tab === k ? '#FFF7ED' : '#fff',
            color: tab === k ? 'var(--rb-orange,#FF8A00)' : '#6B7280',
          }}>{l}</button>
        ))}
      </div>

      {tab === 'zones' && (
        <div>
          <form onSubmit={createZone} style={cardStyle}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Nouvelle zone</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
              Cliquez sur la carte pour placer le centre, glissez le marqueur pour l'ajuster, réglez le rayon avec le curseur.
            </div>

            <div style={{ position: 'relative', marginBottom: 12 }}>
              <div ref={zoneMapRef} style={{ height: 320, width: '100%', borderRadius: 10, overflow: 'hidden', border: '1.5px solid #E5E7EB' }} />
              <button type="button" onClick={detectZoneGps} disabled={gpsLoading} style={{
                position: 'absolute', top: 10, right: 10, zIndex: 500,
                padding: '7px 12px', borderRadius: 8, border: 'none', cursor: gpsLoading ? 'default' : 'pointer',
                background: '#fff', color: '#2563EB', fontSize: 12, fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,.15)',
              }}>
                {gpsLoading ? '⏳…' : '📍 Ma position'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 10 }}>
              <div style={gridItemStyle}><label style={labelStyle}>Nom</label><input required style={inputStyle} value={zoneForm.name} onChange={e => setZoneForm({ ...zoneForm, name: e.target.value })} placeholder="Centre-ville" /></div>
              <div style={gridItemStyle}>
                <label style={labelStyle}>Rayon : {Number(zoneForm.radius_km).toFixed(1)} km</label>
                <input type="range" min="0.5" max="30" step="0.5" style={{ width: '100%' }}
                  value={zoneForm.radius_km} onChange={e => setZoneForm({ ...zoneForm, radius_km: e.target.value })} />
              </div>
              <div style={gridItemStyle}><label style={labelStyle}>Frais de base (MAD)</label><input type="number" step="0.01" style={inputStyle} value={zoneForm.base_fee} onChange={e => setZoneForm({ ...zoneForm, base_fee: e.target.value })} /></div>
              <div style={gridItemStyle}><label style={labelStyle}>Frais / km (MAD)</label><input type="number" step="0.01" style={inputStyle} value={zoneForm.per_km_fee} onChange={e => setZoneForm({ ...zoneForm, per_km_fee: e.target.value })} /></div>
              <div style={gridItemStyle}><label style={labelStyle}>Priorité</label><input type="number" style={inputStyle} value={zoneForm.priority} onChange={e => setZoneForm({ ...zoneForm, priority: e.target.value })} /></div>
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10 }}>
              {zoneForm.center_lat != null ? `Centre : ${zoneForm.center_lat.toFixed(5)}, ${zoneForm.center_lng.toFixed(5)}` : 'Centre non placé — cliquez sur la carte'}
            </div>
            <button disabled={saving} style={{ padding: '9px 18px', background: 'var(--rb-orange,#FF8A00)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
              {saving ? '…' : '+ Créer la zone'}
            </button>
          </form>

          {zones.map(z => (
            <div key={z.id} style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, opacity: z.is_active ? 1 : 0.5 }}>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ fontWeight: 700, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: colorForZoneId(z.id), flexShrink: 0 }} />
                  {z.name} {z.organization_id == null && <span style={{ fontSize: 10, background: '#EFF6FF', color: '#2563EB', padding: '2px 6px', borderRadius: 6, marginLeft: 6 }}>RÉSEAU</span>}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', wordBreak: 'break-word' }}>Centre {Number(z.center_lat).toFixed(4)}, {Number(z.center_lng).toFixed(4)} · rayon {z.radius_km} km · priorité {z.priority}</div>
                {(z.base_fee != null || z.per_km_fee != null) && <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>💰 {z.base_fee ?? 0} MAD{z.per_km_fee ? ` + ${z.per_km_fee} MAD/km` : ''}</div>}
              </div>
              <div style={{ display: 'flex', flexShrink: 0, gap: 6 }}>
                <button onClick={() => toggleZone(z)} style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer' }}>{z.is_active ? 'Désactiver' : 'Activer'}</button>
                <button onClick={() => deleteZone(z.id)} style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #FCA5A5', color: '#DC2626', background: '#fff', cursor: 'pointer' }}>Suppr.</button>
              </div>
            </div>
          ))}
          {zones.length === 0 && <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 20 }}>Aucune zone configurée.</div>}
        </div>
      )}

      {tab === 'pricing' && (
        <div>
          <form onSubmit={createRule} style={cardStyle}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Nouvelle règle de tarification</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 10 }}>
              <div style={gridItemStyle}><label style={labelStyle}>Nom</label><input required style={inputStyle} value={ruleForm.name} onChange={e => setRuleForm({ ...ruleForm, name: e.target.value })} placeholder="Tarif standard" /></div>
              <div style={gridItemStyle}>
                <label style={labelStyle}>Type</label>
                <select style={inputStyle} value={ruleForm.type} onChange={e => setRuleForm({ ...ruleForm, type: e.target.value })}>
                  {RULE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div style={gridItemStyle}><label style={labelStyle}>Montant de base (MAD)</label><input required type="number" step="0.01" style={inputStyle} value={ruleForm.base_amount} onChange={e => setRuleForm({ ...ruleForm, base_amount: e.target.value })} /></div>
              {ruleForm.type === 'per_distance' && (
                <div style={gridItemStyle}><label style={labelStyle}>Montant / km (MAD)</label><input type="number" step="0.01" style={inputStyle} value={ruleForm.per_km_amount} onChange={e => setRuleForm({ ...ruleForm, per_km_amount: e.target.value })} /></div>
              )}
              {ruleForm.type === 'free_threshold' && (
                <div style={gridItemStyle}><label style={labelStyle}>Gratuit dès (MAD)</label><input type="number" step="0.01" style={inputStyle} value={ruleForm.min_order_for_free} onChange={e => setRuleForm({ ...ruleForm, min_order_for_free: e.target.value })} /></div>
              )}
              <div style={gridItemStyle}>
                <label style={labelStyle}>Zone (optionnel)</label>
                <select style={inputStyle} value={ruleForm.zone_id} onChange={e => setRuleForm({ ...ruleForm, zone_id: e.target.value })}>
                  <option value="">Toutes zones</option>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>
              <div style={gridItemStyle}><label style={labelStyle}>Priorité</label><input type="number" style={inputStyle} value={ruleForm.priority} onChange={e => setRuleForm({ ...ruleForm, priority: e.target.value })} /></div>
            </div>
            <button disabled={saving} style={{ padding: '9px 18px', background: 'var(--rb-orange,#FF8A00)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
              {saving ? '…' : '+ Créer la règle'}
            </button>
          </form>

          {rules.map(r => (
            <div key={r.id} style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, opacity: r.is_active ? 1 : 0.5 }}>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{r.name} {r.organization_id == null && <span style={{ fontSize: 10, background: '#EFF6FF', color: '#2563EB', padding: '2px 6px', borderRadius: 6, marginLeft: 6 }}>RÉSEAU</span>}</div>
                <div style={{ fontSize: 12, color: '#6B7280', wordBreak: 'break-word' }}>{RULE_TYPES.find(t => t.value === r.type)?.label || r.type} · {Number(r.base_amount).toFixed(2)} MAD{r.per_km_amount ? ` + ${r.per_km_amount} MAD/km` : ''} · priorité {r.priority}</div>
              </div>
              <div style={{ display: 'flex', flexShrink: 0, gap: 6 }}>
                <button onClick={() => toggleRule(r)} style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer' }}>{r.is_active ? 'Désactiver' : 'Activer'}</button>
                <button onClick={() => deleteRule(r.id)} style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #FCA5A5', color: '#DC2626', background: '#fff', cursor: 'pointer' }}>Suppr.</button>
              </div>
            </div>
          ))}
          {rules.length === 0 && <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 20 }}>Aucune règle configurée — le tarif plat du commerce s'applique.</div>}
        </div>
      )}
    </div>
  );
}
