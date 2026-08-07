import React, { useState, useEffect, useCallback } from 'react';
import { ASSET } from '../../../api';
import { ShareButton } from '../../../shared/components/ui/ShareMenu';
import { ProductOptionsSelector } from '../../components/marketplace/ProductOptionsSelector';
import { initOptionSelections, computeOptionsPrice, buildSelectedOptionsPayload } from '../../components/marketplace/productOptions';

const fmt = n => Number(n || 0).toFixed(2);

export default function MenuItemModal({ item, restaurantName, slug, theme = { primary: '#FF8A00', dark: '#FF5D00' }, onClose, onAddToCart }) {
  const [selections, setSelections] = useState({});
  const [errors, setErrors] = useState({});

  const options = item?.options || [];
  const available = item?.is_available !== false && item?.prix != null;

  useEffect(() => {
    if (!item) return;
    setSelections(initOptionSelections(item.options));
    setErrors({});
  }, [item?.id]);

  const set = useCallback((optId, val) => {
    setSelections(prev => ({ ...prev, [optId]: val }));
    setErrors(prev => { const n = { ...prev }; delete n[optId]; return n; });
  }, []);

  const { total: totalPrice, qtyVal } = computeOptionsPrice(item?.prix, options, selections);

  function handleAdd() {
    const { errs, selected_options } = buildSelectedOptionsPayload(options, selections);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onAddToCart({ ...item, selected_options, _cart_price: totalPrice, _qty_value: qtyVal });
    onClose();
  }

  if (!item) return null;

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{
        width: '100%', maxWidth: 600, maxHeight: '92vh', borderRadius: '20px 20px 0 0',
        background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'slideUp .3s cubic-bezier(.16,1,.3,1)',
      }}>
        {/* Image */}
        <div style={{ position: 'relative', height: 200, background: '#F3F4F6', flexShrink: 0 }}>
          {item.image_url
            ? <img src={ASSET(item.image_url)} alt={item.libelle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56 }}>🍽️</div>
          }
          {!available && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 15, background: 'rgba(0,0,0,.5)', padding: '6px 16px', borderRadius: 20 }}>Indisponible</span>
            </div>
          )}
          <ShareButton compact title={item.libelle} text={`${item.libelle} — ${Number(item.prix || 0).toFixed(2)} MAD chez ${restaurantName} sur iFilino`} url={`${window.location.origin}/r/${slug}`}
            style={{ position: 'absolute', top: 12, right: 52 }} />
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,.4)', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 0' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', marginBottom: 4 }}>{restaurantName}</div>
            <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: '#111827', lineHeight: 1.2 }}>{item.libelle}</h2>
            {item.description && <p style={{ margin: 0, fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>{item.description}</p>}
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: theme.primary }}>{fmt(item.prix)} MAD</span>
              {item.calories && <span style={{ fontSize: 12, color: '#9CA3AF' }}>{item.calories} kcal</span>}
            </div>
          </div>

          <ProductOptionsSelector options={options} selections={selections} errors={errors} onChange={set} theme={theme} />
          <div style={{ height: 20 }} />
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px 20px', borderTop: '1px solid #F3F4F6', background: '#fff', flexShrink: 0 }}>
          {options.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: '#6B7280' }}>Total estimé</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: theme.primary }}>{fmt(totalPrice)} MAD</span>
            </div>
          )}
          <button onClick={handleAdd} disabled={!available} style={{
            width: '100%', padding: '14px', borderRadius: 14, border: 'none',
            background: available ? `linear-gradient(135deg,${theme.primary},${theme.dark})` : '#E5E7EB',
            color: available ? '#fff' : '#9CA3AF', fontWeight: 800, fontSize: 16,
            cursor: available ? 'pointer' : 'default', transition: 'opacity .15s',
          }}>
            {available ? `Ajouter au panier — ${fmt(totalPrice)} MAD` : 'Indisponible'}
          </button>
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>
    </div>
  );
}
