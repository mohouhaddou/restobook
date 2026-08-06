import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Toast } from '../../shared/components/ui/Toast';
import { PERMISSIONS } from '../../modules/core/permissions';
import { usePosApi } from './posApi';
import { PremiumIcon } from '../../shared/components/ui/PremiumIcon';

function useToast() {
  const [toast, setToast] = useState(null);
  const show = (msg, kind = 'success') => { setToast({ msg, kind }); setTimeout(() => setToast(null), 4000); };
  return { toast, show };
}

function fmt(n) { return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function StatBox({ label, value, color }) {
  return (
    <div className="if-card" style={{ padding: '16px 18px', flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-muted)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || 'var(--il-text)', marginTop: 4 }}>{value}</div>
    </div>
  );
}

export default function PosSessionPage() {
  const { user, hasPermission } = useAuth();
  const api = usePosApi();
  const { toast, show } = useToast();

  const [session, setSession] = useState(undefined); // undefined = chargement, null = aucune session
  const [openingAmount, setOpeningAmount] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [notes, setNotes] = useState('');
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);

  const canClose = hasPermission(PERMISSIONS.POS_SESSION_CLOSE);
  const canViewReport = hasPermission(PERMISSIONS.POS_REPORT_VIEW);

  const load = useCallback(() => {
    api.getCurrentSession().then(d => setSession(d.session || null)).catch(() => setSession(null));
    if (canViewReport) {
      api.dailyReport().then(setReport).catch(() => {});
    }
  }, [api, canViewReport]);

  useEffect(() => { load(); }, [load]);

  async function handleOpen(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.openSession(Number(openingAmount || 0));
      show('Caisse ouverte');
      setOpeningAmount('');
      load();
    } catch (e2) { show(e2.message, 'error'); }
    setBusy(false);
  }

  async function handleClose(e) {
    e.preventDefault();
    if (countedCash === '') { show('Montant compté requis', 'error'); return; }
    setBusy(true);
    try {
      const d = await api.closeSession(Number(countedCash), notes || undefined);
      const diff = Number(d.session.cash_difference);
      show(diff === 0 ? 'Caisse fermée — aucun écart' : `Caisse fermée — écart de ${fmt(diff)} MAD`, diff === 0 ? 'success' : 'warning');
      setCountedCash(''); setNotes('');
      load();
    } catch (e2) { show(e2.message, 'error'); }
    setBusy(false);
  }

  if (session === undefined) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--il-muted)' }}>Chargement…</div>;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
      <Toast msg={toast?.msg} kind={toast?.kind} />
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 10 }}><PremiumIcon name="database" size={24} /> Session caisse</h2>
      <p style={{ color: 'var(--il-muted)', marginBottom: 20 }}>Ouvrez la caisse avant de vendre, fermez-la en fin de service.</p>

      {!session ? (
        <form onSubmit={handleOpen} className="if-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Ouvrir la caisse</h3>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Montant d'ouverture (fond de caisse)</label>
          <input
            type="number" min="0" step="0.01" value={openingAmount}
            onChange={e => setOpeningAmount(e.target.value)}
            placeholder="0.00"
            style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--il-radius-sm)', border: '1.5px solid var(--il-border)', fontSize: 16, marginBottom: 16 }}
          />
          <button type="submit" disabled={busy} className="if-btn if-btn-primary if-btn-lg" style={{ width: '100%' }}>
            {busy ? 'Ouverture…' : 'Ouvrir la caisse'}
          </button>
        </form>
      ) : (
        <>
          <div className="if-card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Session ouverte</h3>
              <span style={{ fontSize: 12, color: 'var(--il-muted)' }}>Depuis {new Date(session.opened_at).toLocaleTimeString('fr-FR')}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <StatBox label="Fond de caisse" value={`${fmt(session.opening_amount)} MAD`} />
              <StatBox label="Espèces" value={`${fmt(session.total_cash)} MAD`} color="var(--il-success)" />
              <StatBox label="Carte" value={`${fmt(session.total_card)} MAD`} color="var(--il-info)" />
              <StatBox label="Crédit" value={`${fmt(session.total_credit)} MAD`} color="var(--il-warning)" />
              <StatBox label="Ventes" value={session.sales_count} />
            </div>
          </div>

          {report && (
            <div className="if-card" style={{ padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, display: 'inline-flex', alignItems: 'center', gap: 8 }}><PremiumIcon name="chart" size={18} /> Résumé du jour</h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <StatBox label="Chiffre d'affaires" value={`${fmt(report.totals.revenue)} MAD`} color="var(--il-primary)" />
                <StatBox label="Nb ventes" value={report.totals.count} />
              </div>
            </div>
          )}

          {canClose ? (
            <form onSubmit={handleClose} className="if-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Fermer la caisse</h3>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Montant réel compté en caisse</label>
              <input
                type="number" min="0" step="0.01" value={countedCash}
                onChange={e => setCountedCash(e.target.value)}
                placeholder="0.00"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--il-radius-sm)', border: '1.5px solid var(--il-border)', fontSize: 16, marginBottom: 12 }}
              />
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Notes (optionnel)</label>
              <textarea
                value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--il-radius-sm)', border: '1.5px solid var(--il-border)', fontSize: 14, marginBottom: 16, resize: 'vertical' }}
              />
              <button type="submit" disabled={busy} className="if-btn if-btn-danger if-btn-lg" style={{ width: '100%' }}>
                {busy ? 'Fermeture…' : 'Fermer la caisse'}
              </button>
            </form>
          ) : (
            <div className="if-card" style={{ padding: 20, color: 'var(--il-muted)', fontSize: 13, textAlign: 'center' }}>
              Seul un manager ou le propriétaire peut fermer la caisse.
            </div>
          )}
        </>
      )}
    </div>
  );
}
