import React from 'react';

const PAYMENT_LABELS = { cash: 'Espèces', card: 'Carte', credit: 'Crédit', online: 'En ligne' };

function fmt(n) { return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

/**
 * Ticket HTML imprimable (58mm/80mm), rendu hors-écran et affiché uniquement
 * via window.print() (voir styles/pos-receipt.css, règle @media print).
 * Consomme le payload normalisé produit par buildTicketPayload() (posApi.js) —
 * point d'extension pour une future impression Bluetooth/USB/réseau.
 */
export function PosReceipt({ ticket, width = '80mm' }) {
  if (!ticket) return null;
  return (
    <div className="pos-receipt" data-width={width}>
      {ticket.logo_url && <img src={ticket.logo_url} alt="" className="pos-receipt__logo" />}
      <div className="pos-receipt__title">{ticket.business_name}</div>
      {ticket.address && <div className="pos-receipt__sub">{ticket.address}</div>}
      {ticket.phone && <div className="pos-receipt__sub">{ticket.phone}</div>}
      <hr />
      <div className="pos-receipt__meta"><span>Ticket</span><span>#{ticket.ticket_number}</span></div>
      <div className="pos-receipt__meta"><span>Date</span><span>{new Date(ticket.date).toLocaleString('fr-FR')}</span></div>
      <div className="pos-receipt__meta"><span>Caissier</span><span>{ticket.cashier_name}</span></div>
      <hr />
      <table>
        <thead>
          <tr><th>Article</th><th>Qté</th><th>Total</th></tr>
        </thead>
        <tbody>
          {ticket.items.map((it, i) => (
            <tr key={i}>
              <td>{it.name}</td>
              <td>{it.quantity}</td>
              <td>{fmt(it.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr />
      <div className="pos-receipt__total"><span>Total</span><span>{fmt(ticket.total_amount)} MAD</span></div>
      <div className="pos-receipt__meta" style={{ marginTop: 4 }}>
        <span>Paiement</span><span>{PAYMENT_LABELS[ticket.payment_method] || ticket.payment_method}</span>
      </div>
      <div className="pos-receipt__footer">Merci de votre visite !</div>
    </div>
  );
}
