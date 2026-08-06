import React from 'react';
import { StatusBadge } from '../../../shared/components/ui/Badge';

export function MealHistoryTable({ meals = [] }) {
  return (
    <div className="card p-0" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--rb-border)' }}>
        <h5 className="m-0" style={{ fontSize: 15 }}>Historique des repas</h5>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="table table-sm align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Date</th>
              <th>Utilisateur</th>
              <th>Plat</th>
              <th>Catégorie</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {meals.length === 0 ? (
              <tr><td colSpan="5" className="text-secondary py-3">Aucun repas sur la période.</td></tr>
            ) : meals.slice(0, 12).map(meal => (
              <tr key={meal.id}>
                <td><code>{meal.date_jour}</code></td>
                <td>{meal.user?.nom || meal.user?.matricule || '—'}</td>
                <td>{meal.item?.libelle || '—'}</td>
                <td>{meal.category || '—'}</td>
                <td><StatusBadge status={meal.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
