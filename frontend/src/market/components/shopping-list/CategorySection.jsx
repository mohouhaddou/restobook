import React, { useState } from 'react';
import { AnimatePresence, motion, Reorder } from 'framer-motion';
import { categoryMeta } from '../../config/shoppingCategories';
import { ItemRow } from './ItemRow';

/**
 * Section catégorie repliable. Le drag & drop de réordonnancement
 * (Reorder.Group, framer-motion) n'est monté QUE si `reorderMode` est actif :
 * un Reorder.Item capte le geste vertical en continu, ce qui empêche le
 * scroll tactile normal de la page tant qu'il est présent — d'où le mode
 * explicite activé/désactivé par l'utilisateur plutôt qu'un tri toujours actif.
 */
export function CategorySection({ category, items, reorderMode, onToggle, onDelete, onUpdate, onReorder }) {
  const [open, setOpen] = useState(true);
  const meta = categoryMeta(category);
  const checkedCount = items.filter(i => i.checked).length;

  return (
    <div style={{ marginBottom: 14 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 4px',
        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ fontSize: 16 }}>{meta.icon}</span>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--mk-text)', flex: 1 }}>{meta.label}</span>
        <span style={{ fontSize: 11.5, color: 'var(--mk-muted)' }}>{checkedCount}/{items.length}</span>
        <span style={{ fontSize: 11, color: 'var(--mk-muted)', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .15s' }}>▾</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            {reorderMode ? (
              <Reorder.Group axis="y" values={items} onReorder={onReorder} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map(item => (
                  <Reorder.Item key={item.id} value={item} style={{ listStyle: 'none' }}>
                    <ItemRow item={item} onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate} swipeEnabled={false} />
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map(item => (
                  <ItemRow key={item.id} item={item} onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
