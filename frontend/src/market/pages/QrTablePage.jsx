import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API } from '../../api';
import { useCart } from '../../contexts/CartContext';

export default function QrTablePage() {
  const { slug, token } = useParams();
  const navigate = useNavigate();
  const { setTableContext } = useCart();
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [info, setInfo]       = useState(null);

  useEffect(() => {
    fetch(API(`/marketplace/qr/${slug}/${token}`))
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return; }
        setInfo(d);
        // Persister le contexte table dans le CartContext (survit à la navigation)
        setTableContext(d.org.slug, d.org.name, d.table.label, d.table.id);
        setLoading(false);
        setTimeout(() => {
          navigate(`/r/${d.org.slug}`, { state: { fromQR: true } });
        }, 1800);
      })
      .catch(() => { setError('Erreur réseau'); setLoading(false); });
  }, [slug, token]);

  const goToMenu = () => {
    if (!info) return;
    navigate(`/r/${info.org.slug}`, { state: { fromQR: true } });
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)' }}>
      <div style={{ fontSize: 48 }}>⏳</div>
      <div style={{ fontSize: 16, color: '#6B7280' }}>Chargement du menu…</div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 24 }}>
      <div style={{ fontSize: 48 }}>❌</div>
      <div style={{ fontWeight: 700, color: '#DC2626' }}>QR Code invalide</div>
      <div style={{ color: '#6B7280', textAlign: 'center', fontSize: 14 }}>{error}</div>
      <button onClick={() => navigate('/marketplace')} style={{ padding: '12px 24px', background: 'var(--rb-orange,#FF8A00)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>Aller au marketplace</button>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20, padding: 24 }}>
      <div style={{ fontSize: 56 }}>🍽️</div>

      <div style={{ background: '#fff', borderRadius: 20, padding: '28px 32px', textAlign: 'center', boxShadow: '0 8px 32px rgba(234,88,12,0.12)', maxWidth: 340, width: '100%' }}>
        <div style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
          {info.table.floor || 'Table'}
        </div>
        <div style={{ fontSize: 48, fontWeight: 900, color: 'var(--rb-orange,#FF8A00)', lineHeight: 1 }}>
          {info.table.label}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginTop: 8 }}>{info.org.name}</div>
        <div style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>{info.org.city}</div>

        {/* Badge confirmation contexte table */}
        <div style={{ marginTop: 16, background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 10, padding: '8px 14px', fontSize: 13, color: '#15803D', fontWeight: 600 }}>
          ✓ Commande sur place activée
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#FF8A00', fontWeight: 700 }}>
        <div style={{ width: 24, height: 24, border: '3px solid #FF8A00', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        Ouverture du menu…
      </div>

      <button onClick={goToMenu} style={{ padding: '13px 28px', background: 'var(--rb-orange,#FF8A00)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
        Voir le menu maintenant →
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
