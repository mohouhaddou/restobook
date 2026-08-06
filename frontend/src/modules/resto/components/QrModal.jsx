import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

const CATS = ['entrée', 'plat', 'dessert', 'boisson'];
const cap  = s => s ? s[0].toUpperCase() + s.slice(1) : '';

const CAT_ICONS = { entrée: '🥗', plat: '🍽️', dessert: '🍮', boisson: '🥤' };

export function QrModal({ order, onClose }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!order?.order_code || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, order.order_code, {
      width: 220,
      margin: 2,
      color: { dark: '#1C1917', light: '#FFFFFF' }
    }).catch(() => {});
  }, [order?.order_code]);

  if (!order) return null;

  function formatDay(dateStr) {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1060,
        background: 'rgba(0,0,0,.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        animation: 'fadeIn .15s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--rb-card)',
          borderRadius: 20, padding: 0,
          width: '100%', maxWidth: 380,
          boxShadow: '0 24px 64px rgba(0,0,0,.3)',
          overflow: 'hidden',
          animation: 'slideUp .2s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          background: 'var(--rb-orange)',
          padding: '20px 24px 16px',
          color: '#fff',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, opacity: .85, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Code de commande
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', letterSpacing: 2, marginTop: 2 }}>
                {order.order_code}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff',
                width: 30, height: 30, borderRadius: '50%', cursor: 'pointer',
                display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700,
              }}
            >✕</button>
          </div>
          <div style={{ fontSize: 13, opacity: .8, marginTop: 8 }}>
            📅 {formatDay(order.date_jour)}
          </div>
        </div>

        {/* QR Code */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--rb-border)',
        }}>
          <div style={{
            background: '#fff', padding: 10, borderRadius: 12,
            boxShadow: '0 4px 16px rgba(0,0,0,.1)',
          }}>
            <canvas ref={canvasRef} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--rb-muted)', marginTop: 10, textAlign: 'center' }}>
            Présentez ce QR code lors du retrait de votre repas
          </div>
        </div>

        {/* Détail des plats */}
        <div style={{ padding: '16px 24px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rb-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            Détail de la commande
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {CATS.map(cat => {
              const item = order.items?.find(x => x.category === cat);
              if (!item) return null;
              return (
                <div key={cat} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px',
                  background: 'var(--rb-surface)', borderRadius: 8,
                }}>
                  <span style={{ fontSize: 18 }}>{CAT_ICONS[cat]}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: 'var(--rb-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{cap(cat)}</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
                    background: item.status === 'picked' ? 'var(--rb-green-s)' : item.status === 'cancelled' ? '#FEF2F2' : 'var(--rb-blue-s)',
                    color: item.status === 'picked' ? 'var(--rb-green)' : item.status === 'cancelled' ? '#DC2626' : 'var(--rb-blue)',
                  }}>
                    {item.status === 'picked' ? 'Retiré ✓' : item.status === 'cancelled' ? 'Annulé' : 'Confirmé'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }
      `}</style>
    </div>
  );
}
