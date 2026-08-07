import React, { useEffect, useState } from 'react';
import { useApi } from '../../../hooks/useApi';
import { useAuth } from '../../../contexts/AuthContext';
import { API, ASSET } from '../../../api';
import { PremiumIcon } from '../../../shared/components/ui/PremiumIcon';

const VEHICLE_TYPES = [
  { value: 'foot',    label: 'À pied', icon: 'user' },
  { value: 'bike',    label: 'Vélo', icon: 'bike' },
  { value: 'scooter', label: 'Scooter', icon: 'bike' },
  { value: 'moto',    label: 'Moto', icon: 'bike' },
  { value: 'car',     label: 'Voiture', icon: 'car' },
  { value: 'van',     label: 'Camionnette', icon: 'truck' },
];

const DOCUMENT_TYPES = [
  { value: 'license',           label: 'Permis de conduire' },
  { value: 'national_id',       label: 'Carte nationale' },
  { value: 'insurance',         label: 'Assurance' },
  { value: 'registration_card', label: 'Carte grise' },
  { value: 'background_check',  label: 'Extrait de casier' },
  { value: 'other',             label: 'Autre' },
];

const STATUS_META = {
  pending:  { label: 'En attente de vérification', color: '#6B7280', bg: '#F9FAFB' },
  verified: { label: 'Vérifié',                     color: '#16A34A', bg: '#F0FDF4' },
  rejected: { label: 'Refusé',                       color: '#DC2626', bg: '#FEF2F2' },
  expired:  { label: 'Expiré',                       color: '#DC2626', bg: '#FEF2F2' },
};

const cardStyle = { background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 12 };
const inputStyle = { width: '100%', padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' };
const labelStyle = { fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4 };
// Les enfants d'une grille CSS ont `min-width: auto` par défaut : leur
// contenu (un <select> avec de longues options, un <input type=date/file>)
// peut alors forcer la piste de grille au-delà de la largeur de l'écran,
// même avec `minmax(120px,1fr)` — c'était la vraie cause du débordement
// mobile (le fix précédent ne couvrait que les lignes flex, pas ces formulaires).
const gridItemStyle = { minWidth: 0 };

export default function VehicleDocumentsPanel() {
  const { get, post } = useApi();
  const { token } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({ type: 'moto', brand: '', plate_number: '', capacity_l: '', max_weight_kg: '' });
  const [docForm, setDocForm] = useState({ type: 'license', number: '', issued_at: '', expires_at: '' });
  const [docFile, setDocFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    try {
      const [v, d] = await Promise.all([get('/delivery/vehicles/me'), get('/delivery/documents/me')]);
      setVehicles(v.vehicles || []);
      setDocuments(d.documents || []);
    } catch {}
  }
  useEffect(() => { load(); }, []);

  const activeVehicle = vehicles.find(v => v.is_active) || vehicles[0];

  async function saveVehicle(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await post('/delivery/vehicles', {
        type: vehicleForm.type, brand: vehicleForm.brand || undefined, plate_number: vehicleForm.plate_number || undefined,
        capacity_l: vehicleForm.capacity_l !== '' ? Number(vehicleForm.capacity_l) : undefined,
        max_weight_kg: vehicleForm.max_weight_kg !== '' ? Number(vehicleForm.max_weight_kg) : undefined,
      });
      setMsg('Véhicule enregistré');
      setShowVehicleForm(false);
      load();
    } catch (err) { setMsg(err.message || 'Erreur'); }
    setSaving(false);
  }

  async function uploadDocument(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('type', docForm.type);
      if (docForm.number) formData.append('number', docForm.number);
      if (docForm.issued_at) formData.append('issued_at', docForm.issued_at);
      if (docForm.expires_at) formData.append('expires_at', docForm.expires_at);
      if (docFile) formData.append('file', docFile);

      // Upload multipart — ne passe pas par useApi().post (force du JSON),
      // fetch direct pour laisser le navigateur fixer le boundary multipart.
      const res = await fetch(API('/delivery/documents'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur upload');

      setMsg('Document déposé');
      setDocForm({ type: 'license', number: '', issued_at: '', expires_at: '' });
      setDocFile(null);
      load();
    } catch (err) { setMsg(err.message || 'Erreur'); }
    setSaving(false);
  }

  return (
    <div>
      {msg && <div style={{ padding: '8px 12px', background: '#FFF7ED', borderRadius: 8, fontSize: 13, marginBottom: 12, color: '#B45309' }}>{msg}</div>}

      {/* Véhicule */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}><PremiumIcon name="car" size={18} /> Mon véhicule</div>
          <button onClick={() => setShowVehicleForm(s => !s)} style={{ fontSize: 12, border: 'none', background: 'none', color: 'var(--rb-orange,#FF8A00)', fontWeight: 700, cursor: 'pointer' }}>
            {activeVehicle ? 'Changer' : '+ Déclarer'}
          </button>
        </div>
        {activeVehicle && !showVehicleForm && (
          <div style={{ fontSize: 14, color: '#374151' }}>
            {VEHICLE_TYPES.find(t => t.value === activeVehicle.type)?.label || activeVehicle.type}
            {activeVehicle.brand && ` · ${activeVehicle.brand}`}
            {activeVehicle.plate_number && ` · ${activeVehicle.plate_number}`}
          </div>
        )}
        {!activeVehicle && !showVehicleForm && <div style={{ fontSize: 13, color: '#9CA3AF' }}>Aucun véhicule déclaré.</div>}
        {showVehicleForm && (
          <form onSubmit={saveVehicle}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 10 }}>
              <div style={gridItemStyle}>
                <label style={labelStyle}>Type</label>
                <select style={inputStyle} value={vehicleForm.type} onChange={e => setVehicleForm({ ...vehicleForm, type: e.target.value })}>
                  {VEHICLE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div style={gridItemStyle}><label style={labelStyle}>Marque</label><input style={inputStyle} value={vehicleForm.brand} onChange={e => setVehicleForm({ ...vehicleForm, brand: e.target.value })} /></div>
              <div style={gridItemStyle}><label style={labelStyle}>Immatriculation</label><input style={inputStyle} value={vehicleForm.plate_number} onChange={e => setVehicleForm({ ...vehicleForm, plate_number: e.target.value })} /></div>
              <div style={gridItemStyle}><label style={labelStyle}>Capacité (L)</label><input type="number" style={inputStyle} value={vehicleForm.capacity_l} onChange={e => setVehicleForm({ ...vehicleForm, capacity_l: e.target.value })} /></div>
              <div style={gridItemStyle}><label style={labelStyle}>Poids max (kg)</label><input type="number" style={inputStyle} value={vehicleForm.max_weight_kg} onChange={e => setVehicleForm({ ...vehicleForm, max_weight_kg: e.target.value })} /></div>
            </div>
            <button disabled={saving} style={{ padding: '8px 16px', background: 'var(--rb-orange,#FF8A00)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
              {saving ? '…' : 'Enregistrer'}
            </button>
          </form>
        )}
      </div>

      {/* Documents */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 8 }}><PremiumIcon name="fileText" size={18} /> Mes documents</div>
        <form onSubmit={uploadDocument} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 10 }}>
            <div style={gridItemStyle}>
              <label style={labelStyle}>Type de document</label>
              <select style={inputStyle} value={docForm.type} onChange={e => setDocForm({ ...docForm, type: e.target.value })}>
                {DOCUMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div style={gridItemStyle}><label style={labelStyle}>Numéro</label><input style={inputStyle} value={docForm.number} onChange={e => setDocForm({ ...docForm, number: e.target.value })} /></div>
            <div style={gridItemStyle}><label style={labelStyle}>Date d'expiration</label><input type="date" style={inputStyle} value={docForm.expires_at} onChange={e => setDocForm({ ...docForm, expires_at: e.target.value })} /></div>
            <div style={gridItemStyle}>
              <label style={labelStyle}>Photo / scan (image ou PDF)</label>
              <input type="file" accept="image/*,application/pdf" style={{ fontSize: 12, width: '100%', boxSizing: 'border-box' }} onChange={e => setDocFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <button disabled={saving} style={{ padding: '8px 16px', background: '#16A34A', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            {saving ? '…' : 'Déposer le document'}
          </button>
        </form>

        {documents.length === 0 ? (
          <div style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '12px 0' }}>Aucun document déposé.</div>
        ) : documents.map(doc => {
          const meta = STATUS_META[doc.status] || STATUS_META.pending;
          return (
            <div key={doc.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{DOCUMENT_TYPES.find(t => t.value === doc.type)?.label || doc.type}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF', wordBreak: 'break-word' }}>
                  {doc.expires_at ? `Expire le ${new Date(doc.expires_at).toLocaleDateString('fr-FR')}` : 'Pas de date d\'expiration'}
                  {doc.file_url && <> · <a href={ASSET(doc.file_url)} target="_blank" rel="noreferrer" style={{ color: 'var(--rb-orange,#FF8A00)' }}>Voir le fichier</a></>}
                </div>
              </div>
              <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: meta.color, background: meta.bg, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>{meta.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
