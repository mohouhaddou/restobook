import React, { useState, useEffect, useCallback, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API, ASSET } from '../../api';

/* ══ CONSTANTES ═══════════════════════════════════════════════════════════ */
const SUB_TABS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: '📊' },
  { id: 'customers',  label: 'Clients',         icon: '👥' },
  { id: 'new-credit', label: 'Nouveau crédit',  icon: '➕' },
  { id: 'payments',   label: 'Encaissements',   icon: '💰' },
  { id: 'history',    label: 'Historique',      icon: '🕓' },
  { id: 'reports',    label: 'Rapports',        icon: '📑' },
  { id: 'settings',   label: 'Paramètres',      icon: '⚙️' },
];
const STATUS_COLORS = { green: '#10B981', orange: '#F59E0B', red: '#EF4444' };
const METHOD_LABELS = { cash: '💵 Espèces', card: '💳 Carte', transfer: '🏦 Virement', mobile_money: '📱 Mobile Money' };

function creditFetch(path, opts = {}) {
  const token = localStorage.getItem('rb_token');
  return fetch(API(`/hanout-pro/credit${path}`), {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
    body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined,
  }).then(async r => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Erreur ${r.status}`);
    return data;
  });
}

function fmt(n) { return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(d) { return d ? new Date(d + (String(d).length === 10 ? 'T00:00:00' : '')).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }

/* ══ COMPOSANTS UTILITAIRES ═══════════════════════════════════════════════ */
function KpiCard({ icon, label, value, sub, color = '#10B981' }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 46, height: 46, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', whiteSpace: 'nowrap' }}>{value}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{sub}</div>}
      </div>
    </div>
  );
}

function StatusDot({ status, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: STATUS_COLORS[status], background: `${STATUS_COLORS[status]}18`, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      ● {label}
    </span>
  );
}

function Field({ label, children, required }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>
        {label}{required && <span style={{ color: '#EF4444', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}
const inputStyle = { width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };

/* ── Sélecteur de client (recherche instantanée) ── */
function CustomerPicker({ value, onChange }) {
  const [q, setQ] = useState(value?.name || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const debRef = useRef(null);

  function search(text) {
    setQ(text); setOpen(true);
    clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      if (!text.trim()) { setResults([]); return; }
      try { const d = await creditFetch(`/customers?q=${encodeURIComponent(text)}&limit=8`); setResults(d.customers || []); } catch {}
    }, 250);
  }

  function pick(c) { onChange(c); setQ(c.name); setOpen(false); setResults([]); }

  return (
    <div style={{ position: 'relative' }}>
      <input value={q} onChange={e => { search(e.target.value); if (value) onChange(null); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Rechercher par nom ou téléphone…" style={inputStyle} />
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 240, overflowY: 'auto', marginTop: 4 }}>
          {results.map(c => (
            <button key={c.id} type="button" onMouseDown={() => pick(c)} style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottom: '1px solid #F3F4F6', fontFamily: 'inherit' }}>
              <span>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{c.name}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{c.phone}{c.district ? ` · ${c.district}` : ''}</div>
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: Number(c.balance) > 0 ? '#EF4444' : '#10B981' }}>{fmt(c.balance)} MAD</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══ TABLEAU DE BORD ═══════════════════════════════════════════════════════ */
function CreditDashboardTab() {
  const [data, setData] = useState(null);
  useEffect(() => { creditFetch('/dashboard').then(setData).catch(() => {}); }, []);
  if (!data) return <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>Chargement…</div>;

  const { kpis, monthly, distribution, top_debtors } = data;
  const maxMonthly = Math.max(1, ...monthly.flatMap(m => [m.credits, m.payments]));
  const totalDist = Math.max(1, distribution.green + distribution.orange + distribution.red);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
        <KpiCard icon="💳" label="Total des crédits" value={`${fmt(kpis.total_credits)} MAD`} color="#10B981" />
        <KpiCard icon="✅" label="Encaissé ce mois" value={`${fmt(kpis.month_payments)} MAD`} color="#3B82F6" />
        <KpiCard icon="⏳" label="Montant restant" value={`${fmt(kpis.total_remaining)} MAD`} color="#F59E0B" />
        <KpiCard icon="👥" label="Clients débiteurs" value={kpis.debtors_count} color="#8B5CF6" />
        <KpiCard icon="⚠️" label="Retards" value={kpis.overdue_count} color="#EF4444" />
        <KpiCard icon="💰" label="Encaissé aujourd'hui" value={`${fmt(kpis.today_payments)} MAD`} color="#06B6D4" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>
        {/* Évolution mensuelle */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #E5E7EB' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: '#111827' }}>📈 Évolution mensuelle</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140 }}>
            {monthly.map(m => (
              <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 110 }}>
                  <div title={`Crédits: ${fmt(m.credits)}`} style={{ width: 10, height: `${Math.max(2, (m.credits / maxMonthly) * 100)}%`, background: '#F59E0B', borderRadius: 3 }} />
                  <div title={`Encaissé: ${fmt(m.payments)}`} style={{ width: 10, height: `${Math.max(2, (m.payments / maxMonthly) * 100)}%`, background: '#10B981', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'capitalize' }}>{m.month}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 11, color: '#6B7280' }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#F59E0B', borderRadius: 2, marginRight: 5 }} />Crédits accordés</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#10B981', borderRadius: 2, marginRight: 5 }} />Encaissements</span>
          </div>
        </div>

        {/* Répartition des dettes */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #E5E7EB' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: '#111827' }}>🥧 Répartition des dettes</h3>
          <div style={{ display: 'flex', height: 14, borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ width: `${(distribution.green / totalDist) * 100}%`, background: STATUS_COLORS.green }} />
            <div style={{ width: `${(distribution.orange / totalDist) * 100}%`, background: STATUS_COLORS.orange }} />
            <div style={{ width: `${(distribution.red / totalDist) * 100}%`, background: STATUS_COLORS.red }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[['green', 'Excellent / Bon payeur'], ['orange', 'Payeur moyen'], ['red', 'Risque élevé']].map(([k, l]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#374151' }}>
                <span><span style={{ display: 'inline-block', width: 8, height: 8, background: STATUS_COLORS[k], borderRadius: '50%', marginRight: 7 }} />{l}</span>
                <span style={{ fontWeight: 700 }}>{distribution[k]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top 10 clients débiteurs */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #E5E7EB' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800, color: '#111827' }}>🏆 Top 10 débiteurs</h3>
        {top_debtors.length === 0 ? <div style={{ color: '#9CA3AF', fontSize: 13, padding: '12px 0' }}>Aucun client débiteur.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {top_debtors.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 4px', borderBottom: i < top_debtors.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                <span style={{ width: 22, fontSize: 12, fontWeight: 800, color: '#9CA3AF' }}>#{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#111827' }}>{c.name}</span>
                <StatusDot status={c.status} label={c.status_label} />
                <span style={{ fontSize: 13, fontWeight: 800, color: '#EF4444', minWidth: 90, textAlign: 'right' }}>{fmt(c.balance)} MAD</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══ CLIENTS — LISTE ═══════════════════════════════════════════════════════ */
function CreditCustomersTab({ onOpenCustomer, onNewCustomer }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const debRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ limit: 100 });
    if (q.trim()) qs.set('q', q.trim());
    if (status) qs.set('status', status);
    creditFetch(`/customers?${qs}`).then(d => setCustomers(d.customers || [])).catch(() => {}).finally(() => setLoading(false));
  }, [q, status]);

  useEffect(() => { clearTimeout(debRef.current); debRef.current = setTimeout(load, 250); return () => clearTimeout(debRef.current); }, [load]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 220, display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 10, padding: '9px 14px', border: '1.5px solid #E5E7EB' }}>
          <span style={{ color: '#9CA3AF' }}>🔍</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nom, téléphone, quartier…" style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent' }} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[['', 'Tous'], ['green', '🟢'], ['orange', '🟠'], ['red', '🔴']].map(([v, l]) => (
            <button key={v} onClick={() => setStatus(v)} style={{ padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${status === v ? '#10B981' : '#E5E7EB'}`, background: status === v ? '#F0FDF4' : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: status === v ? '#059669' : '#374151' }}>{l}</button>
          ))}
        </div>
        <button onClick={onNewCustomer} style={{ padding: '9px 18px', background: '#10B981', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Nouveau client</button>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Chargement…</div> : customers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF', background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>👥</div>Aucun client trouvé.
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          {customers.map((c, i) => (
            <button key={c.id} onClick={() => onOpenCustomer(c.id)} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: 'none', borderBottom: i < customers.length - 1 ? '1px solid #F3F4F6' : 'none', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              {c.photo_url
                ? <img src={ASSET(c.photo_url)} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#F0FDF4', display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 800, color: '#10B981', flexShrink: 0 }}>{c.name[0]?.toUpperCase()}</div>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{c.name}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>{c.phone}{c.district ? ` · ${c.district}` : ''}</div>
              </div>
              {c.overdue_count > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: '#EF4444', background: '#FEF2F2', padding: '3px 8px', borderRadius: 20 }}>⚠ {c.overdue_count} retard{c.overdue_count > 1 ? 's' : ''}</span>}
              <StatusDot status={c.status} label={c.status_label} />
              <div style={{ minWidth: 100, textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: Number(c.balance) > 0 ? '#EF4444' : '#10B981' }}>{fmt(c.balance)} MAD</div>
                <div style={{ fontSize: 10, color: '#9CA3AF' }}>plafond {fmt(c.credit_limit)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══ FORMULAIRE CLIENT (créer / modifier) ═══════════════════════════════════ */
function CustomerForm({ customer, onSaved, onCancel }) {
  const [form, setForm] = useState(customer || { name: '', phone: '', address: '', district: '', credit_limit: 0, notes: '', photo_url: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function uploadPhoto(file) {
    const fd = new FormData(); fd.append('image', file);
    const token = localStorage.getItem('rb_token');
    const res = await fetch(API('/hanout-pro/credit/upload'), { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    const d = await res.json();
    if (d.url) set('photo_url', d.url);
  }

  async function save() {
    if (!form.name.trim() || !form.phone.trim()) { setErr('Nom et téléphone requis'); return; }
    setSaving(true); setErr('');
    try {
      const payload = { name: form.name, phone: form.phone, address: form.address || null, district: form.district || null, photo_url: form.photo_url || null, credit_limit: Number(form.credit_limit || 0), notes: form.notes || null };
      const d = customer
        ? await creditFetch(`/customers/${customer.id}`, { method: 'PATCH', body: payload })
        : await creditFetch('/customers', { method: 'POST', body: payload });
      onSaved(d.customer);
    } catch (e) { setErr(e.message); }
    setSaving(false);
  }

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #E5E7EB', maxWidth: 480 }}>
      <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 800, color: '#111827' }}>{customer ? '✏️ Modifier le client' : '➕ Nouveau client'}</h3>
      {err && <div style={{ marginBottom: 14, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#DC2626', fontSize: 13 }}>{err}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', background: '#F3F4F6', flexShrink: 0, cursor: 'pointer', display: 'grid', placeItems: 'center' }} onClick={() => document.getElementById('cust-photo').click()}>
          {form.photo_url ? <img src={ASSET(form.photo_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 22 }}>📷</span>}
        </div>
        <input id="cust-photo" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f) uploadPhoto(f); }} />
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>Photo optionnelle</span>
      </div>

      <Field label="Nom complet" required><input value={form.name} onChange={e => set('name', e.target.value)} style={inputStyle} /></Field>
      <Field label="Téléphone" required><input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="06 XX XX XX XX" style={inputStyle} /></Field>
      <Field label="Adresse"><input value={form.address || ''} onChange={e => set('address', e.target.value)} style={inputStyle} /></Field>
      <Field label="Quartier"><input value={form.district || ''} onChange={e => set('district', e.target.value)} style={inputStyle} /></Field>
      <Field label="Plafond de crédit (MAD)"><input type="number" min="0" value={form.credit_limit} onChange={e => set('credit_limit', e.target.value)} style={inputStyle} /></Field>
      <Field label="Commentaire"><textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></Field>

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '11px', border: '1.5px solid #E5E7EB', borderRadius: 10, background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Annuler</button>
        <button onClick={save} disabled={saving} style={{ flex: 2, padding: '11px', background: '#10B981', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer', opacity: saving ? .7 : 1 }}>{saving ? 'Enregistrement…' : '✓ Enregistrer'}</button>
      </div>
    </div>
  );
}

/* ══ FICHE CLIENT (détail) ═══════════════════════════════════════════════ */
function CustomerDetail({ customerId, onBack, onChanged }) {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState('achats'); // achats | paiements
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const load = useCallback(() => { creditFetch(`/customers/${customerId}`).then(setData).catch(() => {}); }, [customerId]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Chargement…</div>;
  const { customer: c, credits, payments } = data;

  if (editing) return <CustomerForm customer={c} onSaved={() => { setEditing(false); load(); onChanged?.(); }} onCancel={() => setEditing(false)} />;

  function printStatement() {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text(`Relevé de compte — ${c.name}`, 14, 18);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`Téléphone : ${c.phone}${c.district ? '  ·  ' + c.district : ''}`, 14, 26);
    doc.text(`Solde actuel : ${fmt(c.balance)} MAD   |   Plafond : ${fmt(c.credit_limit)} MAD`, 14, 32);

    autoTable(doc, {
      startY: 40, head: [['Date', 'Produits', 'Montant', 'Payé', 'Statut']],
      body: credits.map(cr => [fmtDate(cr.date), cr.products || '—', `${fmt(cr.amount)} MAD`, `${fmt(cr.paid_amount)} MAD`, cr.status]),
      headStyles: { fillColor: [16, 185, 129] }, styles: { fontSize: 9 },
    });
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10, head: [['Date', 'Montant', 'Mode']],
      body: payments.map(p => [fmtDate(p.date), `${fmt(p.amount)} MAD`, METHOD_LABELS[p.method] || p.method]),
      headStyles: { fillColor: [59, 130, 246] }, styles: { fontSize: 9 },
    });
    doc.save(`releve-${c.name.replace(/\s+/g, '_')}.pdf`);
  }

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>← Retour à la liste</button>

      <div style={{ background: '#fff', borderRadius: 16, padding: 22, border: '1px solid #E5E7EB', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
        {c.photo_url ? <img src={ASSET(c.photo_url)} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F0FDF4', display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 800, color: '#10B981' }}>{c.name[0]?.toUpperCase()}</div>}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#111827' }}>{c.name}</h2>
            <StatusDot status={c.status} label={c.status_label} />
          </div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>{c.phone}{c.district ? ` · ${c.district}` : ''}{c.address ? ` · ${c.address}` : ''}</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Client depuis {fmtDate(c.createdAt)} · Dernier achat {fmtDate(c.last_purchase_at)} · Dernier paiement {fmtDate(c.last_payment_at)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: Number(c.balance) > 0 ? '#EF4444' : '#10B981' }}>{fmt(c.balance)} MAD</div>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>Plafond : {fmt(c.credit_limit)} MAD</div>
        </div>
      </div>

      {/* Actions rapides */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <button onClick={() => setShowCreditForm(true)} style={{ padding: '9px 16px', background: '#10B981', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>➕ Ajouter un crédit</button>
        <button onClick={() => setShowPaymentForm(true)} style={{ padding: '9px 16px', background: '#3B82F6', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>💰 Enregistrer un paiement</button>
        <button onClick={() => setEditing(true)} style={{ padding: '9px 16px', background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 10, color: '#374151', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>✏️ Modifier</button>
        <button onClick={printStatement} style={{ padding: '9px 16px', background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 10, color: '#374151', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>🖨️ Imprimer le relevé</button>
        {c.phone && <a href={`https://wa.me/${c.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Bonjour ${c.name}, votre solde chez nous est de ${fmt(c.balance)} MAD.`)}`} target="_blank" rel="noopener noreferrer" style={{ padding: '9px 16px', background: '#F0FDF4', border: '1.5px solid #A7F3D0', borderRadius: 10, color: '#059669', fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>📱 WhatsApp</a>}
        {c.phone && <a href={`tel:${c.phone}`} style={{ padding: '9px 16px', background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 10, color: '#374151', fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>📞 Appeler</a>}
      </div>

      {showCreditForm && <div style={{ marginBottom: 18 }}><InlineCreditForm fixedCustomer={c} onDone={() => { setShowCreditForm(false); load(); onChanged?.(); }} onCancel={() => setShowCreditForm(false)} /></div>}
      {showPaymentForm && <div style={{ marginBottom: 18 }}><InlinePaymentForm fixedCustomer={c} onDone={() => { setShowPaymentForm(false); load(); onChanged?.(); }} onCancel={() => setShowPaymentForm(false)} /></div>}

      {c.notes && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '12px 16px', marginBottom: 18, fontSize: 13, color: '#92400E' }}>💬 {c.notes}</div>
      )}

      {/* Historique */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB' }}>
          {[['achats', `🧾 Achats (${credits.length})`], ['paiements', `💰 Paiements (${payments.length})`]].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)} style={{ flex: 1, padding: '12px', border: 'none', background: tab === v ? '#F0FDF4' : '#fff', color: tab === v ? '#059669' : '#6B7280', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <div style={{ padding: 8 }}>
          {tab === 'achats' && (credits.length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Aucun achat à crédit.</div> : credits.map(cr => (
            <div key={cr.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 10px', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{cr.products || 'Achat à crédit'}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{fmtDate(cr.date)}{cr.due_date ? ` · échéance ${fmtDate(cr.due_date)}` : ''}{cr.comment ? ` · ${cr.comment}` : ''}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: cr.status === 'paid' ? '#10B981' : cr.status === 'partial' ? '#F59E0B' : '#EF4444', background: cr.status === 'paid' ? '#F0FDF4' : cr.status === 'partial' ? '#FFFBEB' : '#FEF2F2', padding: '3px 8px', borderRadius: 20 }}>
                {cr.status === 'paid' ? 'Soldé' : cr.status === 'partial' ? 'Partiel' : 'En attente'}
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#111827', minWidth: 80, textAlign: 'right' }}>{fmt(cr.amount)} MAD</span>
            </div>
          )))}
          {tab === 'paiements' && (payments.length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Aucun paiement enregistré.</div> : payments.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 10px', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{METHOD_LABELS[p.method] || p.method}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{fmtDate(p.date)}{p.comment ? ` · ${p.comment}` : ''}</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#10B981', minWidth: 80, textAlign: 'right' }}>+{fmt(p.amount)} MAD</span>
            </div>
          )))}
        </div>
      </div>
    </div>
  );
}

/* ══ NOUVEAU CRÉDIT (formulaire inline, réutilisable) ═══════════════════════ */
function InlineCreditForm({ fixedCustomer, onDone, onCancel }) {
  const [customer, setCustomer] = useState(fixedCustomer || null);
  const [amount, setAmount] = useState('');
  const [products, setProducts] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [comment, setComment] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function uploadPhoto(file) {
    const fd = new FormData(); fd.append('image', file);
    const token = localStorage.getItem('rb_token');
    const res = await fetch(API('/hanout-pro/credit/upload'), { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    const d = await res.json();
    if (d.url) setPhotoUrl(d.url);
  }

  async function submit() {
    if (!customer) { setErr('Sélectionnez un client'); return; }
    if (!amount || Number(amount) <= 0) { setErr('Montant invalide'); return; }
    setSaving(true); setErr('');
    try {
      await creditFetch('/credits', { method: 'POST', body: { customer_id: customer.id, amount: Number(amount), products: products || null, date, due_date: dueDate || null, comment: comment || null, invoice_photo_url: photoUrl || null } });
      onDone();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  }

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #E5E7EB', maxWidth: 480 }}>
      <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 800, color: '#111827' }}>➕ Nouveau crédit</h3>
      {err && <div style={{ marginBottom: 14, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#DC2626', fontSize: 13 }}>{err}</div>}

      {!fixedCustomer && <Field label="Client" required><CustomerPicker value={customer} onChange={setCustomer} /></Field>}
      <Field label="Montant (MAD)" required><input type="number" min="0" step="0.5" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} /></Field>
      <Field label="Produits achetés"><textarea value={products} onChange={e => setProducts(e.target.value)} rows={2} placeholder="Ex: riz, huile, sucre, thé…" style={{ ...inputStyle, resize: 'vertical' }} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} /></Field>
        <Field label="Échéance"><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputStyle} /></Field>
      </div>
      <Field label="Commentaire"><input value={comment} onChange={e => setComment(e.target.value)} style={inputStyle} /></Field>
      <Field label="Photo de la facture (optionnelle)">
        <input type="file" accept="image/*" onChange={e => { const f = e.target.files[0]; if (f) uploadPhoto(f); }} style={{ fontSize: 12 }} />
        {photoUrl && <img src={ASSET(photoUrl)} alt="" style={{ marginTop: 8, width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} />}
      </Field>

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        {onCancel && <button onClick={onCancel} style={{ flex: 1, padding: '11px', border: '1.5px solid #E5E7EB', borderRadius: 10, background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Annuler</button>}
        <button onClick={submit} disabled={saving} style={{ flex: 2, padding: '11px', background: '#10B981', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer', opacity: saving ? .7 : 1 }}>{saving ? 'Enregistrement…' : '✓ Créer le crédit'}</button>
      </div>
    </div>
  );
}

/* ══ ENCAISSEMENT (formulaire inline, réutilisable) ══════════════════════════ */
function InlinePaymentForm({ fixedCustomer, onDone, onCancel }) {
  const [customer, setCustomer] = useState(fixedCustomer || null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    if (!customer) { setErr('Sélectionnez un client'); return; }
    if (!amount || Number(amount) <= 0) { setErr('Montant invalide'); return; }
    setSaving(true); setErr('');
    try {
      await creditFetch('/payments', { method: 'POST', body: { customer_id: customer.id, amount: Number(amount), method, date, comment: comment || null } });
      onDone();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  }

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #E5E7EB', maxWidth: 480 }}>
      <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 800, color: '#111827' }}>💰 Enregistrer un paiement</h3>
      {err && <div style={{ marginBottom: 14, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#DC2626', fontSize: 13 }}>{err}</div>}

      {!fixedCustomer && <Field label="Client" required><CustomerPicker value={customer} onChange={setCustomer} /></Field>}
      {customer && <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 14 }}>Solde actuel : <strong style={{ color: Number(customer.balance) > 0 ? '#EF4444' : '#10B981' }}>{fmt(customer.balance)} MAD</strong></div>}
      <Field label="Montant payé (MAD)" required><input type="number" min="0" step="0.5" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} /></Field>
      <Field label="Mode de paiement">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {Object.entries(METHOD_LABELS).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setMethod(v)} style={{ padding: '9px 8px', border: `1.5px solid ${method === v ? '#10B981' : '#E5E7EB'}`, borderRadius: 10, background: method === v ? '#F0FDF4' : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: method === v ? '#059669' : '#374151' }}>{l}</button>
          ))}
        </div>
      </Field>
      <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} /></Field>
      <Field label="Commentaire"><input value={comment} onChange={e => setComment(e.target.value)} style={inputStyle} /></Field>

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        {onCancel && <button onClick={onCancel} style={{ flex: 1, padding: '11px', border: '1.5px solid #E5E7EB', borderRadius: 10, background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Annuler</button>}
        <button onClick={submit} disabled={saving} style={{ flex: 2, padding: '11px', background: '#3B82F6', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer', opacity: saving ? .7 : 1 }}>{saving ? 'Enregistrement…' : '✓ Enregistrer le paiement'}</button>
      </div>
    </div>
  );
}

/* ══ HISTORIQUE ═══════════════════════════════════════════════════════════ */
function HistoryTab() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { creditFetch('/history?limit=100').then(d => setEvents(d.events || [])).catch(() => {}).finally(() => setLoading(false)); }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Chargement…</div>;
  if (events.length === 0) return <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF', background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB' }}>Aucune opération pour le moment.</div>;

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
      {events.map((e, i) => (
        <div key={`${e.type}-${e.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < events.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
          <span style={{ fontSize: 18 }}>{e.type === 'credit' ? '🧾' : '💰'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{e.customer?.name || '—'}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>{fmtDate(e.date)} · {e.type === 'credit' ? (e.comment || 'Vente à crédit') : (METHOD_LABELS[e.method] || e.method)}</div>
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, color: e.type === 'credit' ? '#EF4444' : '#10B981' }}>{e.type === 'credit' ? '−' : '+'}{fmt(e.amount)} MAD</span>
        </div>
      ))}
    </div>
  );
}

/* ══ RAPPORTS ═══════════════════════════════════════════════════════════ */
function ReportsTab() {
  const [busy, setBusy] = useState('');

  async function exportTopDebtorsPdf() {
    setBusy('pdf-top');
    try {
      const d = await creditFetch('/dashboard');
      const doc = new jsPDF();
      doc.setFontSize(16); doc.text('Top débiteurs', 14, 18);
      autoTable(doc, { startY: 26, head: [['#', 'Client', 'Téléphone', 'Statut', 'Solde (MAD)']], headStyles: { fillColor: [16, 185, 129] },
        body: d.top_debtors.map((c, i) => [i + 1, c.name, c.phone, c.status_label, fmt(c.balance)]) });
      doc.save('top-debiteurs.pdf');
    } catch {}
    setBusy('');
  }

  async function exportMonthlyPdf() {
    setBusy('pdf-month');
    try {
      const d = await creditFetch('/dashboard');
      const doc = new jsPDF();
      doc.setFontSize(16); doc.text('Encaissements mensuels', 14, 18);
      autoTable(doc, { startY: 26, head: [['Mois', 'Crédits accordés', 'Encaissé']], headStyles: { fillColor: [59, 130, 246] },
        body: d.monthly.map(m => [m.month, `${fmt(m.credits)} MAD`, `${fmt(m.payments)} MAD`]) });
      doc.save('encaissements-mensuels.pdf');
    } catch {}
    setBusy('');
  }

  function toCsv(rows, headers) {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [headers.map(esc).join(';'), ...rows.map(r => r.map(esc).join(';'))].join('\n');
  }
  function downloadCsv(content, filename) {
    const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  async function exportClientsExcel() {
    setBusy('excel-clients');
    try {
      const d = await creditFetch('/customers?limit=500');
      const csv = toCsv(d.customers.map(c => [c.name, c.phone, c.district || '', fmt(c.credit_limit), fmt(c.balance), c.status_label]), ['Nom', 'Téléphone', 'Quartier', 'Plafond', 'Solde', 'Statut']);
      downloadCsv(csv, 'classement-clients.csv');
    } catch {}
    setBusy('');
  }

  async function exportHistoryExcel() {
    setBusy('excel-history');
    try {
      const d = await creditFetch('/history?limit=500');
      const csv = toCsv(d.events.map(e => [e.type === 'credit' ? 'Crédit' : 'Paiement', e.customer?.name || '', fmtDate(e.date), fmt(e.amount)]), ['Type', 'Client', 'Date', 'Montant']);
      downloadCsv(csv, 'historique-operations.csv');
    } catch {}
    setBusy('');
  }

  const ReportCard = ({ icon, title, desc, onClick, busyKey }) => (
    <div style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 24 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{title}</div>
      <div style={{ fontSize: 12, color: '#6B7280', flex: 1 }}>{desc}</div>
      <button onClick={onClick} disabled={busy === busyKey} style={{ padding: '9px 14px', background: '#10B981', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 12, cursor: busy === busyKey ? 'default' : 'pointer', opacity: busy === busyKey ? .7 : 1 }}>
        {busy === busyKey ? 'Génération…' : 'Télécharger'}
      </button>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
      <ReportCard icon="📄" title="Top débiteurs (PDF)" desc="Classement des clients par solde dû." onClick={exportTopDebtorsPdf} busyKey="pdf-top" />
      <ReportCard icon="📄" title="Encaissements mensuels (PDF)" desc="Évolution des crédits et encaissements sur 6 mois." onClick={exportMonthlyPdf} busyKey="pdf-month" />
      <ReportCard icon="📊" title="Classement clients (Excel)" desc="Export CSV de tous les clients avec soldes et statuts." onClick={exportClientsExcel} busyKey="excel-clients" />
      <ReportCard icon="📊" title="Historique des opérations (Excel)" desc="Export CSV de tous les crédits et paiements." onClick={exportHistoryExcel} busyKey="excel-history" />
    </div>
  );
}

/* ══ PARAMÈTRES ═══════════════════════════════════════════════════════════ */
function SettingsTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { creditFetch('/audit-log').then(d => setLogs(d.logs || [])).catch(() => {}).finally(() => setLoading(false)); }, []);

  const ACTION_LABELS = {
    customer_created: 'Client créé', customer_updated: 'Client modifié', customer_deleted: 'Client supprimé',
    credit_created: 'Crédit créé', credit_updated: 'Crédit modifié', credit_deleted: 'Crédit supprimé',
    payment_created: 'Paiement enregistré', payment_deleted: 'Paiement supprimé',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 22, border: '1px solid #E5E7EB' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: '#111827' }}>🔐 Droits d'accès</h3>
        <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, margin: '0 0 12px' }}>
          Les droits du module Crédit Clients suivent les rôles définis dans <strong>Utilisateurs</strong> :
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            ['Propriétaire / Admin', 'Créer des crédits, enregistrer des paiements, supprimer des opérations, gérer les clients.'],
          ].map(([role, desc]) => (
            <div key={role} style={{ padding: '10px 14px', background: '#F9FAFB', borderRadius: 10, fontSize: 12 }}>
              <strong style={{ color: '#111827' }}>{role}</strong><br /><span style={{ color: '#6B7280' }}>{desc}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 12 }}>Une gestion fine par employé (création vs encaissement vs suppression) sera disponible dans une prochaine version.</p>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, padding: 22, border: '1px solid #E5E7EB' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: '#111827' }}>📜 Journal d'audit</h3>
        {loading ? <div style={{ color: '#9CA3AF', fontSize: 13 }}>Chargement…</div> : logs.length === 0 ? <div style={{ color: '#9CA3AF', fontSize: 13 }}>Aucune opération journalisée.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 360, overflowY: 'auto' }}>
            {logs.map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 4px', borderBottom: '1px solid #F3F4F6', fontSize: 12 }}>
                <span style={{ color: '#111827', fontWeight: 600 }}>{ACTION_LABELS[l.action] || l.action}</span>
                <span style={{ color: '#9CA3AF' }}>{l.user_name || '—'}</span>
                <span style={{ color: '#9CA3AF', whiteSpace: 'nowrap' }}>{new Date(l.createdAt).toLocaleString('fr-FR')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══ MODULE PRINCIPAL ═══════════════════════════════════════════════════════ */
export default function CreditModule() {
  const [sub, setSub] = useState('dashboard');
  const [openCustomerId, setOpenCustomerId] = useState(null);
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  function goCustomers() { setSub('customers'); setOpenCustomerId(null); setCreatingCustomer(false); }

  return (
    <div>
      <style>{`@keyframes hn-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 20, background: '#fff', borderRadius: 12, padding: 4, border: '1px solid #E5E7EB' }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => { setSub(t.id); setOpenCustomerId(null); setCreatingCustomer(false); }}
            style={{ padding: '9px 14px', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', background: sub === t.id ? '#F0FDF4' : 'transparent', color: sub === t.id ? '#059669' : '#6B7280', transition: 'all .15s' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {sub === 'dashboard' && <CreditDashboardTab />}

      {sub === 'customers' && (
        openCustomerId
          ? <CustomerDetail customerId={openCustomerId} onBack={goCustomers} />
          : creatingCustomer
            ? <CustomerForm onSaved={(c) => setOpenCustomerId(c.id)} onCancel={() => setCreatingCustomer(false)} />
            : <CreditCustomersTab onOpenCustomer={setOpenCustomerId} onNewCustomer={() => setCreatingCustomer(true)} />
      )}

      {sub === 'new-credit' && <InlineCreditForm onDone={() => { setSub('customers'); }} />}
      {sub === 'payments' && <InlinePaymentForm onDone={() => { setSub('customers'); }} />}
      {sub === 'history' && <HistoryTab />}
      {sub === 'reports' && <ReportsTab />}
      {sub === 'settings' && <SettingsTab />}
    </div>
  );
}
