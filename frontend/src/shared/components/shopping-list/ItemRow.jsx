import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { PremiumIcon } from '../ui/PremiumIcon';

const PRIORITY_DOT = { high: 'var(--mk-red)', normal: 'transparent', low: 'var(--mk-border)' };

/**
 * Ligne d'article — coche, quantité, prix estimé, favori/priorité, notes en
 * repli. Swipe gauche pour supprimer (framer-motion drag, pas de librairie
 * supplémentaire — approuvé par l'utilisateur pour ce chantier). Désactivé
 * (`swipeEnabled=false`) quand la ligne est déjà un Reorder.Item — deux
 * gestes de drag imbriqués (swipe horizontal + tri vertical) entreraient en
 * conflit, et le tri vertical à lui seul est déjà le mode "édition" actif.
 */
export function ItemRow({ item, onToggle, onDelete, onUpdate, swipeEnabled = true }) {
  const [expanded, setExpanded] = useState(false);
  const [dragX, setDragX] = useState(0);

  const qtyLabel = item.quantity_value
    ? `${item.quantity_value}${item.quantity_unit ? ' ' + item.quantity_unit : ''}`
    : item.quantity || null;

  const Wrapper = swipeEnabled ? motion.div : 'div';
  const wrapperProps = swipeEnabled ? {
    drag: 'x',
    dragConstraints: { left: -80, right: 0 },
    dragElastic: 0.1,
    onDrag: (e, info) => setDragX(info.offset.x),
    onDragEnd: (e, info) => { if (info.offset.x < -60) onDelete(item.id); setDragX(0); },
  } : {};

  return (
    <Wrapper {...wrapperProps} style={{ position: 'relative', touchAction: 'pan-y' }}>
      {swipeEnabled && (
        <div style={{
          position: 'absolute', inset: 0, background: 'var(--mk-red)', borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 16,
          opacity: dragX < -10 ? 1 : 0, transition: 'opacity .15s',
        }}>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, display:'inline-flex', alignItems:'center', gap:6 }}><PremiumIcon name="trash" size={14} />Supprimer</span>
        </div>
      )}

      <div style={{ position: 'relative', background: 'var(--mk-card)', borderRadius: 10, padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" checked={!!item.checked} onChange={() => onToggle(item)}
            style={{ width: 18, height: 18, flexShrink: 0, accentColor: 'var(--mk-orange)' }} />

          {item.image_url && (
            <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: `var(--mk-pill) center/cover url(${item.image_url})` }} />
          )}

          <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {item.priority === 'high' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: PRIORITY_DOT.high, flexShrink: 0 }} />}
              <span style={{
                fontSize: 13.5, fontWeight: 600, color: item.checked ? 'var(--mk-muted)' : 'var(--mk-text)',
                textDecoration: item.checked ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {item.name}
              </span>
              {item.is_favorite && <PremiumIcon name="star" size={12} style={{ color:'var(--mk-orange)', flexShrink:0 }} />}
            </div>
            {(qtyLabel || item.brand) && (
              <div style={{ fontSize: 11, color: 'var(--mk-muted)', marginTop: 1 }}>
                {qtyLabel}{qtyLabel && item.brand ? ' · ' : ''}{item.brand}
              </div>
            )}
          </div>

          {item.estimated_price != null && (
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--mk-orange)', flexShrink: 0 }}>
              {Number(item.estimated_price).toFixed(2)} MAD
            </div>
          )}

          <button onClick={() => onDelete(item.id)} style={{ background: 'none', border: 'none', color: 'var(--mk-muted)', cursor: 'pointer', fontSize: 14, flexShrink: 0, padding: 4 }}><PremiumIcon name="close" size={14} /></button>
        </div>

        {expanded && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--mk-border)', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button onClick={() => onUpdate(item.id, { priority: item.priority === 'high' ? 'normal' : 'high' })} className="mk-pill" style={{ fontSize: 11 }}>
              {item.priority === 'high' ? 'Priorité haute' : 'Priorité normale'}
            </button>
            <button onClick={() => onUpdate(item.id, { is_favorite: !item.is_favorite })} className="mk-pill" style={{ fontSize: 11 }}>
              {item.is_favorite ? 'Favori' : 'Marquer favori'}
            </button>
            <input
              defaultValue={item.notes || ''}
              placeholder="Note (ex: bien mûres)"
              onBlur={e => { if (e.target.value !== (item.notes || '')) onUpdate(item.id, { notes: e.target.value }); }}
              style={{ flex: '1 1 160px', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--mk-border)', background: 'var(--mk-input-bg)', color: 'var(--mk-text)', fontSize: 12 }}
            />
          </div>
        )}
      </div>
    </Wrapper>
  );
}
