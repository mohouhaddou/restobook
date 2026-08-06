import React, { useEffect, useState } from 'react';
import { useApi } from '../../shared/hooks/useApi';

const MODES = [['sandbox', 'Sandbox (test)'], ['production', 'Production']];

/**
 * SuperAdmin "Paiements" — active/configure les fournisseurs de paiement (table
 * payment_providers, voir backend/src/modules/payments/). Un card par provider, dont les champs
 * de config (Client ID/Secret pour PayPal, Client-side Token/API Key pour Paddle...) sont rendus
 * GÉNÉRIQUEMENT à partir du schéma `fields` renvoyé par GET /superadmin/payments/providers (voir
 * backend/src/modules/payments/providerFields.js) — ajouter un futur provider n'exige jamais de
 * modifier ce composant, seulement backend/src/modules/payments/PaymentProvider.js.
 */
export default function PaymentsAdminPage() {
  const api = useApi();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState('');
  const [drafts, setDrafts] = useState({}); // provider -> { enabled, mode, default_currency, config: { [fieldKey]: value } }

  function load() {
    setLoading(true);
    api.get('/superadmin/payments/providers')
      .then(({ providers: rows }) => {
        setProviders(rows);
        const nextDrafts = {};
        for (const row of rows) {
          const config = {};
          for (const field of row.fields || []) {
            // Un secret n'est jamais pré-rempli — laisser vide = conserver la valeur existante.
            config[field.key] = field.secret ? '' : (row.config?.[field.key] || '');
          }
          nextDrafts[row.provider] = {
            enabled: row.enabled,
            mode: row.mode,
            default_currency: row.default_currency,
            config,
          };
        }
        setDrafts(nextDrafts);
      })
      .catch(error => setMessage(error.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function setDraft(provider, patch) {
    setDrafts(prev => ({ ...prev, [provider]: { ...prev[provider], ...patch } }));
  }

  function setDraftField(provider, key, value) {
    setDrafts(prev => ({ ...prev, [provider]: { ...prev[provider], config: { ...prev[provider].config, [key]: value } } }));
  }

  async function save(provider) {
    const draft = drafts[provider];
    setSaving(provider); setMessage('');
    try {
      const body = {
        enabled: draft.enabled,
        mode: draft.mode,
        default_currency: draft.default_currency,
        config: draft.config,
      };
      await api.put(`/superadmin/payments/providers/${provider}`, body);
      setMessage(`${provider} enregistré.`);
      load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving('');
    }
  }

  return (
    <div className="app-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Paiements</h1>
          <p className="page-subtitle">Activez et configurez les fournisseurs de paiement — modifiable sans redéploiement.</p>
        </div>
      </div>
      {message && <div className="alert alert-info" role="status">{message}</div>}

      {loading ? <p>Chargement…</p> : (
        <div style={{ display: 'grid', gap: 20, maxWidth: 640 }}>
          {providers.map(row => {
            const draft = drafts[row.provider] || {};
            return (
              <div key={row.provider} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ margin: 0, fontSize: 18, textTransform: 'capitalize' }}>{row.provider}</h2>
                  <label className="portal-admin-check" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={!!draft.enabled} onChange={e => setDraft(row.provider, { enabled: e.target.checked })}/>
                    Activé
                  </label>
                </div>

                {row.provider === 'paypal' && (
                  <p style={{ fontSize: 12.5, color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 12px', margin: 0 }}>
                    PayPal ne supporte pas le MAD (dirham marocain) comme devise de transaction —
                    utilisez une devise supportée (USD, EUR…) pour les produits payables via PayPal.
                  </p>
                )}

                <div style={{ display: 'flex', gap: 12 }}>
                  <label className="form-label" style={{ flex: 1 }}>Mode
                    <select className="form-select" value={draft.mode || 'sandbox'} onChange={e => setDraft(row.provider, { mode: e.target.value })}>
                      {MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                  <label className="form-label" style={{ width: 120 }}>Devise par défaut
                    <input className="form-control" maxLength={3} value={draft.default_currency || ''} onChange={e => setDraft(row.provider, { default_currency: e.target.value.toUpperCase() })}/>
                  </label>
                </div>

                {(row.fields || []).map(field => (
                  <label className="form-label" key={field.key}>{field.label}
                    <input
                      className="form-control"
                      type={field.secret ? 'password' : 'text'}
                      value={draft.config?.[field.key] || ''}
                      onChange={e => setDraftField(row.provider, field.key, e.target.value)}
                      placeholder={field.secret ? 'Laisser vide pour conserver la valeur actuelle' : field.label}
                    />
                  </label>
                ))}

                <button type="button" className="btn btn-primary" style={{ justifySelf: 'start', width: 'fit-content' }} disabled={saving === row.provider} onClick={() => save(row.provider)}>
                  {saving === row.provider ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
