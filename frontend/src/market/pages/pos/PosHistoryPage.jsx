import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Toast } from '../../../shared/components/ui/Toast';
import { PERMISSIONS } from '../../../shared/modules/core/permissions';
import { usePosApi, buildTicketPayload } from './posApi';
import { PosReceipt } from './PosReceipt';
import { PremiumIcon } from '../../../shared/components/ui/PremiumIcon';

const PAYMENT_LABELS = { cash: 'Espèces', card: 'Carte', credit: 'Crédit', online: 'En ligne' };
const STATUS_LABELS = { pending: 'En cours', confirmed: 'Confirmée', preparing: 'Préparation', ready: 'Prête', delivered: 'Complétée', cancelled: 'Annulée' };

function fmt(n) { return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function today() { return new Date().toISOString().slice(0, 10); }

function useToast() {
  const [toast, setToast] = useState(null);
  const show = (msg, kind = 'success') => { setToast({ msg, kind }); setTimeout(() => setToast(null), 4500); };
  return { toast, show };
}

export default function PosHistoryPage() {
  const { user, hasPermission } = useAuth();
  const api = usePosApi();
  const { toast, show } = useToast();
  const canRefund = hasPermission(PERMISSIONS.POS_REFUND);

  const [date, setDate] = useState(today());
  const [paymentMethod, setPaymentMethod] = useState('');
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState(null);
  const [detail, setDetail] = useState(null); // { sale, ticket } chargé pour la modale
  const [reprintTicket, setReprintTicket] = useState(null);
  const [reason, setReason] = useState('');

  useEffect(() => { api.getBusinessInfo().then(d => setBusiness(d.business)).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function load() {
    setLoading(true);
    api.listSales({ date, payment_method: paymentMethod || undefined })
      .then(d => setSales(d.sales || []))
      .catch(() => setSales([]))
      .finally(() => setLoading(false));
  }
  useEffect(load, [date, paymentMethod]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openDetail(row) {
    try {
      const d = await api.getSale(row.id);
      setDetail(d);
    } catch (e) { show(e.message, 'error'); }
  }

  function reprint(d) {
    const items = (d.sale.items || []).map(i => ({
      name: i.menu_item?.libelle || i.product_name, quantity: i.quantity,
      unit_price: i.unit_price ?? i.product_price, line_total: i.line_total,
    }));
    setReprintTicket(buildTicketPayload({ sale: { ...d.sale, ticket_number: d.ticket.ticket_number, total_amount: d.ticket.total_amount }, items, business, cashierName: user?.nom }));
    setTimeout(() => window.print(), 50);
  }

  async function doRefund(row) {
    if (!window.confirm(`Confirmer le remboursement du ticket #${row.ticket_number} ?`)) return;
    try {
      await api.refundSale(row.id, reason || undefined);
      show('Vente remboursée');
      setDetail(null); setReason('');
      load();
    } catch (e) { show(e.message, 'error'); }
  }

  return (
    <div style={{ padding: '20px 16px' }}>
      <Toast msg={toast?.msg} kind={toast?.kind} />
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 10 }}><PremiumIcon name="history" size={24} /> Historique POS</h2>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 'var(--il-radius-sm)', border: '1.5px solid var(--il-border)', fontSize: 13 }} />
        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 'var(--il-radius-sm)', border: '1.5px solid var(--il-border)', fontSize: 13 }}>
          <option value="">Tous les paiements</option>
          <option value="cash">Espèces</option>
          <option value="card">Carte</option>
          <option value="credit">Crédit</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--il-muted)' }}>Chargement…</div>
      ) : sales.length === 0 ? (
        <div className="if-card" style={{ textAlign: 'center', padding: 48, color: 'var(--il-muted)' }}>Aucune vente pour ce filtre.</div>
      ) : (
        <div className="if-card" style={{ overflow: 'hidden' }}>
          {sales.map((s, idx) => (
            <button key={s.id} onClick={() => openDetail(s)} style={{
              width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: idx < sales.length - 1 ? '1px solid var(--il-border)' : 'none',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>#{s.ticket_number}</div>
                <div style={{ fontSize: 11, color: 'var(--il-muted)' }}>{new Date(s.created_at).toLocaleString('fr-FR')} · {STATUS_LABELS[s.status] || s.status}</div>
              </div>
              <span style={{ fontSize: 12 }}>{PAYMENT_LABELS[s.payment_method] || s.payment_method}</span>
              <span style={{ fontSize: 14, fontWeight: 800, minWidth: 80, textAlign: 'right' }}>{fmt(s.total_amount)} MAD</span>
            </button>
          ))}
        </div>
      )}

      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setDetail(null)}>
          <div className="if-card" style={{ maxWidth: 420, width: '100%', padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>Ticket #{detail.ticket.ticket_number}</h3>
              <button onClick={() => setDetail(null)} aria-label="Fermer" style={{ background: 'none', border: 'none', cursor: 'pointer', width: 34, height: 34, display: 'grid', placeItems: 'center' }}><PremiumIcon name="close" size={18} /></button>
            </div>
            <div style={{ marginBottom: 12 }}>
              {(detail.sale.items || []).map((i, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                  <span>{i.quantity} × {i.menu_item?.libelle || i.product_name}</span>
                  <span>{fmt(i.line_total ?? (i.quantity * (i.unit_price ?? i.product_price)))} MAD</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16, borderTop: '1px solid var(--il-border)', paddingTop: 10, marginBottom: 16 }}>
              <span>Total</span><span>{fmt(detail.ticket.total_amount)} MAD</span>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: canRefund && detail.sale.status !== 'cancelled' ? 12 : 0 }}>
              <button onClick={() => reprint(detail)} className="if-btn if-btn-outline" style={{ flex: 1 }}><PremiumIcon name="printer" size={16} /> Réimprimer</button>
            </div>

            {canRefund && detail.sale.status !== 'cancelled' && (
              <>
                <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Motif du remboursement (optionnel)"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--il-radius-sm)', border: '1.5px solid var(--il-border)', fontSize: 13, marginBottom: 10 }} />
                <button onClick={() => doRefund({ id: detail.sale.id, ticket_number: detail.ticket.ticket_number })} className="if-btn if-btn-danger" style={{ width: '100%' }}>
                  ↩︎ Rembourser / Annuler
                </button>
              </>
            )}
            {detail.sale.status === 'cancelled' && (
              <div style={{ fontSize: 12, color: 'var(--il-danger)', textAlign: 'center' }}>Cette vente a déjà été remboursée.</div>
            )}
          </div>
        </div>
      )}

      <PosReceipt ticket={reprintTicket} />
    </div>
  );
}
