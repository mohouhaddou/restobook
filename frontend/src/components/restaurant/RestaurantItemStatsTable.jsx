import React from 'react';

function money(value) {
  return `${Number(value || 0).toFixed(2)} MAD`;
}

export function RestaurantItemStatsTable({ items = [] }) {
  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle mb-0">
        <thead>
          <tr>
            <th>Plat</th>
            <th>Type</th>
            <th className="text-end">Qté</th>
            <th className="text-end">CA</th>
            <th className="text-end">Prix moyen</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.menu_item_id}>
              <td style={{ fontWeight: 600 }}>{item.libelle || 'Plat'}</td>
              <td>{item.type || '-'}</td>
              <td className="text-end">{item.quantity}</td>
              <td className="text-end">{money(item.revenue)}</td>
              <td className="text-end">{money(item.avg_price || item.current_price)}</td>
              <td>
                <span className={`badge ${item.is_available ? 'text-bg-success' : 'text-bg-secondary'}`}>
                  {item.is_available ? 'Disponible' : 'Indisponible'}
                </span>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan="6" className="text-center text-muted py-4">Aucune vente sur la période.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
