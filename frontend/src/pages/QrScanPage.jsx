import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { StatusBadge } from '../components/ui/Badge';
import { Toast } from '../components/ui/Toast';

function formatDate() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function QrScanPage() {
  const { post, get } = useApi();
  const [code, setCode]         = useState('');
  const [matricule, setMatricule] = useState('');
  const [date, setDate]         = useState(formatDate());
  const [preview, setPreview]   = useState(null);
  const [msg, setMsg]           = useState('');
  const [kind, setKind]         = useState('info');
  const [validating, setValidating] = useState(false);

  function notify(text, k='info') { setMsg(text); setKind(k); }

  async function lookupByCode() {
    const c = code.trim().toUpperCase();
    if (!c) return notify('Saisissez un code.', 'error');
    try {
      const d = await get(`/reservations/lookup-order?order_code=${encodeURIComponent(c)}`);
      const byCat = {};
      (d.lignes || []).forEach(l => { byCat[(l.category||'').replace(/^entree$/,'entrée')] = l.item; });
      setPreview({ order_code: d.order_code, date_jour: d.date_jour, matricule: d.matricule, nom: d.nom, items: byCat });
    } catch (e) { notify(e.message, 'error'); setPreview(null); }
  }

  async function lookupByMatricule() {
    const m = matricule.trim();
    if (!m) return notify('Saisissez un matricule.', 'error');
    try {
      const raw = await get(`/reservations/day?date=${date}&status=confirmed&view=list`);
      const rows = (raw.items || []).filter(r => r.matricule.toLowerCase() === m.toLowerCase());
      if (!rows.length) return notify('Aucune commande confirmée.', 'error');
      const byCat = {};
      rows.forEach(r => { byCat[(r.category||'').replace(/^entree$/,'entrée')] = r.label; });
      setPreview({ order_code: rows[0].order_code, date_jour: date, matricule: m, nom: rows[0].nom, items: byCat });
    } catch (e) { notify(e.message, 'error'); setPreview(null); }
  }

  async function validate() {
    if (!preview?.order_code) return;
    setValidating(true);
    try {
      const d = await post('/reservations/redeem-order', { order_code: preview.order_code });
      notify(`Validée — ${d.updated} plat(s) servi(s).`, 'success');
      setPreview(null); setCode(''); setMatricule('');
    } catch (e) { notify(e.message, 'error'); }
    finally { setValidating(false); }
  }

  return (
    <>
      <Toast msg={msg} kind={kind} onClose={() => setMsg('')} />

      <div className="card p-3">
        <h5 className="mb-3">Validation QR / Matricule</h5>
        <div className="row g-3">
          {/* Par code QR */}
          <div className="col-12 col-md-6">
            <label className="form-label small fw-semibold">Code de commande (QR scan)</label>
            <div className="input-group">
              <input className="form-control" placeholder="ex. A1B2C3D4E5" value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && lookupByCode()} />
              <button className="btn btn-outline-primary" onClick={lookupByCode}>Chercher</button>
            </div>
          </div>

          {/* Par matricule */}
          <div className="col-12 col-md-6">
            <label className="form-label small fw-semibold">Matricule + date</label>
            <div className="input-group">
              <input className="form-control" placeholder="Matricule" value={matricule}
                onChange={e => setMatricule(e.target.value)} />
              <input type="date" className="form-control" value={date}
                onChange={e => setDate(e.target.value)} style={{maxWidth:150}} />
              <button className="btn btn-outline-secondary" onClick={lookupByMatricule}>Chercher</button>
            </div>
          </div>
        </div>
      </div>

      {preview && (
        <div className="card p-3 border-primary">
          <h6 className="mb-3">Aperçu de la commande</h6>
          <div className="mb-2">
            <strong>{preview.nom || preview.matricule}</strong>
            <code className="ms-2">{preview.order_code}</code>
            <span className="text-secondary ms-2 small">{preview.date_jour}</span>
          </div>
          <div className="row g-2 mb-3">
            {Object.entries(preview.items).map(([cat, label]) => (
              <div key={cat} className="col-6 col-md-3">
                <div className="card p-2 bg-body-tertiary border-0">
                  <div className="text-secondary" style={{fontSize:11}}>{cat}</div>
                  <div className="fw-semibold small">{label}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-success" onClick={validate} disabled={validating}>
              {validating ? 'Validation…' : '✓ Valider le repas'}
            </button>
            <button className="btn btn-outline-secondary" onClick={() => setPreview(null)}>Annuler</button>
          </div>
        </div>
      )}
    </>
  );
}
