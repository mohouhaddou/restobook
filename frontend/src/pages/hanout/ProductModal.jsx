import React, { useState, useEffect, useCallback } from 'react';
import { ASSET } from '../../api';
import { ShareButton } from '../../shared/components/ui/ShareMenu';
import { ProductOptionsSelector } from '../../shared/components/marketplace/ProductOptionsSelector';
import { initOptionSelections, computeOptionsPrice, buildSelectedOptionsPayload } from '../../shared/components/marketplace/productOptions';

const fmt = n => Number(n || 0).toFixed(2);

export default function ProductModal({ product, hanoutName, slug, theme = { primary: '#10B981', dark: '#059669' }, onClose, onAddToCart }) {
  const [selections, setSelections] = useState({});
  const [errors, setErrors] = useState({});
  const [imgIdx, setImgIdx] = useState(0);

  const options = product?.options || [];

  useEffect(() => {
    if (!product) return;
    setSelections(initOptionSelections(product.options));
    setErrors({});
    setImgIdx(0);
  }, [product?.id]);

  const set = useCallback((optId, val) => {
    setSelections(prev => ({ ...prev, [optId]: val }));
    setErrors(prev => { const n = { ...prev }; delete n[optId]; return n; });
  }, []);

  const { total: totalPrice, qtyVal } = computeOptionsPrice(product?.price, options, selections);

  function handleAdd() {
    const { errs, selected_options } = buildSelectedOptionsPayload(options, selections);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onAddToCart({ ...product, selected_options, _cart_price: totalPrice, _qty_value: qtyVal });
    onClose();
  }

  if (!product) return null;

  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  const hasDiscount = product.compare_price && Number(product.compare_price) > Number(product.price);
  const discountPct = hasDiscount ? Math.round((1 - product.price / product.compare_price) * 100) : 0;

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{
        width: '100%', maxWidth: 600, maxHeight: '92vh', borderRadius: '20px 20px 0 0',
        background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'slideUp .3s cubic-bezier(.16,1,.3,1)',
      }}>
        {/* ── Image carousel ── */}
        <div style={{ position: 'relative', height: 220, background: '#F3F4F6', flexShrink: 0 }}>
          {images.length > 0
            ? <img src={ASSET(images[imgIdx])} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60 }}>🛒</div>
          }
          {hasDiscount && (
            <span style={{ position: 'absolute', top: 12, left: 12, background: '#EF4444', color: '#fff', fontWeight: 800, fontSize: 12, padding: '3px 10px', borderRadius: 20 }}>-{discountPct}%</span>
          )}
          {images.length > 1 && (
            <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
              {images.map((_, i) => (
                <button key={i} onClick={() => setImgIdx(i)} style={{ width: i === imgIdx ? 18 : 7, height: 7, borderRadius: 20, border: 'none', background: i === imgIdx ? '#fff' : 'rgba(255,255,255,.5)', cursor: 'pointer', padding: 0, transition: 'width .2s' }} />
              ))}
            </div>
          )}
          <ShareButton compact title={product.name} text={`${product.name} — ${Number(product.price).toFixed(2)} MAD chez ${hanoutName} sur iFilino`} url={`${window.location.origin}/h/${slug}?add=${product.id}`}
            style={{ position: 'absolute', top: 12, right: 52 }} />
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,.4)', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 0' }}>
          {/* Header */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', marginBottom: 4 }}>{hanoutName}</div>
            <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: '#111827', lineHeight: 1.2 }}>{product.name}</h2>
            {product.description && <p style={{ margin: 0, fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>{product.description}</p>}
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: theme.primary }}>{fmt(product.price)} MAD</span>
              <span style={{ fontSize: 13, color: '#9CA3AF' }}>/ {product.unit}</span>
              {hasDiscount && <span style={{ fontSize: 13, color: '#9CA3AF', textDecoration: 'line-through' }}>{fmt(product.compare_price)}</span>}
            </div>
          </div>

          <ProductOptionsSelector options={options} selections={selections} errors={errors} onChange={set} theme={theme} />
          <div style={{ height: 20 }} />
        </div>

        {/* ── Sticky footer ── */}
        <div style={{ padding: '14px 20px 20px', borderTop: '1px solid #F3F4F6', background: '#fff', flexShrink: 0 }}>
          {options.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: '#6B7280' }}>Total estimé</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: theme.primary }}>{fmt(totalPrice)} MAD</span>
            </div>
          )}
          <button onClick={handleAdd} disabled={!product.available} style={{
            width: '100%', padding: '14px', borderRadius: 14, border: 'none',
            background: product.available ? `linear-gradient(135deg,${theme.primary},${theme.dark})` : '#E5E7EB',
            color: product.available ? '#fff' : '#9CA3AF', fontWeight: 800, fontSize: 16,
            cursor: product.available ? 'pointer' : 'default', transition: 'opacity .15s',
          }}>
            {product.available ? `Ajouter au panier — ${fmt(totalPrice)} MAD` : 'Indisponible'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </div>
  );
}
