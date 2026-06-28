import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import { API } from '../api';

const STATUS_STEPS = {
  // Commande sur place via QR table
  TABLE_QR: [
    { key: 'pending',   label: 'Reçue',           icon: '📥', desc: 'Votre commande a bien été reçue par le restaurant' },
    { key: 'confirmed', label: 'Confirmée',        icon: '✅', desc: 'Le personnel a confirmé votre commande' },
    { key: 'preparing', label: 'En préparation',  icon: '👨‍🍳', desc: 'Vos plats sont en cours de préparation en cuisine' },
    { key: 'ready',     label: 'En cours de service', icon: '🍽️', desc: 'Vos plats arrivent à votre table' },
    { key: 'delivered', label: 'Servie',           icon: '🎉', desc: 'Bon appétit ! Paiement auprès du serveur.' },
  ],
  // Commande en ligne — livraison
  delivery: [
    { key: 'pending',    label: 'Reçue',            icon: '📥', desc: 'Votre commande a bien été reçue' },
    { key: 'confirmed',  label: 'Confirmée',         icon: '✅', desc: 'Le restaurant a confirmé votre commande' },
    { key: 'preparing',  label: 'En préparation',   icon: '👨‍🍳', desc: 'Vos plats sont en cours de préparation' },
    { key: 'ready',      label: 'Prête',             icon: '🛎️', desc: 'Votre commande attend le livreur' },
    { key: 'on_the_way', label: 'En livraison',     icon: '🛵', desc: 'Votre livreur est en chemin' },
    { key: 'delivered',  label: 'Livrée',            icon: '🎉', desc: 'Bon appétit !' },
  ],
  // Commande en ligne — à emporter / click & collect
  takeaway: [
    { key: 'pending',   label: 'Reçue',           icon: '📥', desc: 'Votre commande a bien été reçue' },
    { key: 'confirmed', label: 'Confirmée',        icon: '✅', desc: 'Le restaurant a confirmé votre commande' },
    { key: 'preparing', label: 'En préparation',  icon: '👨‍🍳', desc: 'Vos plats sont en cours de préparation' },
    { key: 'ready',     label: 'Prête à emporter', icon: '🛎️', desc: 'Votre commande est prête, venez la récupérer' },
    { key: 'picked_up', label: 'Récupérée',       icon: '🎉', desc: 'Bonne dégustation !' },
  ],
};

function getSteps(order) {
  if (!order) return STATUS_STEPS.takeaway;
  if (order.order_source === 'TABLE_QR') return STATUS_STEPS.TABLE_QR;
  if (order.type === 'delivery') return STATUS_STEPS.delivery;
  return STATUS_STEPS.takeaway;
}

export default function OrderTrackingPage() {
  const { code } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [order, setOrder]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [showReview, setShowReview] = useState(false);
  const [rating, setRating]       = useState(5);
  const [comment, setComment]     = useState('');
  const [itemRatings, setItemRatings] = useState({});
  const [reviewSent, setReviewSent]   = useState(false);
  const justOrdered = location.state?.justOrdered;

  /* ── QR code ── */
  const [qrDataUrl, setQrDataUrl] = useState('');
  useEffect(() => {
    if (!code) return;
    QRCode.toDataURL(code, { width: 256, margin: 2, color: { dark: '#111827', light: '#FFFFFF' } })
      .then(url => setQrDataUrl(url))
      .catch(() => {});
  }, [code]);

  const qrCanvasCallback = useCallback((canvas) => {
    if (!canvas || !code) return;
    QRCode.toCanvas(canvas, code, { width: 190, margin: 2, color: { dark: '#111827', light: '#FFFFFF' } }).catch(() => {});
  }, [code]);

  /* ── Download receipt PDF ── */
  async function downloadOrderReceipt() {
    if (!order) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [90, 200] });
    const W = 90;
    let y = 0;

    // Header
    doc.setFillColor(255, 138, 0);
    doc.rect(0, 0, W, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('RestoBook', W / 2, 10, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('Confirmation de commande', W / 2, 17, { align: 'center' });
    doc.setFontSize(8);
    doc.text(order.restaurant?.name || '', W / 2, 24, { align: 'center' });
    y = 34;

    // QR code
    if (qrDataUrl) {
      const qrSize = 36;
      doc.addImage(qrDataUrl, 'PNG', (W - qrSize) / 2, y, qrSize, qrSize);
      y += qrSize + 3;
    }

    // Code
    doc.setTextColor(255, 138, 0);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text(code, W / 2, y, { align: 'center' });
    y += 5;
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text('Code de retrait / suivi', W / 2, y, { align: 'center' });
    y += 7;

    // Divider
    doc.setDrawColor(220, 220, 220);
    doc.line(8, y, W - 8, y);
    y += 5;

    // Info rows
    const infoRows = [
      ['Restaurant', order.restaurant?.name || ''],
      ['Mode', order.order_source === 'TABLE_QR' ? `Sur place — Table ${order.table_label || '—'}` : order.type === 'delivery' ? 'Livraison' : 'À emporter'],
      ['Statut', order.status],
      ['Paiement', order.payment_method === 'cash' ? 'Espèces' : order.payment_method],
    ];
    if (order.guest_name) infoRows.splice(1, 0, ['Client', order.guest_name]);
    if (order.delivery_address) infoRows.push(['Adresse', order.delivery_address]);

    doc.setFontSize(8.5);
    for (const [label, value] of infoRows) {
      doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 60);
      doc.text(label, 8, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20);
      const lines = doc.splitTextToSize(String(value), 50);
      doc.text(lines, 40, y);
      y += lines.length * 5 + 1;
    }

    // Items
    y += 3;
    doc.setDrawColor(220, 220, 220);
    doc.line(8, y, W - 8, y);
    y += 5;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(60, 60, 60);
    doc.text('Détail de la commande', 8, y);
    y += 5;

    for (const item of (order.items || [])) {
      doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20);
      const itemLabel = `${item.quantity}× ${item.libelle}`;
      const itemLines = doc.splitTextToSize(itemLabel, 52);
      doc.text(itemLines, 8, y);
      doc.setFont('helvetica', 'bold');
      doc.text(`${(item.unit_price * item.quantity).toFixed(2)} MAD`, W - 8, y, { align: 'right' });
      y += itemLines.length * 5;
      if (y > 185) break;
    }

    // Totals
    y += 3;
    doc.setDrawColor(220, 220, 220);
    doc.line(8, y, W - 8, y);
    y += 5;

    if (order.delivery_fee > 0) {
      doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100); doc.setFontSize(8);
      doc.text('Livraison', 8, y);
      doc.text(`${Number(order.delivery_fee).toFixed(2)} MAD`, W - 8, y, { align: 'right' });
      y += 5;
    }
    if (order.discount_amount > 0) {
      doc.setFont('helvetica', 'bold'); doc.setTextColor(22, 163, 74); doc.setFontSize(8);
      doc.text('Réduction', 8, y);
      doc.text(`-${Number(order.discount_amount).toFixed(2)} MAD`, W - 8, y, { align: 'right' });
      y += 5;
    }

    doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 138, 0); doc.setFontSize(11);
    doc.text('TOTAL', 8, y);
    doc.text(`${Number(order.total_amount).toFixed(2)} MAD`, W - 8, y, { align: 'right' });
    y += 7;

    // Footer
    doc.setDrawColor(220, 220, 220);
    doc.line(8, y, W - 8, y);
    y += 5;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(160, 160, 160); doc.setFontSize(7);
    doc.text('Merci pour votre commande !', W / 2, y, { align: 'center' });
    y += 4;
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} par RestoBook`, W / 2, y, { align: 'center' });

    doc.save(`commande-${code}.pdf`);
  }

  async function load() {
    try {
      const res = await fetch(API(`/marketplace/track/${code}`));
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Commande introuvable'); setLoading(false); return; }
      setOrder(data.order);
    } catch { setError('Erreur réseau'); }
    setLoading(false);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [code]);

  function updateItemRating(index, patch) {
    setItemRatings(prev => ({ ...prev, [index]: { ...(prev[index] || {}), ...patch } }));
  }

  async function sendReview() {
    if (!order) return;
    try {
      await fetch(API('/marketplace/reviews'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_slug: order.restaurant?.slug,
          pickup_code: code, rating,
          comment: comment.trim() || undefined,
          item_ratings: (order.items || []).map((item, index) => ({
            menu_item_id: item.menu_item_id, libelle: item.libelle,
            rating: itemRatings[index]?.rating || rating,
            comment: itemRatings[index]?.comment || undefined,
          }))
        })
      });
      setReviewSent(true); setShowReview(false);
    } catch {}
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
      <div style={{ width: 48, height: 48, border: '3px solid #E2E8F0', borderTopColor: '#FF8A00', borderRadius: '50%', animation: 'ot-spin .8s linear infinite' }} />
      <style>{`@keyframes ot-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ color: '#94A3B8', fontSize: 14 }}>Chargement du suivi…</div>
    </div>
  );

  if (error || !order) return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 52 }}>❌</div>
      <div style={{ color: '#DC2626', fontWeight: 700, fontSize: 16 }}>{error || 'Commande introuvable'}</div>
      <button onClick={() => navigate('/marketplace')} style={{ padding: '12px 24px', background: '#FF8A00', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>
        Retour à l'accueil
      </button>
    </div>
  );

  const steps       = getSteps(order);
  const currentIdx  = steps.findIndex(s => s.key === order.status);
  const isCancelled = order.status === 'cancelled';
  const isDone      = order.status === 'delivered';
  const currentStep = steps[currentIdx];

  /* Status hero colors */
  const heroBg = isCancelled
    ? 'linear-gradient(135deg, #7F1D1D, #DC2626)'
    : isDone
      ? 'linear-gradient(135deg, #14532D, #16A34A)'
      : 'linear-gradient(135deg, #0F172A, #1E293B)';

  const inputBase = { width: '100%', padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 13, boxSizing: 'border-box', outline: 'none' };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'Inter,system-ui,sans-serif' }}>
      <style>{`@keyframes ot-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.05);opacity:.9}}`}</style>

      {/* ── Status hero ── */}
      <div style={{ background: heroBg, padding: '40px 20px 80px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Orbe décoratif */}
        <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -30, left: -30, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,.04)', pointerEvents: 'none' }} />

        {justOrdered && !isCancelled && (
          <div style={{ marginBottom: 12, fontSize: 13, color: 'rgba(255,255,255,.75)', fontWeight: 600, letterSpacing: '.02em' }}>
            🎉 Commande envoyée avec succès !
          </div>
        )}

        <div style={{ fontSize: 56, marginBottom: 12, lineHeight: 1, animation: !isDone && !isCancelled ? 'ot-pulse 2.5s infinite' : 'none' }}>
          {isCancelled ? '❌' : isDone ? '🎉' : currentStep?.icon || '📦'}
        </div>
        <h1 style={{ margin: 0, fontSize: 'clamp(20px,4vw,30px)', fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>
          {isCancelled ? 'Commande annulée' : currentStep?.label || order.status}
        </h1>
        <div style={{ fontSize: 14, marginTop: 8, color: 'rgba(255,255,255,.75)' }}>
          {isCancelled ? "Contactez le restaurant pour plus d'informations" : currentStep?.desc || ''}
        </div>

        {/* Code badge */}
        <div style={{ marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.12)', backdropFilter: 'blur(8px)', borderRadius: 12, padding: '8px 16px', border: '1px solid rgba(255,255,255,.15)' }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', fontWeight: 600 }}>CODE</span>
          <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: 3 }}>{code}</span>
        </div>
      </div>

      {/* ── QR Code card (floats over hero) ── */}
      <div style={{ maxWidth: 560, margin: '-44px auto 0', padding: '0 20px', position: 'relative', zIndex: 10 }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: '22px 20px', boxShadow: '0 8px 32px rgba(0,0,0,.12)', border: '1.5px solid #F1F5F9', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* QR canvas */}
            <div style={{ background: '#fff', padding: 8, borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: '0 2px 10px rgba(0,0,0,.06)', flexShrink: 0 }}>
              <canvas ref={qrCanvasCallback} style={{ display: 'block' }} />
            </div>
            {/* Info + download */}
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 4 }}>Code de suivi</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--rb-orange,#FF8A00)', fontFamily: 'monospace', letterSpacing: 2, marginBottom: 4 }}>{code}</div>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 14, lineHeight: 1.5 }}>
                {order?.order_source === 'TABLE_QR' ? 'Montrez ce code au serveur si besoin' : order?.type === 'delivery' ? 'Présentez ce QR code à votre livreur' : 'Présentez ce QR code lors du retrait'}
              </div>
              <button
                onClick={downloadOrderReceipt}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: 'linear-gradient(135deg,#FF8A00,#FF5D00)', color: '#fff', border: 'none', borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: 'pointer', width: '100%', justifyContent: 'center', boxShadow: '0 4px 14px rgba(255,93,0,.28)', fontFamily: 'inherit' }}
              >
                ⬇ Télécharger le reçu
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 560, margin: '0 auto 0', padding: '0 20px 60px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Temps estimé */}
        {order.estimated_ready_at && !isDone && !isCancelled && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '18px 22px', boxShadow: '0 4px 20px rgba(0,0,0,.08)', border: '1.5px solid #FED7AA', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#92400E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Heure estimée</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--rb-orange,#FF8A00)' }}>
              {new Date(order.estimated_ready_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        )}

        {/* Timeline */}
        {!isCancelled && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', boxShadow: '0 4px 20px rgba(0,0,0,.06)', border: '1px solid #F1F5F9' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20, color: '#0F172A' }}>Suivi de commande</div>
            <div style={{ position: 'relative' }}>
              {/* Vertical connector line */}
              <div style={{ position: 'absolute', left: 15, top: 16, bottom: 16, width: 2, background: '#F1F5F9', zIndex: 0 }} />

              {steps.filter(s => s.key !== 'cancelled').map((step, idx) => {
                const done   = idx <= currentIdx;
                const active = idx === currentIdx;
                const future = idx > currentIdx;
                return (
                  <div key={step.key} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', position: 'relative', zIndex: 1, marginBottom: idx < steps.length - 1 ? 24 : 0 }}>
                    {/* Circle */}
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: active ? 16 : 13,
                      background: active ? 'var(--rb-orange,#FF8A00)' : done ? '#16A34A' : '#fff',
                      border: `2px solid ${active ? 'var(--rb-orange,#FF8A00)' : done ? '#16A34A' : '#E2E8F0'}`,
                      color: done || active ? '#fff' : '#94A3B8',
                      boxShadow: active ? '0 0 0 5px rgba(234,88,12,.15)' : 'none',
                      transition: 'all .3s',
                    }}>
                      {future ? <span style={{ fontSize: 11, fontWeight: 700 }}>{idx + 1}</span>
                        : active ? step.icon
                        : '✓'}
                    </div>

                    {/* Text */}
                    <div style={{ paddingTop: 4, flex: 1 }}>
                      <div style={{
                        fontSize: 14, fontWeight: active ? 700 : 500,
                        color: future ? '#94A3B8' : '#0F172A',
                        transition: 'color .3s',
                      }}>
                        {step.label}
                      </div>
                      {active && (
                        <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>{step.desc}</div>
                      )}
                    </div>

                    {/* Done timestamp placeholder */}
                    {done && !active && (
                      <div style={{ fontSize: 11, color: '#22C55E', fontWeight: 600, paddingTop: 4 }}>✓</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Restaurant info */}
        {order.restaurant && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '18px 22px', boxShadow: '0 4px 20px rgba(0,0,0,.06)', border: '1px solid #F1F5F9' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Restaurant</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>{order.restaurant.name}</div>
            {order.restaurant.phone && (
              <a href={`tel:${order.restaurant.phone}`} style={{ fontSize: 13, color: 'var(--rb-orange,#FF8A00)', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                📞 {order.restaurant.phone}
              </a>
            )}
          </div>
        )}

        {/* Order detail */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '18px 22px', boxShadow: '0 4px 20px rgba(0,0,0,.06)', border: '1px solid #F1F5F9' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>Détail de la commande</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(order.items || []).map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: '#374151' }}><span style={{ fontWeight: 700, color: '#0F172A' }}>{item.quantity}×</span> {item.libelle}</span>
                <span style={{ fontWeight: 600, color: '#0F172A' }}>{(item.unit_price * item.quantity).toFixed(2)} MAD</span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid #F1F5F9', marginTop: 14, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {order.delivery_fee > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748B' }}>
                <span>Frais de livraison</span><span>{Number(order.delivery_fee).toFixed(2)} MAD</span>
              </div>
            )}
            {order.discount_amount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#16A34A', fontWeight: 700 }}>
                <span>Réduction</span><span>-{Number(order.discount_amount).toFixed(2)} MAD</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16, borderTop: '1px solid #F1F5F9', paddingTop: 12, marginTop: 4 }}>
              <span style={{ color: '#0F172A' }}>Total</span>
              <span style={{ color: 'var(--rb-orange,#FF8A00)' }}>{Number(order.total_amount).toFixed(2)} MAD</span>
            </div>
          </div>

          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#94A3B8', background: '#F8FAFC', padding: '3px 10px', borderRadius: 20, border: '1px solid #E2E8F0' }}>
              💳 {order.payment_method === 'cash' ? 'Espèces' : order.payment_method}
            </span>
            {order.delivery_address && (
              <span style={{ fontSize: 11, color: '#94A3B8', background: '#F8FAFC', padding: '3px 10px', borderRadius: 20, border: '1px solid #E2E8F0' }}>
                📍 {order.delivery_address}
              </span>
            )}
          </div>
        </div>

        {/* Review */}
        {isDone && !reviewSent && !showReview && (
          <button onClick={() => setShowReview(true)} style={{
            padding: '16px', background: '#fff',
            border: '2px solid var(--rb-orange,#FF8A00)',
            borderRadius: 16, color: 'var(--rb-orange,#FF8A00)',
            fontWeight: 700, fontSize: 15, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'background .15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background='#FFF7ED'}
            onMouseLeave={e => e.currentTarget.style.background='#fff'}
          >
            ⭐ Donner mon avis
          </button>
        )}

        {reviewSent && (
          <div style={{ padding: '18px', background: '#F0FDF4', borderRadius: 16, textAlign: 'center', color: '#16A34A', fontWeight: 700, border: '1.5px solid #BBF7D0', fontSize: 15 }}>
            ✓ Merci pour votre avis ! C'est très précieux.
          </div>
        )}

        {showReview && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', boxShadow: '0 4px 20px rgba(0,0,0,.08)', border: '1px solid #F1F5F9' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: '#0F172A' }}>⭐ Votre avis</div>

            {/* Global rating */}
            <div style={{ marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Note globale</div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                {[1,2,3,4,5].map(s => (
                  <span key={s} onClick={() => setRating(s)} style={{
                    fontSize: 32, cursor: 'pointer', transition: 'transform .1s, opacity .15s',
                    opacity: s <= rating ? 1 : 0.25,
                    transform: s <= rating ? 'scale(1.1)' : 'scale(1)',
                  }}>⭐</span>
                ))}
              </div>
            </div>

            {/* Per-item ratings */}
            {(order.items || []).length > 1 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Notes par plat</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(order.items || []).map((item, index) => (
                    <div key={index} style={{ border: '1px solid #F1F5F9', borderRadius: 12, padding: '12px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>{item.quantity}× {item.libelle}</div>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                        {[1,2,3,4,5].map(s => (
                          <span key={s} onClick={() => updateItemRating(index, { rating: s })} style={{
                            fontSize: 20, cursor: 'pointer',
                            opacity: s <= (itemRatings[index]?.rating || rating) ? 1 : 0.25,
                          }}>⭐</span>
                        ))}
                      </div>
                      <input
                        value={itemRatings[index]?.comment || ''}
                        onChange={e => updateItemRating(index, { comment: e.target.value })}
                        placeholder="Commentaire (optionnel)"
                        style={{ ...inputBase }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <textarea value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Votre commentaire général (optionnel)…" rows={3}
              style={{ ...inputBase, resize: 'vertical', marginBottom: 14 }} />

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowReview(false)} style={{
                flex: 1, padding: '12px', border: '1.5px solid #E2E8F0', borderRadius: 10,
                cursor: 'pointer', background: '#fff', fontSize: 14, fontWeight: 600, color: '#374151',
              }}>Annuler</button>
              <button onClick={sendReview} style={{
                flex: 2, padding: '12px',
                background: 'var(--rb-orange,#FF8A00)', color: '#fff',
                border: 'none', borderRadius: 10,
                cursor: 'pointer', fontWeight: 700, fontSize: 14,
                boxShadow: '0 4px 12px rgba(234,88,12,.3)',
              }}>Envoyer mon avis</button>
            </div>
          </div>
        )}

        {/* Back button */}
        <button onClick={() => navigate('/marketplace')} style={{
          padding: '14px', background: '#fff',
          border: '1.5px solid #E2E8F0', borderRadius: 16,
          color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          ← Retour à l'accueil
        </button>
      </div>
    </div>
  );
}
