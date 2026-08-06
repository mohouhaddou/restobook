import React from 'react';
import { DashboardIcon } from '../ui/DashboardIcon';
import { PremiumIcon } from '../ui/PremiumIcon';

const LIST_COLORS = ['#FF8A00', '#16A34A', '#2563EB', '#7C3AED', '#DC2626', '#D97706'];
function colorFor(id) { return LIST_COLORS[id % LIST_COLORS.length]; }

export function ListCard({ list, onOpen, onDelete }) {
  const total = list.items.length;
  const checked = list.items.filter(i => i.checked).length;
  const progress = total ? Math.round((checked / total) * 100) : 0;
  const color = colorFor(list.id);

  return (
    <div onClick={() => onOpen(list)} className="mk-card" style={{ padding: 16, cursor: 'pointer', position: 'relative' }}>
      <button onClick={e => { e.stopPropagation(); onDelete(list.id); }} style={{
        position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', color: 'var(--mk-muted)', cursor: 'pointer', fontSize: 13,
      }}><PremiumIcon name="close" size={13} /></button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
          <DashboardIcon icon={list.icon || '🛒'} size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--mk-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{list.name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--mk-muted)' }}>{total} article{total > 1 ? 's' : ''}</div>
        </div>
      </div>

      {list.completed_at ? (
        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--mk-green)' }}>Terminée</div>
      ) : (
        <div style={{ height: 6, borderRadius: 4, background: 'var(--mk-bg)', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: color, transition: 'width .2s' }} />
        </div>
      )}
    </div>
  );
}
