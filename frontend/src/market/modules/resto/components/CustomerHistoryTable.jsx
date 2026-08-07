import React from 'react';

function money(value) {
  return `${Number(value || 0).toFixed(2)} MAD`;
}

export function CustomerHistoryTable({ customers = [] }) {
  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle mb-0">
        <thead>
          <tr>
            <th>Client</th>
            <th>Téléphone</th>
            <th className="text-end">Commandes</th>
            <th className="text-end">Total</th>
            <th>Dernière visite</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer, index) => (
            <tr key={`${customer.phone || customer.name}-${index}`}>
              <td style={{ fontWeight: 600 }}>{customer.name || 'Client'}</td>
              <td>{customer.phone || '-'}</td>
              <td className="text-end">{customer.orders_count}</td>
              <td className="text-end">{money(customer.total_spent)}</td>
              <td>{customer.last_order_at ? new Date(customer.last_order_at).toLocaleString('fr-FR') : '-'}</td>
            </tr>
          ))}
          {customers.length === 0 && (
            <tr><td colSpan="5" className="text-center text-muted py-4">Aucun client sur la période.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
