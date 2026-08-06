import React, { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { API } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { Toast } from '../../components/ui/Toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { EmptyState } from '../../components/ui/EmptyState';
import { InfraLayout } from './InfraLayout';

function fmtBytes(n) {
  if (n == null) return '—';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let i = 0, v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}

export default function InfraBackupsPage() {
  const { get, post } = useApi();
  const { token } = useAuth();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [msg, setMsg] = useState(''); const [kind, setKind] = useState('success');

  function load() {
    get('/superadmin/infra/backups').then(d => { setBackups(d.backups || []); setLoading(false); }).catch(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function createBackup() {
    setConfirmCreate(false);
    setCreating(true);
    try {
      const res = await post('/superadmin/infra/backups', {});
      setMsg(`Sauvegarde créée : ${res.filename} (${fmtBytes(res.size_bytes)})`); setKind('success');
      load();
    } catch (e) { setMsg(e.message); setKind('error'); }
    setCreating(false);
  }

  function download(filename) {
    // Téléchargement authentifié : le lien direct n'a pas d'en-tête Bearer,
    // on récupère donc le blob via fetch puis on déclenche le download.
    fetch(API(`/superadmin/infra/backups/${encodeURIComponent(filename)}/download`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => { setMsg('Échec du téléchargement'); setKind('error'); });
  }

  const last = backups[0];

  return (
    <InfraLayout title="Sauvegardes" icon="🗂️" actions={
      <button className="if-btn if-btn-primary if-btn-sm" onClick={() => setConfirmCreate(true)} disabled={creating}>
        {creating ? 'Création en cours…' : '+ Créer une sauvegarde'}
      </button>
    }>
      <div className="if-card" style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--il-muted)', fontWeight: 700, marginBottom: 10 }}>Dernière sauvegarde</div>
        {last ? (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div><div style={{ fontSize: 11, color: 'var(--il-muted)' }}>Fichier</div><div style={{ fontWeight: 700, color: 'var(--il-text)' }}>{last.filename}</div></div>
            <div><div style={{ fontSize: 11, color: 'var(--il-muted)' }}>Taille</div><div style={{ fontWeight: 700, color: 'var(--il-text)' }}>{fmtBytes(last.size_bytes)}</div></div>
            <div><div style={{ fontSize: 11, color: 'var(--il-muted)' }}>Date</div><div style={{ fontWeight: 700, color: 'var(--il-text)' }}>{new Date(last.created_at).toLocaleString('fr-FR')}</div></div>
            <div><div style={{ fontSize: 11, color: 'var(--il-muted)' }}>Destination</div><div style={{ fontWeight: 700, color: 'var(--il-text)' }}>/var/www/restobook/backups/</div></div>
          </div>
        ) : (
          <div style={{ color: 'var(--il-muted)', fontSize: 13 }}>Aucune sauvegarde pour l'instant.</div>
        )}
      </div>

      <div className="if-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--il-border)', fontWeight: 800, color: 'var(--il-text)' }}>Historique</div>
        {loading ? (
          <div style={{ padding: 20, color: 'var(--il-muted)' }}>Chargement…</div>
        ) : backups.length === 0 ? (
          <EmptyState icon="🗂️" title="Aucune sauvegarde" />
        ) : (
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <tbody>
              {backups.map(b => (
                <tr key={b.filename} style={{ borderBottom: '1px solid var(--il-border)' }}>
                  <td style={{ padding: '10px 18px', fontFamily: 'monospace', color: 'var(--il-text2)' }}>{b.filename}</td>
                  <td style={{ padding: '10px 18px', color: 'var(--il-muted)' }}>{new Date(b.created_at).toLocaleString('fr-FR')}</td>
                  <td style={{ padding: '10px 18px', color: 'var(--il-text)', fontWeight: 700 }}>{fmtBytes(b.size_bytes)}</td>
                  <td style={{ padding: '10px 18px', textAlign: 'right' }}>
                    <button className="if-btn if-btn-outline if-btn-sm" onClick={() => download(b.filename)}>⬇ Télécharger</button>
                    <button className="if-btn if-btn-outline if-btn-sm" style={{ marginLeft: 6, opacity: .5, cursor: 'not-allowed' }} disabled title="Bientôt disponible">Restaurer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        show={confirmCreate}
        title="Créer une sauvegarde"
        message="Cela va exécuter un mysqldump de la base et archiver le dossier uploads. L'opération peut prendre quelques secondes."
        confirmLabel="Créer"
        confirmClass="btn-primary"
        onCancel={() => setConfirmCreate(false)}
        onConfirm={createBackup}
      />
      <Toast msg={msg} kind={kind} onClose={() => setMsg('')} />
    </InfraLayout>
  );
}
