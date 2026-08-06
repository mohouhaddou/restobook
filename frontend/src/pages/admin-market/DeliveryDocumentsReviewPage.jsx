import React, { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { ASSET } from '../../api';
import { DashboardIcon } from '../../shared/components/ui/DashboardIcon';
import { PremiumIcon } from '../../shared/components/ui/PremiumIcon';

const STATUS_TABS = [
  { value: 'pending',  label: 'En attente', icon: 'clock' },
  { value: 'verified', label: 'Vérifiés', icon: 'check' },
  { value: 'expired',  label: 'Expirés', icon: 'alert' },
  { value: 'rejected', label: 'Refusés', icon: 'close' },
];

const DOCUMENT_TYPE_LABELS = {
  license: 'Permis de conduire', national_id: 'Carte nationale', insurance: 'Assurance',
  registration_card: 'Carte grise', background_check: 'Extrait de casier', other: 'Autre',
};

const cardStyle = { background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 12 };

export default function DeliveryDocumentsReviewPage() {
  const { get, patch } = useApi();
  const [status, setStatus] = useState('pending');
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    try {
      const d = await get(`/delivery/documents?status=${status}`);
      setDocuments(d.documents || []);
    } catch {}
    setLoading(false);
  }
  useEffect(() => { load(); }, [status]);

  async function verify(id) {
    try { await patch(`/delivery/documents/${id}/verify`, {}); setMsg('Document vérifié'); load(); }
    catch (e) { setMsg(e.message); }
  }
  async function reject(id) {
    const notes = window.prompt('Motif du refus (optionnel) :') || undefined;
    try { await patch(`/delivery/documents/${id}/reject`, { notes }); setMsg('Document refusé'); load(); }
    catch (e) { setMsg(e.message); }
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><PremiumIcon name="fileText" size={22} /> Vérification des documents livreurs</div>
        <div className="page-subtitle">Un document expiré exclut automatiquement le livreur du dispatch — voir la colonne statut.</div>
      </div>

      {msg && <div style={{ padding: '8px 12px', background: '#FFF7ED', borderRadius: 8, fontSize: 13, marginBottom: 12, color: '#B45309' }}>{msg}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {STATUS_TABS.map(t => (
          <button key={t.value} onClick={() => setStatus(t.value)} style={{
            padding: '8px 16px', borderRadius: 8, border: '1.5px solid', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6,
            borderColor: status === t.value ? 'var(--rb-orange,#FF8A00)' : '#E5E7EB',
            background: status === t.value ? '#FFF7ED' : '#fff',
            color: status === t.value ? 'var(--rb-orange,#FF8A00)' : '#6B7280',
          }}><DashboardIcon icon={t.icon} size={14} /> {t.label}</button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 30, color: '#9CA3AF' }}>Chargement…</div> : documents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 30, color: '#9CA3AF' }}>Aucun document dans cette catégorie.</div>
      ) : documents.map(doc => (
        <div key={doc.id} style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>{DOCUMENT_TYPE_LABELS[doc.type] || doc.type}</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2, wordBreak: 'break-word' }}>
              {doc.deliveryPerson?.user?.nom || doc.deliveryPerson?.user?.matricule || `Livreur #${doc.delivery_person_id}`}
              {doc.number && ` · N° ${doc.number}`}
              {doc.expires_at && ` · Expire le ${new Date(doc.expires_at).toLocaleDateString('fr-FR')}`}
            </div>
            {doc.file_url && <a href={ASSET(doc.file_url)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--rb-orange,#FF8A00)' }}>Voir le fichier</a>}
          </div>
          {status === 'pending' && (
            <div style={{ display: 'flex', flexShrink: 0, gap: 8 }}>
              <button onClick={() => reject(doc.id)} style={{ padding: '7px 14px', border: '1px solid #FCA5A5', color: '#DC2626', background: '#fff', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>Refuser</button>
              <button onClick={() => verify(doc.id)} style={{ padding: '7px 14px', border: 'none', color: '#fff', background: '#16A34A', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>Valider</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
