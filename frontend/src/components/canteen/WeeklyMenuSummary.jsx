import React from 'react';

function dayLabel(date) {
  return new Date(date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function WeeklyMenuSummary({ menus = [] }) {
  return (
    <div className="card p-0" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--rb-border)' }}>
        <h5 className="m-0" style={{ fontSize: 15 }}>Menus hebdomadaires</h5>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(180px, 1fr))', minWidth: 850 }}>
          {menus.map(day => (
            <div key={day.date_jour} style={{ padding: 14, borderRight: '1px solid var(--rb-border)' }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>{dayLabel(day.date_jour)}</div>
              <div style={{ fontSize: 11, color: 'var(--rb-muted)', marginBottom: 10 }}>
                {day.totals?.reserved || 0} réservés · {day.totals?.consumed || 0} consommés
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {(day.items || []).slice(0, 6).map(item => (
                  <div key={item.daily_menu_item_id || item.id} style={{
                    border: '1px solid var(--rb-border)',
                    borderRadius: 8,
                    padding: '7px 8px',
                    background: 'var(--rb-card)',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.libelle}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--rb-muted)' }}>
                      Quota {item.quota ?? '∞'} · reste {item.remaining ?? '∞'}
                    </div>
                  </div>
                ))}
                {(!day.items || day.items.length === 0) && (
                  <div style={{ fontSize: 12, color: 'var(--rb-muted)', padding: '8px 0' }}>Aucun menu</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
