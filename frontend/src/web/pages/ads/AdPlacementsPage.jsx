import React, { useEffect, useState } from 'react';
import { useApi } from '../../../hooks/useApi';
import { Toast } from '../../../components/ui/Toast';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { AdsManagerLayout } from './AdsManagerLayout';
import { PremiumIcon } from '../../../shared/components/ui/PremiumIcon';

const PLATFORMS = ['global', 'homepage', 'marketplace', 'discover', 'play', 'user_dashboard'];
const DEVICES = ['desktop', 'tablet', 'mobile'];

const EMPTY_FORM = {
  code: '', name: '', description: '', platform: 'global', position: '',
  recommended_desktop_size: '', recommended_mobile_size: '', supported_devices: [...DEVICES], max_ads: 1, is_active: true,
};

const inputStyle = { minHeight: 36, border: '1px solid #D1D5DB', borderRadius: 8, padding: '6px 10px', fontSize: 13 };
const th = { padding: 10, textAlign: 'left' };
const td = { padding: 10, borderTop: '1px solid #F3F4F6' };

export default function AdPlacementsPage() {
  const { get, post, put, del } = useApi();
  const [placements, setPlacements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState(''); const [kind, setKind] = useState('success');
  const [pendingDelete, setPendingDelete] = useState(null);

  function load() {
    setLoading(true);
    get('/superadmin/ad-placements').then(d => { setPlacements(d.placements || []); setLoading(false); })
      .catch(e => { setMsg(e.message); setKind('error'); setLoading(false); });
  }
  useEffect(() => { load(); }, []);

  function set(field, value) { setForm(prev => ({ ...prev, [field]: value })); }

  async function handleSave() {
    if (!form.code.trim() || !form.name.trim()) { setMsg('Code et nom sont obligatoires.'); setKind('error'); return; }
    try {
      if (editingId) await put(`/superadmin/ad-placements/${editingId}`, form);
      else await post('/superadmin/ad-placements', form);
      setMsg(editingId ? 'Emplacement mis à jour.' : 'Emplacement créé.'); setKind('success');
      setForm(EMPTY_FORM); setEditingId(null);
      load();
    } catch (e) { setMsg(e.message); setKind('error'); }
  }

  function handleEdit(p) {
    setForm({ ...EMPTY_FORM, ...p, supported_devices: Array.isArray(p.supported_devices) ? p.supported_devices : DEVICES });
    setEditingId(p.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    try { await del(`/superadmin/ad-placements/${id}`); setMsg('Emplacement supprimé.'); setKind('success'); load(); }
    catch (e) { setMsg(e.message); setKind('error'); }
  }

  function toggleDevice(d) {
    set('supported_devices', form.supported_devices.includes(d) ? form.supported_devices.filter(x => x !== d) : [...form.supported_devices, d]);
  }

  return (
    <AdsManagerLayout title="Emplacements publicitaires" icon="radio">
      <div className="if-card" style={{ padding: 18, marginBottom: 16 }}>
        <h6 style={{ margin: '0 0 14px', fontWeight: 800 }}>{editingId ? `Modifier l'emplacement #${editingId}` : 'Nouvel emplacement'}</h6>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, color: '#4B5563' }}>
            Code (identifiant unique) *
            <input style={inputStyle} value={form.code} onChange={e => set('code', e.target.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'))} placeholder="ex: below_header" disabled={!!editingId} />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, color: '#4B5563' }}>
            Nom affiché *
            <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="ex: Sous le header" />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, color: '#4B5563' }}>
            Plateforme
            <select style={inputStyle} value={form.platform} onChange={e => set('platform', e.target.value)}>
              {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, color: '#4B5563' }}>
            Position (libellé libre)
            <input style={inputStyle} value={form.position || ''} onChange={e => set('position', e.target.value)} placeholder="top, sidebar, inline…" />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, color: '#4B5563' }}>
            Dimensions recommandées (desktop)
            <input style={inputStyle} value={form.recommended_desktop_size || ''} onChange={e => set('recommended_desktop_size', e.target.value)} placeholder="728x90" />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, color: '#4B5563' }}>
            Dimensions recommandées (mobile)
            <input style={inputStyle} value={form.recommended_mobile_size || ''} onChange={e => set('recommended_mobile_size', e.target.value)} placeholder="320x100" />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, color: '#4B5563' }}>
            Nombre maximal de publicités
            <input type="number" min={1} style={inputStyle} value={form.max_ads} onChange={e => set('max_ads', Number(e.target.value))} />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, color: '#4B5563' }}>
            Description
            <input style={inputStyle} value={form.description || ''} onChange={e => set('description', e.target.value)} />
          </label>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#4B5563', marginBottom: 6 }}>Appareils compatibles</div>
          <div style={{ display: 'flex', gap: 14 }}>
            {DEVICES.map(d => (
              <label key={d} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                <input type="checkbox" checked={form.supported_devices.includes(d)} onChange={() => toggleDevice(d)} /> {d}
              </label>
            ))}
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, marginTop: 12 }}>
          <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} /> Actif
        </label>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button className="if-btn if-btn-primary if-btn-sm" onClick={handleSave}>{editingId ? 'Enregistrer' : 'Créer'}</button>
          {editingId && <button className="if-btn if-btn-outline if-btn-sm" onClick={() => { setForm(EMPTY_FORM); setEditingId(null); }}>Annuler</button>}
        </div>
      </div>

      <div className="if-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720, fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F9FAFB', color: '#4B5563', fontSize: 11.5 }}>
                <th style={th}>Code</th><th style={th}>Nom</th><th style={th}>Plateforme</th>
                <th style={th}>Position</th><th style={th}>Max annonces</th><th style={th}>Statut</th><th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 16, textAlign: 'center', color: '#6B7280' }}>Chargement…</td></tr>
              ) : placements.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 16, textAlign: 'center', color: '#6B7280' }}>Aucun emplacement.</td></tr>
              ) : placements.map(p => (
                <tr key={p.id}>
                  <td style={td}><code>{p.code}</code></td>
                  <td style={td}>{p.name}</td>
                  <td style={td}>{p.platform}</td>
                  <td style={td}>{p.position || '—'}</td>
                  <td style={td}>{p.max_ads}</td>
                  <td style={td}>{p.is_active ? 'Actif' : 'Inactif'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <button className="if-btn if-btn-outline if-btn-sm" onClick={() => handleEdit(p)}><PremiumIcon name="edit" size={13} /></button>{' '}
                    <button className="if-btn if-btn-outline if-btn-sm" style={{ color: '#DC2626', borderColor: '#DC2626' }} onClick={() => setPendingDelete(p)}><PremiumIcon name="trash" size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        show={!!pendingDelete}
        title="Supprimer cet emplacement ?"
        message={`« ${pendingDelete?.name} » sera supprimé (refusé si des campagnes y sont encore assignées).`}
        confirmLabel="Supprimer" confirmClass="btn-danger"
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />

      <Toast msg={msg} kind={kind} onClose={() => setMsg('')} />
    </AdsManagerLayout>
  );
}
